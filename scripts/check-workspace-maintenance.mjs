import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'workspace-maintenance-')),db=new DatabaseSync(':memory:');
let beforeRun,beforeRead;
const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values);},async first(){if(beforeRead)beforeRead(sql);return db.prepare(sql).get(...args)??null;},async all(){if(beforeRead)beforeRead(sql);return {results:db.prepare(sql).all(...args)};},async run(){if(beforeRun){const hook=beforeRun;beforeRun=null;hook();}return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}});
try{
 for(const file of(await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 globalThis.maintenanceDb={prepare:stmt};globalThis.maintenanceUser=null;
 await writeFile(join(dir,'db.ts'),'export const getRawDb=()=>globalThis.maintenanceDb;');
 await writeFile(join(dir,'auth.ts'),'export const getChatGPTUser=async()=>globalThis.maintenanceUser;');
 await build({entryPoints:['app/api/workspace-maintenance/route.ts'],bundle:true,format:'esm',platform:'node',outfile:join(dir,'api.mjs'),alias:{'@/db':join(dir,'db.ts'),'@/app/chatgpt-auth':join(dir,'auth.ts')},logLevel:'silent'});
 const api=await import(join(dir,'api.mjs'));
 const users=Object.fromEntries(['owner','manager','cook','legacy','disabled','unlinked','unlisted'].map(name=>[name,{userId:name,email:name+'@example.test'}]));
 for(const name of ['owner','manager','cook','legacy','disabled','unlinked'])db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES(?,?,?,?,?,1,?,0,'synthetic')").run(name,name==='unlinked'?null:name,users[name].email,name,['owner','disabled','unlinked'].includes(name)?'legacy':name,name==='disabled'?0:1);
 db.prepare("INSERT INTO kitchen_owner VALUES('owner','owner')").run();
 db.prepare("INSERT INTO notebooks VALUES('kitchen','synthetic retained restaurant data',5,'synthetic','owner')").run();
 const policy=()=>db.prepare("SELECT * FROM workspace_runtime_policy WHERE id='kitchen'").get();
 const count=()=>db.prepare('SELECT count(*) n FROM workspace_runtime_policy_commands').get().n;
 const command=action=>({operationId:crypto.randomUUID(),expectedRevision:policy().revision,action});
 const request=(method='GET',body,headers={})=>new Request('http://test.local/api/workspace-maintenance',{method,headers:{Origin:'http://test.local','Content-Type':'application/json','X-Labula-Account-Id':globalThis.maintenanceUser?.userId??'',...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const verify=async(response,status,code)=>{const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));if(code)assert.equal(data.code,code);assert.match(response.headers.get('cache-control'),/no-store/);return data;};
 await verify(await api.GET(request()),401,'sign_in_required');
 for(const name of ['manager','cook','legacy','disabled','unlinked','unlisted']){globalThis.maintenanceUser=users[name];await verify(await api.GET(request()),403);await verify(await api.POST(request('POST',command('pause'))),403);}
 assert.equal(db.prepare("SELECT user_id FROM kitchen_team WHERE id='unlinked'").get().user_id,null,'control cannot link or bootstrap identity');
 globalThis.maintenanceUser=users.owner;
 await verify(await api.GET(request()),200);
 for(const headers of [{Origin:'https://evil.example'},{Origin:''},{'X-Labula-Account-Id':'manager'},{'X-Labula-Account-Id':''}])await verify(await api.POST(request('POST',command('pause'),headers)),403);
 for(const input of [{...command('pause'),sql:'DELETE FROM notebooks'},{...command('pause'),expectedRevision:-1},{...command('pause'),expectedRevision:0.5},{...command('pause'),operationId:'not-a-uuid'},command('delete'),null])await verify(await api.POST(request('POST',input)),400);
 assert.equal(count(),0);assert.equal(policy().revision,0);
 const pause=command('pause'),paused=await verify(await api.POST(request('POST',pause)),200);
 assert.equal(paused.policy.write_paused,1);assert.equal(paused.policy.min_client_version,1);assert.equal(paused.policy.revision,1);assert.equal(count(),1);
 await verify(await api.GET(request()),200);await verify(await api.POST(request('POST',pause)),200);assert.equal(count(),1,'exact retry is idempotent while frozen');
 await verify(await api.POST(request('POST',{...pause,action:'resume'})),409,'operation_conflict');
 await verify(await api.POST(request('POST',command('pause'))),409,'state_conflict');
 await verify(await api.POST(request('POST',{...command('resume'),expectedRevision:0})),409,'revision_conflict');
 assert.throws(()=>db.prepare("UPDATE notebooks SET revision=6 WHERE id='kitchen'").run(),/workspace_write_paused/);
 assert.throws(()=>db.prepare('UPDATE workspace_runtime_policy_commands SET actor_id=?').run('manager'),/maintenance_audit_immutable/);
 assert.throws(()=>db.prepare('DELETE FROM workspace_runtime_policy_commands').run(),/maintenance_audit_immutable/);
 // A failure applying policy must roll back the receipt inserted by the same statement.
 const resume=command('resume');db.exec("CREATE TRIGGER synthetic_reject_policy BEFORE UPDATE ON workspace_runtime_policy BEGIN SELECT RAISE(ABORT,'synthetic failure'); END;");
 await verify(await api.POST(request('POST',resume)),503,'maintenance_unavailable');assert.equal(count(),1);assert.equal(policy().revision,1);db.exec('DROP TRIGGER synthetic_reject_policy');
 const resumed=await verify(await api.POST(request('POST',resume)),200);assert.equal(resumed.policy.write_paused,0);assert.equal(resumed.policy.min_client_version,2);assert.equal(count(),2);
 // Revocation after HTTP admission is rechecked by SQL before receipt or policy writes.
 const revoked=command('pause');beforeRun=()=>db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='owner'").run();
 await verify(await api.POST(request('POST',revoked)),403,'access_revoked');assert.equal(count(),2);assert.equal(policy().revision,2);db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='owner'").run();
 const moved=command('pause');beforeRun=()=>db.prepare("UPDATE workspace_runtime_policy SET revision=revision+1 WHERE id='kitchen'").run();
 await verify(await api.POST(request('POST',moved)),409,'revision_conflict');assert.equal(count(),2);assert.equal(policy().write_paused,0);
 // Private status is withheld if membership is revoked during its read.
 beforeRead=sql=>{if(sql.startsWith('SELECT * FROM workspace_runtime_policy_commands ORDER')){beforeRead=null;db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='owner'").run();}};
 await verify(await api.GET(request()),403,'access_not_granted');db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='owner'").run();
 const raced=command('pause'),replies=await Promise.all([api.POST(request('POST',raced)),api.POST(request('POST',raced))]);
 for(const response of replies)await verify(response,200);
 assert.equal(count(),3,'concurrent same-operation requests produce one audit receipt');
 assert.equal(db.prepare('SELECT count(*) n FROM workspace_runtime_policy_commands WHERE operation_id=?').get(raced.operationId).n,1);
 // A future policy must never be lowered by this version's resume action.
 db.prepare("UPDATE workspace_runtime_policy SET min_client_version=3 WHERE id='kitchen'").run();
 const futurePolicy=policy(),futureCount=count(),futureResume=command('resume');
 await verify(await api.POST(request('POST',futureResume)),409,'future_client_policy');
 assert.deepEqual(policy(),futurePolicy);assert.equal(count(),futureCount);
 assert.throws(()=>db.prepare('INSERT INTO workspace_runtime_policy_commands(operation_id,actor_id,request,action,expected_revision,prior_write_paused,prior_min_client_version,write_paused,min_client_version,revision,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(futureResume.operationId,'owner',JSON.stringify(futureResume),'resume',futurePolicy.revision,1,3,0,2,futurePolicy.revision+1,new Date().toISOString()),/maintenance_invalid_transition/,'SQL independently refuses a future-policy downgrade');
 assert.deepEqual(policy(),futurePolicy);assert.equal(count(),futureCount);
 assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,5,'control never mutates restaurant data');
 assert.equal(db.prepare('SELECT count(*) n FROM access_write_guards').get().n,0);
 console.log('PASS Owner maintenance: actual SQLite identity/role/account/origin/input guards; no account bootstrap; paused reads/resume; exact idempotency and revision conflict; SQL revocation/race barrier; atomic audit+policy rollback; immutable audit; post-read revocation; restaurant data unchanged.');
}finally{db.close();delete globalThis.maintenanceDb;delete globalThis.maintenanceUser;await rm(dir,{recursive:true,force:true});}
