import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'labula-usage-'));
try{
 const outfile=path.join(dir,'model.mjs');await build({stdin:{contents:"export * from './lib/direct-usage';export {initialNotebook,newItem,validateNotebook} from './lib/notebook';export {applyOperation} from './lib/catalog';export {applyBulkCommand,reconcileDraft} from './lib/bulk';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const {directUsage,ingredientGroups,removeInput,droppedItems,dedicatedPreparations,scenarioSelection,scenarioNotice,initialNotebook,newItem,applyOperation,applyBulkCommand,reconcileDraft,validateNotebook}=await import(outfile);
 let n=initialNotebook();n.recipes.forEach(r=>r.active=false);const mk=(id,name,kind='bought')=>({...newItem(name),id,kind});n.items=[mk('a','Salt'),mk('b','Sauce','prep'),mk('c','Salt'),mk('d','Unused'),mk('nested','Nested ingredient')];n.items[1].inputs=[{itemId:'nested',amount:2,note:'historical'}];const set=(id,ids,active=true)=>{const r=n.recipes.find(r=>r.id===id);r.active=active;r.inputs=ids.map(itemId=>({itemId,amount:4,note:'preserve'}));return r;};
 set('m1-v1',['a','b']).recorded=true;set('m1-v2',['b','c']);set('s1-v1',['b']);set('s2-v1',['d'],false);
 const before=JSON.stringify(n),base=directUsage(n);assert.equal(base.dishes.length,2);assert.equal(base.itemDishes.get('b').size,2);assert.equal(base.itemDishes.get('c').size,1);assert.equal(base.itemDishes.size,3);assert.equal(base.bought,2);assert.equal(base.prep,1);assert.ok(!base.itemDishes.has('nested'));assert.ok(!base.itemDishes.has('d'));
 const groups=ingredientGroups(base,'m1',n.recipes.find(r=>r.id==='m1-v1').inputs);assert.deepEqual(groups.shared.map(p=>p.itemId),['b']);assert.deepEqual(groups.only.map(p=>p.itemId),['a']);assert.equal(JSON.stringify(n),before,'derive/sort must not mutate any notebook field');
 const inactive=ingredientGroups(base,'s2',[{itemId:'a'},{itemId:'d'}]);assert.equal(inactive.only.length,0);assert.equal(inactive.other.length,2);
 assert.deepEqual(removeInput([{itemId:'a',amount:4,note:'keep'},{itemId:'b',amount:1,note:'drop'}],'b'),[{itemId:'a',amount:4,note:'keep'}]);
 const one=directUsage(n,new Set(['m1']));assert.equal(droppedItems(base,one).length,0);assert.equal(dedicatedPreparations(one)[0].dedicated.length,1);assert.equal(dedicatedPreparations(base)[0].dedicated.length,0);
 const empty=directUsage(n,new Set());assert.equal(empty.itemDishes.size,0);assert.equal(droppedItems(base,empty).length,3);assert.equal(droppedItems(base,empty).filter(i=>i.id==='b').length,1);assert.deepEqual([...scenarioSelection(base,null)],['s1','m1']);assert.equal(scenarioSelection(base,{selected:[],known:[]}).size,0);assert.equal(scenarioNotice(base,{selected:['m1'],known:['m1']}),true);
 // All changed snapshots use the same derivation: single add/remove, bulk, active flags, catalog merge and Undo snapshot.
 n.recipes.find(r=>r.id==='s1-v1').inputs.push({itemId:'c',amount:null,note:''});assert.equal(directUsage(n).itemDishes.get('c').size,2);
 n.items.find(i=>i.id==='c').name='Sea salt';
 n=applyBulkCommand(n,{recipeId:'s1-v1',rows:reconcileDraft('Salt',[],n.items)});assert.equal(directUsage(n).itemDishes.get('a').size,2);
 n.recipes.find(r=>r.id==='s1-v1').active=false;assert.equal(directUsage(n).itemDishes.get('b').size,1);
 const undo=structuredClone(n);const merged=applyOperation(n,{kind:'merge',sourceId:'c',targetId:'a'}).next;assert.equal(directUsage(merged).itemDishes.has('c'),false);assert.equal(directUsage(undo).itemDishes.has('c'),true);
 // Fresh backup validation is separate from the optional, historical analytics fixture.
 const backupPath=process.env.LABULA_VERIFY_BACKUP;if(backupPath)validateNotebook(JSON.parse(await readFile(backupPath,'utf8')));
 const historical=path.resolve('../analyza-kuchyne-2026-09-13/podklady.json');
 try{const h=JSON.parse(await readFile(historical,'utf8'));const fixture={...initialNotebook(),items:h.items.map(([name,kind],i)=>mk(String(i),name,kind)),recipes:h.recipes.map(r=>({...initialNotebook().recipes.find(x=>x.id===r.id),...r,inputs:r.items.map(id=>({itemId:String(id),amount:null,note:''}))}))};const keep=['s2','s3','s4','s6','s7','m1','m2','m5','p3','p2','m6'];const idx=directUsage(fixture,new Set(keep));assert.deepEqual([idx.itemDishes.size,idx.bought,idx.prep],[62,27,35]);const noMapo=directUsage(fixture,new Set(keep.filter(id=>id!=='p3')));assert.deepEqual([noMapo.itemDishes.size,noMapo.bought,noMapo.prep],[54,20,34]);assert.equal(directUsage(fixture,new Set(keep.filter(id=>id!=='s7'))).itemDishes.size,62);const rows=dedicatedPreparations(idx);for(const [id,count]of [['m1',6],['m2',4],['m5',3],['p2',3]])assert.equal(rows.find(r=>r.dish.id===id).dedicated.length,count);console.log('Historical rev181 regression passed.');}catch(e){if(e.code!=='ENOENT')throw e;}
 console.log('Direct usage: identity, variant union, inactive/unfinished, non-recursion, sorting/removal, scenario union/reset, dedicated prep and snapshot reactivity passed.');
}finally{await rm(dir,{recursive:true,force:true});}
