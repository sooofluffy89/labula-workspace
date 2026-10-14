import {fixtureAuthSource} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
import {harness,sleep} from './sync-harness.mjs';

// Isolated actual controllers/routes/SQLite. Async-local identity prevents a test
// harness global-user race from impersonating another cook during concurrent IO.

globalThis.auditAuthContext=new AsyncLocalStorage();
const dir=await mkdtemp(tmpdir()+'/labula-three-cooks-');
await writeFile(dir+'/auth.ts',fixtureAuthSource('globalThis.auditAuthContext.getStore()','globalThis.syncDb'));
await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.syncDb;export const getAppAccessMode=()=>"application";');
await build({stdin:{contents:"export * as api from './app/api/evening/route';export * as batch from './app/api/evening/batch/route';export * as sync from './app/api/evening/sync/route';export {EveningController} from './lib/evening-client';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
const m=await import(dir+'/test.mjs');
const results=[];
async function setup(){
 const h=await harness(),clients=[],offline=[false,false,false];
 const users=[h.cook,...[2,3].map(i=>({userId:'cook'+i,email:'cook'+i+'@example.test'}))];
 for(const u of users.slice(1))h.db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES(?,?,?,?,'cook',1,1,0,?)").run(u.userId,u.userId,u.email,'Synthetic '+u.userId,new Date().toISOString());
 const request=i=>async(url,init={})=>{
  await sleep(10);if(offline[i])throw Error('Synthetic disconnected cook');
  return globalThis.auditAuthContext.run(users[i],async()=>{
   const parsed=new URL(url,'http://test.local');
   const api=parsed.pathname.endsWith('/batch')?m.batch:parsed.pathname.endsWith('/sync')?m.sync:m.api;
   const res=init.method==='POST'?await h.post(api,JSON.parse(init.body),init):await api.GET(new Request(parsed,{headers:{'X-Labula-Stations':'4'}}));
   const body=await res.json();await sleep(10);return {res,body};
  });
 };
 for(let i=0;i<3;i++)clients.push(new m.EveningController(users[i].email,h.storage(),{day:h.day},request(i)));
 await Promise.all(clients.map(c=>c.refresh()));
 assert(clients.every(c=>c.visibleCheck()?.answers.length===80));
 const close=async()=>{clients.forEach(c=>c.dispose());await sleep(100);h.db.close();};
 return {...h,clients,users,offline,close};
}
async function fill(s){
 for(let i=0;i<80;i++)assert(s.clients[i%3].answer('item-'+i,i%5===0?'missing':'have'));
 assert.deepEqual(await Promise.all(s.clients.map(c=>c.flush())),[true,true,true]);
 await Promise.all(s.clients.map(c=>c.refresh()));
 const rows=s.db.prepare("SELECT item_id,value,updated_by FROM evening_answers ORDER BY item_id").all();
 assert.equal(rows.length,80);
 for(const row of rows){const i=Number(row.item_id.split('-')[1]);assert.equal(row.value,i%5===0?'missing':'have');assert.equal(row.updated_by,s.users[i%3].email);assert.equal(s.db.prepare("SELECT actor_id FROM kitchen_activity WHERE item_id=? AND action='answer'").get(row.item_id).actor_id,s.users[i%3].userId);}
 assert.equal(s.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='answer'").get().n,80);
}
{
 const s=await setup();try{
  await fill(s);results.push({scenario:'three cooks answer separate items',pass:true,answers:80,correctAuthors:80});
  const summaries=s.clients.map(c=>c.reviewFinish());assert(summaries.every(Boolean));
  s.clients.forEach((c,i)=>assert(c.requestFinish(summaries[i])));
  await Promise.all(s.clients.map(c=>c.continueFinish()));
  const phases=s.clients.map(c=>c.state.finish?.phase);
  assert.equal(phases.filter(p=>p==='complete').length,1);
  assert.equal(phases.filter(p=>p==='attention').length,2);
  assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
  assert.equal(s.db.prepare('SELECT count(*) n FROM morning_tasks WHERE cancelled=0').get().n,16);
  const losers=s.clients.filter(c=>c.state.finish?.phase==='attention');
  for(const c of losers){const original=structuredClone(c.state.finish),key='labula-finish-v1:'+encodeURIComponent(c.state.snapshot.accountId)+':'+original.id;assert(await c.resolveRejected(false));assert.equal(c.state.finish,undefined);assert.equal(c.state.deviceWorkPending,false);c.storage.setItem(key,JSON.stringify(original));assert(await c.refresh());assert.equal(c.state.finish,undefined,'a stale tab rewrite cannot revive an explicitly withdrawn Finish');assert.equal(c.state.finishRecovery.length,0);}
  assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
  results.push({scenario:'three simultaneous Finish approvals',pass:true,phases,publishedVersions:1,morningTasks:16});
 }finally{await s.close();}
}
{
 const s=await setup();try{
  await fill(s);const summary=s.clients[0].reviewFinish();assert(summary);
  assert(s.clients[1].answer('item-1','missing'));assert(s.clients[2].answer('item-2','missing'));
  assert.deepEqual(await Promise.all(s.clients.slice(1).map(c=>c.flush())),[true,true]);
  assert(s.clients[0].requestFinish(summary));await s.clients[0].continueFinish();
  assert.equal(s.clients[0].state.finish.phase,'attention');
  assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);
  assert(await s.clients[0].keepReviewedSharedFinish());assert.equal(s.clients[0].state.finish,undefined);assert(s.clients[0].requestFinish(s.clients[0].reviewFinish()));await s.clients[0].continueFinish();
  assert.equal(s.clients[0].state.finish.phase,'complete');
  assert.equal(s.db.prepare('SELECT count(*) n FROM morning_tasks WHERE cancelled=0').get().n,18);
  results.push({scenario:'other two cooks change reviewed content before Finish',pass:true,staleApprovalBlocked:true,explicitReapprovalTasks:18});
 }finally{await s.close();}
}
{
 const s=await setup();try{
  s.clients.forEach(c=>assert(c.answer('item-0','have')));
  await Promise.all(s.clients.map(c=>c.flush()));
  assert.equal(s.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='answer' AND item_id='item-0'").get().n,1);
  const conflicts=s.clients.filter(c=>c.state.pending.some(p=>p.rejected));assert.equal(conflicts.length,2);
  // An explicit review adopts the same freshly verified value without a write.
  assert.equal(await conflicts[0].resolveRejected(true),true);
  assert.equal(conflicts[0].state.pending.length,0);
  assert.equal(s.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='answer' AND item_id='item-0'").get().n,1,'reviewing identical value preserves original author/time');
  assert.deepEqual(await Promise.all(conflicts.filter(c=>c.state.pending.length).map(c=>c.resolveRejected(false))),[true]);
  results.push({scenario:'three cooks choose same value on same item',pass:true,savedAuthors:1,conflicts:2,reviewedIdenticalValueResolved:true});
  s.offline[0]=true;assert(s.clients[0].answer('item-3','missing'));assert.equal(await s.clients[0].flush(),false);
  const ids=s.clients[0].state.pending.map(p=>p.command.id);
  assert(s.clients[1].answer('item-4','have'));assert(s.clients[2].answer('item-5','missing'));
  assert.deepEqual(await Promise.all(s.clients.slice(1).map(c=>c.flush())),[true,true]);
  s.offline[0]=false;assert(await s.clients[0].retry());
  for(const id of ids)assert.equal(s.db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(id).n,1);
  for(let i=0;i<3;i++)assert.equal(s.db.prepare('SELECT updated_by FROM evening_answers WHERE item_id=?').get('item-'+(i+3)).updated_by,s.users[i].email);
  results.push({scenario:'one cook offline while two others save, then reconnect',pass:true,allThreePreserved:true,originalCommandsReplayedOnce:true});
 }finally{await s.close();}
}
{
 const s=await setup();try{
  const day='2026-10-04',targetDay='2026-10-06';await Promise.all(s.clients.map(c=>c.refresh({day})));
  const started=await Promise.all(s.clients.map(c=>c.action({id:crypto.randomUUID(),scope:'kitchen',kind:'start',day,targetDay})));
  assert(started.every(Boolean));assert.equal(s.db.prepare('SELECT count(*) n FROM evening_checks WHERE id=?').get(day).n,1);assert.equal(s.db.prepare('SELECT count(*) n FROM evening_answers WHERE check_id=?').get(day).n,80);
  assert(s.clients.every(c=>c.visibleCheck().targetDay===targetDay));
  results.push({scenario:'three simultaneous Start, Sunday to Tuesday',pass:true,checks:1,answers:80});
 }finally{await s.close();}
}
{
 const s=await setup();try{
  s.offline[0]=true;assert(s.clients[0].answer('item-0','have'));assert(s.clients[0].answer('item-0','missing'));assert.equal(await s.clients[0].flush(),false);
  assert(s.clients[1].answer('item-0','have'));assert(await s.clients[1].flush());
  const original=s.db.prepare("SELECT updated_by,updated_at FROM evening_answers WHERE item_id='item-0'").get();
  s.offline[0]=false;assert.equal(await s.clients[0].retry(),false);assert(s.clients[0].state.pending[0].rejected);
  assert(await s.clients[0].resolveRejected(true));assert.equal(s.clients[0].state.pending.length,0);
  const final=s.db.prepare("SELECT value,updated_by,updated_at FROM evening_answers WHERE item_id='item-0'").get();assert.equal(final.value,'missing');assert.equal(final.updated_by,s.users[0].email);assert.equal(original.updated_by,s.users[1].email);
  assert.equal(s.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='answer' AND item_id='item-0'").get().n,2,'same prefix is not re-written, later different intent is retained');
  results.push({scenario:'identical rejected prefix with a later different local answer',pass:true,actualAnswerEvents:2});
 }finally{await s.close();}
}
{
 const s=await setup();try{
  await fill(s);s.offline[0]=true;assert(s.clients[0].answer('item-3','missing'));await s.clients[0].flush();const id=s.clients[0].state.pending[0].command.id;
  assert(s.clients[1].requestFinish(s.clients[1].reviewFinish()));await s.clients[1].continueFinish();assert.equal(s.clients[1].state.finish.phase,'complete');
  s.offline[0]=false;assert.equal(await s.clients[0].retry(),false);assert.equal(s.clients[0].state.pending[0].command.id,id);assert(s.clients[0].state.pending[0].rejected);assert.equal(await s.clients[0].resolveRejected(true),false);
  assert.equal(s.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE command_id=?").get(id).n,0);assert.equal(s.db.prepare("SELECT count(*) n FROM evening_versions").get().n,1);assert.equal(s.db.prepare("SELECT value FROM evening_answers WHERE item_id='item-3'").get().value,'have');
  results.push({scenario:'offline answer arrives after a colleague Finish',pass:true,originalPreserved:true,publishedPlanNotOverwritten:true});
 }finally{await s.close();}
}
const report={source:'working tree',environment:'Actual EveningController + actual API handlers + isolated in-memory SQLite; 3 separate cook identities and storage instances, 20ms simulated request delay; not production/browser/load certification',results};

console.log(JSON.stringify(report,null,2));
