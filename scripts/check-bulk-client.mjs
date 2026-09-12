import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-client-'));
try{
 const stub=path.join(dir,'hooks.mjs');
 await writeFile(stub,`export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],v=>{h.values[i]=typeof v==='function'?v(h.values[i]):v;}];}export function useRef(initial){const h=globalThis.hooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export const useCallback=fn=>fn;export const useEffect=()=>{};`);
 const outfile=path.join(dir,'client.mjs');await build({stdin:{contents:"export {useNotebook} from './app/use-notebook';export {initialNotebook} from './lib/notebook';export {reconcileDraft,applyBulkCommand} from './lib/bulk';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,alias:{react:stub},logLevel:'silent'});
 const {useNotebook,initialNotebook,reconcileDraft,applyBulkCommand}=await import(outfile);
 let server,revision,receipts,calls,mode,gate,arrived;
 const render=()=>{globalThis.hooks.cursor=0;return useNotebook();};
 const freshPage=async()=>{globalThis.hooks={values:[],cursor:0};const next=render();assert.equal(await next.load(),true);return render();};
 const reset=async()=>{globalThis.hooks={values:[],cursor:0};server=initialNotebook();revision=0;receipts=new Map();calls=[];mode='ok';globalThis.fetch=async(url,options={})=>{
  if(!options.method)return Response.json({data:server,revision,updatedAt:'2026-09-12',updatedBy:'test',isOwner:false});
  const data=JSON.parse(options.body),id=options.method==='PUT'?options.headers['X-Operation-Id']:data.commandId;
  calls.push({url,id,body:options.body,revision:options.headers['If-Match']});
  if(mode==='gate'){arrived();await gate;}
  if(mode==='mismatch')return Response.json({error:'Different account',code:'command_mismatch'},{status:409});
  if(mode==='unauthorized')return Response.json({error:'Sign in required'},{status:401});
  if(mode==='reject'){mode='ok';return Response.json({error:'Rejected before saving'},{status:400});}
  if(!receipts.has(id)){
   if(Number(options.headers['If-Match'])!==revision)return Response.json({error:'Newer version',code:'revision_conflict'},{status:409});
   server=options.method==='PUT'?data:applyBulkCommand(server,data.command);revision++;receipts.set(id,{revision,body:options.body});
  }else assert.equal(receipts.get(id).body,options.body,'same ID must keep identical payload');
  if(mode==='lost'){mode='ok';throw new TypeError('Response lost after commit');}
  return Response.json(options.method==='PUT'?{revision:receipts.get(id).revision,updatedAt:'2026-09-12',updatedBy:'test'}:{data:server,revision,updatedAt:'2026-09-12',updatedBy:'test',isOwner:false});
 };let h=render();await h.load();return render();};
 let h=await reset();const recipeId=h.data.recipes[0].id;let rows=reconcileDraft('Coriander\nSalt',[],[]);mode='reject';let result=await h.runBulk({recipeId,rows});h=render();assert.equal(result.ok,false);assert.equal(result.pending,false);assert.equal(h.data.items.length,0);assert.equal(server.items.length,0);rows=reconcileDraft('Salt',rows,[]);assert.equal((await h.runBulk({recipeId,rows})).ok,true);h=render();assert.deepEqual(h.data.items.map(i=>i.name),['Salt']);
 h=await reset();mode='lost';const command={recipeId,rows:reconcileDraft('Garlic\nGinger',[],[])};result=await h.runBulk(command);h=render();assert.equal(result.pending,true);assert.equal(h.data.items.length,0);assert.equal(server.items.length,2);assert.throws(()=>h.update(n=>n),/pending/);assert.equal((await h.runBulk({...command,recipeId:'other'})).pending,true);assert.equal(calls.length,1);mode='unauthorized';result=await h.runBulk(command);h=render();assert.equal(result.pending,true);assert.equal(h.unauthorized,true);mode='ok';server.recipes[0].recorded=true;revision++;result=await h.runBulk(command);h=render();assert.equal(result.ok,true);assert.equal(h.data.recipes[0].recorded,true);assert.equal(new Set(calls.map(c=>c.id)).size,1);assert.equal(new Set(calls.map(c=>c.body)).size,1);
 // An earlier autosave loses its reply; preflush must reuse its receipt before bulk.
 h=await reset();h.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Existing local edit',[],[])}));h=render();mode='lost';assert.equal(await h.save(),false);h=render();assert.equal((await h.runBulk({recipeId,rows:reconcileDraft('Bulk addition',[],[])})).ok,true);h=render();assert.deepEqual(h.data.items.map(i=>i.name),['Existing local edit','Bulk addition']);assert.equal(calls[0].id,calls[1].id);assert.notEqual(calls[1].id,calls[2].id);
 // Keep staged data out of the notebook while a request is in flight; ignore double submit.
 h=await reset();let release;gate=new Promise(r=>release=r);const started=new Promise(r=>arrived=r);mode='gate';const first=h.runBulk(command);await started;assert.equal(render().data.items.length,0);assert.equal((await h.runBulk(command)).ok,false);assert.equal(calls.length,1);mode='ok';release();assert.equal((await first).ok,true);
 // A stale version must keep the proposal and require review, not overwrite newer data.
 h=await reset();server.recipes[1].active=false;revision++;result=await h.runBulk(command);assert.equal(result.conflict,true);assert.equal(server.items.length,0);h=render();assert.equal((await h.refreshBulk()).ok,true);h=render();assert.equal(h.data.recipes[1].active,false);assert.equal((await h.runBulk(command)).ok,true);
 // Export during first in-flight attempt, then restore after losing the entire page.
 h=await reset();gate=new Promise(r=>release=r);const exporting=new Promise(r=>arrived=r);mode='gate';const original=h.runBulk(command);await exporting;const backup=render().getBulkRecovery();assert.ok(backup);assert.deepEqual(backup.command,command);mode='lost';release();await original;assert.equal(server.items.length,2);
 globalThis.hooks={values:[],cursor:0};h=render();await h.load();h=render();assert.equal(h.restoreBulkRecovery(backup).ok,true);h=render();assert.equal(h.getBulkRecovery().id,backup.id);assert.equal(calls.length,1,'restoring performs no POST');
 mode='mismatch';result=await h.runBulk(command);assert.equal(result.pending,true);assert.equal(result.code,'command_mismatch');assert.match(result.error,/account/);mode='unauthorized';assert.equal((await render().runBulk(command)).pending,true);
 mode='ok';server.recipes[1].active=false;revision++;assert.equal((await render().runBulk(command)).ok,true);h=render();assert.equal(h.data.items.length,2);assert.equal(h.data.recipes[1].active,false);assert.equal(receipts.size,1);assert.ok(calls.every(c=>c.id===backup.id));
 h=await reset();h.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Unsaved ingredient',[],[])}));h=render();assert.equal(h.restoreBulkRecovery(backup).ok,false);assert.equal(h.getBulkRecovery(),null);assert.equal(h.data.items.length,1);

 // Controlled deadlines use the production helper, without waiting 30 wall-clock seconds.
 const nativeSetTimeout=globalThis.setTimeout,nativeClearTimeout=globalThis.clearTimeout;const deadlines=new Map();let nextTimer=50000;
 globalThis.setTimeout=(fn,ms,...args)=>{if(ms===30000){const id=++nextTimer;deadlines.set(id,()=>fn(...args));return id;}return nativeSetTimeout(fn,ms,...args);};
 globalThis.clearTimeout=id=>{if(deadlines.has(id))deadlines.delete(id);else nativeClearTimeout(id);};
 const settle=()=>new Promise(r=>setImmediate(r));const expire=()=>{assert.equal(deadlines.size,1);[...deadlines.values()][0]();};
 try{
  // No response before timeout; late server execution cannot overwrite a newer successful retry.
  h=await reset();let baseFetch=globalThis.fetch,releaseFetch,startedFetch;const entered=new Promise(r=>startedFetch=r);let firstSignal;
  globalThis.fetch=async(url,opts)=>{firstSignal=opts.signal;startedFetch();return new Promise(resolve=>releaseFetch=async()=>resolve(await baseFetch(url,opts)));};
  let attempt=h.runBulk(command);await entered;expire();result=await attempt;assert.equal(result.pending,true);assert.equal(firstSignal.aborted,true);h=render();assert.equal(h.operating,false);const originalId=h.getBulkRecovery().id;
  globalThis.fetch=baseFetch;assert.equal((await h.runBulk(command)).ok,true);h=render();h.update(n=>({...n,recipes:n.recipes.map((r,i)=>i===1?{...r,active:false}:r)}));h=render();const currentAfterRetry=JSON.stringify(h.data);await releaseFetch();await settle();h=render();assert.equal(JSON.stringify(h.data),currentAfterRetry);assert.equal(h.operationPending,false);assert.equal(receipts.size,1);assert.equal(calls.filter(c=>c.url==='/api/bulk').every(c=>c.id===originalId),true);
  // Headers arrive but the body never completes; old JSON arriving later stays ignored.
  h=await reset();baseFetch=globalThis.fetch;let releaseBody;const responseStarted=new Promise(r=>startedFetch=r);
  globalThis.fetch=async(url,opts)=>{const response=await baseFetch(url,opts),stale=await response.json();startedFetch();return {ok:true,status:200,json:()=>new Promise(resolve=>releaseBody=()=>resolve(stale))};};
  attempt=h.runBulk(command);await responseStarted;expire();result=await attempt;assert.equal(result.pending,true);assert.equal(server.items.length,2);globalThis.fetch=baseFetch;server.recipes[0].recorded=true;revision++;
  assert.equal((await render().runBulk(command)).ok,true);releaseBody();await settle();h=render();assert.equal(h.data.recipes[0].recorded,true);assert.equal(h.revision,revision);assert.equal(receipts.size,1);assert.equal(h.operating,false);
  // A blocked preflush must not send any bulk request; repeat the original PUT first.
  h=await reset();h.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Earlier edit',[],[])}));h=render();baseFetch=globalThis.fetch;let releasePut;const putStarted=new Promise(r=>startedFetch=r);
  globalThis.fetch=async(url,opts)=>{const response=await baseFetch(url,opts);startedFetch();return new Promise(resolve=>releasePut=()=>resolve(response));};
  attempt=h.runBulk(command);await putStarted;expire();result=await attempt;h=render();assert.equal(result.pending,false);assert.equal(h.savePending,true);assert.equal(h.saving,false);assert.equal(calls.every(c=>c.url==='/api/notebook'),true);assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false);
  globalThis.fetch=baseFetch;assert.equal((await h.runBulk(command)).ok,true);assert.equal(calls[0].id,calls[1].id);releasePut();await settle();assert.equal(render().data.items.length,3);
  // dirty=false does not hide an uncertain original PUT after a local revert.
  h=await reset();const blank=structuredClone(h.data);h.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Reverted edit',[],[])}));h=render();baseFetch=globalThis.fetch;
  globalThis.fetch=async()=>new Promise(()=>{});attempt=h.save();await settle();h.update(()=>blank);h=render();assert.equal(h.dirty,false);expire();await attempt;h=render();assert.equal(h.savePending,true);assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false);
  globalThis.fetch=baseFetch;await h.retry();h=render();assert.equal(h.savePending,false);assert.equal(h.data.items.length,0);assert.equal(server.items.length,0);

  // Export the exact pending PUT plus edits made while it was in flight.
  const exportedSave=async(extra=false)=>{
   let client=await reset();client.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Earlier saved ingredient',[],[])}));client=render();
   let releaseSave;gate=new Promise(resolve=>releaseSave=resolve);const began=new Promise(resolve=>arrived=resolve);mode='gate';const saving=client.save();await began;
   if(extra){client.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Additional local ingredient',[],n.items)}));client=render();}
   const recovery=client.getSaveRecovery();assert.ok(recovery);assert.equal(recovery.id,calls[0].id);assert.equal(String(recovery.revision),calls[0].revision);assert.equal(recovery.payload,calls[0].body);assert.equal(recovery.localPayload,JSON.stringify(client.data));
   assert.equal(JSON.parse(recovery.payload).items.length,1);assert.equal(JSON.parse(recovery.localPayload).items.length,extra?2:1);
   mode='lost';releaseSave();assert.equal(await saving,false);assert.equal(receipts.size,1);return recovery;
  };
  // Fresh-page receipt replay adopts a fresh GET, never the historical PUT revision.
  for(const extra of [false,true])for(const foreign of [false,true]){
   const recovery=await exportedSave(extra);if(foreign){server.recipes[1].active=false;revision++;}
   h=await freshPage();const freshSnapshot=JSON.stringify(h.data),writesBeforeRestore=calls.length;assert.equal(h.restoreSaveRecovery(recovery).ok,true);h=render();
   assert.equal(JSON.stringify(h.data),freshSnapshot,'restoring must not replace the current notebook with the old payload');assert.equal(calls.length,writesBeforeRestore,'restoring performs no PUT or bulk POST');assert.equal(h.savePending,true);assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false);
   result=await h.retryEarlierSave();h=render();
   if(extra&&foreign){
    assert.equal(result.ok,false);assert.equal(h.saveRecoveryConflict,true);assert.equal(h.savePending,true);assert.deepEqual(h.getSaveRecovery(),recovery);assert.equal(h.data.items.length,1);assert.equal(h.data.recipes[1].active,false);assert.equal(h.revision,revision);
    assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false);const beforeBlocked=calls.length;assert.equal((await h.runBulk(command)).ok,false);assert.equal(calls.length,beforeBlocked);assert.equal(receipts.size,1);
    assert.equal(h.useSharedAfterRecovery().ok,true);h=render();assert.equal(h.saveRecoveryConflict,false);assert.equal(h.savePending,false);assert.equal(h.getSaveRecovery(),null);assert.equal(h.data.items.length,1);assert.equal(h.data.recipes[1].active,false);assert.equal(calls.length,beforeBlocked,'choosing shared version performs no write');
   }else{
    assert.equal(result.ok,true);assert.equal(h.savePending,false);assert.equal(h.saveRecoveryConflict,false);assert.equal(h.getSaveRecovery(),null);assert.equal(h.dirty,false);assert.equal(h.revision,revision);assert.equal(h.data.items.length,extra?2:1);assert.equal(h.data.recipes[1].active,!foreign);assert.equal(receipts.size,extra?2:1);
    if(extra){assert.notEqual(calls.at(-1).id,recovery.id);assert.equal(calls.at(-1).body,recovery.localPayload,'extra local edits use their exact saved payload');}
   }
   assert.equal(calls[1].id,recovery.id);assert.equal(calls[1].body,recovery.payload);assert.equal(calls.every(call=>call.url==='/api/notebook'),true,'save recovery must not add bulk ingredients before review');
  }
  // Foreign edit between the replay GET and the extra-local PUT remains recoverable.
  let saveBackup=await exportedSave(true);h=await freshPage();assert.equal(h.restoreSaveRecovery(saveBackup).ok,true);h=render();baseFetch=globalThis.fetch;let injected=false;
  globalThis.fetch=async(url,opts={})=>{if(opts.method==='PUT'&&opts.headers['X-Operation-Id']!==saveBackup.id&&!injected){injected=true;server.recipes[1].active=false;revision++;}return baseFetch(url,opts);};
  result=await h.retryEarlierSave();h=render();assert.equal(injected,true);assert.equal(result.ok,false);assert.equal(h.saveRecoveryConflict,true);assert.equal(h.savePending,true);assert.equal(h.data.recipes[1].active,false);assert.equal(h.data.items.length,1);assert.equal(receipts.size,1);
  const extraRecovery=h.getSaveRecovery();assert.ok(extraRecovery);assert.notEqual(extraRecovery.id,saveBackup.id);assert.equal(extraRecovery.payload,saveBackup.localPayload);assert.equal(extraRecovery.localPayload,saveBackup.localPayload);assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false);assert.equal(calls.every(call=>call.url==='/api/notebook'),true);globalThis.fetch=baseFetch;
  const extraWrites=calls.length;assert.equal(h.useSharedAfterRecovery().ok,true);assert.equal(calls.length,extraWrites);assert.equal(render().getSaveRecovery(),null);
  // The extra-local recovery PUT stays frozen even before it becomes uncertain.
  saveBackup=await exportedSave(true);h=await freshPage();assert.equal(h.restoreSaveRecovery(saveBackup).ok,true);h=render();baseFetch=globalThis.fetch;let releaseExtra,enteredExtra;const extraStarted=new Promise(resolve=>enteredExtra=resolve),extraGate=new Promise(resolve=>releaseExtra=resolve);
  globalThis.fetch=async(url,opts={})=>{if(opts.method==='PUT'&&opts.headers['X-Operation-Id']!==saveBackup.id){enteredExtra();await extraGate;}return baseFetch(url,opts);};
  attempt=h.retryEarlierSave();await extraStarted;h=render();assert.equal(h.savePending,true);let blockedExtra=false;try{h.update(n=>n);}catch(e){blockedExtra=/pending/.test(e.message);}releaseExtra();assert.equal((await attempt).ok,true);globalThis.fetch=baseFetch;assert.equal(blockedExtra,true,'ref guard must reject edits until the restored extra PUT is fully confirmed');
  // An original PUT which never applied cannot be replayed over a foreign revision.
  h=await reset();h.update(n=>applyBulkCommand(n,{recipeId,rows:reconcileDraft('Never applied ingredient',[],[])}));h=render();let releaseUnsent;gate=new Promise(resolve=>releaseUnsent=resolve);const unsentBegan=new Promise(resolve=>arrived=resolve);mode='gate';attempt=h.save();await unsentBegan;saveBackup=h.getSaveRecovery();server.recipes[1].active=false;revision++;mode='ok';releaseUnsent();assert.equal(await attempt,false);assert.equal(receipts.size,0);
  h=await freshPage();assert.equal(h.restoreSaveRecovery(saveBackup).ok,true);result=await render().retryEarlierSave();h=render();assert.equal(result.ok,false);assert.equal(h.saveRecoveryConflict,true);assert.deepEqual(h.getSaveRecovery(),saveBackup);assert.equal(h.data.items.length,0);assert.equal(h.data.recipes[1].active,false);assert.equal(receipts.size,0);assert.throws(()=>h.update(n=>n),/pending/);
  // Authentication failures retain the same restored receipt and exact payload.
  saveBackup=await exportedSave(false);h=await freshPage();assert.equal(h.restoreSaveRecovery(saveBackup).ok,true);
  for(const failureMode of ['unauthorized','mismatch']){mode=failureMode;result=await render().retryEarlierSave();h=render();assert.equal(result.ok,false);assert.equal(h.savePending,true);assert.equal(h.saveRecoveryConflict,false);assert.deepEqual(h.getSaveRecovery(),saveBackup);assert.equal(calls.at(-1).id,saveBackup.id);assert.equal(calls.at(-1).body,saveBackup.payload);}
  mode='ok';assert.equal((await render().retryEarlierSave()).ok,true);assert.equal(render().getSaveRecovery(),null);assert.equal(receipts.size,1);
  // A confirmed receipt still stays frozen until its following GET can be read.
  saveBackup=await exportedSave(false);h=await freshPage();assert.equal(h.restoreSaveRecovery(saveBackup).ok,true);h=render();baseFetch=globalThis.fetch;let gotRead;const readStarted=new Promise(resolve=>gotRead=resolve);
  globalThis.fetch=async(url,opts={})=>{if(!opts.method){gotRead();return new Promise(()=>{});}return baseFetch(url,opts);};attempt=h.retryEarlierSave();await readStarted;expire();result=await attempt;h=render();assert.equal(result.ok,false);assert.equal(h.savePending,true);assert.deepEqual(h.getSaveRecovery(),saveBackup);assert.throws(()=>h.update(n=>n),/pending/);assert.equal(receipts.size,1);
  globalThis.fetch=baseFetch;server.recipes[1].active=false;revision++;assert.equal((await h.retryEarlierSave()).ok,true);h=render();assert.equal(h.savePending,false);assert.equal(h.revision,revision);assert.equal(h.data.recipes[1].active,false);assert.equal(h.dirty,false);assert.equal(receipts.size,1);assert.equal(calls.every(call=>call.url==='/api/notebook'&&call.id===saveBackup.id),true);
  assert.equal(deadlines.size,0,'settled requests clear their deadline timers');
 }finally{globalThis.setTimeout=nativeSetTimeout;globalThis.clearTimeout=nativeClearTimeout;}
 console.log('Passed client transitions: staged/frozen bulk; deadline and late replies; exact ordinary recovery exports; fresh-page PUT/GET replay; retained extra edits; foreign-write conflicts; explicit shared-version choice; authentication and GET timeout recovery.');
}finally{await rm(dir,{recursive:true,force:true});}
