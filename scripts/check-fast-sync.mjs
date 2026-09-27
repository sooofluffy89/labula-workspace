import assert from 'node:assert/strict';
import {harness,sleep} from './sync-harness.mjs';
const h=await harness(),{m,db,owner,cook,day}=h;
const clients=[];
const json=async(r,status=200)=>{const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;};
const read=()=>m.api.GET(new Request('http://test.local/api/evening?day='+day)).then(r=>json(r));
const batch=commands=>h.post(m.batch,{commands}).then(r=>json(r));
const answer=(itemId,revision,value,generation=0)=>h.command({kind:'answer',checkId:day,itemId,revision,value,generation,deviceId:crypto.randomUUID(),sequence:1});
const ready=(itemId,revision,value)=>h.command({kind:'ready',checkId:day,itemId,revision,value});
const sync=cursor=>m.sync.GET(new Request('http://test.local/api/evening/sync?day='+day+'&cursor='+encodeURIComponent(cursor))).then(r=>json(r));
const client=async(request=h.requester,storage=h.storage(),account=owner)=>{globalThis.syncUser=account;const c=new m.EveningController(account.email,storage,{day},request);clients.push(c);assert.ok(await c.refresh());return c;};
const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r=>r.name);
const dump=()=>JSON.stringify(Object.fromEntries(tables.map(t=>[t,db.prepare('SELECT * FROM "'+t+'" ORDER BY rowid').all()])));
try{
 const a=await client();let release;const held=await client(async(url,init)=>{if(init?.method==='POST'&&!release)await new Promise(r=>release=r);return h.requester(url,init);});
 assert.ok(held.answer('item-0','have'));assert.ok(held.answer('item-0','missing'));assert.ok(held.answer('item-0','have'));
 const intents=held.state.pending.map(p=>p.command);while(!release)await sleep(1);release();assert.ok(await held.flush());
 assert.deepEqual(db.prepare("SELECT after_value FROM kitchen_activity WHERE action='answer' AND item_id='item-0' ORDER BY rowid").all().map(e=>JSON.parse(e.after_value).value),['have','missing','have']);
 assert.deepEqual(db.prepare("SELECT client_at FROM kitchen_activity WHERE action='answer' AND item_id='item-0' ORDER BY rowid").all().map(e=>e.client_at),intents.map(c=>c.meta.occurredAt));
 await a.refreshVisible();assert.equal(a.visibleCheck().answers[0].revision,3);
 // Logical conflict blocks only dependent commands; independent item commits in the same transaction.
 const cs=[answer('item-0',0,'missing'),answer('item-0',1,'have'),answer('item-1',0,'missing')];
 const r=await batch(cs);assert.deepEqual(r.results.map(x=>x.status),['conflict','blocked','saved']);
 assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(cs[0].id).n,0);
 assert.equal((await batch(cs)).results[2].status,'saved');assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(cs[2].id).n,1);
 const failed=[answer('item-2',0,'missing'),answer('item-3',0,'have')],before=dump();h.fail(sql=>sql.startsWith('UPDATE evening_answers'));await json(await h.post(m.batch,{commands:failed}),503);assert.equal(dump(),before);await batch(failed);
 // Lost acknowledgement: immutable original commands survive reload and replay exactly once.
 let lost=true;const storage=h.storage(),offline=await client(async(url,init)=>{const r=await h.requester(url,init);if(init?.method==='POST'&&lost){lost=false;throw Error('Lost committed ACK')}return r;},storage);
 offline.answer('item-4','missing');assert.equal(await offline.flush(),false);const original=offline.state.pending[0].command;offline.dispose();const restored=await client(h.requester,storage);assert.deepEqual(restored.state.pending[0].command,original);assert.ok(await restored.retry());assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(original.id).n,1);
 // Offline accepts more answers. Old v47 storage format and unknown/sent payload remain unchanged.
 const oldStorage=h.storage(),off=await client(async(url,init)=>{if(init?.method==='POST')throw Error('Offline before commit');return h.requester(url,init);},oldStorage);off.answer('item-5','missing');await off.flush();assert.ok(off.answer('item-6','have'));const old=off.state.pending.map(p=>p.command);off.dispose();const recovered=await client(h.requester,oldStorage);assert.deepEqual(recovered.state.pending.map(p=>p.command),old);assert.ok(await recovered.retry());
 const quota=await client(h.requester,{length:0,key:()=>null,getItem:()=>null,setItem(){throw Error('quota')},removeItem(){}});assert.equal(quota.answer('item-7','missing'),false);assert.equal(quota.state.pending.length,0);
 // A reviewed conflict plus a later lost batch ACK must still offer a usable exact retry.
 let resumeFirst,postCount=0;const mixed=await client(async(url,init)=>{if(init?.method==='POST'){postCount++;if(postCount===1)await new Promise(r=>resumeFirst=r);const result=await h.requester(url,init);if(postCount===2)throw Error('Lost later batch ACK');return result;}return h.requester(url,init);});
 for(let i=50;i<76;i++)mixed.answer('item-'+i,'missing');while(!resumeFirst)await sleep(1);await batch([answer('item-50',0,'have')]);resumeFirst();assert.equal(await mixed.flush(),false);assert.ok(mixed.state.pending[0].rejected);assert.ok(mixed.state.pending.some(p=>p.sent&&!p.rejected));assert.equal(await mixed.resolveRejected(true),false);assert.match(mixed.state.error,/Retry remaining saves/);await mixed.retry();assert.equal(mixed.state.pending.length,1);assert.ok(await mixed.resolveRejected(false));
 // Two tabs can restore/drain the same durable operation. Server receipts are the final arbiter.
 const shared=h.storage();let stop;const first=await client(async(url,init)=>{if(init?.method==='POST')await new Promise(r=>stop=r);return h.requester(url,init);},shared);first.answer('item-7','missing');while(!stop)await sleep(1);const second=await client(h.requester,shared);assert.ok(await second.retry());stop();assert.ok(await first.flush());assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE item_id='item-7' AND action='answer'").get().n,1);
 // Remote merge works during a local in-flight save, without changing pending payloads.
 let go;const pending=await client(async(url,init)=>{if(init?.method==='POST'&&!go)await new Promise(r=>go=r);return h.requester(url,init);});pending.answer('item-8','missing');const immutable=JSON.stringify(pending.state.pending[0].command);
 globalThis.syncUser=cook;await batch([answer('item-9',0,'missing')]);globalThis.syncUser=owner;assert.ok(await pending.refreshVisible());assert.equal(pending.visibleCheck().answers.find(x=>x.itemId==='item-9').value,'missing');assert.equal(JSON.stringify(pending.state.pending[0].command),immutable);go();assert.ok(await pending.flush());
 // Read-only deltas preserve every table, carry no unrelated notebook/history and are scope-bound.
 let snap=await read(),cursor=snap.sync.cursor;const unchanged=dump();const empty=await sync(cursor);assert.equal(empty.answers.length,0);assert.equal(dump(),unchanged);assert.ok(JSON.stringify(empty).length<1400);assert.equal('catalog' in empty,false);
 globalThis.syncUser=cook;await json(await m.sync.GET(new Request('http://test.local/api/evening/sync?day='+day+'&cursor='+encodeURIComponent(cursor))),409);globalThis.syncUser=owner;
 // Five thousand real same-millisecond events: stable row sequence, bounded paging and concurrent boundary.
 let revision=3,value='have';for(let block=0;block<250;block++){const list=[];for(let i=0;i<20;i++){value=value==='have'?'missing':'have';list.push(answer('item-0',revision++,value));}assert.ok((await batch(list)).results.every(r=>r.status==='saved'));}
 const p1=await sync(cursor);assert.equal(p1.more,true);const captured=JSON.parse(p1.cursor).through;await batch([answer('item-10',0,'missing')]);let p=p1,pages=1;while(p.more){p=await sync(p.cursor);pages++;}assert.equal(pages,40);assert.equal(JSON.parse(p.cursor).after,captured);const later=await sync(p.cursor);assert.equal(later.answers.find(x=>x.itemId==='item-10').value,'missing');assert.equal(later.more,false);h.reset();await batch([answer('item-0',revision,'missing')]);assert.equal(h.metrics.trips,2);assert.ok(h.metrics.rows<10,'hot write does not reread the 5000-event history');
 // No stale ACK or delta can replace a newer item revision.
 const current=await client();let deliver;const stale=await client(async(url,init)=>{const r=await h.requester(url,init);if(init?.method==='POST')await new Promise(done=>deliver=()=>done(r));return r;});stale.answer('item-11','missing');while(!deliver)await sleep(1);await batch([answer('item-11',1,'have')]);assert.ok(await stale.refreshVisible());assert.equal(stale.state.snapshot.check.answers.find(x=>x.itemId==='item-11').revision,2);deliver();assert.ok(await stale.flush());assert.equal(stale.visibleCheck().answers.find(x=>x.itemId==='item-11').value,'have');
 // Finish locks handlers immediately, flushes 80 intents, and needs fresh explicit confirmation.
 await current.refresh();for(const row of current.visibleCheck().answers)if(row.value===null)assert.ok(current.answer(row.itemId,'missing'));
 const finishing=current.summary();assert.equal(current.answer('item-1','have'),false);assert.equal(await current.summary(),null);snap=await finishing;assert.ok(snap);assert.equal(current.state.pending.length,0);
 const change=snap.check.answers.find(x=>x.itemId==='item-1');await batch([answer(change.itemId,change.revision,'have')]);const confirm=h.command({kind:'confirm',checkId:day,revision:snap.check.revision,planRevision:snap.check.planRevision,notebookRevision:snap.notebookRevision});assert.equal(await current.action(confirm),false);assert.equal(db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);current.endFinish();assert.ok(await current.refresh());assert.ok(await current.resolveRejected(false));snap=await current.summary();assert.ok(await current.action(h.command({...confirm,id:crypto.randomUUID(),revision:snap.check.revision,planRevision:snap.check.planRevision})));current.endFinish();
 // Offline changes from an earlier check generation cannot alter the published plan.
 const frozen=db.prepare('SELECT * FROM evening_versions').all();const late=await batch([answer('item-12',0,'have',0)]);assert.equal(late.results[0].status,'conflict');assert.deepEqual(db.prepare('SELECT * FROM evening_versions').all(),frozen);
 // Distinct chefs, same item conflict/no fake author, Ready–Undo–Ready and independent changes.
 const readyRows=current.visibleCheck().tasks.filter(t=>!t.cancelled);const id=readyRows[0].itemId,id2=readyRows[1].itemId;
 const ra=ready(id,0,true);globalThis.syncUser=cook;const rb=ready(id,0,true),rb2=ready(id2,0,true);await batch([rb,rb2]);globalThis.syncUser=owner;assert.equal((await batch([ra])).results[0].status,'conflict');assert.equal(db.prepare("SELECT actor_id FROM kitchen_activity WHERE item_id=? AND action='ready'").get(id).actor_id,'cook');await batch([ready(id,1,false),ready(id,2,true)]);assert.deepEqual(db.prepare("SELECT after_value FROM kitchen_activity WHERE item_id=? AND action='ready' ORDER BY rowid").all(id).map(r=>JSON.parse(r.after_value).ready),[true,false,true]);
 // Metadata invalidation requests a complete read without writing; a cancelled task rejects stale Ready.
 snap=await read();const oldCursor=snap.sync.cursor;db.prepare("UPDATE notebooks SET revision=revision+1 WHERE id='kitchen'").run();const metadataBefore=dump();assert.equal((await sync(oldCursor)).reset,true);assert.equal(dump(),metadataBefore);
 await h.send({kind:'correct',checkId:day,revision:snap.check.revision,planRevision:snap.check.planRevision});
 snap=await read();const toRemove=snap.check.answers.find(a=>a.itemId===id);await batch([answer(id,toRemove.revision,'have',snap.check.version)]);snap=await read();
 await h.send({kind:'confirm',checkId:day,revision:snap.check.revision,planRevision:snap.check.planRevision,notebookRevision:snap.notebookRevision});
 assert.equal((await batch([ready(id,3,false)])).results[0].status,'conflict');assert.equal(db.prepare('SELECT cancelled FROM morning_tasks WHERE check_id=? AND item_id=?').get(day,id).cancelled,1);
 // A paused account cannot read/publish; no prior cursor is a permission cache.
 snap=await read();db.prepare("UPDATE kitchen_team SET active=0 WHERE user_id='owner'").run();await json(await m.sync.GET(new Request('http://test.local/api/evening/sync?day='+day+'&cursor='+encodeURIComponent(snap.sync.cursor))),403);await json(await h.post(m.batch,{commands:[ready(id,3,false)]}),403);db.prepare("UPDATE kitchen_team SET active=1 WHERE user_id='owner'").run();
 globalThis.syncUser=null;await json(await m.sync.GET(new Request('http://test.local/api/evening/sync')),401);globalThis.syncUser=owner;
 // Actual requestJson deadline covers an unfinished body after a real batch commit.
 const nativeFetch=globalThis.fetch,nativeTimer=globalThis.setTimeout;let hanging=true;
 try{
  globalThis.setTimeout=(fn,ms,...args)=>nativeTimer(fn,ms===30000?10:ms,...args);
  globalThis.fetch=async(url,init)=>{const {res,body}=await h.requester(url,init);if(init?.method==='POST'&&hanging)return {ok:res.ok,status:res.status,json:()=>new Promise(()=>{})};return Response.json(body,{status:res.status});};
  const timed=new m.EveningController(owner.email,h.storage(),{day});clients.push(timed);await timed.refresh();const t=timed.visibleCheck().tasks.find(t=>!t.ready&&!t.cancelled);assert.ok(timed.ready(t.itemId,true));assert.equal(await timed.flush(),false);assert.match(timed.state.error,/took too long/);const id=timed.state.pending[0].command.id;hanging=false;assert.ok(await timed.retry());assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(id).n,1);timed.dispose();
 }finally{globalThis.fetch=nativeFetch;globalThis.setTimeout=nativeTimer;}
 // Disposal during Finish retains accepted durable changes and ignores late UI replies.
 const store=h.storage();let unblock;const dying=await client(async(url,init)=>{if(init?.method==='POST')await new Promise(r=>unblock=r);return h.requester(url,init);},store);const task=dying.visibleCheck().tasks.find(t=>!t.ready&&!t.cancelled);dying.ready(task.itemId,true);while(!unblock)await sleep(1);dying.dispose();unblock();await sleep(5);assert.ok(store.length);const survivor=await client(h.requester,store);assert.ok(await survivor.retry());assert.equal(store.length,0);
 console.log('PASS fast sync: real SQLite + APIs + controller; ordered batches, partial CAS/dependencies, atomic rollback, exact lost-ACK replay, v47 durable queue, offline, quota, two tabs, two actors, merges during writes, stale ACK, cursor paging/boundary, read-only data, Finish lock/conflict/reconfirmation, immutable published versions, Ready history, auth/pause and disposal.');
}finally{for(const c of clients)c.dispose();db.close();}
