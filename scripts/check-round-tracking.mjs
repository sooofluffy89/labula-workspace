import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {harness,sleep} from './sync-harness.mjs';
const h=await harness(),dir=await mkdtemp(tmpdir()+'/round-track-');
try{
 await build({entryPoints:['lib/check-rounds-client.ts'],bundle:true,format:'esm',platform:'node',outfile:dir+'/client.mjs',logLevel:'silent'});
 const {RoundClient}=await import(dir+'/client.mjs');
 const read=async()=>{const r=await h.m.rounds.GET();assert.equal(r.status,200);return r.json();};
 const command=async(itemId,track)=>{const s=await read(),i=s.items.find(i=>i.itemId===itemId);return {id:crypto.randomUUID(),actorId:h.owner.userId,revision:s.revision,kind:'track',itemId,itemRevision:i.revision,track};};
 const post=c=>h.post(h.m.rounds,c);const send=async c=>{const r=await post(c);assert.equal(r.status,200,JSON.stringify(await r.json()));};
 const table=t=>h.db.prepare('SELECT * FROM '+t).all();
 for(let i=0;i<3;i++)h.db.prepare("INSERT INTO checking_station_items(item_id,station_id,revision,updated_at,updated_by) VALUES(?,'station-1',1,?,'owner')").run('item-'+i,new Date().toISOString());
 const notebook=table('notebooks'),draft=table('evening_answers');
 for(const [index,roundId] of ['daily','twice-weekly','weekly'].entries()){
  const itemId='item-'+index;let s=await read();await send({id:crypto.randomUUID(),actorId:h.owner.userId,revision:s.revision,kind:'members',roundId,itemIds:[itemId]});
  const before=h.db.prepare('SELECT * FROM stock_items WHERE item_id=?').get(itemId),history=table('round_timeline').length;
  const off=await command(itemId,false);await send(off);s=await read();let i=s.items.find(i=>i.itemId===itemId);assert.equal(i.track,false);assert.equal(i.roundId,roundId);assert.equal(i.included,true);assert.equal(i.revision,before.revision+1);assert.equal(table('round_timeline').length,history+1);assert.equal(table('kitchen_activity').at(-1).actor_id,h.owner.userId);
  assert(!h.m.filteredRoundItems(s.items,roundId,{...h.m.emptyRoundFilters,current:'this',tracking:'tracked'}).some(i=>i.itemId===itemId));assert(h.m.filteredRoundItems(s.items,roundId,{...h.m.emptyRoundFilters,current:'this',tracking:'untracked'}).some(i=>i.itemId===itemId));
  assert.equal(h.m.roundCounts(s.items.filter(i=>i.roundId===roundId)).off,1);
  const future=await h.m.api.GET(new Request('http://test.local/api/evening?day=2026-10-01')).then(r=>r.json());assert(!future.planning.items.some(i=>i.itemId===itemId));
  assert.deepEqual(table('evening_answers'),draft,'existing draft unchanged');await send(await command(itemId,true));i=(await read()).items.find(i=>i.itemId===itemId);assert.equal(i.track,true);assert.equal(i.roundId,roundId);
  await send(off);assert.equal((await read()).items.find(i=>i.itemId===itemId).track,true,'replay cannot turn later On off');
 }
 // A new activation cannot invent missing configuration; explicitly prepare Daily and a station.
 await send(await command('item-3',false));let s=await read();await send({id:crypto.randomUUID(),actorId:h.owner.userId,revision:s.revision,kind:'members',roundId:null,itemIds:['item-3']});assert.equal((await post(await command('item-3',true))).status,409);s=await read();await send({id:crypto.randomUUID(),actorId:h.owner.userId,revision:s.revision,kind:'members',roundId:'daily',itemIds:['item-3']});h.db.prepare("INSERT INTO checking_station_items(item_id,station_id,revision,updated_at,updated_by) VALUES('item-3','station-1',1,?,'owner')").run(new Date().toISOString());const timeline=table('round_timeline').length;await send(await command('item-3',true));assert.equal((await read()).items.find(i=>i.itemId==='item-3').roundId,'daily');assert.equal(table('round_timeline').length,timeline+1);
 const noOpCount=table('kitchen_activity').length;await send(await command('item-3',true));assert.equal(table('kitchen_activity').length,noOpCount);
 // Shared membership, legacy Track and manager races all invalidate stale requests.
 const stale=await command('item-0',false);s=await read();await send({id:crypto.randomUUID(),actorId:h.owner.userId,revision:s.revision,kind:'members',roundId:'weekly',itemIds:['item-0']});assert.equal((await post(stale)).status,409);
 const original=await command('item-0',false);h.fail(sql=>sql.startsWith('UPDATE stock_items SET track='));assert.equal((await post(original)).status,503);assert.equal(table('round_commands').some(x=>x.id===original.id),false);await send(original);
 const denied=await command('item-1',false);globalThis.syncUser=h.cook;assert.equal((await post({...denied,actorId:h.cook.userId})).status,403);globalThis.syncUser=null;assert.equal((await post(denied)).status,401);globalThis.syncUser=h.owner;
 // A real Manager can write, and a stale Owner cannot overwrite their newer intent.
 h.db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,revision,created_at) VALUES('manager','manager','manager@example.test','Test manager','manager',1,0,?)").run(new Date().toISOString());globalThis.syncUser={userId:'manager',email:'manager@example.test'};assert.equal((await post({...denied,actorId:'manager'})).status,200);globalThis.syncUser=h.owner;assert.equal((await post(denied)).status,409);
 // Publish current frozen draft, set Ready, then Off must not touch versions/tasks/history.
 let e=await h.m.api.GET(new Request('http://test.local/api/evening?day='+h.day)).then(r=>r.json());for(const a of e.check.answers)e=await h.send({kind:'answer',checkId:h.day,itemId:a.itemId,revision:a.revision,generation:e.check.version,value:'missing',deviceId:crypto.randomUUID(),sequence:1});e=await h.send({kind:'confirm',checkId:h.day,revision:e.check.revision,planRevision:e.check.planRevision,notebookRevision:e.notebookRevision});let task=e.check.tasks[0];await h.send({kind:'ready',checkId:h.day,itemId:task.itemId,revision:task.revision,value:true});
 const frozen=Object.fromEntries(['evening_checks','evening_answers','evening_versions','morning_tasks','evening_commands'].map(t=>[t,table(t)]));await send(await command('item-2',false));for(const [t,rows] of Object.entries(frozen))assert.deepEqual(table(t),rows,t+' preserved');assert.deepEqual(table('notebooks'),notebook);
 // Real controller and real endpoint: before-send timeout, lost response after commit,
 // two-client conflict, reload, duplicate submission and unmount.
 let mode='ok',posts=0,release;const request=async(url,init)=>{if(init?.method==='POST'){posts++;if(mode==='offline')throw Error('Timed out');if(mode==='hold')await new Promise(r=>release=r);const r=await h.requester(url,init);if(mode==='lost')throw Error('Lost ACK after commit');return r;}return h.requester(url,init);};
 const storage=h.storage();let c=new RoundClient(h.owner.email,storage,request);await c.refresh();mode='offline';let op=await command('item-4',false);assert.equal(await c.submit(op),false);assert.equal((await read()).items.find(i=>i.itemId==='item-4').track,true);c.dispose();c=new RoundClient(h.owner.email,storage,request);await c.refresh();assert.deepEqual(c.state.pending.command,op);mode='lost';assert.equal(await c.retry(),false);assert.equal((await read()).items.find(i=>i.itemId==='item-4').track,false);mode='ok';assert.equal(await c.retry(),true);assert.equal(c.state.pending,null);assert.equal(table('round_commands').filter(x=>x.id===op.id).length,1);
 await c.refresh();op=await command('item-5',false);await send(await command('item-5',false));assert.equal(await c.submit(op),false);assert.equal(c.state.pending.rejected,true);await c.refresh();c.discardRejected();assert.equal(c.state.pending,null);
 op=await command('item-6',false);mode='hold';const pending=c.submit(op);await sleep(2);const n=posts;assert.equal(await c.submit(op),false);assert.equal(posts,n);c.dispose();release();await pending;assert.equal(storage.length,0);assert.equal((await read()).items.find(i=>i.itemId==='item-6').track,false);
 assert.equal(h.m.initialRoundView().filters.tracking,'tracked');console.log('PASS round tracking: 3 rounds Off/On, remembered/default membership, counts and filters, one timeline+actor, no-op, replay, CAS/rollback, owner/manager/Cook/anonymous, frozen draft/published/Ready, real controller timeout/lost ACK/reload/conflict/duplicate/unmount.');
}finally{h.db.close();await rm(dir,{recursive:true,force:true});}
