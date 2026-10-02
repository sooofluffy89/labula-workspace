import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {harness,sleep} from './sync-harness.mjs';
const h=await harness(),dir=await mkdtemp(tmpdir()+'/labula-group-review-ui-');
try{
 await writeFile(dir+'/react.mjs',`export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='Fragment';export function useState(v){let i=hooks.cursor++;if(!(i in hooks.cells))hooks.cells[i]={value:typeof v==='function'?v():v};return [hooks.cells[i].value,n=>hooks.cells[i].value=typeof n==='function'?n(hooks.cells[i].value):n];}export function useRef(v){let i=hooks.cursor++;if(!(i in hooks.cells))hooks.cells[i]={current:v};return hooks.cells[i];}export function useEffect(fn,deps){let i=hooks.cursor++,old=hooks.cells[i];if(!old||deps?.some((v,j)=>v!==old.deps?.[j])){hooks.cells[i]={deps};hooks.effects.push(fn);}}`);
 await writeFile(dir+'/ui.mjs',`export const Button='Button',Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',DialogFooter='DialogFooter';`);
 await build({stdin:{contents:"export * from './app/stock-group-editor';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',jsx:'automatic',alias:{react:dir+'/react.mjs','react/jsx-runtime':dir+'/react.mjs','@/components/ui/button':dir+'/ui.mjs','@/components/ui/dialog':dir+'/ui.mjs'},logLevel:'silent'});
 globalThis.hooks={cursor:0,cells:[],effects:[]};globalThis.localStorage=h.storage();globalThis.HTMLElement=class{};globalThis.document={activeElement:null,getElementById(){return null;}};globalThis.requestAnimationFrame=fn=>fn();
 let loseReply=false,requests=[];
 globalThis.fetch=async(url,init)=>{const r=await h.requester(url,init);if(init?.method==='POST'){requests.push(JSON.parse(init.body));if(loseReply){loseReply=false;throw Error('Synthetic connection lost after commit');}}return new Response(JSON.stringify(r.body),{status:r.res.status});};
 const m=await import(dir+'/test.mjs');let snapshot,selection=null,refreshPromise=Promise.resolve();
 const refresh=async()=>{snapshot=await h.m.stock.GET().then(r=>r.json());};await refresh();
 const group=async(id,groupId)=>{const item=snapshot.items.find(i=>i.itemId===id);const r=await h.post(h.m.groups,{id:crypto.randomUUID(),itemId:id,revision:item.groupRevision,groupId});assert.equal(r.status,200);await refresh();};
 await group('item-0','vegetables');await group('item-2','pickles');
 const operationId=crypto.randomUUID();const r=await h.post(h.m.catalog,{operationId,operation:{kind:'merge',sourceId:'item-0',targetId:'item-2'}},{headers:{'If-Match':String(snapshot.notebookRevision)}});assert.equal(r.status,200,await r.text());await refresh();
 const render=()=>{hooks.cursor=0;const tree=m.StockGroupEditor({account:h.owner.email,snapshot,selection,onSelection:v=>selection=v,onRefresh:()=>{refreshPromise=refresh();},blocked:false});for(const f of hooks.effects.splice(0))f();return tree;};
 const flat=x=>!x||typeof x==='boolean'?[]:Array.isArray(x)?x.flatMap(flat):typeof x!=='object'?[x]:[x,...flat(x.props?.children)];
 const text=x=>flat(x).filter(v=>typeof v==='string'||typeof v==='number').join('');
 const button=(tree,label)=>flat(tree).find(n=>n?.type==='Button'&&text(n)===label);
 const settle=async()=>{await sleep(30);await refreshPromise;render();await sleep(0);return render();};
 let tree=render();button(tree,'Synthetic 02: Pickled & fermented vegetables · review').props.onClick();render();tree=await settle();
 assert.match(text(tree),/Merged ingredient: Synthetic 00 · Vegetables, herbs & mushrooms/);assert.match(text(tree),/Kept ingredient: Synthetic 02 · Pickled & fermented vegetables/);
 assert.equal(button(tree,'Confirm group & resolve').props.disabled,false,'the existing group can be explicitly confirmed');
 loseReply=true;button(tree,'Confirm group & resolve').props.onClick();tree=await settle();assert.match(text(tree),/Synthetic connection lost after commit/);assert.equal(localStorage.length,1);assert.equal((await h.m.stock.GET().then(r=>r.json())).groupConflicts.length,0);
 const original=requests[0];assert.equal(original.reviewedMerges[0].operationId,operationId);
 // Recover after a real remount with a fresh server snapshot and the saved request.
 hooks={cursor:0,cells:[],effects:[]};selection=null;await refresh();render();tree=await settle();assert.ok(button(tree,'Retry group save'));button(tree,'Retry group save').props.onClick();tree=await settle();
 assert.deepEqual(requests[1],original);assert.equal(localStorage.length,0);assert.equal(snapshot.groupConflicts.length,0);assert.match(text(tree),/Merge review resolved/);assert.equal(h.db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(original.id).n,1);
 // Reopen through the ordinary editor: no unresolved review and no accidental save.
 selection='item-2';render();tree=await settle();assert.equal(button(tree,'Save group').props.disabled,true);
 selection=null;render();await settle();
 const undo=await h.post(h.m.catalog,{operationId:crypto.randomUUID(),operation:{kind:'undo',operationId}},{headers:{'If-Match':String(snapshot.notebookRevision)}});assert.equal(undo.status,200,await undo.text());await refresh();
 const secondMerge=await h.post(h.m.catalog,{operationId:crypto.randomUUID(),operation:{kind:'merge',sourceId:'item-0',targetId:'item-2'}},{headers:{'If-Match':String(snapshot.notebookRevision)}});assert.equal(secondMerge.status,200,await secondMerge.text());await refresh();
 selection='item-2';render();tree=await settle();
 // Another device saves after the dialog opens; the stale review must stay recoverable.
 const staleSnapshot=snapshot;await group('item-2','sauces');snapshot=staleSnapshot;
 button(tree,'Confirm group & resolve').props.onClick();tree=await settle();assert.match(text(tree),/This ingredient group changed/);assert.equal(localStorage.length,1);
 button(tree,'Refresh shared group').props.onClick();tree=await settle();button(tree,'Review group again').props.onClick();tree=await settle();
 assert.match(text(tree),/Kept ingredient: Synthetic 02 · Sauces, pastes & dips/);assert.equal(flat(tree).find(n=>n?.type==='select').props.value,'pickles','keep the intended choice for explicit review');
 button(tree,'Confirm group & resolve').props.onClick();tree=await settle();assert.equal(snapshot.items.find(i=>i.itemId==='item-2').groupId,'pickles');assert.equal(snapshot.groupConflicts.length,0);
 console.log('PASS actual group editor handlers: compared names/groups, unchanged-group confirmation, lost response, remount and exact retry, no duplicate audit, stale decision and explicit renewed review');
}finally{h.db.close();await rm(dir,{recursive:true,force:true});}
