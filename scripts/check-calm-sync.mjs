import assert from 'node:assert/strict';
import {harness,sleep} from './sync-harness.mjs';
const h=await harness(),{m,owner,day,targetDay,db}=h,clients=[];
const client=async(request=h.requester,storage=h.storage(),fast=true)=>{const c=new m.EveningController(owner.email,storage,{day},request,fast);clients.push(c);assert.ok(await c.refresh());return c;};
const until=async(fn)=>{for(let i=0;i<400&&!fn();i++)await sleep(2);assert.ok(fn(),'request reached expected stage');};
try{
 let hold=false,release;const c=await client(async(url,init)=>{const result=await h.requester(url,init);if(hold&&!init?.method){hold=false;await new Promise(r=>release=r);}return result;});
 hold=true;const older=c.refresh({morningDay:targetDay});await until(()=>release);assert.equal(c.state.loading,true);assert.equal(c.state.requestedSelection,'morningDay='+targetDay);c.cancelNavigation();release();assert.equal(await older,false);assert.equal(c.state.loading,false);assert.notEqual(c.state.requestedSelection,c.state.loadedSelection,'cancelled request cannot display old cache as new date');
 await c.refresh({day});release=null;hold=true;const a=c.refresh({day:'2026-09-25'});await until(()=>release);const b=c.refresh({day:'2026-09-24'});assert.ok(await b);release();assert.equal(await a,false);assert.equal(c.state.loadedSelection,'day=2026-09-24');assert.equal(c.state.snapshot.check,null);
 // Old failed deltas must not contaminate a newly selected day.
 let rejectOld,holdSync=false;const stale=await client(async(url,init)=>{if(holdSync&&url.includes('/sync?')){holdSync=false;return new Promise((_,reject)=>rejectOld=reject);}return h.requester(url,init);});holdSync=true;const staleRead=stale.refreshVisible();await until(()=>rejectOld);await stale.refresh({day:'2026-09-25'});rejectOld(Error('Old date failed'));await staleRead;assert.equal(stale.state.freshnessError,'');
 // Obsolete legacy reads cannot publish identity failures into a new date.
 let legacyHold=false,releaseLegacy;const legacy=await client(async(url,init)=>{const r=await h.requester(url,init);if(legacyHold&&!init?.method){legacyHold=false;await new Promise(done=>releaseLegacy=done);r.body={...r.body,accountId:'other',account:'other@example.test'};}return r;},h.storage(),false);
 legacyHold=true;const oldLegacy=legacy.refreshVisible();await until(()=>releaseLegacy);await legacy.refresh({day:'2026-09-25'});releaseLegacy();await oldLegacy;assert.equal(legacy.state.unauthorized,false);assert.equal(legacy.state.loadedSelection,'day=2026-09-25');
 // Manual refresh is public for the entire GET in both protocols, even with fresh cache and error.
 for(const fast of [true,false]){
  let paused=false,go;const x=await client(async(url,init)=>{const r=await h.requester(url,init);if(paused&&!init?.method){paused=false;await new Promise(done=>go=done);}return r;},h.storage(),fast);
  x.state={...x.state,error:'Previous network error',errorKind:'network'};paused=true;const retry=x.userRefresh();await until(()=>go);assert.equal(x.state.verifying,'manual');assert.equal(m.morningProgress(x.state).complete,false);go();assert.ok(await retry);assert.equal(x.state.verifying,null);assert.equal(x.state.error,'');
 }
 // Real Finish: waiting writes -> shared summary -> explicit atomic confirmation.
 await c.refresh({day});let unblockPost,holdPost=true;const finish=await client(async(url,init)=>{if(init?.method==='POST'&&holdPost){holdPost=false;await new Promise(r=>unblockPost=r);}return h.requester(url,init);});
 for(const row of finish.visibleCheck().answers)finish.answer(row.itemId,row.itemId==='item-0'?'missing':'have');const summary=finish.summary();await until(()=>unblockPost);assert.equal(finish.state.finishPhase,'saving');assert.equal(finish.answer('item-1','missing'),false);unblockPost();const s=await summary;assert(s);assert.equal(db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);assert.ok(await finish.action(h.command({kind:'confirm',checkId:day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision})));finish.endFinish();
 // Final Ready ACK cannot declare completion before whole-plan verification, including restored queues.
 for(const restored of [false,true]){
  let delaySync=false,goSync,offline=restored;const storage=h.storage();let x=await client(async(url,init)=>{if(offline&&init?.method==='POST')throw Error('Synthetic offline');if(delaySync&&url.includes('/sync?')){delaySync=false;await new Promise(r=>goSync=r);}return h.requester(url,init);},storage);
  if(x.visibleCheck().tasks[0].ready){x.ready('item-0',false);await x.flush();await until(()=>!x.state.verifying);}
  delaySync=!restored;assert.ok(x.ready('item-0',true));await x.flush();
  if(restored){assert.equal(x.state.pending.length,1);x.dispose();offline=false;x=await client(async(url,init)=>{if(url.includes('/sync?'))await new Promise(r=>goSync=r);return h.requester(url,init);},storage);assert.equal(x.state.needsVerification,true);const retry=x.retry();await until(()=>goSync);assert.equal(x.state.verifying,'retry');assert.equal(m.morningProgress(x.state).complete,false);goSync();assert.ok(await retry);}
  else{await until(()=>goSync);assert.equal(x.state.pending.length,0);assert.equal(x.state.verifying,'finality');assert.equal(m.morningProgress(x.state).complete,false);goSync();await until(()=>!x.state.verifying);}
  assert.equal(m.morningProgress(x.state).complete,true);
  // Cached all-ready state remains unverified while Retry GET is held.
  let releaseGet;const readyCache=x.state.snapshot;const held=await client();held.state={...held.state,snapshot:readyCache};let paused=true;const raw=held.request;held.request=async(url,init)=>{const r=await raw(url,init);if(paused&&!init?.method){paused=false;await new Promise(done=>releaseGet=done);}return r;};const pendingRetry=held.retry();await until(()=>releaseGet);assert.equal(m.morningProgress(held.state).complete,false);releaseGet();assert.ok(await pendingRetry);
  // Undo before next case must be committed, not mistaken for another user's data.
  x.ready('item-0',false);await x.flush();await until(()=>!x.state.verifying);x.dispose();
 }
 console.log('PASS calm sync: latest navigation/date, cancelled GET, stale failed delta, manual refresh fast+legacy, held Retry with fresh cache, Finish queue guard, final Ready and recovered Ready require a post-write whole-plan read.');
}finally{for(const c of clients)c.dispose();db.close();}
