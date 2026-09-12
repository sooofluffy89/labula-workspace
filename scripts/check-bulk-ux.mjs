import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-ux-'));
try{
 const outfile=path.join(dir,'ux.mjs');await build({stdin:{contents:"export * from './lib/bulk';export * from './lib/bulk-review';export * from './lib/bulk-draft';export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const {initialNotebook,newItem,reconcileDraft,draftSuggestions,matchPairs,applyMatch,planBulk,applyBulkCommand,readIngredientDraft,makeIngredientDraft,restoreIngredientDraft}=await import(outfile);
 let n=initialNotebook(),recipeId=n.recipes[0].id,rows=reconcileDraft('Garlic cloves\nGarlic clovs\nGarlic clovs',[],[]);
 let matches=draftSuggestions(n.items,rows),pairs=matchPairs(rows,n.items,matches);assert.equal(pairs.length,1,'symmetric suggestions share one decision');assert.equal(planBulk(n,{recipeId,rows}).count,2);
 const chosen=[pairs[0].a,pairs[0].b].find(x=>x.name==='Garlic cloves');let shared=applyMatch(rows,pairs[0],chosen);assert.equal(matchPairs(shared,[],matches).length,0);assert.equal(planBulk(n,{recipeId,rows:shared}).count,1);assert.equal(shared.find(r=>r.name==='Garlic clovs').occurrences,2);
 const kept=pairs[0].id;const reordered=reconcileDraft('Garlic clovs\nGARLIC CLOVES',rows,[]).map(r=>({...r,kind:'prep'}));assert.equal(matchPairs(reordered,[],draftSuggestions([],reordered))[0].id,kept,'same identity retains separate choice across casing, order and type');
 n.items.push(newItem('Garlic cloves','bought'));rows=reconcileDraft('Garlic clovs\nGarlic clove',[],n.items);pairs=matchPairs(rows,n.items,draftSuggestions(n.items,rows));const catalogPair=pairs.find(p=>p.a.type==='item'||p.b.type==='item');const itemEnd=[catalogPair.a,catalogPair.b].find(e=>e.type==='item');rows=applyMatch(rows,catalogPair,itemEnd);pairs=matchPairs(rows,n.items,draftSuggestions(n.items,rows));assert.equal(pairs.length,1,'multiple aliases resolve to one catalog/new pair');rows=applyMatch(rows,pairs[0],[pairs[0].a,pairs[0].b].find(e=>e.type==='item'));assert.equal(planBulk(n,{recipeId,rows}).count,1);
 let file=makeIngredientDraft(n,recipeId,'Garlic clovs\nGarlic clove',rows,[],[],null);const parsed=readIngredientDraft(JSON.stringify(file));assert.deepEqual(restoreIngredientDraft(parsed,n,recipeId).rows,rows);
 const changed=structuredClone(n);changed.items[0].name='Peeled garlic cloves';changed.items[0].kind='prep';const restored=restoreIngredientDraft(file,changed,recipeId);assert.equal(restored.needsReview.length,2,'renamed/changed selected items require review');
 const removed=structuredClone(n);removed.items=[];assert.equal(restoreIngredientDraft(file,removed,recipeId).needsReview.length,2,'missing target marked without silently remapping');
 assert.throws(()=>restoreIngredientDraft(file,n,n.recipes[1].id),/belongs to/);assert.throws(()=>readIngredientDraft('{broken'),/could not be read/);assert.throws(()=>readIngredientDraft(JSON.stringify({...file,version:42})),/not a supported/);assert.throws(()=>readIngredientDraft('x'.repeat(750001)),/too large/);assert.throws(()=>readIngredientDraft(JSON.stringify({...file,rows:[{...rows[0],key:'wrong'}]})),/inconsistent/);
 const legacy=readIngredientDraft(JSON.stringify({recipeId,text:'Garlic clovs',rows:[rows[0]]}));assert.equal(legacy.save.state,'unverified');assert.equal(makeIngredientDraft(n,recipeId,legacy.text,legacy.rows,[],[],null,true).save.state,'unverified','reference-only status survives another export');
 // Text may legitimately change while Edit list is open; preserve choices by name.
 file=makeIngredientDraft(n,recipeId,'Salt\nGarlic clovs',rows,[],[],null);const edited=restoreIngredientDraft(file,n,recipeId);assert.equal(edited.rows.length,2);assert.equal(edited.rows[1].target.id,n.items[0].id);
 // Recovery carries the exact original command, even after its items now exist.
 const empty=initialNotebook(),command={recipeId,rows:reconcileDraft('Ginger\nSesame oil',[],[])},recovery={id:crypto.randomUUID(),revision:0,command};
 file=makeIngredientDraft(empty,recipeId,'Ginger\nSesame oil',command.rows,[],[],recovery);const after=applyBulkCommand(empty,command);const restoredPending=restoreIngredientDraft(readIngredientDraft(JSON.stringify(file)),after,recipeId);assert.deepEqual(restoredPending.rows,command.rows);assert.deepEqual(file.save.recovery,recovery);assert.equal(restoredPending.rows[0].target,null,'never reconcile an uncertain command before replay');
 assert.throws(()=>readIngredientDraft(JSON.stringify({...file,save:{state:'pending',recovery:{...recovery,command:{...command,recipeId:'other'}}}})),/different dish/);
 console.log('Passed UX regressions: symmetric pair decisions; canonical reuse; stable separate choices; draft roundtrip; changed and missing matches; wrong dish and malformed files; legacy provenance; immutable pending restoration.');
}finally{await rm(dir,{recursive:true,force:true});}
