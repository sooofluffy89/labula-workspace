import assert from 'node:assert/strict';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';

const dir=await mkdtemp(join(tmpdir(),'workspace-policy-recovery-')),originalFetch=globalThis.fetch;
try{
 const hooks=join(dir,'hooks.mjs');
 await writeFile(hooks,`export function useState(initial){const h=globalThis.policyHooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],next=>h.values[i]=typeof next==='function'?next(h.values[i]):next];}export function useRef(initial){const h=globalThis.policyHooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export const useCallback=fn=>fn;export const useEffect=()=>{};`);
 await build({stdin:{contents:`export {useNotebook} from './app/use-notebook';export {initialNotebook,newItem} from './lib/notebook';export {applyBulkCommand,reconcileDraft} from './lib/bulk';export {applyOperation} from './lib/catalog';export {makeNotebookDraft,readNotebookDraft} from './lib/notebook-draft';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:join(dir,'test.mjs'),alias:{react:hooks},logLevel:'silent'});
 const m=await import(join(dir,'test.mjs')),render=()=>{globalThis.policyHooks.cursor=0;return m.useNotebook();};
 let server,revision,receipts,calls,status;
 const snapshot=()=>({data:server,revision,user:'owner@example.test',isOwner:true,canManage:true,updatedAt:'2026-10-15T00:00:00Z',updatedBy:'owner@example.test'});
 const fresh=async()=>{globalThis.policyHooks={cursor:0,values:[]};assert.equal(await render().load(),true);return render();};
 const reset=async(code)=>{server=m.initialNotebook();server.items=[{...m.newItem('Synthetic salt'),id:'salt'}];revision=0;receipts=new Map();calls=[];status=code;
  globalThis.fetch=async(url,init={})=>{
   if(!init.method)return Response.json(snapshot());
   const headers=new Headers(init.headers),body=JSON.parse(init.body),id=init.method==='PUT'?headers.get('X-Operation-Id'):body.operationId??body.commandId;
   calls.push({url,body:init.body,id,revision:headers.get('If-Match')});
   assert.equal(headers.get('X-Labula-Workspace-Version'),'2');
   if(status!==200)return Response.json({error:'Keep this exact request and retry after updating.',code:status===428?'workspace_update_required':status===503?'workspace_write_paused':'invalid_input'},{status});
   if(!receipts.has(id)){assert.equal(Number(headers.get('If-Match')),revision);server=init.method==='PUT'?body:url==='/api/bulk'?m.applyBulkCommand(server,body.command):m.applyOperation(server,body.operation).next;revision++;receipts.set(id,{body:init.body,revision});}
   else assert.equal(receipts.get(id).body,init.body,'a replay must retain exact bytes');
   return Response.json(init.method==='PUT'?{revision:receipts.get(id).revision,user:'owner@example.test',updatedAt:'2026-10-15T00:00:00Z',updatedBy:'owner@example.test'}:snapshot());
  };return fresh();
 };
 for(const blockedStatus of [428,503])for(const kind of ['save','catalog','bulk']){
  let h=await reset(blockedStatus);const originalServer=JSON.stringify(server);
  if(kind==='save'){h.update(n=>({...n,recipes:n.recipes.map((r,i)=>i===0?{...r,notes:'Synthetic accepted local edit'}:r)}));h=render();assert.equal(await h.save(),false);}
  else if(kind==='catalog')assert.equal(await h.runOperation({kind:'aliases',itemId:'salt',aliases:['Synthetic fine salt']}),false);
  else assert.equal((await h.runBulk({recipeId:h.data.recipes[0].id,rows:m.reconcileDraft('Synthetic coriander',[],h.data.items)})).ok,false);
  h=render();assert.equal(h.unauthorized,false);assert.equal(kind==='save'?h.savePending:h.operationPending,true,`${blockedStatus} ${kind} retains recovery`);assert.equal(JSON.stringify(server),originalServer);assert.equal(receipts.size,0);
  assert.throws(()=>h.update(n=>n),/pending/);assert.equal(await h.load(),false,'reload cannot discard retained intent');
  const recovery=kind==='save'?h.getSaveRecovery():kind==='catalog'?h.getCatalogRecovery():h.getBulkRecovery();assert(recovery);assert.equal(recovery.id,calls[0].id);
  assert.equal(await h.retry(),false);h=render();assert.deepEqual(calls[1],calls[0],'blocked retry uses original identity, revision and bytes');
  const file=m.readNotebookDraft(JSON.stringify(m.makeNotebookDraft(h.data,h.getSavedBase(),h.user,[],h.getSaveRecovery(),h.getCatalogRecovery(),h.getBulkRecovery())));
  assert.equal(file.recovery.kind,kind);assert.deepEqual(file.recovery.receipt,recovery);
  // A full page reload restores the original operation without sending it first.
  h=await fresh();const before=calls.length;
  const restored=kind==='save'?h.restoreSaveRecovery(file.recovery.receipt):kind==='catalog'?h.restoreCatalogRecovery(file.recovery.receipt):h.restoreBulkRecovery(file.recovery.receipt);
  assert.equal(restored.ok,true);assert.equal(calls.length,before);h=render();assert.equal(kind==='save'?h.savePending:h.operationPending,true);
  status=200;assert.equal(await h.retry(),true);h=render();assert.equal(receipts.size,1);assert.equal(revision,1);assert.equal(h.savePending,false);assert.equal(h.operationPending,false);assert.equal(h.unauthorized,false);
  assert.deepEqual(calls.at(-1),calls[0],'restored retry must retain exact request');assert.equal(await h.retry(),true);assert.equal(receipts.size,1);assert.equal(revision,1);
 }
 let h=await reset(400);assert.equal((await h.runBulk({recipeId:h.data.recipes[0].id,rows:m.reconcileDraft('Synthetic invalid row',[],h.data.items)})).pending,false);assert.equal(render().operationPending,false,'ordinary definite validation rejection remains editable');
 console.log('PASS notebook runtime-policy recovery: real useNotebook save/catalog/bulk retain original receipts, revisions and payloads for 428 and 503; export and reload restore exact retry once; no authorization latch or silent reload; ordinary input rejection remains editable.');
}finally{globalThis.fetch=originalFetch;delete globalThis.policyHooks;await rm(dir,{recursive:true,force:true});}
