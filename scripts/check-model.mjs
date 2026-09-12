import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { mkdtemp,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'labula-model-'));
try{
 const entry=path.join(dir,'model.mjs');await build({entryPoints:['lib/notebook.ts'],bundle:true,platform:'node',format:'esm',outfile:entry,logLevel:'silent'});
 const {initialNotebook,newItem,validateNotebook,perPortion,usageMap,normalizeName,exportCsv}=await import(pathToFileURL(entry));
 const n=initialNotebook();assert.equal(new Set(n.recipes.map(r=>r.menuId)).size,19);assert.equal(n.recipes.length,24);assert.equal(n.items.length,0);validateNotebook(n);
 const x=newItem('Chilli Oil'),b=newItem('Sauce B','prep'),a=newItem('Sauce A','prep');b.yieldAmount=1000;b.inputs=[{itemId:x.id,amount:200,note:''}];a.yieldAmount=500;a.inputs=[{itemId:b.id,amount:100,note:''}];n.items=[x,b,a];n.recipes[0].portions=4;n.recipes[0].inputs=[{itemId:b.id,amount:100,note:''}];
 let calc=perPortion(n,n.recipes[0]);assert.equal(calc.amounts.get(b.id),25);assert.equal(calc.amounts.get(x.id),5);assert.equal(calc.amounts.get(x.id)*8,40);assert.deepEqual(calc.missing,[]);
 n.recipes[1].inputs=[{itemId:a.id,amount:50,note:''},{itemId:x.id,amount:5,note:''}];n.recipes.push({...n.recipes[0],id:'test-variant',variant:'Second variant'});validateNotebook(n);assert.equal(usageMap(n).get(x.id).all.size,2);
 n.recipes[1].active=false;assert.equal(usageMap(n).get(x.id).all.size,1);n.recipes[1].active=true;
 const collision=structuredClone(n);collision.items.push(newItem(' chílli   oil '));assert.equal(normalizeName(collision.items.at(-1).name),normalizeName(x.name));assert.throws(()=>validateNotebook(collision),/already exists/);
 const cycle=structuredClone(n);cycle.items[1].inputs=[{itemId:a.id,amount:1,note:''}];assert.throws(()=>validateNotebook(cycle),/cannot contain itself/);
 const absent=structuredClone(n);absent.recipes[0].inputs[0].itemId='missing';assert.throws(()=>validateNotebook(absent),/no longer exists/);
 for(const value of [0,-1,Infinity,NaN]){const bad=structuredClone(n);bad.items[1].yieldAmount=value;assert.throws(()=>validateNotebook(bad));}
 const unknown=structuredClone(n);unknown.items[1].inputs[0].amount=null;validateNotebook(unknown);calc=perPortion(unknown,unknown.recipes[0]);assert.ok(calc.missing.length>0);assert.equal(calc.amounts.has(x.id),false);
 const evidence=structuredClone(n);evidence.items[0].storage.evidence='documented';evidence.items[0].storage.safetyHours=24;assert.throws(()=>validateNotebook(evidence),/document reference/);evidence.items[0].storage.reference='Kitchen HACCP, 2026-09-12';validateNotebook(evidence);
 const incomplete=structuredClone(n);incomplete.recipes[2].recorded=true;assert.throws(()=>validateNotebook(incomplete),/before marking/);
 const csv=structuredClone(n);csv.items[0].name='=SUM(1,2)';assert.ok(exportCsv(csv).includes('"\'=SUM(1,2)"'));assert.ok(exportCsv(csv).includes('prep input'));
 console.log('Passed: 19 dishes / 24 variants; nested yields; distinct active-dish counts; duplicate names; cycles; dangling references; invalid and unknown quantities; safety evidence; recipe completion; CSV safety.');
}finally{await rm(dir,{recursive:true,force:true});}
