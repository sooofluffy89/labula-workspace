import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const {build}=createRequire(path.resolve('package.json'))('esbuild');
const dir=await mkdtemp(path.join(tmpdir(),'labula-preparation-transition-'));
try{
 const react=path.join(dir,'hooks.mjs');
 await writeFile(react,`export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],v=>{h.values[i]=typeof v==='function'?v(h.values[i]):v;}];}export function useRef(initial){const h=globalThis.hooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export const useCallback=fn=>fn;export const useEffect=()=>{};`);
 const outfile=path.join(dir,'hook.mjs');
 await build({stdin:{contents:"export {useNotebook} from './app/use-notebook';export {initialNotebook} from './lib/notebook';export {reconcileDraft,applyBulkCommand} from './lib/bulk';export {makeNotebookDraft,planNotebookRestore} from './lib/notebook-draft';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,alias:{react},logLevel:'silent'});
 const {useNotebook:renderNotebookHook,initialNotebook,reconcileDraft,applyBulkCommand,makeNotebookDraft,planNotebookRestore}=await import(outfile);
 let server,revision,receipts,calls,gates,outcomes,isOwner;
 const account='chef@example.test',tick=()=>new Promise(r=>setImmediate(r));
 const render=()=>{hooks.cursor=0;return renderNotebookHook();};
 const snapshot=()=>({data:structuredClone(server),revision,user:account,updatedAt:'2026-09-13',updatedBy:account,isOwner});
 const pauseNextWrite=()=>{let enter,release;const began=new Promise(r=>enter=r),wait=new Promise(r=>release=r);const gate={enter,wait};gates.push(gate);return {began,release};};
 const reset=async()=>{
  globalThis.hooks={values:[],cursor:0};server=initialNotebook();revision=0;receipts=new Map();calls=[];gates=[];outcomes=[];isOwner=false;
  globalThis.fetch=async(url,opts={})=>{
   if(!opts.method)return Response.json(snapshot());
   const payload=JSON.parse(opts.body),id=opts.method==='PUT'?opts.headers['X-Operation-Id']:payload.commandId;
   calls.push({url,id,body:opts.body,revision:opts.headers['If-Match']});
   const gate=gates.shift();if(gate){gate.enter();await gate.wait;}
   const outcome=outcomes.shift();
   if(outcome==='400')return Response.json({error:'Rejected before saving'},{status:400});
   if(outcome==='401')return Response.json({error:'Sign in required'},{status:401});
   if(!receipts.has(id)){
    if(Number(opts.headers['If-Match'])!==revision)return Response.json({error:'Newer revision',code:'revision_conflict'},{status:409});
    server=opts.method==='PUT'?payload:applyBulkCommand(server,payload.command);revision++;receipts.set(id,{payload:opts.body,revision});
   }else assert.equal(receipts.get(id).payload,opts.body,'replayed receipt must retain exact payload');
   if(outcome==='lost')throw Error('Lost reply after commit');
   return Response.json(opts.method==='PUT'?{revision:receipts.get(id).revision,user:account,updatedAt:'2026-09-13',updatedBy:account}:snapshot());
  };
  let h=render();assert.equal(await h.load(),true);return render();
 };
 const setInactive=(h,index)=>h.update(n=>({...n,recipes:n.recipes.map((r,i)=>i===index?{...r,active:false}:r)}));
 const assertSame=()=>{const h=render();assert.deepEqual(h.data,server);assert.equal(h.dirty,false);assert.equal(h.savePending,false);};
 const assertProtected=(fn)=>{const before=JSON.stringify(render().data);assert.throws(fn);assert.equal(JSON.stringify(render().data),before);};
 let h=await reset();
 // The exact P1: two writes each followed by a further local edit. A true flush result must mean all edits are confirmed.
 setInactive(h,0);h=render();const first=pauseNextWrite(),second=pauseNextWrite();
 const flushing=h.flush();await first.began;setInactive(render(),1);first.release();await second.began;setInactive(render(),2);second.release();
 const flushed=await flushing;h=render();
 assert.equal(h.data.recipes[2].active,false,'last edit remains visible');
 if(flushed)assertSame();else{assert.equal(h.dirty,true);assert.notDeepEqual(h.data,server);}
 console.log('PASS flush cannot report success while newer local edits remain unsaved.');

 // A snapshot must have the current owner's signal, and must still reject dirty data during its initial flush.
 h=await reset();assertProtected(()=>h.acceptProfileSnapshot(snapshot(),new AbortController().signal));
 setInactive(h,0);h=render();const dirtyControl=new AbortController(),dirtyGate=pauseNextWrite(),dirtyBeginning=h.beginPreparation(dirtyControl.signal);
 await dirtyGate.began;assertProtected(()=>render().acceptProfileSnapshot(snapshot(),dirtyControl.signal));dirtyGate.release();(await dirtyBeginning)();
 // A revert makes dirty false while an older write remains in flight: the in-flight guard is independently required.
 h=await reset();const clean=structuredClone(h.data);setInactive(h,0);h=render();const paused=pauseNextWrite();const saving=h.save();await paused.began;
 render().update(()=>clean);h=render();assert.equal(h.dirty,false);const inflightControl=new AbortController(),inflightBeginning=h.beginPreparation(inflightControl.signal);
 assertProtected(()=>render().acceptProfileSnapshot(snapshot(),inflightControl.signal));paused.release();await saving;(await inflightBeginning)();
 console.log('PASS profile snapshot requires the owning signal and rejects dirty/in-flight state, including a clean-looking local revert.');

 h=await reset();assert.equal(typeof h.beginPreparation,'function','beginPreparation API exists');setInactive(h,0);h=render();
 const startingWrite=pauseNextWrite(),controller=new AbortController();
 const beginning=h.beginPreparation(controller.signal);
 assertProtected(()=>h.update(n=>n)); // Before React re-render or any awaited continuation.
 assert.equal(render().preparationBusy,true,'visible state reports the lease');
 await startingWrite.began;assertProtected(()=>render().update(n=>n));startingWrite.release();const release=await beginning;
 assert.equal(typeof release,'function');assertSame();assertProtected(()=>render().update(n=>n));
 // Fresh shared snapshot may safely refresh only the clean leased notebook.
 server.recipes[3].active=false;revision++;render().acceptProfileSnapshot(snapshot(),controller.signal);assertSame();assertProtected(()=>render().update(n=>n));
 assertProtected(()=>render().acceptProfileSnapshot(snapshot(),new AbortController().signal));
 assertProtected(()=>render().acceptProfileSnapshot({...snapshot(),revision:revision-1},controller.signal));
 assertProtected(()=>render().acceptProfileSnapshot({...snapshot(),user:'other@example.test'},controller.signal));
 assert.equal(await render().load(),false,'shared reload cannot bypass the preparation lease');
 const blockedCommand={recipeId:render().data.recipes[0].id,rows:reconcileDraft('Blocked',[],[])};
 assert.equal((await render().runBulk(blockedCommand)).ok,false,'ordinary bulk save cannot bypass the preparation lease');
 await assert.rejects(render().beginPreparation(new AbortController().signal),'second concurrent owner is rejected');
 release();release();assert.equal(render().preparationBusy,false);const newerControl=new AbortController(),newerRelease=await render().beginPreparation(newerControl.signal);release();assert.equal(render().preparationBusy,true);assertProtected(()=>render().update(n=>n));newerRelease();assertProtected(()=>render().acceptProfileSnapshot(snapshot(),controller.signal));setInactive(render(),4);assert.equal(render().data.recipes[4].active,false);
 console.log('PASS beginPreparation synchronously freezes ordinary edits, confirms earlier changes, accepts a clean snapshot, and holds until idempotent release.');

 // Normal autosave must continue to accept typing outside the transition.
 h=await reset();setInactive(h,0);h=render();const normalGate=pauseNextWrite();const normalSave=h.save();await normalGate.began;
 setInactive(render(),1);normalGate.release();assert.equal(await normalSave,true);assert.equal(render().dirty,true);assert.equal(render().data.recipes[1].active,false);
 const normalRelease=await render().beginPreparation(new AbortController().signal);assertSame();normalRelease();
 console.log('PASS ordinary edits during ordinary autosave remain allowed and survive the next preparation transition.');

 // Failed flush cannot leave a preparation lease behind; rejected work remains an editable ordinary draft.
 h=await reset();setInactive(h,0);h=render();outcomes.push('400');
 await assert.rejects(h.beginPreparation(new AbortController().signal));assert.equal(render().preparationBusy,false);assert.equal(render().dirty,true);setInactive(render(),1);
 const retryRelease=await render().beginPreparation(new AbortController().signal);assertSame();retryRelease();
 // Pre-aborted calls must never reserve a token.
 const alreadyAborted=new AbortController();alreadyAborted.abort();await assert.rejects(render().beginPreparation(alreadyAborted.signal));setInactive(render(),2);
 console.log('PASS failed and pre-aborted preparation opening retain the ordinary draft without leaving a stale lock.');

 // Aborting does not chain an additional save or erase edits made after cancellation.
 h=await reset();setInactive(h,0);h=render();const cancelOnlyGate=pauseNextWrite(),cancelOnly=new AbortController();
 const cancelledStart=h.beginPreparation(cancelOnly.signal).then(()=>({ok:true}),error=>({ok:false,error}));await cancelOnlyGate.began;cancelOnly.abort();
 setInactive(render(),1);cancelOnlyGate.release();assert.equal((await cancelledStart).ok,false);assert.equal(calls.length,1);assert.equal(render().dirty,true);assert.equal(render().data.recipes[1].active,false);assert.equal(server.recipes[1].active,true);assert.equal(render().preparationBusy,false);
 console.log('PASS cancellation does not send follow-up writes or discard edits made after cancellation.');

 // An abort during a pending save releases this generation, without allowing its late continuation to unlock a newer one.
 h=await reset();setInactive(h,0);h=render();const abortGate=pauseNextWrite(),oldControl=new AbortController();
 const abandoned=h.beginPreparation(oldControl.signal);const abandonedOutcome=abandoned.then(()=>({ok:true}),error=>({ok:false,error}));await abortGate.began;
 oldControl.abort();await tick();setInactive(render(),1);
 const nextControl=new AbortController(),successor=render().beginPreparation(nextControl.signal);assertProtected(()=>render().update(n=>n));
 abortGate.release();const outcome=await abandonedOutcome;assert.equal(outcome.ok,false,'aborted opening cannot report a live lease');
 const successorRelease=await successor;assertSame();assertProtected(()=>render().update(n=>n));
 successorRelease();assert.equal(render().preparationBusy,false);setInactive(render(),2);
 console.log('PASS abort during save preserves edits; an abandoned continuation cannot release the successor preparation lease.');

 // Pending ordinary receipt and bulk operation each prevent opportunistic snapshot replacement.
 h=await reset();setInactive(h,0);h=render();outcomes.push('lost');assert.equal(await h.save(),false);h=render();const pendingSave=h.getSaveRecovery();assert.ok(pendingSave);
 const pendingControl=new AbortController(),pendingGate=pauseNextWrite(),pendingBeginning=h.beginPreparation(pendingControl.signal);await pendingGate.began;
 assertProtected(()=>render().acceptProfileSnapshot(snapshot(),pendingControl.signal));assert.deepEqual(render().getSaveRecovery(),pendingSave);pendingGate.release();(await pendingBeginning)();assertSame();
 h=await reset();const command={recipeId:h.data.recipes[0].id,rows:reconcileDraft('Coriander',[],[])};outcomes.push('lost');assert.equal((await h.runBulk(command)).pending,true);h=render();const pendingBulk=h.getBulkRecovery();assert.ok(pendingBulk);
 assertProtected(()=>h.acceptProfileSnapshot(snapshot(),new AbortController().signal));assert.deepEqual(render().getBulkRecovery(),pendingBulk);
 await assert.rejects(render().beginPreparation(new AbortController().signal));assert.deepEqual(render().getBulkRecovery(),pendingBulk);
 console.log('PASS unconfirmed ordinary and bulk receipts block snapshot replacement and retain exact recovery.');

 // Import-related ordinary recovery remains resolvable before acquiring the preparation lease.
 h=await reset();setInactive(h,0);h=render();outcomes.push('lost');await h.save();const importedReceipt=render().getSaveRecovery();assert.ok(importedReceipt);
 globalThis.hooks={values:[],cursor:0};h=render();await h.load();h=render();assert.equal(h.restoreSaveRecovery(importedReceipt).ok,true);
 const importedRelease=await render().beginPreparation(new AbortController().signal);assertSame();assert.equal(render().getSaveRecovery(),null);importedRelease();
 console.log('PASS imported ordinary-save recovery is confirmed before preparation starts.');
 // A pending imported request with later local edits drains both exact payloads before opening.
 h=await reset();setInactive(h,0);h=render();const importGate=pauseNextWrite();outcomes.push('lost');const importSaving=h.save();await importGate.began;
 setInactive(render(),1);const importWithExtra=render().getSaveRecovery();assert.ok(importWithExtra);assert.notEqual(importWithExtra.localPayload,importWithExtra.payload);importGate.release();await importSaving;
 globalThis.hooks={values:[],cursor:0};h=render();await h.load();h=render();assert.equal(h.restoreSaveRecovery(importWithExtra).ok,true);
 const extraRelease=await render().beginPreparation(new AbortController().signal);assertSame();assert.equal(server.recipes[0].active,false);assert.equal(server.recipes[1].active,false);assert.equal(render().getSaveRecovery(),null);extraRelease();
 console.log('PASS imported ordinary-save recovery retains additional local edits before preparation starts.');

 // All recovery entry points preserve a clean notebook while a preparation lease is held.
 h=await reset();isOwner=true;await h.load();h=render();assert.equal(h.isOwner,true);
 const guardedControl=new AbortController(),guardedRelease=await h.beginPreparation(guardedControl.signal),guardedPayload=JSON.stringify(render().data),guardedCalls=calls.length;
 const guardedSave={id:crypto.randomUUID(),revision,payload:guardedPayload,localPayload:guardedPayload};
 const guardedBulk={id:crypto.randomUUID(),revision,command:{recipeId:render().data.recipes[0].id,rows:reconcileDraft('Must stay staged',[],[])}};
 const guardedCatalog={id:crypto.randomUUID(),revision,operation:{kind:'aliases',itemId:'test-item',aliases:['test alias']}};
 assert.equal(render().restoreSaveRecovery(guardedSave).ok,false);assert.equal(render().getSaveRecovery(),null);
 assert.equal(render().restoreBulkRecovery(guardedBulk).ok,false);assert.equal(render().getBulkRecovery(),null);
 assert.equal(render().restoreCatalogRecovery(guardedCatalog).ok,false);assert.equal(render().getCatalogRecovery(),null);
 assert.equal((await render().reconcileImported()).ok,false);assert.equal(render().useSharedAfterRecovery().ok,false);
 assert.equal(calls.length,guardedCalls);assert.equal(JSON.stringify(render().data),guardedPayload);assert.equal(render().preparationBusy,true);guardedRelease();
 console.log('PASS active preparation blocks ordinary/bulk/catalog recovery, import reconciliation and shared-version replacement.');

 // A denied first attempt keeps its original command and draft for explicit same-account retry.
 h=await reset();setInactive(h,0);h=render();outcomes.push('401');
 await assert.rejects(h.beginPreparation(new AbortController().signal));h=render();
 assert.equal(h.preparationBusy,false);assert.equal(h.unauthorized,true);assert.equal(h.dirty,true);assert.ok(h.getSaveRecovery());assert.equal(receipts.size,0);
 assert.equal(h.data.recipes[0].active,false);assert.equal(server.recipes[0].active,true);assertProtected(()=>setInactive(h,1));
 // The transport now represents the same user after signing in again.
 assert.equal(await render().retry(),true);assertSame();assert.equal(server.recipes[0].active,false);assert.equal(server.recipes[1].active,true);setInactive(render(),1);
 const reauthenticatedRelease=await render().beginPreparation(new AbortController().signal);reauthenticatedRelease();
 // If an earlier response was lost, a later 401 must retain that exact original receipt.
 h=await reset();setInactive(h,0);h=render();outcomes.push('lost');assert.equal(await h.save(),false);const before401=render().getSaveRecovery();assert.ok(before401);
 outcomes.push('401');await assert.rejects(render().beginPreparation(new AbortController().signal));h=render();
 assert.equal(h.preparationBusy,false);assert.equal(h.unauthorized,true);assert.equal(h.savePending,true);assert.deepEqual(h.getSaveRecovery(),before401);assert.equal(receipts.size,1);assertProtected(()=>h.update(n=>n));
 assert.equal(await h.retry(),true);assertSame();assert.equal(receipts.size,1);assert.ok(calls.every(c=>c.id===before401.id&&c.body===before401.payload));
 console.log('PASS 401 releases only the preparation lease, preserves local work and retains uncertain receipts for same-account retry.');

 // A competing writer wins the revision before preparation begins. Export / load / review / save keeps both users' changes.
 h=await reset();setInactive(h,0);h=render();server.recipes[3].active=false;revision++;
 await assert.rejects(h.beginPreparation(new AbortController().signal));h=render();
 assert.equal(h.preparationBusy,false);assert.equal(h.dirty,true);assert.equal(h.getSaveRecovery(),null);assert.equal(h.data.recipes[0].active,false);assert.equal(server.recipes[0].active,true);assert.equal(server.recipes[3].active,false);assert.equal(receipts.size,0);
 const conflictBackup=makeNotebookDraft(h.data,h.getSavedBase(),account,[],h.getSaveRecovery(),null,null);
 assert.equal(await h.load(),true);h=render();assert.equal(h.data.recipes[3].active,false);
 const conflictPlan=planNotebookRestore(conflictBackup,h.data);assert.equal(conflictPlan.unresolved,0);assert.equal(conflictPlan.error,'');assert.equal(conflictPlan.next.recipes[0].active,false);assert.equal(conflictPlan.next.recipes[3].active,false);
 h.update(()=>conflictPlan.next);assert.equal(await render().retry(),true);assertSame();assert.equal(server.recipes[0].active,false);assert.equal(server.recipes[3].active,false);
 const reviewedRelease=await render().beginPreparation(new AbortController().signal);reviewedRelease();
 console.log('PASS revision conflict releases the lease and preserves both local and foreign edits through draft export / restore review.');

 // Exercise the production 30-second deadline without waiting wall-clock time.
 const nativeSetTimeout=globalThis.setTimeout,nativeClearTimeout=globalThis.clearTimeout,deadlines=new Map();let deadlineId=80000;
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===30000){const id=++deadlineId;deadlines.set(id,()=>fn(...args));return id;}return nativeSetTimeout(fn,ms,...args);};
 globalThis.clearTimeout=id=>{if(deadlines.has(id))deadlines.delete(id);else nativeClearTimeout(id);};
 try{
  for(const committed of [false,true]){
   h=await reset();setInactive(h,0);h=render();const baseTransport=globalThis.fetch;
   let entered,releaseLate,capturedRequest;const began=new Promise(r=>entered=r);
   globalThis.fetch=async(url,opts={})=>{
    capturedRequest=opts;
    if(committed){const response=await baseTransport(url,opts),body=await response.json();entered();return {ok:true,status:200,json:()=>new Promise(r=>releaseLate=()=>r(body))};}
    entered();return new Promise(r=>releaseLate=async()=>r(await baseTransport(url,opts)));
   };
   const timeoutControl=new AbortController(),timeoutBeginning=h.beginPreparation(timeoutControl.signal).then(()=>({ok:true}),error=>({ok:false,error}));
   await began;assert.equal(render().preparationBusy,true);assertProtected(()=>render().update(n=>n));assert.equal(deadlines.size,1);[...deadlines.values()][0]();
   const timedOut=await timeoutBeginning;assert.equal(timedOut.ok,false);h=render();assert.equal(h.preparationBusy,false);assert.equal(h.savePending,true);assert.equal(h.dirty,true);assert.equal(capturedRequest.signal.aborted,true);assert.match(h.error,/too long|retry/i);
   const timeoutReceipt=h.getSaveRecovery();assert.ok(timeoutReceipt);assert.equal(timeoutReceipt.id,capturedRequest.headers['X-Operation-Id']);assert.equal(timeoutReceipt.payload,capturedRequest.body);assert.equal(timeoutReceipt.localPayload,JSON.stringify(h.data));
   assert.equal(h.data.recipes[0].active,false);assert.equal(server.recipes[0].active,!committed);assertProtected(()=>h.update(n=>n));
   // Existing Retry saving confirms the same receipt, regardless of whether the timed-out request committed.
   globalThis.fetch=baseTransport;assert.equal(await h.retry(),true);assertSame();assert.equal(receipts.size,1);assert.ok(calls.every(c=>c.id===timeoutReceipt.id&&c.body===timeoutReceipt.payload));
   const confirmedSnapshot=JSON.stringify(render().data);await releaseLate();await tick();assert.equal(JSON.stringify(render().data),confirmedSnapshot);assert.equal(render().getSaveRecovery(),null);assert.equal(receipts.size,1);assert.equal(deadlines.size,0);
   const afterTimeoutRelease=await render().beginPreparation(new AbortController().signal);assertSame();afterTimeoutRelease();
   console.log('PASS preparation opening timeout '+(committed?'after commit / during response body':'before commit / during network')+': token released, exact recovery retained, retry idempotent, late response ignored.');
  }
 }finally{globalThis.setTimeout=nativeSetTimeout;globalThis.clearTimeout=nativeClearTimeout;}
 console.log('PASS preparation transition regression suite.');
}finally{await rm(dir,{recursive:true,force:true});}
