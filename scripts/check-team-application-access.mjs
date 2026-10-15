import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';
const dir=await mkdtemp(tmpdir()+'/labula-app-access-'),auth=new AsyncLocalStorage();
const db=new DatabaseSync(':memory:');for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
let beforeBatch=null,beforeQuery=null,queryFailure=false;const metrics={trips:0,queries:0};
const stmt=(sql,args=[])=>({sql,args,bind(...a){return stmt(sql,a)},async first(){metrics.trips++;return this.exec().results[0]??null},async all(){metrics.trips++;return this.exec()},async run(){return this.all()},exec(){metrics.queries++;if(queryFailure)throw Error('Synthetic DB unavailable');if(beforeQuery)beforeQuery(sql,args);const q=db.prepare(sql);return q.columns().length?{results:q.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(q.run(...args).changes)}}}});
const base={prepare:stmt,async batch(ss){metrics.trips++;if(beforeBatch){const hook=beforeBatch;if(hook(ss)!==false)beforeBatch=null;}db.exec('BEGIN');try{const rs=ss.map(s=>s.exec());db.exec('COMMIT');return rs}catch(e){db.exec('ROLLBACK');throw e}}};
globalThis.accessTestDb=base;globalThis.accessTestIdentity=auth;
try{
 await writeFile(dir+'/env.ts','export const env={BUCKET:globalThis.photoTestBucket};');
 await writeFile(dir+'/db.ts',`import {accessContext,guardDatabase} from '@/lib/access-context';export const getRawDb=()=>{const c=accessContext.getStore();return c?guardDatabase(globalThis.accessTestDb,c):globalThis.accessTestDb;};export const getAppAccessMode=()=>"application";`);
 await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.accessTestIdentity.getStore()??null;');
 const routes=[];async function scan(path){for(const f of await readdir(path,{withFileTypes:true})){if(f.isDirectory())await scan(path+'/'+f.name);else if(f.name==='route.ts')routes.push(path+'/'+f.name);}}await scan('app/api');
 const exports=routes.map((r,i)=>`export * as r${i} from './${r}';`).join('');
 await build({stdin:{contents:exports+"export * from './lib/notebook';export {TeamController} from './lib/team-client';export {EveningController} from './lib/evening-client';export {permittedMember} from './lib/team-access-server';export {protectedApi} from './lib/protected-api';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'cloudflare:workers':dir+'/env.ts','@/lib/access-context':process.cwd()+'/lib/access-context.ts','@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/test.mjs');const gaps=[];
 const users={owner:{userId:'owner',email:'owner@example.test'},manager:{userId:'manager',email:'manager@example.test'},cook:{userId:'cook',email:'cook@example.test'},legacy:{userId:'legacy',email:'legacy@example.test'},unlisted:{userId:'unlisted',email:'unlisted@example.test'},disabled:{userId:'disabled',email:'disabled@example.test'}};
 const provision=(user,role,enabled=1)=>db.prepare('INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES(?,?,?,?,?,1,?,0,?)').run(crypto.randomUUID(),user.userId,user.email,user.email,role,enabled,new Date().toISOString());
 for(const role of ['owner','manager','cook','legacy','disabled'])provision(users[role],role==='owner'||role==='disabled'?'legacy':role,role==='disabled'?0:1);
 db.prepare("INSERT INTO kitchen_owner VALUES('owner','owner')").run();
 const notebook=m.initialNotebook();notebook.items=[{...m.newItem('Synthetic broth','prep'),id:'synthetic-broth'}];db.prepare('INSERT INTO notebooks VALUES(?,?,?,?,?)').run('kitchen',JSON.stringify(notebook),0,new Date().toISOString(),'synthetic');
 const api=path=>m['r'+routes.indexOf('app/api/'+path+'/route.ts')];
 const request=(path,method='GET',body={},revision=0)=>new Request('http://test.local/api/'+path,{method,headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(revision),'X-Labula-Stations':'4'},...(method==='GET'?{}:{body:JSON.stringify(body)})});
 const call=(user,path,method='GET',body={},revision=0)=>auth.run(user,()=>api(path)[method](request(path,method,body,revision)));
 const json=async(r,status=200)=>{const text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text)};
 const row=user=>db.prepare('SELECT * FROM kitchen_team WHERE user_id=?').get(user.userId);
 const dump=()=>JSON.stringify(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(t=>[t.name,db.prepare('SELECT * FROM '+t.name+' ORDER BY rowid').all()]));
 // Complete current API inventory. Anonymous/unlisted/disabled are denied BEFORE
 // body parsing, domain validation or idempotent replay, with no mutation.
 const inventory=[];
 for(let i=0;i<routes.length;i++){
  const path=routes[i].slice(8,-9);const source=await readFile(routes[i],'utf8');const maintenance=path==='workspace-maintenance';assert(/protectedApi\(/.test(source)||/export \{POST,dynamic\} from/.test(source)||(maintenance&&/export const GET=workspaceMaintenance;\s*export const POST=workspaceMaintenance;/.test(source)),routes[i]);
  for(const method of ['GET','POST','PUT','DELETE','PATCH'])if(m['r'+i][method]){
   const scope=source.match(new RegExp('export const '+method+"=protectedApi\\('([^']+)'"))?.[1]??'workspace';inventory.push({path,method,scope,maintenance,roles:maintenance?['owner']:scope==='management'?['owner','manager']:scope==='workspace'?['owner','manager','legacy']:['owner','manager','cook','legacy']});for(const [user,status] of [[null,401],[users.unlisted,403],[users.disabled,403]]){const before=dump();const response=await auth.run(user,()=>m['r'+i][method](request(path,method)));assert.equal(response.status,status,routes[i]+' '+method);assert.match(response.headers.get('cache-control'),/no-store/);assert.equal(dump(),before,'denied request is read-only');}
  }
 }
 assert.equal(inventory.length,routes.reduce((n,r)=>n+Object.keys(m['r'+routes.indexOf(r)]).filter(k=>['GET','POST','PUT','DELETE','PATCH'].includes(k)).length,0));assert(inventory.length>=30);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_team WHERE user_id=?').get('unlisted').n,0);
 for(const path of ['notebook','private-backup','catalog','review-workflow','team?management=1'])if(!path.includes('?'))await json(await call(users.cook,path),403);
 await json(await call(users.owner,'notebook'));await json(await call(users.manager,'notebook'));await json(await call(users.legacy,'notebook'));

 // Every discovered method is checked against its declared guard and actual
 // request-scoped member roles; allowed malformed writes may fail validation.
 for(const entry of inventory)for(const role of ['owner','manager','cook','legacy']){
  const probe=m.protectedApi(entry.scope,async()=>Response.json({guardPassed:true}));const response=await auth.run(users[role],()=>probe(request(entry.path,entry.method))),body=await response.json();
  if(!entry.maintenance){if(!entry.roles.includes(role)){assert.equal(response.status,403,entry.path+' '+entry.method+' '+role);}
  else {assert.equal(response.status,200,entry.path+' '+entry.method+' '+role+' should pass central guard');assert.equal(body.guardPassed,true);}}
  const actual=await call(users[role],entry.path,entry.method),actualBody=await actual.json();entry.actualRoles??={};entry.actualRoles[role]={status:actual.status,code:actualBody.code??null};
  if(!entry.roles.includes(role))assert.equal(actual.status,403,entry.path+' '+entry.method+' '+role+' actual route denies');
  else {assert.notEqual(actual.status,401);assert(!['access_not_granted','access_not_linked','identity_conflict'].includes(actualBody.code),'listed role reached actual handler');}
 }
 provision({userId:'invalid-role',email:'invalid@example.test'},'invalid');
 const invalid={userId:'invalid-role',email:'invalid@example.test'};
 for(const entry of inventory){const before=dump();const denied=await json(await call(invalid,entry.path,entry.method),403);assert.equal(denied.code,'role_restricted');assert.equal(dump(),before);}
 const identityRequest=request('team');identityRequest.headers.set('X-Labula-Account-Id','owner');
 const mismatch=await json(await auth.run(users.manager,()=>api('team').GET(identityRequest)),403);assert.equal(mismatch.code,'account_changed');
 const beforeFailure=dump();queryFailure=true;
 try{for(const entry of inventory){const denied=await json(await call(users.owner,entry.path,entry.method),503);assert.equal(denied.code,entry.maintenance?'maintenance_unavailable':'access_check_failed');}}finally{queryFailure=false;}
 assert.equal(dump(),beforeFailure,'DB failure must not create legacy access');
 // Post-handler recheck must withhold a notebook that was read before revocation.
 beforeQuery=(sql)=>{if(sql.startsWith('SELECT payload,revision,updated_at,updated_by FROM notebooks')){beforeQuery=null;db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='legacy'").run();}};
 const withheld=await json(await call(users.legacy,'notebook'),403);assert.equal(withheld.code,'access_not_granted');assert(!withheld.data);db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='legacy'").run();

 // The response recheck must use the narrower scope of sensitive GETs. A
 // manager-to-legacy demotion still allows general workspace reads, so only
 // an explicit management scope prevents releasing the already-read payload.
 for(const [path,query,match] of [
  ['team','management=1',sql=>sql.startsWith('SELECT * FROM kitchen_team ORDER BY')],
  ['prep-notes','ingredient=synthetic-broth',sql=>sql.startsWith('SELECT * FROM prep_instructions WHERE')],
  ['prep-instructions','',sql=>sql.startsWith('SELECT item_id,text,revision,updated_at,updated_by FROM prep_instructions')],
  ['operations','mode=overview',sql=>sql.includes('FROM evening_checks c WHERE')],
 ]){
  let hit=false;beforeQuery=sql=>{if(match(sql)){hit=true;beforeQuery=null;db.prepare("UPDATE kitchen_team SET access_role='legacy' WHERE user_id='manager'").run();}};
  try{const res=await auth.run(users.manager,()=>api(path).GET(new Request('http://test.local/api/'+path+'?'+query,{headers:{'X-Labula-Stations':'4'}})));assert(hit,path+' sensitive read reached');await json(res,403);}catch(e){gaps.push(path+' narrow GET demotion: '+e.message);}finally{beforeQuery=null;db.prepare("UPDATE kitchen_team SET access_role='manager' WHERE user_id='manager'").run();}
 }
 const cookSelf=await json(await call(users.cook,'team'));assert.equal(cookSelf.members.length,1);assert.equal(cookSelf.members[0].userId,'cook');
 await json(await auth.run(users.cook,()=>api('team').GET(new Request('http://test.local/api/team?management=1'))),403);
 const save=(body,user=users.owner,status=200)=>call(user,'team','POST',body).then(r=>json(r,status));
 const command={id:crypto.randomUUID(),kind:'add',name:'',email:' NEW@Example.test '};await save(command);await save(command);
 let added=db.prepare('SELECT * FROM kitchen_team WHERE email=?').get('new@example.test');assert.equal(added.name,'new@example.test');assert.equal(added.access_enabled,1);assert.equal(added.access_role,'cook');assert.equal(added.user_id,null);
 assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(command.id).n,1);
 await save({...command,id:crypto.randomUUID()},users.owner,409);

 const invalidEmail={id:crypto.randomUUID(),kind:'add',email:'not-an-email',name:''};await save(invalidEmail,users.owner,400);assert.equal(db.prepare('SELECT count(*) n FROM team_commands WHERE id=?').get(invalidEmail.id).n,0);
 // Different verified identities racing the same first-link email cannot both win.
 const linkCommand={id:crypto.randomUUID(),kind:'add',email:'link-race@example.test',name:''};await save(linkCommand);
 const linkUsers=[{userId:'first-link-one',email:linkCommand.email},{userId:'first-link-two',email:linkCommand.email}];
 const linkRace=await Promise.all(linkUsers.map(user=>call(user,'team')));assert.deepEqual(linkRace.map(r=>r.status).sort(),[200,403]);
 const linkWinner=db.prepare('SELECT user_id FROM kitchen_team WHERE id=?').get(linkCommand.id).user_id;assert(linkUsers.some(user=>user.userId===linkWinner));assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='link' AND item_id=?").get(linkCommand.id).n,1);
 assert.equal(db.prepare("SELECT actor_id FROM kitchen_activity WHERE action='link' AND item_id=?").get(linkCommand.id).actor_id,linkWinner);
 // Two simultaneous first sign-ins bind the SAME profile once, stable identity
 // wins. A different identity using that email is rejected, not re-linked.
 const first={userId:'new',email:'new@example.test',fullName:'New Chef'};const replies=await Promise.all([call(first,'team'),call(first,'team')]);assert(replies.every(r=>r.status===200));added=row(first);assert.equal(added.id,command.id);assert.equal(added.name,'New Chef');assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='link' AND item_id=?").get(added.id).n,1);
 await json(await call({userId:'imposter',email:first.email},'team'),403);await json(await call({...users.cook,email:first.email},'team'));assert.equal(row(users.cook).email,users.cook.email,'stable identity, no email takeover');
 await save({id:crypto.randomUUID(),kind:'access',memberId:row(users.owner).id,revision:0,enabled:false},users.owner,409);
 await save({id:crypto.randomUUID(),kind:'access',memberId:row(users.manager).id,revision:0,enabled:false},users.manager,409);
 await save({id:crypto.randomUUID(),kind:'role',memberId:row(users.manager).id,revision:0,role:'cook'},users.manager,409);
 // Disable, restore, audit, legacy stock pause and old edits cannot restore entry.
 const disable={id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:added.revision,enabled:false};await save(disable);await json(await call(first,'team'),403);
 db.prepare('UPDATE kitchen_team SET active=0 WHERE id=?').run(added.id);
 await save({id:crypto.randomUUID(),kind:'edit',memberId:added.id,revision:row(first).revision,name:'Renamed',active:false});assert.equal(row(first).access_enabled,0);
 await save({id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:row(first).revision,enabled:true});assert.equal(row(first).active,0);assert.equal(row(first).id,command.id);await json(await call(first,'evening'),403);db.prepare('UPDATE kitchen_team SET active=1 WHERE id=?').run(added.id);

 // An exact old restore receipt is a result lookup, never authority to undo a
 // subsequent disable. A duplicate disabled email cannot create another person.
 await save({id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:row(first).revision,enabled:false});
 const restore={id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:row(first).revision,enabled:true};await save(restore);
 await save({id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:row(first).revision,enabled:false});const latestRevision=row(first).revision;await save(restore);assert.equal(row(first).access_enabled,0);assert.equal(row(first).revision,latestRevision);
 await save({id:crypto.randomUUID(),kind:'add',email:first.email.toUpperCase(),name:''},users.owner,409);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_team WHERE lower(email)=?').get(first.email).n,1);assert.equal(row(first).access_enabled,0);
 await save({id:crypto.randomUUID(),kind:'access',memberId:added.id,revision:row(first).revision,enabled:true});
 // Atomic revocation after request authorization but BEFORE the actual batch.
 beforeBatch=()=>db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='manager'").run();const attempted={id:crypto.randomUUID(),kind:'add',name:'',email:'not-created@example.test'};await save(attempted,users.manager,403);assert.equal(db.prepare('SELECT count(*) n FROM team_commands WHERE id=?').get(attempted.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_team WHERE email=?').get(attempted.email).n,0);
 db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='manager'").run();
 // Demotion during a privileged note transaction, guard created before escalation.
 beforeBatch=()=>db.prepare("UPDATE kitchen_team SET access_role='cook' WHERE user_id='manager'").run();await json(await call(users.manager,'prep-notes','POST',{id:crypto.randomUUID(),kind:'instruction',actorId:'manager',itemId:'synthetic-broth',revision:0,text:'Synthetic instruction'}),403);assert.equal(db.prepare('SELECT count(*) n FROM prep_instruction_versions').get().n,0);db.prepare("UPDATE kitchen_team SET access_role='manager' WHERE user_id='manager'").run();
 // Revocation of a workspace write rolls back notebook + receipt together.
 beforeBatch=()=>db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='legacy'").run();await json(await call(users.legacy,'notebook','PUT',notebook),403);assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,0);db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='legacy'").run();

 // Escalated management scope survives inside a real review save. Demotion to
 // legacy retains workspace entry but cannot commit manager-only review facts.
 const reviewStart=await json(await call(users.manager,'review-workflow','POST',{operationId:crypto.randomUUID(),action:'start2'}));
 const reviewDraft=structuredClone(reviewStart.record.data);reviewDraft.entities.find(e=>e.kind==='manager').name='Synthetic privileged edit';
 const reviewId=crypto.randomUUID();beforeBatch=ss=>{if(!ss.some(s=>s.sql.includes('INSERT INTO data_review_commands')))return false;db.prepare("UPDATE kitchen_team SET access_role='legacy' WHERE user_id='manager'").run();};
 await json(await call(users.manager,'review-workflow','POST',{operationId:reviewId,action:'save2',clientVersion:5,data:reviewDraft},reviewStart.record.revision),403);
 assert.equal(db.prepare('SELECT count(*) n FROM data_review_commands WHERE id=?').get(reviewId).n,0);assert.equal(db.prepare('SELECT revision FROM data_reviews').get().revision,reviewStart.record.revision);db.prepare("UPDATE kitchen_team SET access_role='manager' WHERE user_id='manager'").run();
 // One existing transaction barrier blocks the whole rapid-tap batch, Finish
 // publication, and Ready, with no receipts, authorship or plan mutations.
 await json(await call(users.cook,'evening'));db.prepare("UPDATE stock_items SET track=1,round_id='daily',round_revision=round_revision+1,round_source='owner:synthetic',revision=revision+1 WHERE item_id='synthetic-broth'").run();
 const day='2026-10-04',cmd=c=>({id:crypto.randomUUID(),scope:'kitchen',actorId:'cook',...c});
 const evening=()=>auth.run(users.cook,()=>api('evening').GET(new Request('http://test.local/api/evening?day='+day,{headers:{'X-Labula-Stations':'4'}}))).then(r=>json(r));
 await json(await call(users.cook,'evening','POST',cmd({kind:'start',day,targetDay:'2026-10-05'})));
 let snap=await evening();const answer=cmd({kind:'answer',checkId:day,itemId:'synthetic-broth',revision:0,generation:0,value:'missing',deviceId:crypto.randomUUID(),sequence:1});
 const revokeWhen=fragment=>{beforeBatch=ss=>{if(!ss.some(s=>s.sql.includes(fragment)))return false;db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='cook'").run();};};
 const restoreCook=()=>db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='cook'").run();
 revokeWhen('INSERT INTO evening_commands');await json(await call(users.cook,'evening/batch','POST',{commands:[answer]}),403);assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(answer.id).n,0);assert.equal(db.prepare('SELECT value FROM evening_answers').get().value,null);restoreCook();

 // An invalid role introduced after entry authorization must also fail at the
 // SQL commit barrier, not merely be noticed after the mutation already saved.
 beforeBatch=ss=>{if(!ss.some(s=>s.sql.includes('INSERT INTO evening_commands')))return false;db.prepare("UPDATE kitchen_team SET access_role='invalid' WHERE user_id='cook'").run();};
 try{await json(await call(users.cook,'evening/batch','POST',{commands:[answer]}),403);assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(answer.id).n,0);assert.equal(db.prepare('SELECT value FROM evening_answers').get().value,null);}catch(e){gaps.push('invalid role commit barrier: '+e.message);}finally{beforeBatch=null;db.prepare("UPDATE kitchen_team SET access_role='cook' WHERE user_id='cook'").run();}
 await json(await call(users.cook,'evening/batch','POST',{commands:[answer]}));snap=await evening();
 const finish=cmd({kind:'confirm',checkId:day,revision:snap.check.revision,planRevision:snap.check.planRevision,notebookRevision:snap.notebookRevision});
 revokeWhen('INSERT INTO evening_versions');await json(await call(users.cook,'evening','POST',finish),403);assert.equal(db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM morning_tasks').get().n,0);assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(finish.id).n,0);restoreCook();
 await json(await call(users.cook,'evening','POST',finish));
 const ready=cmd({kind:'ready',checkId:day,itemId:'synthetic-broth',revision:0,value:true});
 revokeWhen('INSERT INTO evening_commands');await json(await call(users.cook,'evening/batch','POST',{commands:[ready]}),403);assert.equal(db.prepare('SELECT ready FROM morning_tasks').get().ready,0);assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(ready.id).n,0);
 // Revoked identity cannot use an old committed receipt to retrieve private data.
 await json(await call(users.cook,'evening','POST',finish),403);restoreCook();await json(await call(users.cook,'evening/batch','POST',{commands:[ready]}));assert.equal(db.prepare('SELECT ready FROM morning_tasks').get().ready,1);
 // Lost reply after commit, durable original replay, different account refused.
 const values=new Map(),storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};let lose=true,actor=users.owner;
 const transport=async(url,init={})=>{const q=url.includes('?')?'team':'team';const res=await auth.run(actor,()=>init.method?api(q).POST(request('team','POST',JSON.parse(init.body))):api(q).GET(new Request('http://test.local'+url)));const body=await res.json();if(init.method&&lose){lose=false;throw Error('Lost reply after commit');}return {res,body}};
 const controller=new m.TeamController(users.owner.email,storage,()=>{},transport);await controller.refresh();const intent={id:crypto.randomUUID(),kind:'add',name:'',email:'lost@example.test'};assert.equal(await controller.save(intent),false);let pending=controller.state.pending[0];actor=users.manager;assert.equal(await controller.save(pending.command,pending.key),false);assert(values.has(pending.key));actor=users.owner;assert.equal(await controller.save(pending.command,pending.key),true);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(intent.id).n,1);controller.dispose();
 // Request-scoped identities with real AsyncLocalStorage, never a global user.
 const same={id:crypto.randomUUID(),kind:'add',name:'',email:'parallel@example.test'};const race=await Promise.all([call(users.owner,'team','POST',same),call(users.manager,'team','POST',{...same,id:crypto.randomUUID()})]);assert.deepEqual(race.map(r=>r.status).sort(),[200,409]);const event=db.prepare('SELECT actor_id FROM kitchen_activity WHERE item_name=?').get(same.email);assert.equal(event.actor_id,'owner');
 assert.equal(db.prepare('SELECT count(*) n FROM access_write_guards').get().n,0);
 // Migration initialized exactly the proved three current IDs; replay of the
 // initialization is not part of login and never reactivates disabled people.
 const migration=await readFile('drizzle/0018_application_access.sql','utf8');assert.match(migration,/WHERE user_id IN/);assert(!/UPDATE kitchen_team SET access_enabled=1;/.test(migration));
 await writeFile(dir+'/route-coverage.json',JSON.stringify(inventory,null,2));
 assert.deepEqual(gaps,[],'No sensitive read or commit authorization gaps');
 console.log('PASS application access: '+inventory.length+' direct API methods; anonymous/unlisted/disabled; first-link race; owner/self protection; access/stock separation; complete four-role guard matrix; invalid role/DB failure fail closed; expected-account identity mismatch; withheld read and sensitive GET demotion; invalid-role commit rollback; Evening batch/Finish/Ready revocation; review manager-to-legacy demotion; transactional revocation/demotion; original lost-ACK retry; concurrent identities and zero leaked guard rows.');
}finally{db.close();delete globalThis.accessTestDb;delete globalThis.accessTestIdentity;await rm(dir,{recursive:true,force:true});}
