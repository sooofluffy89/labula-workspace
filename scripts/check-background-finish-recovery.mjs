import assert from 'node:assert/strict';
import {harness,sleep} from './sync-harness.mjs';
const until=async(fn)=>{for(let i=0;i<3000;i++){if(fn())return;await sleep(2);}throw Error('Finish recovery timeout');};
const h=await harness(),clients=[];
let offline=false,holdConfirm=false,releaseConfirm,quota=false,auth=false;
const original=h.storage(),storage={...original,get length(){return original.length;},setItem(k,v){if(quota&&k.startsWith('labula-finish-v1:'))throw Error('Synthetic quota');original.setItem(k,v);}};
const request=async(url,init)=>{if(offline)throw Error('Synthetic timeout/unknown result');if(auth)return {res:new Response('',{status:401}),body:{error:'Sign in again'}};if(holdConfirm&&init?.method==='POST'&&JSON.parse(init.body).kind==='confirm'){holdConfirm=false;await new Promise(done=>releaseConfirm=done);}return h.requester(url,init);};
const client=async(store=storage)=>{const c=new h.m.EveningController(h.owner.email,store,{day:h.day},request);clients.push(c);await c.refresh();return c;};
try{
 let c=await client();let s=c.reviewFinish();assert.equal(c.requestFinish(s),false,'unanswered check cannot Finish');
 for(const a of c.visibleCheck().answers)c.answer(a.itemId,'have');await c.flush();s=c.reviewFinish();quota=true;assert.equal(c.requestFinish(s),false);assert.equal(c.state.finish,undefined,'failed storage cannot accept Finish');assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);quota=false;
 // Accepted note survives the editor, but draft text is not a dependency.
 const notes=new h.m.PrepNotesController(h.owner.email,storage,async(url,init)=>init?.method==='POST'?Promise.reject(Error('Note offline')):h.requester(url,init));await notes.initialize();
 notes.saveDraft('synthetic-draft','Not submitted');notes.enqueue({kind:'feedback',context:{checkId:h.day,itemId:'item-0',catalogId:'item-0',version:0,instructionRevision:0,phase:'evening'},text:'Explicitly submitted before Finish'});await notes.flush();notes.dispose();
 holdConfirm=true;assert(c.requestFinish(s));await until(()=>releaseConfirm);const id=c.state.finish.id;assert(c.state.finish.command.meta.occurredAt===c.state.finish.createdAt);
 assert.equal(h.db.prepare("SELECT count(*) n FROM prep_feedback WHERE text='Explicitly submitted before Finish'").get().n,1);
 assert.equal(h.db.prepare("SELECT count(*) n FROM prep_feedback WHERE text='Not submitted'").get().n,0);
 // A real page close stops this controller. Reload sends the same durable command.
 c.dispose();const reloaded=await client();await until(()=>reloaded.state.finish?.phase==='complete');assert.equal(reloaded.state.finish.id,id);releaseConfirm();await c.continueFinish();
 assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1,'two tabs use the exact original request including meta');
 assert.equal(reloaded.visibleCheck().tasks.length,0,'empty Morning prep is legitimate');
 // Correction retains existing publication until another approved atomic commit.
 await h.send({kind:'correct',checkId:h.day,revision:reloaded.visibleCheck().revision,planRevision:reloaded.visibleCheck().planRevision});await reloaded.refresh();assert.equal(reloaded.state.snapshot.check.version,1);
 reloaded.answer('item-0','missing');await reloaded.flush();auth=true;assert(reloaded.requestFinish(reloaded.reviewFinish()));await reloaded.continueFinish();assert.equal(reloaded.state.finish.phase,'attention');assert.equal(reloaded.state.unauthorized,true);auth=false;await reloaded.retry();assert.equal(reloaded.state.finish.phase,'complete');assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,2);
 // Another account cannot restore or publish this device's Finish intent.
 const peer=new h.m.EveningController(h.cook.email,storage,{day:h.day},h.requester);clients.push(peer);globalThis.syncUser=h.cook;await peer.refresh();assert.equal(peer.state.finish,undefined);assert.equal(peer.state.pending.length,0);
 globalThis.syncUser=h.owner;
 // A changed target is approval-relevant, and no automatic approval is inferred.
 await h.send({kind:'start',day:'2026-10-03',targetDay:'2026-10-04'});await reloaded.refresh({day:'2026-10-03'});for(const a of reloaded.visibleCheck().answers)reloaded.answer(a.itemId,'have');await reloaded.flush();const approved=reloaded.reviewFinish();
 await h.send({kind:'dates',checkId:'2026-10-03',revision:approved.check.revision,targetDay:'2026-10-06'});
 assert(reloaded.requestFinish(approved));await reloaded.continueFinish();assert.equal(reloaded.state.finish.phase,'attention');assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,2);
 const corrupt=h.storage();const complete=JSON.parse(storage.getItem('labula-finish-v1:owner:'+reloaded.state.finish.supersedes));delete complete.receipt;corrupt.setItem('labula-finish-v1:owner:'+complete.id,JSON.stringify(complete));const corruptReceipt=await client(corrupt);assert.equal(corruptReceipt.state.recoveryBlocked,true);assert.notEqual(corruptReceipt.state.finish?.phase,'complete','a missing commit receipt cannot claim success');
 // A malformed local approval blocks recovery; the original journal is retained.
 const bad=h.storage();bad.setItem('labula-finish-v1:owner:bad','{}');const invalid=await client(bad);assert.equal(invalid.state.recoveryBlocked,true);assert.equal(bad.getItem('labula-finish-v1:owner:bad'),'{}');
 console.log('PASS durable Finish recovery: incomplete/quota, accepted feedback vs drafts, close/reload/two-tab exact replay, empty plan, correction, auth retry, foreign account, changed target, corrupt journal retained.');
}finally{for(const c of clients)c.dispose();h.db.close();}
