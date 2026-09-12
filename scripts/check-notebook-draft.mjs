import {build} from 'esbuild';
import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
const dir=await mkdtemp(tmpdir()+'/labula-plan-review-');
try {
 const outfile=dir+'/bundle.mjs';
 await build({stdin:{contents:"export * from './lib/notebook-draft'; export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const {initialNotebook,newItem,makeNotebookDraft,readNotebookDraft,planNotebookRestore}=await import(outfile);
 const make=(local,base)=>makeNotebookDraft(local,base?{revision:1,notebook:base}:null,'chef@test',[],null,null,null);
 const baseline=initialNotebook(),salt=newItem('Salt'),pepper=newItem('Pepper');baseline.items=[salt,pepper];baseline.recipes[0].inputs=[{itemId:salt.id,amount:null,note:''}];
 // Independent local and foreign edits on separate dishes both survive.
 let local=structuredClone(baseline),shared=structuredClone(baseline);local.recipes[0].active=false;shared.recipes[1].active=false;
 let p=planNotebookRestore(make(local,baseline),shared);assert.equal(p.unresolved,0);assert.equal(p.next.recipes[0].active,false);assert.equal(p.next.recipes[1].active,false);
 // A legacy file never silently removes newer shared membership.
 shared=structuredClone(baseline);shared.recipes[0].inputs.push({itemId:pepper.id,amount:null,note:''});
 const legacy=readNotebookDraft(JSON.stringify({exportedAt:'2026-09-12',sourceMenu:'https://www.labula.cz/menu',notebook:baseline}));p=planNotebookRestore(legacy,shared);assert.ok(p.unresolved>0);assert.equal(p.next.recipes[0].inputs.length,2);
 // An untouched old Completed flag must remain untouched by restore planning.
 const complete=structuredClone(baseline);complete.recipes[0].recorded=true;shared=structuredClone(complete);shared.recipes[0].inputs.push({itemId:pepper.id,amount:null,note:''});shared.recipes[0].recorded=false;
 p=planNotebookRestore(make(complete,complete),shared);assert.equal(p.changes.some(c=>c.id==='recorded:'+complete.recipes[0].id),false);assert.equal(p.next.recipes[0].recorded,false);assert.equal(p.next.recipes[0].inputs.length,2);assert.equal(p.unresolved,0);
 // Missing imported IDs require a mapping even if they were absent from base.
 const empty=initialNotebook();local=structuredClone(empty);const retired=newItem('Old garlic');local.items=[retired];local.recipes[0].inputs=[{itemId:retired.id,amount:null,note:''}];
 shared=structuredClone(empty);const survivor=newItem('Current garlic');shared.items=[survivor];shared.recipes[0].inputs=[{itemId:survivor.id,amount:null,note:''}];
 const retiredFile=make(local,empty);p=planNotebookRestore(retiredFile,shared);assert.equal(p.unmapped.length,1);assert.ok(p.unresolved>0);assert.equal(p.next.items.some(i=>i.id===retired.id),false);
 const mapped=planNotebookRestore(retiredFile,shared,{}, {[retired.id]:survivor.id});assert.equal(mapped.unresolved,0);assert.equal(mapped.next.items.length,1);assert.equal(mapped.next.recipes[0].inputs[0].itemId,survivor.id);
 const freshId=crypto.randomUUID(),created=planNotebookRestore(retiredFile,shared,{}, {[retired.id]:'new:'+freshId});assert.equal(created.unresolved,0);assert.ok(created.next.items.some(i=>i.id===freshId));assert.equal(created.next.items.some(i=>i.id===retired.id),false);assert.equal(created.error,'');
 // Pending-save export retains the exact receipt and the real extra local data.
 const original=structuredClone(baseline),extra=structuredClone(original);extra.recipes[0].active=false;
 const receipt={id:crypto.randomUUID(),revision:7,payload:'\n'+JSON.stringify(original,null,1)+'\n',localPayload:JSON.stringify(extra,null,2)};
 let pending=makeNotebookDraft(extra,{revision:7,notebook:baseline},'chef@test',[],receipt,null,null);assert.equal(pending.base.revision,7);assert.deepEqual(pending.notebook,extra);assert.deepEqual(pending.recovery.receipt,receipt);
 pending=readNotebookDraft(JSON.stringify(pending));assert.deepEqual(pending.recovery.receipt,receipt);assert.deepEqual(pending.notebook,extra);
 // A post-conflict export exposes fresh shared data/base but must recover the
 // old extra data from its receipt, without treating fresh base as provenance.
 const foreign=structuredClone(original);foreign.recipes[1].active=false;
 const afterConflict=makeNotebookDraft(foreign,{revision:9,notebook:foreign},'chef@test',[],receipt,null,null);
 assert.deepEqual(afterConflict.notebook,extra);assert.deepEqual(afterConflict.recovery.receipt,receipt);assert.equal(afterConflict.base,null,'a different confirmed revision is not the editing base for old localPayload');
 const conflictPlan=planNotebookRestore(afterConflict,foreign);assert.ok(conflictPlan.unresolved>0);assert.equal(conflictPlan.next.recipes[1].active,false,'foreign edit remains until explicit conflict choice');
 const legacyPending=readNotebookDraft(JSON.stringify({exportedAt:'2026-09-12',sourceMenu:'https://www.labula.cz/menu',notebook:foreign,earlierSave:receipt}));assert.deepEqual(legacyPending.notebook,extra);assert.equal(legacyPending.base,null);assert.deepEqual(legacyPending.recovery.receipt,receipt);
 console.log('Passed restore-plan boundaries: independent foreign edits, explicit legacy removals, unchanged completion, missing/retired ID mapping, fresh IDs, exact pending receipt/localPayload, legacy pending exports and post-conflict base provenance.');
} finally {await rm(dir,{recursive:true,force:true});}
