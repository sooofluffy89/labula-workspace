import {build} from 'esbuild';
import {tmpdir} from 'node:os';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
const dir=await mkdtemp(tmpdir()+'/labula-notebook-ui-review-');
try {
 const react=path.join(dir,'react.mjs'),ui=path.join(dir,'ui.mjs');
 await writeFile(react,`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;const same=(a,b)=>a&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]={value:typeof initial==='function'?initial():initial};return [h.values[i].value,v=>{h.values[i].value=typeof v==='function'?v(h.values[i].value):v;h.dirty=true;}];}export function useRef(initial){const h=globalThis.hooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export function useMemo(fn,deps){const h=globalThis.hooks,i=h.cursor++;if(!same(h.values[i]?.deps,deps))h.values[i]={deps,value:fn()};return h.values[i].value;}export function useEffect(fn,deps){const h=globalThis.hooks,i=h.cursor++;if(!same(h.values[i]?.deps,deps)){const prior=h.values[i];h.values[i]={deps};h.effects.push(()=>{prior?.cleanup?.();h.values[i].cleanup=fn();});}}`);
 await writeFile(ui,`export const Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',DialogFooter='DialogFooter',Button='Button',Textarea='Textarea',Checkbox='Checkbox',Choice='Choice',AlertDialog='AlertDialog',AlertDialogContent='AlertDialogContent',AlertDialogHeader='AlertDialogHeader',AlertDialogTitle='AlertDialogTitle',AlertDialogDescription='AlertDialogDescription',AlertDialogFooter='AlertDialogFooter',AlertDialogCancel='AlertDialogCancel',AlertDialogAction='AlertDialogAction';`);
 const outfile=path.join(dir,'component.mjs');
 await build({stdin:{contents:"export {NotebookRestore} from './app/notebook-restore';export {makeNotebookDraft} from './lib/notebook-draft';export {initialPreparationSession,makePrepEntry} from './lib/prep-draft';export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',alias:{react,'react/jsx-runtime':react},plugins:[{name:'primitives',setup(b){b.onResolve({filter:/^(?:@\/components\/ui\/|\.\/recipe-ui$)/},()=>({path:ui}));}}],logLevel:'silent'});
 const {NotebookRestore,makeNotebookDraft,initialNotebook,newItem,initialPreparationSession,makePrepEntry}=await import(outfile);
 globalThis.window={addEventListener(){},removeEventListener(){}};
 const flatten=n=>!n||typeof n==='boolean'?[]:Array.isArray(n)?n.flatMap(flatten):typeof n!=='object'?[n]:[n,...flatten(n.props?.children)];const label=n=>flatten(n.props?.children).filter(x=>typeof x==='string'||typeof x==='number').join('');
 let tree,nb,opened=true,aliasDirty=false,aliasCalls=[],refreshRestoreCalls=0,reconcileCalls=0,prepCalls=[],prepOpens=true;
 function render(){for(let a=0;a<10;a++){hooks.cursor=0;hooks.dirty=false;tree=NotebookRestore({open:opened,onOpenChange:v=>opened=v,nb,hasAliasDrafts:aliasDirty,onRestoreAliases:d=>aliasCalls.push(d),onDownloadCurrent(){},onRestorePrep:async draft=>{prepCalls.push(draft);return prepOpens;}});for(const effect of hooks.effects.splice(0))effect();if(!hooks.dirty)return;}throw Error('loop');}
 const nodes=type=>flatten(tree).filter(n=>n?.type===type);const button=text=>nodes('Button').find(n=>label(n)===text);
 const click=async text=>{const n=button(text);assert.ok(n,'button '+text);assert.ok(!n.props.disabled,'enabled '+text);await n.props.onClick();await new Promise(r=>setImmediate(r));render();};
 const select=async draft=>{nodes('input').find(n=>n.props.type==='file').props.onChange({target:{files:[new File([JSON.stringify(draft)],'draft.json')],value:'draft'}});await new Promise(r=>setImmediate(r));render();};
 const base=initialNotebook();base.items.push(newItem('Salt'));const local=structuredClone(base);local.recipes[0].active=false;
 const aliases=[{itemId:base.items[0].id,text:'Sea salt',base:[]}];
 const reset=()=>{globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};opened=true;aliasDirty=false;aliasCalls=[];prepCalls=[];prepOpens=true;refreshRestoreCalls=0;reconcileCalls=0;nb={user:'owner@test',data:structuredClone(base),dirty:false,saving:false,operating:false,operationPending:false,savePending:false,isOwner:true,error:'',unauthorized:false,update(fn){this.data=fn(this.data);this.dirty=true;},async flush(){this.error='unconfirmed';return false;},async retry(){this.dirty=false;this.error='';return true;},async refreshBulk(){return this.dirty?{ok:false,error:'Earlier edits are not saved.'}:{ok:true,notebook:this.data};},async refreshRestore(){refreshRestoreCalls++;this.data=structuredClone(base);this.dirty=false;return {ok:true,notebook:this.data};},restoreSaveRecovery(){return {ok:true};},async reconcileImported(){reconcileCalls++;return this.refreshBulk();}};render();};
 // A successful retry needs the same alias finalization as first-attempt success.
 reset();const draft=makeNotebookDraft(local,{revision:1,notebook:base},'owner@test',aliases,null,null,null);
 await select(draft);await click('Load latest version & review');nodes('Checkbox')[0].props.onCheckedChange(true);render();await click('Apply selected changes');await click('Retry saving');
 assert.equal(opened,false);assert.equal(aliasCalls.length,1);
 console.log('PASS 1: successful retry restores included alias drafts.');
 // A previously installed receipt must not outrank refresh of a failed proposal.
 reset();const receipt={id:crypto.randomUUID(),revision:1,payload:JSON.stringify(base),localPayload:JSON.stringify(local)};
 await select(makeNotebookDraft(local,{revision:1,notebook:base},'owner@test',[],receipt,null,null));await click('Check earlier save & review');nodes('Checkbox')[0].props.onCheckedChange(true);render();await click('Apply selected changes');await click('Load latest version & review again');
 assert.equal(reconcileCalls,1);assert.equal(refreshRestoreCalls,1);
 console.log('PASS 2: a failed proposal refreshes the shared version after an earlier receipt.');
 // A kept imported file may overlap new local alias work created while closed.
 reset();nb.flush=async()=>true;await select(draft);await click('Load latest version & review');await click('Close — keep this draft');aliasDirty=true;opened=true;render();nodes('Checkbox')[0].props.onCheckedChange(true);render();assert.equal(button('Apply selected changes').props.disabled,true);assert.equal(aliasCalls.length,0);
 console.log('PASS 3: Apply is blocked when newer unsaved alias work exists.');
 reset();await select(draft);await click('Load latest version & review');nodes('Checkbox')[0].props.onCheckedChange(true);render();await click('Apply selected changes');await click('Close — keep this draft');aliasDirty=true;opened=true;render();await click('Retry saving');assert.equal(aliasCalls.length,0);assert.equal(aliasDirty,true);assert.equal(opened,true);assert.ok(button('Download imported draft'));aliasDirty=false;render();await click('Retry saving');assert.equal(aliasCalls.length,1);assert.equal(opened,false);
 console.log('PASS 4: Retry preserves newer alias work and completes only after that work is resolved.');
reset();await select(draft);await click('Load latest version & review');nodes('Checkbox')[0].props.onCheckedChange(true);render();await click('Apply selected changes');await click('Close — keep this draft');nb.update(n=>({...n,recipes:n.recipes.map((r,i)=>i===1?{...r,active:false}:r)}));opened=true;render();await click('Load latest version & review again');assert.equal(nb.data.recipes[1].active,false);assert.equal(refreshRestoreCalls,0);assert.equal(opened,true);assert.ok(flatten(tree).includes('You made more dish edits after this restore attempt. Save those edits or download the current draft before reloading. The imported draft stays here.'));console.log('PASS 5: refresh protects later unrelated ordinary edits.');

 // Imported preparation + aliases finalize together only after the transition succeeds.
 reset();const prep=initialPreparationSession(base,null,'owner@test',{itemId:base.items[0].id});
 prep.drafts[base.items[0].id]=makePrepEntry(base.items[0].prepProfile);prep.drafts[base.items[0].id].value.note='Imported preparation notes';
 const withPrep=makeNotebookDraft(base,{revision:1,notebook:base},'owner@test',aliases,null,null,null,prep);
 await select(withPrep);await click('Load latest version & review');nodes('Checkbox')[0].props.onCheckedChange(true);render();prepOpens=false;
 await click('Apply selected changes');assert.equal(opened,true);assert.equal(aliasCalls.length,0);assert.equal(prepCalls.length,1);assert.ok(button('Download imported draft'));assert.deepEqual(prepCalls[0],prep);
 prepOpens=true;await click('Apply selected changes');assert.equal(opened,false);assert.equal(aliasCalls.length,1);assert.equal(prepCalls.length,2);assert.deepEqual(prepCalls[1],prep);
 console.log('PASS 6: failed/cancelled preparation transition keeps the complete import; successful retry restores preparation and alias drafts together.');
}finally {await rm(dir,{recursive:true,force:true});}
