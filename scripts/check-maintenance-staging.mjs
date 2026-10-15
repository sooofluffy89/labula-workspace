import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {mkdir,mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';

const directory=await mkdtemp(join(tmpdir(),'workspace-runtime-')),db=new DatabaseSync(':memory:');
let beforeBatch;
const statement=(sql,args=[])=>({sql,args,bind(...values){return statement(sql,values);},execute(){const query=db.prepare(sql);return query.columns().length?{results:query.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(query.run(...args).changes)}};},async first(){return this.execute().results[0]??null;},async all(){return this.execute();},async run(){return this.execute();}});
const raw={prepare:statement,async batch(statements){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;hook();}db.exec('BEGIN');try{const result=statements.map(stmt=>stmt.execute());db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
const originalFetch=globalThis.fetch,originalWindow=globalThis.window;
try{
 for(const file of(await readdir('drizzle')).filter(file=>file.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 globalThis.runtimeTestDb=raw;globalThis.runtimeTestUser={userId:'synthetic-owner',email:'owner@example.test'};
 db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES('owner','synthetic-owner','owner@example.test','Synthetic Owner','legacy',1,1,0,'synthetic')").run();
 db.prepare("INSERT INTO kitchen_owner(id,user_id) VALUES('owner','synthetic-owner')").run();
 await writeFile(join(directory,'db.ts'),`import {accessContext,guardDatabase} from '@/lib/access-context';export const getRawDb=()=>{const context=accessContext.getStore();return context?guardDatabase(globalThis.runtimeTestDb,context):globalThis.runtimeTestDb;};export const getAppAccessMode=()=> 'application';`);
 await writeFile(join(directory,'auth.ts'),'export const getChatGPTUser=async()=>globalThis.runtimeTestUser;');
 await writeFile(join(directory,'env.ts'),'export const env={};');
 await build({stdin:{contents:`export {protectedApi} from './lib/protected-api';export {isCompletePrivateBackup,verifyPrivateBackupPhotos} from './lib/private-backup';export {getRawDb} from '@/db';export * from './lib/access-client';export {TeamController} from './lib/team-client';export {initialNotebook,newItem} from './lib/notebook';export {recordSignIn} from './lib/team-access-server';export * as notebookApi from './app/api/notebook/route';export * as backupApi from './app/api/private-backup/route';export * as eveningApi from './app/api/evening/route';export * as stockApi from './app/api/stock/route';export * as roundsApi from './app/api/check-rounds/route';export * as calendarApi from './app/api/operating-calendar/route';export * as teamApi from './app/api/team/route';export * as notesApi from './app/api/prep-notes/route';export * as settingsApi from './app/api/stock-settings/route';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:join(directory,'test.mjs'),alias:{'@/lib/access-context':join(process.cwd(),'lib/access-context.ts'),'@/db':join(directory,'db.ts'),'@/app/chatgpt-auth':join(directory,'auth.ts'),'cloudflare:workers':join(directory,'env.ts')},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(join(directory,'test.mjs'));
 const n=m.initialNotebook();n.items=[{...m.newItem('Synthetic ingredient'),id:'ingredient'}];db.prepare('INSERT INTO notebooks VALUES(?,?,?,?,?)').run('kitchen',JSON.stringify(n),0,'synthetic','owner@example.test');
 const policy=(paused,minimum=1)=>db.prepare("UPDATE workspace_runtime_policy SET write_paused=?,min_client_version=?,revision=revision+1,updated_at='synthetic' WHERE id='kitchen'").run(paused,minimum);
 let handlerCalls=0;
 const write=m.protectedApi('management',async request=>{handlerCalls++;const command=await request.json(),store=m.getRawDb();const found=await store.prepare('SELECT id FROM team_commands WHERE id=?').bind(command.id).first();if(!found)await store.batch([store.prepare('INSERT INTO team_commands(id,actor_id,request,created_at) VALUES(?,?,?,?)').bind(command.id,'synthetic-owner',JSON.stringify(command),'synthetic'),store.prepare("UPDATE notebooks SET revision=revision+1 WHERE id='kitchen'")]);return Response.json({operationId:command.id});});
 const request=(command,version,origin='http://test.local')=>new Request('http://test.local/api/test',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(version===undefined?{}:{'X-Labula-Workspace-Version':String(version)})},body:JSON.stringify(command)});
 const result=async(response,status,code)=>{assert.equal(response.status,status,await response.clone().text());if(code)assert.equal((await response.json()).code,code);};
 const command={id:crypto.randomUUID(),kind:'add',email:'synthetic-new@example.test',name:''};
 // Default policy accepts legacy clients until a deliberate cutover.
 await result(await write(request(command)),200);assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,1);
 // Mature the operational records while writes are enabled, then publish a
 // real synthetic morning task. Frozen reads must neither bootstrap nor mutate.
 const readRequest=path=>new Request('http://test.local/api/'+path,{headers:{'X-Labula-Workspace-Version':'2'}});
 await result(await m.stockApi.GET(readRequest('stock')),200);
 db.prepare("UPDATE stock_items SET track=1,round_id='daily',round_revision=round_revision+1,revision=revision+1 WHERE item_id='ingredient'").run();
 const sendEvening=async body=>{const response=await m.eveningApi.POST(new Request('http://test.local/api/evening',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':'0','X-Labula-Workspace-Version':'2'},body:JSON.stringify({id:crypto.randomUUID(),scope:'kitchen',actorId:'synthetic-owner',...body})}));await result(response,200);};
 await sendEvening({kind:'start',day:'2026-10-14',targetDay:'2026-10-15'});
 await sendEvening({kind:'answer',checkId:'2026-10-14',itemId:'ingredient',revision:0,generation:0,value:'missing',deviceId:crypto.randomUUID(),sequence:1});
 const evening=await(await m.eveningApi.GET(readRequest('evening?day=2026-10-14'))).json();
 await sendEvening({kind:'confirm',checkId:'2026-10-14',revision:evening.check.revision,planRevision:evening.check.planRevision,notebookRevision:evening.notebookRevision});
 policy(1);const frozenRevision=db.prepare('SELECT revision FROM notebooks').get().revision,calls=handlerCalls;
 await result(await write(request({...command,id:crypto.randomUUID()},2)),503,'workspace_write_paused');assert.equal(handlerCalls,calls,'reject before parsing or consuming command');
 for(const [api,path] of [[m.notebookApi,'notebook'],[m.backupApi,'private-backup']])await result(await api.GET(new Request('http://test.local/api/'+path,{headers:{'X-Labula-Workspace-Version':'2'}})),200);
 const changesBeforeReads=db.prepare('SELECT total_changes() AS count').get().count;
 for(const [api,path] of [[m.eveningApi,'evening?day=2026-10-14'],[m.eveningApi,'evening?morningDay=2026-10-15'],[m.stockApi,'stock'],[m.roundsApi,'check-rounds'],[m.calendarApi,'operating-calendar'],[m.teamApi,'team'],[m.notesApi,'prep-notes'],[m.settingsApi,'stock-settings']])await result(await api.GET(readRequest(path)),200);
 const morning=await(await m.eveningApi.GET(readRequest('evening?morningDay=2026-10-15'))).json();
 assert([1,2].includes(db.prepare('SELECT plan_policy_version FROM evening_checks').get().plan_policy_version),'retained or explicit publication policy is readable while frozen');assert.equal(morning.check.tasks.length,1);assert.equal(morning.check.tasks[0].ready,false);
 assert.equal(db.prepare('SELECT total_changes() AS count').get().count,changesBeforeReads,'mature daily/settings/identity reads issue no database mutations while frozen');
 const backup=await(await m.backupApi.GET(readRequest('private-backup'))).json();assert(m.isCompletePrivateBackup(backup),'frozen complete backup inventory and counts');assert(await m.verifyPrivateBackupPhotos(backup),'frozen backup photo bytes');
 const beforeActualWrites=db.prepare('SELECT total_changes() AS count').get().count;
 const blockedEvening={id:crypto.randomUUID(),scope:'kitchen',actorId:'synthetic-owner',kind:'ready',checkId:'2026-10-14',itemId:'ingredient',revision:0,value:true};
 await result(await m.eveningApi.POST(new Request('http://test.local/api/evening',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(blockedEvening)})),503,'workspace_write_paused');
 const saveId=crypto.randomUUID();await result(await m.notebookApi.PUT(new Request('http://test.local/api/notebook',{method:'PUT',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(frozenRevision),'X-Operation-Id':saveId},body:JSON.stringify(n)})),503,'workspace_write_paused');
 assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(blockedEvening.id).n,0);assert.equal(db.prepare('SELECT count(*) n FROM notebook_commands WHERE id=?').get(saveId).n,0);assert.equal(db.prepare('SELECT total_changes() AS count').get().count,beforeActualWrites,'actual v84 API writes leave all data and receipts unchanged');
 await m.recordSignIn(globalThis.runtimeTestUser);assert.equal(db.prepare('SELECT last_sign_in_at FROM kitchen_team WHERE id=\'owner\'').get().last_sign_in_at,null,'read-only session visit does not write a stamp');
 assert.throws(()=>db.prepare("UPDATE notebooks SET revision=99 WHERE id='kitchen'").run(),/workspace_write_paused/,'unguarded legacy writes cannot bypass freeze');
 const tableNames=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(row=>row.name).filter(name=>!['workspace_runtime_policy','workspace_runtime_policy_commands','access_write_guards'].includes(name));
 for(const table of tableNames)for(const action of ['insert','update','delete'])assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND name=?").get('workspace_freeze_'+table+'_'+action),'freeze covers '+table+' '+action);
 assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,frozenRevision);
 // A freeze raised AFTER admission still rolls back the transaction completely.
 policy(0);const race={...command,id:crypto.randomUUID()};beforeBatch=()=>policy(1);
 await result(await write(request(race,2)),503,'workspace_write_paused');assert.equal(db.prepare('SELECT count(*) n FROM team_commands WHERE id=?').get(race.id).n,0);assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,frozenRevision);assert.equal(db.prepare('SELECT count(*) n FROM access_write_guards').get().n,0);
 // A new minimum raised after admission blocks an old queued client atomically.
 policy(0,1);beforeBatch=()=>policy(0,2);
 assert.equal(request(race).headers.get('X-Labula-Workspace-Version'),null,'legacy wire request omits the protocol header');await result(await write(request(race)),428,'workspace_update_required');assert.equal(db.prepare('SELECT count(*) n FROM team_commands WHERE id=?').get(race.id).n,0);
 // Old deployed code does not send the new SQL column; its default is version 1.
 assert.throws(()=>db.prepare("INSERT INTO access_write_guards(id,user_id,scope) VALUES('old-server','synthetic-owner','management')").run(),/workspace_update_required/);
 await result(await write(request(race)),428,'workspace_update_required');await result(await write(request(race,'garbage')),428,'workspace_update_required');
 await result(await write(request(race,2,'https://evil.example')),403);
 await result(await write(request(race,2)),200);await result(await write(request(race,2)),200);
 assert.equal(db.prepare('SELECT count(*) n FROM team_commands WHERE id=?').get(race.id).n,1,'exact post-reload retry preserves receipt id');assert.equal(db.prepare('SELECT revision FROM notebooks').get().revision,frozenRevision+1);
 // Recovery and identity are separate: maintenance/upgrade must not latch logout.
 const values=new Map(),storage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 globalThis.window=new EventTarget();window.localStorage=storage;let accessLost=0;window.addEventListener('labula:access-lost',()=>accessLost++);m.configureClientAccess('synthetic-owner');
 let maintenance=true,failureStatus=428,seenVersion;
 globalThis.fetch=async(url,init={})=>{seenVersion=new Headers(init.headers).get('X-Labula-Workspace-Version');if(init.method)return maintenance?Response.json({code:failureStatus===428?'workspace_update_required':'workspace_write_paused',error:'Your pending action is kept.'},{status:failureStatus}):Response.json({operationId:JSON.parse(init.body).id});return Response.json({accountId:'synthetic-owner',email:'owner@example.test',canManage:true,isOwner:true,members:[],accessMode:'application'});};
 const controller=new m.TeamController('owner@example.test',storage,()=>{});await controller.refresh();assert.equal(await controller.save(command),false);const pending=controller.state.pending[0],saved=storage.getItem(pending.key);assert(saved);assert.equal(accessLost,0);assert.equal(storage.getItem(m.accessBlockedKey('synthetic-owner')),null);failureStatus=503;assert.equal(await controller.save(pending.command,pending.key),false);assert.equal(storage.getItem(pending.key),saved);assert.equal(accessLost,0);maintenance=false;assert.equal(await controller.save(pending.command,pending.key),true);assert.equal(storage.getItem(pending.key),null);controller.dispose();
 console.log('PASS maintenance cutover: mature business API and complete backup reads remain usable while frozen; ordinary writes and transaction races reject without receipts; legacy wire commands require a client update and pending recovery is retained.');
}finally{db.close();globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;delete globalThis.runtimeTestDb;delete globalThis.runtimeTestUser;await rm(directory,{recursive:true,force:true});}
