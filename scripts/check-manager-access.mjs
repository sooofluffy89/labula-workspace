import {fixtureAuthSource} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(tmpdir()+'/labula-activity-');
try{
 const db=new DatabaseSync(':memory:');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
 let failEvent=false,concurrent=null;
 const stmt=(sql,args=[])=>({bind(...a){return stmt(sql,a)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){if(failEvent&&sql.includes('INSERT OR IGNORE INTO kitchen_activity')){failEvent=false;throw Error('event write failed')}const s=db.prepare(sql);return s.columns().length?{results:s.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(s.run(...args).changes)}}}});
 globalThis.activityDb={prepare:stmt,async batch(ss){if(concurrent){const fn=concurrent;concurrent=null;fn();}db.exec('BEGIN');try{const r=ss.map(s=>s.exec());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.activityDb;export const getAppAccessMode=()=>"application";');await writeFile(dir+'/auth.ts',fixtureAuthSource('globalThis.activityUser','globalThis.activityDb'));
 await build({stdin:{contents:`export * as evening from './app/api/evening/route';export * as stock from './app/api/stock/route';export * as team from './app/api/team/route';export * as activity from './app/api/activity/route';export * from './lib/notebook';export * from './lib/evening-client';export * from './lib/activity';export * from './lib/team-client';export * as notebookApi from './app/api/notebook/route';export * as backup from './app/api/private-backup/route';export * as catalog from './app/api/catalog/route';export * as notes from './app/api/prep-notes/route';export * as instructions from './app/api/prep-instructions/route';export * as rounds from './app/api/check-rounds/route';export * as calendar from './app/api/operating-calendar/route';export * as review from './app/api/review-workflow/route';export * as operations from './app/api/operations/route';export {canManage,owner} from './lib/notebook-server';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/test.mjs');

 const owner={userId:'owner',email:'jan@bananasport.cz',fullName:'Owner'},manager={userId:'manager',email:'manager@example.test',fullName:'Manager'},legacy={userId:'legacy',email:'legacy@example.test',fullName:'Legacy'};
 const req=(path='team?management=1',body,revision=0)=>new Request('http://test.local/api/'+path,body===undefined?{}:{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify(body)});
 const send=async(api,path,body,status=200,revision=0)=>{const r=await api.POST(req(path,body,revision)),text=await r.text();assert.equal(r.status,status,text);return JSON.parse(text)};
 const read=async(api,path,status=200)=>{const r=await api.GET(req(path));assert.equal(r.status,status,await r.clone().text());return r.json()};
 const row=id=>db.prepare('SELECT * FROM kitchen_team WHERE user_id=?').get(id);
 const role=(r,role)=>({id:crypto.randomUUID(),kind:'role',memberId:r.id,revision:r.revision,role});
 const edit=(r,extra={})=>({id:crypto.randomUUID(),kind:'edit',memberId:r.id,revision:r.revision,name:r.name,active:!!r.active,...extra});
 globalThis.activityUser=owner;await read(m.notebookApi,'notebook');await m.team.GET();
 globalThis.activityUser=manager;await m.team.GET();globalThis.activityUser=legacy;await m.team.GET();
 assert.equal(row('manager').access_role,'legacy');assert.equal(await m.canManage(manager),false);
 await send(m.team,'team',role(row('manager'),'manager'),403);
 globalThis.activityUser=owner;const grant=role(row('manager'),'manager');await send(m.team,'team',grant);await send(m.team,'team',grant);
 assert.equal(row('manager').revision,1);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(grant.id).n,1);
 const audit=db.prepare('SELECT * FROM kitchen_activity WHERE command_id=?').get(grant.id);assert.equal(audit.actor_id,'owner');assert.equal(JSON.parse(audit.before_value).role,'legacy');assert.equal(JSON.parse(audit.after_value).role,'manager');assert.equal(JSON.parse(audit.after_value).userId,'manager');assert.ok(audit.recorded_at);
 globalThis.activityUser=manager;assert.equal(await m.owner(manager),false);assert.equal(await m.canManage(manager),true);
 let directory=await read(m.team,'team?management=1');assert.equal(directory.isOwner,false);assert.equal(directory.canManage,true);
 let notebook=await read(m.notebookApi,'notebook');assert.equal(notebook.isOwner,false);assert.equal(notebook.canManage,true);
 for(const [api,path] of [[m.backup,'private-backup'],[m.catalog,'catalog'],[m.instructions,'prep-instructions'],[m.rounds,'check-rounds'],[m.calendar,'operating-calendar'],[m.review,'review-workflow'],[m.operations,'operations?from=2026-09-01&to=2026-09-29'],[m.activity,'activity?category=team&export=1']])await read(api,path);
 // Real representative admin writes under Manager identity; content exists only in this synthetic DB.
 const n=m.initialNotebook();n.items=[m.newItem('Synthetic broth','prep')];db.prepare("UPDATE notebooks SET payload=? WHERE id='kitchen'").run(JSON.stringify(n));
 await send(m.catalog,'catalog',{operationId:crypto.randomUUID(),operation:{kind:'aliases',itemId:n.items[0].id,aliases:['QA broth']}},200,notebook.revision);
 const instruction={id:crypto.randomUUID(),kind:'instruction',actorId:'manager',itemId:n.items[0].id,revision:0,text:'SYNTHETIC: one test pan'};await send(m.notes,'prep-notes',instruction);await send(m.notes,'prep-notes',instruction);
 assert.equal(db.prepare('SELECT actor_id FROM prep_instruction_versions').get().actor_id,'manager');
 const started=await send(m.review,'review-workflow',{operationId:crypto.randomUUID(),action:'start2'});assert.equal(started.isOwner,false);assert.equal(started.canManage,true);
 // Approval is separate and still validates content: Manager reaches domain validation, legacy does not.
 await send(m.review,'review-workflow',{operationId:crypto.randomUUID(),action:'approve',entityIds:[],reason:''},422,started.record.revision);
 globalThis.activityUser=legacy;await send(m.review,'review-workflow',{operationId:crypto.randomUUID(),action:'approve',entityIds:[],reason:''},403,started.record.revision);
 globalThis.activityUser=manager;
 // Cannot affect actual Owner or self role/status, including forged direct API requests.
 await send(m.team,'team',role(row('owner'),'cook'),409);await send(m.team,'team',edit(row('owner'),{active:false}),409);
 await send(m.team,'team',role(row('manager'),'cook'),409);await send(m.team,'team',edit(row('manager'),{active:false}),409);
 await send(m.team,'team',edit(row('manager'),{name:'Renamed Manager'}));assert.equal(row('manager').access_role,'manager');
 await send(m.team,'team',edit(row('legacy'),{name:'Renamed Legacy'}));assert.equal(row('legacy').access_role,'legacy');
 // CAS and old-client edit can never restore a superseded role.
 const old=edit(row('legacy'),{name:'Old client'}),promote=role(row('legacy'),'manager');await send(m.team,'team',promote);await send(m.team,'team',old,409);await send(m.team,'team',promote);
 await send(m.team,'team',edit(row('legacy'),{name:'New name'}));assert.equal(row('legacy').access_role,'manager');
 const same=row('legacy');const results=await Promise.all([send(m.team,'team',role(same,'cook')),send(m.team,'team',role(same,'manager'),409)]);assert.equal(results.length,2);
 // Authorization is checked in receipt transaction as well as at request entry.
 concurrent=()=>db.prepare("UPDATE kitchen_team SET active=0 WHERE user_id='manager'").run();await send(m.team,'team',role(row('legacy'),'manager'),403);assert.equal(row('legacy').access_role,'cook');
 await read(m.backup,'private-backup',403);await send(m.notes,'prep-notes',{...instruction,id:crypto.randomUUID(),revision:1},403);await read(m.team,'team?management=1',403);
 globalThis.activityUser=owner;await send(m.team,'team',edit(row('manager'),{active:true}));globalThis.activityUser=manager;
 // Lost ACK and double click use durable, account-scoped original command. No duplicate role event.
 const values=new Map(),storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 let lost=true,release,held=false;
 const transport=async(url,init={})=>{const response=init.method?await m.team.POST(req('team',JSON.parse(init.body))):await m.team.GET(req());const body=await response.json();if(init.method&&lost){lost=false;throw Error('Synthetic lost ACK after commit')}if(init.method&&held)await new Promise(r=>{release=r});return {res:response,body}};
 let c=new m.TeamController(manager.email,storage,()=>{},transport);await c.refresh();const change=role(row('legacy'),'manager');assert.equal(await c.save(change),false);let p=c.state.pending[0];assert.equal(await c.save(p.command,p.key),true);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(change.id).n,1);
 held=true;const running=c.save(role(row('legacy'),'cook'));while(!release)await new Promise(r=>setImmediate(r));assert.equal(await c.save(role(row('legacy'),'manager')),false);release();assert.equal(await running,true);held=false;
 // Queue stays isolated through account switch and loss of Manager permission.
 lost=true;await c.save(role(row('legacy'),'manager'));p=c.state.pending[0];assert.ok(storage.getItem(p.key));globalThis.activityUser=owner;assert.equal(await c.save(p.command,p.key),false);assert.ok(storage.getItem(p.key));
 await send(m.team,'team',role(row('manager'),'cook'));globalThis.activityUser=manager;assert.equal(await c.save(p.command,p.key),false);assert.ok(storage.getItem(p.key));
 for(const [api,path] of [[m.backup,'private-backup'],[m.catalog,'catalog'],[m.instructions,'prep-instructions'],[m.rounds,'check-rounds'],[m.notebookApi,'notebook']])await read(api,path,403);
 globalThis.activityUser=owner;await send(m.team,'team',role(row('manager'),'manager'));globalThis.activityUser=manager;assert.equal(await c.save(p.command,p.key),true);
 assert.deepEqual(db.prepare('SELECT * FROM kitchen_owner').all(),[{id:'owner',user_id:'owner'}].map(x=>Object.assign(Object.create(null),x)));
 c.dispose();console.log('PASS Manager: separate ownership; administrative API coverage; explicit audited CAS roles; legacy preservation; owner/self protection; atomic revocation; double click; lost ACK; old client; account isolation and durable recovery.');db.close();
}finally{delete globalThis.activityDb;delete globalThis.activityUser;await rm(dir,{recursive:true,force:true});}
