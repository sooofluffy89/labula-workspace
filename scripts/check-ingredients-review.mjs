import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

const dir=await mkdtemp(tmpdir()+'/labula-ingredients-review-');
try{
 const outfile=dir+'/test.mjs';
 await build({stdin:{contents:"export * from './lib/menu-review';export {withIngredientCatalog} from './lib/ingredient-review';export * from './lib/dish-workspace';export {initialNotebook,newItem,validateNotebook,perPortion,exportDishIngredientsCsv} from './lib/notebook';export {validateOrdinaryEdit,applyBulk,mergePreview,applyOperation} from './lib/catalog';export {makeNotebookDraft,readNotebookDraft,planNotebookRestore} from './lib/notebook-draft';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const m=await import(outfile);
 let n=m.initialNotebook();
 const ingredient={...m.newItem('Synthetic review scope eggplant'),id:'review-scope-eggplant'};
 const extra={...m.newItem('Synthetic review scope oil'),id:'review-scope-oil'};
 n.items=[ingredient,extra];
 const first=n.recipes[0],second=n.recipes[1],id=first.id;
 Object.assign(first,{portions:null,inputs:[{itemId:ingredient.id,amount:null,unit:'pcs',pieceMeaning:'one whole eggplant',conversion:null,note:'Batons'}],recorded:false,ingredientsReviewed:false,reviewStatus:'unverified',workshop:{...m.emptyWorkshop(),steps:[{id:'historical-before',phase:'before',text:'Previously saved prep step.'}],beforeMinutes:6,beforeTiming:{basis:'batch',portions:12,evidence:'estimate'},decisions:[{id:'open-test',kind:'test',text:'Compare cuts with Wen.',done:false}]}});
 n=m.validateNotebook(n);
 assert(m.reviewReady(first),'nonempty ingredients can be checked without recorded status or process completion');
 assert(!m.ingredientsReviewed(first));assert(!m.menuReviewComplete(first));
 assert(m.reviewIssues(n,first).every(issue=>!issue.blocking),'unknown quantities and portions remain optional for an ingredient pass');
 assert(!m.reviewIssues(n,first).some(issue=>['process','step','followup'].includes(issue.kind)));
 const empty={...first,inputs:[]};assert(!m.reviewReady(empty));assert(m.reviewIssues(n,empty).some(issue=>issue.kind==='list'&&issue.blocking));
 const checked=m.patchDishVariant(n,id,{recorded:true,ingredientsReviewed:true});m.validateNotebook(checked);m.validateOrdinaryEdit(n,checked,true);assert.throws(()=>m.validateOrdinaryEdit(n,checked,false),/Manager must mark ingredients reviewed/,'a nonmanager cannot grant the new scoped check');
 const r=checked.recipes.find(r=>r.id===id);
 assert(m.ingredientsReviewed(r));assert(m.menuReviewComplete(r));
 assert.equal(r.reviewStatus,'unverified','checking ingredients never promotes full verification');
 assert.deepEqual(r.workshop,first.workshop,'checking ingredients preserves historical steps, time and open tests');
 assert.equal(r.workshop.decisions[0].done,false);assert.equal(r.workshop.processChecked,false);
 assert.match(m.reviewLabel(checked,r),/Ingredients reviewed/);
 for(const patch of [{inputs:structuredClone(r.inputs)},{portions:r.portions},{recorded:true,ingredientsReviewed:true},{workshop:structuredClone(r.workshop)}]){
  assert.deepEqual(m.patchDishVariant(checked,id,patch),checked,'no-op patches preserve scoped checks and exact values');
 }
 const other=structuredClone(checked.recipes.find(r=>r.id===second.id));
 for(const patch of [
  {inputs:r.inputs.map(p=>({...p,amount:0.5}))},
  {inputs:r.inputs.map(p=>({...p,note:'New cut'}))},
  {inputs:r.inputs.map(p=>({...p,pieceMeaning:'one peeled eggplant'}))},
  {inputs:r.inputs.map(p=>({...p,unit:'g',amount:100,conversion:null}))},
  {inputs:r.inputs.map(p=>({...p,conversion:{from:'pcs',to:'g',factor:240}}))},
  {portions:2},
 ]){
  const changed=m.patchDishVariant(checked,id,patch),next=changed.recipes.find(r=>r.id===id);
  assert.equal(next.ingredientsReviewed,false,'ingredient and portion changes invalidate scoped check');assert.equal(next.recorded,false);assert.equal(next.reviewStatus,'unverified');
  assert(!m.menuReviewComplete(next));assert.deepEqual(changed.recipes.find(r=>r.id===second.id),other,'another variant keeps its data and status');assert.deepEqual(changed.items,checked.items,'recipe edits preserve catalog units');
  const forged=structuredClone(changed);Object.assign(forged.recipes.find(r=>r.id===id),{ingredientsReviewed:true,recorded:true});
  assert.throws(()=>m.validateOrdinaryEdit(checked,forged,true),/review|check|confirm/i,'a client cannot preserve ingredient confirmation across a substantive change');
 }
 const processChange=m.patchDishVariant(checked,id,{workshop:{...r.workshop,steps:[{id:'historical-before',phase:'before',text:'Corrected historical step.'}]}});
 assert(m.ingredientsReviewed(processChange.recipes.find(r=>r.id===id)),'process-only edit preserves the ingredient check');assert.equal(processChange.recipes.find(r=>r.id===id).reviewStatus,'unverified');m.validateOrdinaryEdit(checked,processChange,true);
 const oldClient=structuredClone(checked);delete oldClient.recipes.find(r=>r.id===id).ingredientsReviewed;
 assert.throws(()=>m.validateOrdinaryEdit(checked,oldClient,true),/reload|preserve|review/i,'stale clients cannot drop explicit scoped confirmation');
 const invalid=structuredClone(checked);invalid.recipes.find(r=>r.id===id).inputs=[];assert.throws(()=>m.validateNotebook(invalid),/ingredient|recorded|review/i);
 const legacy={...r,recorded:true,reviewStatus:'verified'};delete legacy.ingredientsReviewed;
 assert(m.ingredientsReviewed(legacy),'known legacy verified lists retain their ingredient review');
 assert(!m.ingredientsReviewed({...legacy,reviewStatus:'unverified'}),'legacy unverified lists are not promoted');
 assert(!m.ingredientsReviewed({...legacy,recorded:false}));assert(!m.ingredientsReviewed({...legacy,inputs:[]}));assert(!m.ingredientsReviewed({...legacy,ingredientsReviewed:false}),'explicit invalidation overrides legacy verified status');
 const legacyNotebook=structuredClone(checked);Object.assign(legacyNotebook.recipes.find(r=>r.id===id),{...legacy,workshop:{...m.emptyWorkshop(),processChecked:true,steps:[{id:'verified-step',phase:'before',text:'Prepare before service.'}]}});m.validateNotebook(legacyNotebook);
 const legacyProcess=m.patchDishVariant(legacyNotebook,id,{notes:'Corrected preparation note'});assert(m.ingredientsReviewed(legacyProcess.recipes.find(r=>r.id===id)),'legacy ingredient check survives process-only invalidation');assert.equal(legacyProcess.recipes.find(r=>r.id===id).reviewStatus,'unverified');
 const fullForgery=structuredClone(legacyNotebook);fullForgery.recipes.find(r=>r.id===id).workshop.steps[0].text='Changed without a fresh full review';assert.throws(()=>m.validateOrdinaryEdit(legacyNotebook,fullForgery,true),/checked process|fresh review/i,'full recipe verification guards remain active');
 const unresolved=structuredClone(legacyNotebook);unresolved.recipes.find(r=>r.id===id).workshop.decisions.push({id:'pending-verification',kind:'test',text:'Unresolved full review test',done:false});assert.throws(()=>m.validateNotebook(unresolved),/resolve/i,'full verification retains its own process/test gate');
 const copied=m.addDish(checked,'Synthetic copied scope recipe','Starters',r.menuId).notebook;assert(copied.recipes.filter(recipe=>recipe.menuId!==r.menuId&&!checked.recipes.some(old=>old.id===recipe.id)).every(recipe=>recipe.ingredientsReviewed===false&&!recipe.recorded),'new identities require their own ingredient review');
 const bulk=m.applyBulk(checked,id,[{name:extra.name,targetId:extra.id,kind:'bought',skip:false}]);assert(!m.ingredientsReviewed(bulk.recipes.find(r=>r.id===id)));assert.equal(bulk.recipes.find(r=>r.id===id).ingredientsReviewed,false);
 const reclassified=m.applyOperation(checked,{kind:'reclassify',itemId:ingredient.id,itemKind:'prep'}).next;assert(!m.ingredientsReviewed(reclassified.recipes.find(r=>r.id===id)),'catalog type correction invalidates affected ingredient checks');
 const make=(local,base)=>m.readNotebookDraft(JSON.stringify(m.makeNotebookDraft(local,{revision:1,notebook:base},'synthetic-scope@test',[],null,null,null)));
 const local=structuredClone(checked);Object.assign(local.recipes.find(r=>r.id===id),{ingredientsReviewed:false,recorded:false,inputs:[{...r.inputs[0],amount:0.5,conversion:{from:'pcs',to:'g',factor:240}}]});
 const restored=m.planNotebookRestore(make(local,checked),checked,{}, {},true);assert.equal(restored.error,'');const rr=restored.next.recipes.find(r=>r.id===id);assert.equal(rr.inputs[0].amount,0.5);assert.deepEqual(rr.inputs[0].conversion,{from:'pcs',to:'g',factor:240});assert.equal(rr.ingredientsReviewed,false);assert.equal(rr.recorded,false);assert.deepEqual(rr.workshop,r.workshop,'ingredient recovery preserves historical process metadata');
 const oldFile=structuredClone(checked);delete oldFile.recipes.find(r=>r.id===id).ingredientsReviewed;const oldRestore=m.planNotebookRestore(make(oldFile,oldFile),checked,{}, {},true);assert.equal(oldRestore.error,'');assert.equal(oldRestore.next.recipes.find(r=>r.id===id).ingredientsReviewed,true,'older unchanged recovery cannot erase explicit scope');
 const implicit=structuredClone(checked);Object.assign(implicit.recipes.find(r=>r.id===id).inputs[0],{amount:null});delete implicit.recipes.find(r=>r.id===id).inputs[0].unit;delete implicit.recipes.find(r=>r.id===id).inputs[0].pieceMeaning;delete implicit.recipes.find(r=>r.id===id).inputs[0].conversion;
 const changedCatalog=structuredClone(implicit);changedCatalog.items.find(i=>i.id===ingredient.id).unit='pcs';
 assert.throws(()=>m.validateOrdinaryEdit(implicit,changedCatalog,true),/fresh ingredient review/i,'catalog unit changes alter the meaning of legacy implicit recipe quantities even if amount is unknown');
 const safeCatalog=m.withIngredientCatalog(implicit,changedCatalog.items);assert.equal(safeCatalog.recipes.find(r=>r.id===id).ingredientsReviewed,false);assert.equal(safeCatalog.recipes.find(r=>r.id===id).recorded,false);assert.deepEqual(safeCatalog.recipes.find(r=>r.id===id).workshop.steps,implicit.recipes.find(r=>r.id===id).workshop.steps);assert.deepEqual(safeCatalog.recipes.find(r=>r.id===id).workshop.beforeTiming,implicit.recipes.find(r=>r.id===id).workshop.beforeTiming);m.validateOrdinaryEdit(implicit,safeCatalog,true);
 const explicitCatalog=m.withIngredientCatalog(checked,changedCatalog.items);assert.equal(explicitCatalog.recipes.find(r=>r.id===id).ingredientsReviewed,true,'explicit recipe units retain their meaning after an unrelated catalog unit change');
 const catalogRestore=m.planNotebookRestore(make(changedCatalog,implicit),implicit,{}, {},true);assert.equal(catalogRestore.error,'');assert.equal(catalogRestore.next.items.find(i=>i.id===ingredient.id).unit,'pcs');assert.equal(catalogRestore.next.recipes.find(r=>r.id===id).ingredientsReviewed,false,'restoring an implicit catalog-unit change invalidates dependent ingredient checks');
 const withConversion=structuredClone(checked);withConversion.recipes.find(r=>r.id===id).inputs[0].conversion={from:'pcs',to:'g',factor:240};const reordered=m.patchDishVariant(withConversion,id,{inputs:withConversion.recipes.find(r=>r.id===id).inputs.map(p=>({...p,conversion:{factor:240,to:'g',from:'pcs'}}))});assert.equal(reordered.recipes.find(r=>r.id===id).ingredientsReviewed,true,'conversion object key order does not invalidate an unchanged meaning');
 const csv=m.exportDishIngredientsCsv(checked),header=csv.split('\r\n')[0];assert.match(header,/"Export scope","Ingredients reviewed"$/,'CSV appends the scoped check after established columns');assert.match(csv,/"true"/);
 const exportText=m.exportMenuReview(checked);assert.match(exportText,/Ingredients reviewed/);assert.match(exportText,/one whole eggplant/);assert.match(exportText,/Previously saved prep step/);assert.match(exportText,/Compare cuts with Wen/);assert.match(exportText,/6 min.*batch basis.*12 portions.*estimate evidence/);assert.equal(r.inputs[0].amount,null);
 console.log('PASS ingredient review scope: independent completion, unknown quantities, process/test retention, legacy migration, no-op preservation, variant isolation, stale-client and full-verification guards, bulk/catalog invalidation, atomic recovery and honest export.');
}finally{await rm(dir,{recursive:true,force:true});}
