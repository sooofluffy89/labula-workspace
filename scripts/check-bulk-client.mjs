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
 const reset=async()=>{globalThis.hooks={values:[],cursor:0};server=initialNotebook();revision=0;receipts=new Map();calls=[];mode='ok';globalThis.fetch=async(url,options={})=>{
  if(!options.method)return Response.json({data:server,revision,updatedAt:'2026-09-12',updatedBy:'test',isOwner:false});
  const data=JSON.parse(options.body),id=options.method==='PUT'?options.headers['X-Operation-Id']:data.commandId;
  calls.push({url,id,body:options.body,revision:options.headers['If-Match']});
  if(mode==='gate'){arrived();await gate;}
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
 console.log('Passed client transitions: staged proposal; rejected save/edit/retry; frozen ID/body across network loss and401; fresh replay; idempotent preflush; concurrent submit guard; conflict reload/review.');
}finally{await rm(dir,{recursive:true,force:true});}
