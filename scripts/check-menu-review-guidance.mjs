import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

const dir=await mkdtemp(tmpdir()+'/labula-review-guidance-');
try{
 const outfile=dir+'/guidance.mjs';
 await build({stdin:{contents:"export * from './lib/menu-review';export {patchDishVariant} from './lib/dish-workspace';export {initialNotebook,newItem,validateNotebook,perPortion} from './lib/notebook';export {validateOrdinaryEdit} from './lib/catalog';export {makeNotebookDraft,readNotebookDraft,planNotebookRestore} from './lib/notebook-draft';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const m=await import(outfile);
 let n=m.initialNotebook();
 const counted={...m.newItem('Synthetic counted vegetable'),id:'guidance-counted'},unknown={...m.newItem('Synthetic garnish'),id:'guidance-unknown'};
 n.items.push(counted,unknown);
 const id=n.recipes[0].id,otherId=n.recipes[1].id;
 Object.assign(n.recipes[0],{portions:null,inputs:[{itemId:counted.id,amount:0.5,unit:'pcs',pieceMeaning:'one medium vegetable',conversion:null,note:'Even pieces'},{itemId:unknown.id,amount:null,note:''}],recorded:false,reviewStatus:'unverified',workshop:{...m.emptyWorkshop(),steps:[{id:'guidance-step',phase:'before',text:''}],decisions:[{id:'guidance-test',kind:'test',text:'Compare both cuts with Wen',done:false}]}});
 n=m.validateNotebook(n);

 const issues=m.reviewIssues(n,n.recipes[0]);
 assert.equal(new Set(issues.map(i=>i.id)).size,issues.length,'each issue needs a stable unique navigation target');
 for(const kind of ['list','portions','amount','conversion','process','step','followup'])assert(issues.some(i=>i.kind===kind),'expose the concrete '+kind+' gap');
 for(const issue of issues){assert(issue.message.trim());assert(['ingredients','portions','process','decisions'].includes(issue.target));assert.equal(typeof issue.blocking,'boolean');}
 assert(issues.some(i=>i.kind==='amount'&&i.itemId===unknown.id&&i.target==='ingredients'&&!i.blocking));
 assert(issues.some(i=>i.kind==='conversion'&&i.itemId===counted.id&&i.target==='ingredients'&&!i.blocking));
 assert(issues.some(i=>i.kind==='portions'&&i.target==='portions'&&!i.blocking));
 assert(issues.some(i=>i.kind==='step'&&i.stepId==='guidance-step'&&i.target==='process'&&i.blocking));
 assert(issues.some(i=>i.kind==='followup'&&i.target==='decisions'&&i.blocking));
 assert.notEqual(m.reviewSummary(n,n.recipes[0]),'To review','the summary must describe actual remaining work');
 assert(!m.reviewReady(n.recipes[0]));

 const ready=structuredClone(n);
 Object.assign(ready.recipes[0],{recorded:true,reviewStatus:'verified',workshop:{...ready.recipes[0].workshop,processChecked:true,steps:[{id:'guidance-step',phase:'before',text:'Prepare the garnish.'}],decisions:ready.recipes[0].workshop.decisions.map(d=>({...d,done:true}))}});
 m.validateNotebook(ready);
 assert(m.reviewReady(ready.recipes[0]),'unknown amounts, portions and conversion do not prevent checking the list and process');
 const remaining=m.reviewIssues(ready,ready.recipes[0]);
 assert(remaining.length>=3);assert(remaining.every(i=>!i.blocking),'checked-with-quantity-gaps remains eligible to finish');
 assert.match(m.reviewLabel(ready,ready.recipes[0]),/quantities pending/);
 assert.match(m.reviewSummary(ready,ready.recipes[0]),/amount|portion|conversion|quantit/i,'remaining quantitative work stays visible');

 const legacy=structuredClone(ready);delete legacy.recipes[0].workshop;
 assert(m.reviewIssues(legacy,legacy.recipes[0]).some(i=>i.kind==='process'&&i.blocking),'legacy list verification must not claim a checked process');
 const malformed=structuredClone(ready);malformed.recipes[0].workshop.steps[0].text='  ';
 assert(m.reviewIssues(malformed,malformed.recipes[0]).some(i=>i.kind==='step'&&i.blocking));

 const checked=ready.recipes[0];
 checked.workshop.beforeMinutes=6;checked.workshop.beforeTiming={basis:'batch',portions:12,evidence:'estimate'};
 for(const patch of [{inputs:structuredClone(checked.inputs)},{portions:checked.portions},{workshop:structuredClone(checked.workshop)},{notes:checked.notes},{recorded:true}]){
  const same=m.patchDishVariant(ready,id,patch);assert.deepEqual(same,ready,'re-saving the same value must preserve all review checks');
 }
 const changed=m.patchDishVariant(ready,id,{inputs:checked.inputs.map(p=>p.itemId===counted.id?{...p,pieceMeaning:'one peeled medium vegetable'}:p)});
 assert.equal(changed.recipes[0].recorded,false);assert.equal(changed.recipes[0].workshop.processChecked,false);assert.equal(changed.recipes[0].reviewStatus,'unverified');
 assert.deepEqual(changed.recipes.find(r=>r.id===otherId),ready.recipes.find(r=>r.id===otherId),'piece meaning changes are isolated to the selected variant');
 assert.deepEqual(changed.items,ready.items,'inline piece meaning cannot change the shared catalog');
 assert.equal(m.perPortion(changed,changed.recipes[0]).amounts.has(counted.id),false,'a textual piece meaning is not a numeric conversion');
 const explicit=m.patchDishVariant(changed,id,{inputs:changed.recipes[0].inputs.map(p=>p.itemId===counted.id?{...p,conversion:{from:'pcs',to:'g',factor:240}}:p),portions:2});
 assert.equal(m.perPortion(explicit,explicit.recipes[0]).amounts.get(counted.id),60);
 assert(!m.reviewIssues(explicit,explicit.recipes[0]).some(i=>i.kind==='conversion'&&i.itemId===counted.id));

 const noteOnly=m.applySharedPreparation(ready,counted.id,[id],'New cut',false);
 assert.deepEqual(noteOnly.recipes[0].inputs[0],{...checked.inputs[0],note:'New cut'});
 assert.deepEqual(noteOnly.recipes.find(r=>r.id===otherId),ready.recipes.find(r=>r.id===otherId));
 assert.deepEqual(noteOnly.processes,ready.processes);
 const older=structuredClone(ready);delete older.recipes[0].inputs[0].pieceMeaning;
 assert.throws(()=>m.validateOrdinaryEdit(ready,older,true),/preserve saved ingredient units/);

 const emptyTime=m.phaseTimeSummary(undefined,'before');
 assert.match(emptyTime,/not recorded|unknown|—/i);assert(!/unknown.*unknown|not recorded.*not recorded/i.test(emptyTime),'unknown time is communicated once');
 assert.match(m.phaseTimeSummary(checked.workshop,'before'),/6\s*min.*batch.*estimate/i);
 const order={...checked.workshop,orderMinutes:2,orderTiming:{basis:'order',portions:1,evidence:'measured'}};
 assert.match(m.phaseTimeSummary(order,'order'),/2\s*min.*order.*measured/i);
 const exportText=m.exportMenuReview(ready);
 assert.match(exportText,/0.5 pcs/);assert.match(exportText,/one medium vegetable/);assert.match(exportText,/Compare both cuts with Wen/);

 const draft=(local,base)=>m.readNotebookDraft(JSON.stringify(m.makeNotebookDraft(local,{revision:1,notebook:base},'synthetic-guidance@test',[],null,null,null)));
 const local=structuredClone(ready),shared=structuredClone(ready);
 Object.assign(local.recipes[0].inputs[0],{pieceMeaning:'one peeled vegetable',conversion:{from:'pcs',to:'g',factor:220}});
 Object.assign(shared.recipes[0].inputs[0],{amount:0.75,pieceMeaning:'one unpeeled vegetable'});
 const conflict='measurement:'+id+':'+counted.id;
 let restored=m.planNotebookRestore(draft(local,ready),shared,{}, {},true);
 assert(restored.changes.some(c=>c.id===conflict&&c.conflict));
 assert.deepEqual(restored.next.recipes[0].inputs[0],shared.recipes[0].inputs[0],'default restore retains the shared complete measurement');
 restored=m.planNotebookRestore(draft(local,ready),shared,{[conflict]:'draft'}, {},true);
 assert.equal(restored.error,'');assert.deepEqual(restored.next.recipes[0].inputs[0],local.recipes[0].inputs[0],'explicit resolution restores amount, meaning and conversion together');
 console.log('PASS menu review guidance: concrete navigable gaps, checked-with-unknown eligibility, legacy scope, no-op checks, scoped piece meaning, explicit conversions, time summaries, export and atomic recovery.');
}finally{await rm(dir,{recursive:true,force:true});}
