// Exercise the actual dialog handlers and effect cleanup without a browser dependency.
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-dialog-'));
try{
 const react=path.join(dir,'react.mjs'),ui=path.join(dir,'ui.mjs'),worker=path.join(dir,'worker.mjs');
 await writeFile(react,`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;const same=(a,b)=>a&&a.length===b.length&&a.every((x,i)=>Object.is(x,b[i]));export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]={value:typeof initial==='function'?initial():initial};return [h.values[i].value,v=>{h.values[i].value=typeof v==='function'?v(h.values[i].value):v;h.dirty=true;}];}export function useRef(initial){const h=globalThis.hooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export function useMemo(fn,deps){const h=globalThis.hooks,i=h.cursor++;if(!same(h.values[i]?.deps,deps))h.values[i]={deps,value:fn()};return h.values[i].value;}export function useEffect(fn,deps){const h=globalThis.hooks,i=h.cursor++;if(!same(h.values[i]?.deps,deps)){const prior=h.values[i];h.values[i]={deps};h.effects.push(()=>{prior?.cleanup?.();h.values[i].cleanup=fn();});}}`);
 await writeFile(ui,`export const Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',DialogFooter='DialogFooter',Button='Button',Textarea='Textarea',Checkbox='Checkbox',Choice='Choice',AlertDialog='AlertDialog',AlertDialogContent='AlertDialogContent',AlertDialogHeader='AlertDialogHeader',AlertDialogTitle='AlertDialogTitle',AlertDialogDescription='AlertDialogDescription',AlertDialogFooter='AlertDialogFooter',AlertDialogCancel='AlertDialogCancel',AlertDialogAction='AlertDialogAction';`);
 await writeFile(worker,`export default class Worker {constructor(){globalThis.workers.push(this);}postMessage(value){this.request=value;}terminate(){this.terminated=true;}}`);
 const outfile=path.join(dir,'dialog.mjs');await build({stdin:{contents:"export {BulkIngredients} from './app/bulk-ingredients';export {initialNotebook} from './lib/notebook';export {applyBulkCommand,draftSuggestions,reconcileDraft} from './lib/bulk';export {makeIngredientDraft} from './lib/bulk-draft';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',alias:{react,'react/jsx-runtime':react},plugins:[{name:'primitives',setup(b){b.onResolve({filter:/^(?:@\/components\/ui\/|\.\/recipe-ui$)/},()=>({path:ui}));b.onResolve({filter:/\?worker$/},()=>({path:worker}));}}],logLevel:'silent'});
 const {BulkIngredients,initialNotebook,applyBulkCommand,draftSuggestions,reconcileDraft,makeIngredientDraft}=await import(outfile);
 const flatten=n=>!n||typeof n==='boolean'?[]:Array.isArray(n)?n.flatMap(flatten):typeof n!=='object'?[n]:[n,...flatten(n.props?.children)];const label=n=>flatten(n.props?.children).filter(x=>typeof x==='string'||typeof x==='number').join('');
 let notebook=initialNotebook(),tree,closed=0,mode='ok',sent=[],extraProps={};
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};globalThis.workers=[];const listeners=new Map();globalThis.window={addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:k=>listeners.delete(k)};
 function render(){for(let attempt=0;attempt<10;attempt++){hooks.cursor=0;hooks.dirty=false;tree=BulkIngredients({notebook,recipeId:notebook.recipes[0].id,unauthorized:false,onClose:()=>closed++,onRefresh:async()=>({ok:true,pending:false,notebook}),getRecovery:()=>null,onRestoreRecovery:()=>({ok:true,pending:true}),onApply:async command=>{sent.push(structuredClone(command));if(mode==='reject')return {ok:false,pending:false,error:'Rejected'};if(mode==='lost')return {ok:false,pending:true,error:'Unknown'};notebook=applyBulkCommand(notebook,command);return {ok:true,pending:false};},...extraProps});for(const effect of hooks.effects.splice(0))effect();if(!hooks.dirty)return;}throw Error('Render loop');}
 const nodes=type=>flatten(tree).filter(n=>n?.type===type);const button=text=>nodes('Button').find(n=>label(n)===text);const click=async text=>{const node=button(text);assert.ok(node,'button '+text);assert.ok(!node.props.disabled,'enabled '+text);await node.props.onClick();render();};const fill=text=>{nodes('Textarea')[0].props.onChange({target:{value:text}});render();};const resolve=w=>{w.onmessage({data:{matches:draftSuggestions(w.request.items,w.request.rows)}});render();};
 render();fill('House sauce\nGarlic cloves\nGarlic clovs\nSalt');assert.ok(listeners.has('beforeunload'));await click('Review ingredients');const firstWorker=workers.at(-1);assert.ok(button('Add 4 ingredients').props.disabled);nodes('input').find(n=>n.props['aria-label']==='Made in-house for House sauce').props.onChange();render();assert.equal(workers.length,1,'type change must not restart suggestions');resolve(firstWorker);await nodes('Button').find(n=>n.props['aria-label']==='Use Garlic cloves').props.onClick();render();nodes('Checkbox').find(n=>n.props['aria-label']==='Include Salt').props.onCheckedChange(false);render();await click('Edit list');fill('Salt\nHouse sauce\nGarlic clovs\nGarlic cloves\nGarlic clovs\nPepper');await click('Review ingredients');resolve(workers.at(-1));assert.equal(nodes('input').find(n=>n.props['aria-label']==='Made in-house for House sauce').props.checked,true);assert.equal(nodes('Checkbox').find(n=>n.props['aria-label']==='Include Salt').props.checked,false);assert.ok(button('Add 3 ingredients'));mode='reject';await click('Add 3 ingredients');assert.equal(notebook.items.length,0);await click('Edit list');fill('Salt\nHouse sauce\nGarlic clovs\nGarlic cloves\nGarlic clovs');await click('Review ingredients');resolve(workers.at(-1));mode='lost';await click('Add 2 ingredients');assert.ok(button('Edit list').props.disabled);assert.equal(notebook.items.length,0);const frozen=sent.at(-1);mode='ok';await click('Retry saving');assert.deepEqual(sent.at(-1),frozen);assert.equal(closed,1);assert.deepEqual(notebook.items.map(i=>i.name),['House sauce','Garlic cloves']);assert.equal(notebook.items[0].kind,'prep');
 // Old worker completions are ignored after leaving/replacing the reviewed list.
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;render();fill('Garlic clovs');await click('Review ingredients');const old=workers.at(-1);await click('Edit list');fill('Completely different ingredient');await click('Review ingredients');const latest=workers.at(-1);assert.equal(old.terminated,true);resolve(old);assert.ok(button('Add 1 ingredient').props.disabled,'stale completion cannot enable saving');resolve(latest);assert.equal(button('Add 1 ingredient').props.disabled,false);await click('Edit list');await click('Review ingredients');workers.at(-1).onmessage({data:{error:'Simulated worker failure'}});render();assert.ok(button('Add 1 ingredient').props.disabled);await click('Retry match check');resolve(workers.at(-1));assert.equal(button('Add 1 ingredient').props.disabled,false);nodes('Dialog')[0].props.onOpenChange(false);render();assert.equal(closed,0);assert.equal(nodes('AlertDialog')[0].props.open,true);
 // File selection validates before replacement; restoring requires explicit confirmation.
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;render();fill('My current list');
 const selectFile=async(content)=>{const file=new File([content],'draft.json',{type:'application/json'});nodes('input').find(n=>n.props.type==='file').props.onChange({target:{files:[file],value:'draft.json'}});await new Promise(r=>setImmediate(r));render();};
 await selectFile('{bad');assert.equal(nodes('Textarea')[0].props.value,'My current list');assert.ok(flatten(tree).some(n=>typeof n==='string'&&n.includes('could not be read')));
 const importedRows=reconcileDraft('Imported sauce',[],notebook.items).map(r=>({...r,kind:'prep'}));const imported=makeIngredientDraft(notebook,notebook.recipes[0].id,'Imported sauce',importedRows,[],[],null);
 await selectFile(JSON.stringify({...imported,recipeId:notebook.recipes[1].id}));assert.equal(nodes('Textarea')[0].props.value,'My current list');assert.ok(flatten(tree).some(n=>typeof n==='string'&&n.includes('belongs to')));
 await selectFile(JSON.stringify(imported));assert.equal(nodes('Textarea')[0].props.value,'My current list','file selection must wait for replacement confirmation');await nodes('Button').filter(n=>label(n)==='Restore draft').at(-1).props.onClick();render();resolve(workers.at(-1));assert.equal(nodes('input').find(n=>n.props['aria-label']==='Made in-house for Imported sauce').props.checked,true);assert.equal(button('Add 1 ingredient').props.disabled,false);
 // Legacy files may be read, but a missing save receipt cannot become a blind new POST.
 await selectFile(JSON.stringify({recipeId:notebook.recipes[0].id,text:'Legacy sauce',rows:reconcileDraft('Legacy sauce',[],notebook.items)}));await nodes('Button').filter(n=>label(n)==='Restore draft').at(-1).props.onClick();render();resolve(workers.at(-1));assert.equal(button('Add 1 ingredient').props.disabled,true);assert.ok(flatten(tree).some(n=>typeof n==='string'&&n.includes('Reference only')));

 // Copy checks occur before ordinary review and require explicit decisions.
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;notebook=initialNotebook();render();
 fill('1. Salt\nCoriander, spring onion\n5-spice powder');await click('Review ingredients');assert.equal(workers.length,0);assert.ok(button('Review ingredients').props.disabled);
 await nodes('Button').find(n=>n.props['aria-label']==='Clean 1. Salt').props.onClick();render();
 await nodes('Button').find(n=>n.props['aria-label']==='Split Coriander, spring onion').props.onClick();render();await click('Review ingredients');resolve(workers.at(-1));
 assert.ok(button('Add 4 ingredients').props.disabled,'transformed names and types need a new check');
 for(const name of ['Salt','Coriander','spring onion']){nodes('input').find(n=>n.props['aria-label']===`Bought for ${name}`).props.onChange();render();}
 assert.equal(button('Add 4 ingredients').props.disabled,false);assert.ok(nodes('input').find(n=>n.props['aria-label']==='Bought for 5-spice powder'));
 // Format confirmation survives a download and ordinary file restoration.
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;render();fill('Chilli, mild');await click('Review ingredients');await click('Keep original as one name');await click('Review ingredients');resolve(workers.at(-1));
 let downloaded;const oldCreateUrl=URL.createObjectURL;URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};globalThis.document={createElement:()=>({click(){}})};
 await click('Download draft');const keptNameFile=JSON.parse(await downloaded.text());assert.deepEqual(keptNameFile.keptNames,['chilli, mild']);
 await selectFile(JSON.stringify(keptNameFile));await nodes('Button').filter(n=>label(n)==='Restore draft').at(-1).props.onClick();render();resolve(workers.at(-1));assert.equal(button('Add 1 ingredient').props.disabled,false);
 // Decisions remain in exports made while a new worker is still pending.
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;notebook=initialNotebook();render();fill('Garlic cloves\nGarlic clove');await click('Review ingredients');resolve(workers.at(-1));await click('Keep separate');await click('Download draft');const keptBefore=JSON.parse(await downloaded.text()).keptPairs;
 await click('Edit list');fill('Garlic cloves\nGarlic clove\nGinger');await click('Review ingredients');await click('Download draft');const workerFile=JSON.parse(await downloaded.text());assert.deepEqual(workerFile.keptPairs,keptBefore);await selectFile(JSON.stringify(workerFile));await nodes('Button').filter(n=>label(n)==='Restore draft').at(-1).props.onClick();render();resolve(workers.at(-1));assert.equal(button('Add 3 ingredients').props.disabled,false);
 URL.createObjectURL=oldCreateUrl;
 // All present -> Done without a POST or discard warning; excluded new work remains protected.
 notebook=applyBulkCommand(initialNotebook(),{recipeId:'s1-v1',rows:reconcileDraft('Salt',[],[])});notebook.recipes[0].recorded=true;
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;render();fill('Salt');await click('Review ingredients');resolve(workers.at(-1));const beforeSent=sent.length;await click('Done');assert.equal(closed,1);assert.equal(sent.length,beforeSent);assert.equal(notebook.recipes[0].recorded,true);
 globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;render();fill('Salt\nGinger');await click('Review ingredients');resolve(workers.at(-1));nodes('Checkbox').find(n=>n.props['aria-label']==='Include Ginger').props.onCheckedChange(false);render();assert.ok(button('Review selection'));assert.equal(button('Done'),undefined);nodes('Dialog')[0].props.onOpenChange(false);render();assert.equal(nodes('AlertDialog')[0].props.open,true);assert.equal(closed,0);
 nodes('Checkbox').find(n=>n.props['aria-label']==='Include Salt').props.onCheckedChange(false);render();assert.ok(flatten(tree).includes('No ingredients selected'));assert.equal(button('Done'),undefined);
 // Ordinary restored lists cannot bypass copy checks, and changing one copied
 // line preserves a different ingredient's explicit made-in-house choice.
 const reset=()=>{globalThis.hooks={values:[],cursor:0,dirty:false,effects:[]};workers.length=0;closed=0;extraProps={};};
 const confirmRestore=async()=>{await nodes('Button').filter(n=>label(n)==='Restore draft').at(-1).props.onClick();render();};
 reset();notebook=initialNotebook();render();
 const copiedText='House sauce\n1. Salt\nCoriander, spring onion';
 const copiedRows=reconcileDraft(copiedText,[],[]).map(r=>r.name==='House sauce'?{...r,kind:'prep'}:r);
 const copiedFile=makeIngredientDraft(notebook,notebook.recipes[0].id,copiedText,copiedRows,[],[],null);
 await selectFile(JSON.stringify(copiedFile));await confirmRestore();
 assert.equal(workers.length,0,'ordinary restored copied text must be checked before matching');
 assert.ok(flatten(tree).includes('1 of 2 · Check copied text'));assert.equal(button('Review ingredients').props.disabled,true);
 assert.equal(nodes('Textarea')[0].props.value,copiedText,'restoring never silently strips or splits names');
 await nodes('Button').find(n=>n.props['aria-label']==='Clean 1. Salt').props.onClick();render();
 await nodes('Button').find(n=>n.props['aria-label']==='Split Coriander, spring onion').props.onClick();render();
 await click('Review ingredients');resolve(workers.at(-1));
 assert.equal(nodes('input').find(n=>n.props['aria-label']==='Made in-house for House sauce').props.checked,true,'unrelated preparation type survives copied-text transformations');
 assert.equal(button('Add 4 ingredients').props.disabled,true);

 // An already committed pending command must retry its original numbered and
 // comma-containing names, even when the latest dish makes its add count zero.
 reset();const pendingBefore=initialNotebook(),pendingRecipeId=pendingBefore.recipes[0].id;
 const pendingText='1. Salt\nCoriander, spring onion',pendingRows=reconcileDraft(pendingText,[],[]);
 const exactBulk={id:crypto.randomUUID(),revision:9,command:{recipeId:pendingRecipeId,rows:pendingRows}};
 const pendingFile=makeIngredientDraft(pendingBefore,pendingRecipeId,pendingText,pendingRows,[],[],exactBulk);
 notebook=applyBulkCommand(pendingBefore,exactBulk.command);notebook.recipes[0].recorded=true;
 let installedBulk=null;extraProps={getRecovery:()=>installedBulk,onRestoreRecovery:receipt=>{installedBulk=structuredClone(receipt);return {ok:true,pending:true};}};render();
 await selectFile(JSON.stringify(pendingFile));await confirmRestore();
 assert.deepEqual(installedBulk,exactBulk);assert.ok(button('Retry saving'));assert.equal(button('Retry saving').props.disabled,false);
 assert.equal(nodes('Button').some(n=>n.props['aria-label']==='Clean 1. Salt'),false,'a pending command never enters copy cleanup');
 assert.equal(flatten(tree).filter(n=>n==='Already in this dish').length,2,'both original names are already linked');
 const sentBeforeReplay=sent.length;await click('Retry saving');
 assert.equal(sent.length,sentBeforeReplay+1);assert.deepEqual(sent.at(-1),exactBulk.command,'zero-count retry keeps exact original rows');
 assert.equal(notebook.recipes[0].recorded,true);assert.equal(closed,1);

 // Invalid old decisions cannot suppress current matching after restoration.
 reset();notebook=initialNotebook();render();URL.createObjectURL=blob=>{downloaded=blob;return 'blob:test';};
 const matchText='Garlic cloves\nGarlic clove',matchRows=reconcileDraft(matchText,[],[]);
 const invalidPairs=['not-json',JSON.stringify([['row','garlic clove'],['row','missing']]),JSON.stringify([['row','garlic cloves'],['row','garlic cloves']]),JSON.stringify([['item','deleted-item'],['row','garlic clove']])];
 const malformedFile={...makeIngredientDraft(notebook,notebook.recipes[0].id,matchText,matchRows,[],[],null),keptPairs:invalidPairs};
 await selectFile(JSON.stringify(malformedFile));await confirmRestore();resolve(workers.at(-1));
 assert.ok(button('Keep separate'));assert.equal(button('Add 2 ingredients').props.disabled,true);
 await click('Download draft');assert.deepEqual(JSON.parse(await downloaded.text()).keptPairs,[],'malformed, missing, and self-pairs are removed');
 await click('Keep separate');await click('Edit list');fill(matchText+'\nGarlic clovs');await click('Review ingredients');resolve(workers.at(-1));
 assert.ok(button('Keep separate'));assert.equal(button('Add 3 ingredients').props.disabled,true,'a valid old choice cannot suppress new pairs');

 // Earlier ordinary saves are exported exactly, remain separate from a bulk
 // receipt, and take priority over Done when every ingredient already exists.
 reset();notebook=applyBulkCommand(initialNotebook(),{recipeId:'s1-v1',rows:reconcileDraft('Salt',[],[])});render();fill('Salt');await click('Review ingredients');resolve(workers.at(-1));
 const earlierPayload='\n'+JSON.stringify(notebook,null,1)+'\n';const staged=structuredClone(notebook);staged.recipes[0].notes='A later local note';
 const exactEarlier={id:crypto.randomUUID(),revision:12,payload:earlierPayload,localPayload:JSON.stringify(staged,null,2)};
 let earlierReceipt=structuredClone(exactEarlier),earlierRestores=[],earlierRetries=0,useSharedCalls=0;
 extraProps={earlierSavePending:true,getEarlierRecovery:()=>earlierReceipt};render();
 assert.ok(button('Retry earlier save'));assert.equal(button('Done'),undefined);assert.equal(button('Edit list').props.disabled,true);
 assert.equal(button('Restore draft').props.disabled,true);assert.equal(nodes('Checkbox')[0].props.disabled,true);
 await click('Download draft');const earlierFile=JSON.parse(await downloaded.text());
 assert.deepEqual(earlierFile.priorSave,exactEarlier);assert.equal(earlierFile.save.state,'unsubmitted');
 reset();earlierReceipt=null;extraProps={getEarlierRecovery:()=>earlierReceipt,onRestoreEarlierRecovery:receipt=>{earlierRestores.push(structuredClone(receipt));earlierReceipt=structuredClone(receipt);extraProps.earlierSavePending=true;return {ok:true,pending:true};},onRetryEarlierSave:async()=>{earlierRetries++;earlierReceipt=null;extraProps.earlierSavePending=false;return {ok:true,pending:false,notebook};}};render();
 await selectFile(JSON.stringify(earlierFile));await confirmRestore();resolve(workers.at(-1));
 assert.deepEqual(earlierRestores,[exactEarlier]);assert.ok(button('Retry earlier save'));assert.equal(button('Done'),undefined);
 const beforeEarlierRetry=sent.length;await click('Retry earlier save');if(workers.at(-1)&&!workers.at(-1).terminated)resolve(workers.at(-1));
 assert.equal(earlierRetries,1);assert.equal(sent.length,beforeEarlierRetry,'earlier save retry never submits a bulk command');assert.ok(button('Done'));

 // After the earlier request is checked, reconcile against the returned shared
 // notebook, then require a separate, explicit Add for still-missing names.
 reset();notebook=initialNotebook();earlierReceipt=null;
 const unsentText='Salt\nGinger',unsentRows=reconcileDraft(unsentText,[],[]);
 const unsentWithEarlier=makeIngredientDraft(notebook,notebook.recipes[0].id,unsentText,unsentRows,[],[],null,false,[],exactEarlier);
 extraProps={getEarlierRecovery:()=>earlierReceipt,onRestoreEarlierRecovery:receipt=>{earlierReceipt=structuredClone(receipt);extraProps.earlierSavePending=true;return {ok:true,pending:true};},onRetryEarlierSave:async()=>{notebook=applyBulkCommand(notebook,{recipeId:'s1-v1',rows:reconcileDraft('Salt',[],[])});earlierReceipt=null;extraProps.earlierSavePending=false;return {ok:true,pending:false,notebook};}};render();
 await selectFile(JSON.stringify(unsentWithEarlier));await confirmRestore();
 const beforeSeparateAdd=sent.length;await click('Retry earlier save');resolve(workers.at(-1));
 assert.equal(sent.length,beforeSeparateAdd);assert.equal(notebook.items.length,1);assert.equal(button('Add 1 ingredient').props.disabled,true,'a new exact catalog identity needs review');await click('Confirm name and type');assert.equal(button('Add 1 ingredient').props.disabled,false);
 assert.equal(flatten(tree).filter(n=>n==='Already in this dish').length,1);
 await click('Add 1 ingredient');assert.equal(sent.length,beforeSeparateAdd+1);assert.deepEqual(notebook.items.map(i=>i.name),['Salt','Ginger']);assert.equal(closed,1);

 // Choosing the shared version after a conflict is an explicit confirmation,
 // never an automatic dismissal of the extra earlier edits or ingredient list.
 reset();notebook=initialNotebook();earlierReceipt=null;
 extraProps={getEarlierRecovery:()=>earlierReceipt,onRestoreEarlierRecovery:receipt=>{earlierReceipt=structuredClone(receipt);extraProps.earlierSavePending=true;return {ok:true,pending:true};},onUseShared:()=>{useSharedCalls++;earlierReceipt=null;extraProps.earlierSavePending=false;extraProps.earlierSaveConflict=false;return {ok:true,pending:false,notebook};}};render();
 await selectFile(JSON.stringify(unsentWithEarlier));await confirmRestore();extraProps.earlierSaveConflict=true;render();
 assert.equal(button('Retry earlier save').props.disabled,true);await click('Continue with shared version');assert.equal(useSharedCalls,0);
 const sharedDialog=nodes('AlertDialog').find(n=>flatten(n).some(child=>child?.type==='AlertDialogTitle'&&label(child)==='Continue with the shared version?'));
 assert.equal(sharedDialog.props.open,true);assert.ok(flatten(sharedDialog).some(n=>typeof n==='string'&&n.includes('does not apply those extra earlier edits')));
 sharedDialog.props.onOpenChange(false);render();assert.equal(useSharedCalls,0);assert.deepEqual(earlierReceipt,exactEarlier);
 await click('Continue with shared version');await nodes('AlertDialogAction').find(n=>label(n)==='Use shared version').props.onClick();render();resolve(workers.at(-1));
 assert.equal(useSharedCalls,1);assert.equal(earlierReceipt,null);assert.equal(button('Add 2 ingredients').props.disabled,false);assert.equal(notebook.items.length,0);assert.equal(closed,0);
 URL.createObjectURL=oldCreateUrl;
 console.log('Passed actual dialog handlers: prep/reuse/skip preservation; copied-text restore gating; immutable zero-count replay; invalid match decisions; earlier-save export/restore/retry/conflict confirmation; separate Add after recovery; rejection/edit/retry; close protection; stale worker handling.');
}finally{await rm(dir,{recursive:true,force:true});}
