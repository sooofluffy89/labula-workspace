import assert from 'node:assert/strict';
import {harness,sleep} from './sync-harness.mjs';
const h=await harness(),m=h.m,clients=[];
const priorWindow=globalThis.window;globalThis.window=new EventTarget();
const storageEvent=key=>{const event=new Event('storage');Object.defineProperty(event,'key',{value:key});globalThis.window.dispatchEvent(event);};
const until=async f=>{for(let i=0;i<1000;i++){if(f())return;await sleep(2);}throw Error('Synthetic operation timed out');};
const client=async(store,day=h.day,request=h.requester)=>{const c=new m.EveningController(h.owner.email,store,{day},request);clients.push(c);assert(await c.refresh());return c;};
try{
 const store=h.storage();let holdVerification=false,releaseVerification;
 const c=await client(store,h.day,async(url,init)=>{const r=await h.requester(url,init);if(holdVerification&&url.includes('/sync?')&&h.db.prepare('SELECT count(*) n FROM evening_versions').get().n){await new Promise(done=>releaseVerification=done);}return r;});
 for(const a of c.visibleCheck().answers)c.answer(a.itemId,a.itemId==='item-0'?'missing':'have');await c.flush();
 const approved=c.reviewFinish();holdVerification=true;assert(c.requestFinish(approved));await c.continueFinish();await until(()=>releaseVerification&& !c.state.saving);
 assert(m.currentFinishReceipt(c.state),'commit receipt is usable before the later shared-plan read ends');assert(m.safeToCloseEvening(c.state));assert(c.state.needsVerification);assert.equal(m.morningProgress(c.state).complete,false);
 const completed=structuredClone(c.state.finish);assert.equal(completed.compact,1);assert(!('approved' in completed));
 store.setItem('labula.prep-notes.v1.owner.pending.other','accepted feedback');storageEvent('labula.prep-notes.v1.owner.pending.other');assert.equal(m.safeToCloseEvening(c.state),false,'another accepted note prevents safe close');store.removeItem('labula.prep-notes.v1.owner.pending.other');storageEvent('labula.prep-notes.v1.owner.pending.other');assert(m.safeToCloseEvening(c.state));releaseVerification();holdVerification=false;await until(()=>!c.state.verifying);c.dispose();
 const legacy={...completed,approved,fingerprint:m.finishFingerprint(approved),dependencies:[]};delete legacy.compact;
 const legacyStore=h.storage();legacyStore.setItem(m.finishJournalPrefix('owner')+legacy.id,JSON.stringify(legacy));
 // Crash after replacement is written but before old journal is removed.
 let crash=true;const interrupted={...legacyStore,get length(){return legacyStore.length;},removeItem(k){if(crash&&k===m.finishJournalPrefix('owner')+legacy.id)throw Error('Synthetic interruption');legacyStore.removeItem(k);}};
 assert.throws(()=>m.compactCompletedFinishes(interrupted,'owner',h.owner.email),/interruption/);assert(legacyStore.getItem(m.finishReceiptPrefix('owner')+legacy.id));assert(legacyStore.getItem(m.finishJournalPrefix('owner')+legacy.id));crash=false;m.compactCompletedFinishes(interrupted,'owner',h.owner.email);assert.equal(legacyStore.getItem(m.finishJournalPrefix('owner')+legacy.id),null);
 // Refuse quota exhaustion without removing the only full receipt.
 const quota=h.storage();quota.setItem(m.finishJournalPrefix('owner')+legacy.id,JSON.stringify(legacy));const full={...quota,get length(){return quota.length;},setItem(){throw Error('Synthetic full storage');}};assert.throws(()=>m.compactCompletedFinishes(full,'owner',h.owner.email),/full storage/);assert.equal(quota.getItem(m.finishJournalPrefix('owner')+legacy.id),JSON.stringify(legacy));
 const long=h.storage(),pending={...legacy,id:crypto.randomUUID(),phase:'offline',createdAt:'2026-09-25T12:00:00.000Z',receipt:undefined,command:undefined,supersedes:legacy.id};long.setItem(m.finishJournalPrefix('owner')+pending.id,JSON.stringify(pending));long.setItem(m.finishJournalPrefix('owner')+legacy.id,JSON.stringify(legacy));const pendingBytes=long.getItem(m.finishJournalPrefix('owner')+pending.id);
 for(let i=0;i<500;i++){const id=crypto.randomUUID(),r={...legacy,id,createdAt:new Date(Date.UTC(2026,9,3,0,0,i)).toISOString(),command:{...legacy.command,id}};long.setItem(m.finishJournalPrefix('owner')+id,JSON.stringify(r));m.compactCompletedFinishes(long,'owner',h.owner.email,id);}
 assert.equal(long.getItem(m.finishJournalPrefix('owner')+pending.id),pendingBytes);const records=m.readFinishRecords(long,'owner',h.owner.email);assert(records.length<=23);assert(records.some(r=>r.id===legacy.id),'unfinished reference retains its receipt');assert([...long.records.values()].reduce((n,s)=>n+s.length*2,0)<500_000);
 // An unrelated newer complete record cannot supersede or hide an older approval.
 const recovery=h.storage(),second={...pending,id:crypto.randomUUID(),checkId:'2026-09-27',targetDay:'2026-09-29',approved:structuredClone(approved),createdAt:'2026-09-26T12:00:00.000Z',supersedes:undefined};second.approved.check.id=second.checkId;second.approved.check.targetDay=second.targetDay;second.fingerprint=m.finishFingerprint(second.approved);
 const late={...completed,id:crypto.randomUUID(),checkId:'2026-09-29',targetDay:'2026-09-30',createdAt:'2026-09-29T12:00:00.000Z',supersedes:pending.id,command:{...completed.command,checkId:'2026-09-29'},receipt:{...completed.receipt,checkId:'2026-09-29',targetDay:'2026-09-30'}};late.command.id=late.id;
 for(const r of [pending,second,late])recovery.setItem(('compact' in r?m.finishReceiptPrefix('owner'):m.finishJournalPrefix('owner'))+r.id,JSON.stringify(r));
 assert.equal(m.unresolvedFinishes(m.readFinishRecords(recovery,'owner',h.owner.email)).length,2);
 const offline=await client(recovery,h.day,async(url,init)=>init?.method==='POST'||url.includes('/sync')?Promise.reject(Error('Synthetic offline')):h.requester(url,init));await offline.continueFinish();assert.equal(offline.state.finish.id,pending.id);assert(offline.state.finishRecovery.some(r=>r.id===second.id));assert.equal(m.safeToCloseEvening(offline.state),false);assert.equal(recovery.getItem(m.finishJournalPrefix('owner')+second.id),JSON.stringify(second));
 const corrupted=h.storage();corrupted.setItem(m.finishJournalPrefix('owner')+'broken','{');const corrupt=new m.EveningController(h.owner.email,corrupted,{day:h.day},h.requester);clients.push(corrupt);assert.equal(await corrupt.refresh(),false);assert(corrupt.state.recoveryBlocked);assert.equal(corrupted.getItem(m.finishJournalPrefix('owner')+'broken'),'{');
 // A failed cleanup must not leave a newly accepted approval hidden on disk.
 await h.send({kind:'start',day:'2026-10-07',targetDay:'2026-10-08'});
 const blockedStore=h.storage();let refuseCompact=false;const blocked={...blockedStore,get length(){return blockedStore.length;},setItem(k,v){if(refuseCompact&&k.startsWith(m.finishReceiptPrefix('owner')))throw Error('Synthetic quota');blockedStore.setItem(k,v);}};
 const blockedClient=await client(blocked,'2026-10-07');for(const a of blockedClient.visibleCheck().answers)blockedClient.answer(a.itemId,'have');await blockedClient.flush();
 blockedStore.setItem(m.finishJournalPrefix('owner')+legacy.id,JSON.stringify(legacy));refuseCompact=true;assert.equal(blockedClient.requestFinish(blockedClient.reviewFinish()),false);assert.equal(m.readFinishRecords(blockedStore,'owner',h.owner.email).length,1);assert.equal(blockedClient.state.finish,undefined);
 console.log('PASS immediate receipt vs live freshness, other accepted work, legacy compaction, interrupted replacement, quota preservation, 500 completed checks bounded retention, protected ancestry, multiple unresolved dates, foreign supersedes and corrupt record retention.');
}finally{for(const c of clients)c.dispose();await sleep(20);h.db.close();if(priorWindow===undefined)delete globalThis.window;else globalThis.window=priorWindow;}
