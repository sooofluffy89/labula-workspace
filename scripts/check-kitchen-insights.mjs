import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(os.tmpdir(),'labula-insights-'));
try{
 const output=path.join(dir,'insights.mjs');
 await build({stdin:{contents:"export * from './lib/kitchen-insights';export {initialNotebook,newItem,validateNotebook} from './lib/notebook';export {emptyProfile,newStorageSetup} from './lib/prep-profile';export {emptyBatch} from './lib/batch-profile';",resolveDir:process.cwd()},outfile:output,bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const m=await import(output),n=m.initialNotebook();n.recipes.forEach(r=>r.active=false);
 const a=m.newItem('Daily broth','prep'),b=m.newItem('Shared sauce','prep'),c=m.newItem('Unused paste','prep'),d=m.newItem('Garlic','bought'),e=m.newItem('Fortnight prep','prep'),f=m.newItem('Supplied tofu','prep');
 n.items=[a,b,c,d,e,f];for(const i of n.items){i.prepProfile={...m.emptyProfile(),workflow:'ahead',batch:{...m.emptyBatch(),output:{amount:2,unit:'kg',unitOther:'',unknown:false},frequency:{times:2,period:'day',unknown:false},work:{minutes:30,unknown:false},schedule:'planned'}};}
 b.prepProfile.batch.note='Prepared for Vinohrady and MANIFESTO together';d.prepProfile.issues=['repeat','runout'];e.prepProfile.batch.frequency={times:1,period:'week',unknown:false};e.prepProfile.batch.note='we prep this once in 2 weeks, together braising with another product.';f.prepProfile.workflow='supplied';
 const frozen=m.newStorageSetup(),chilled=m.newStorageSetup(),other=m.newStorageSetup();frozen.mode='frozen';chilled.mode='chilled';other.mode='other';a.prepProfile.storage=[frozen];b.prepProfile.storage=[frozen];d.prepProfile.storage=[frozen,chilled];e.prepProfile.storage=[other];
 n.recipes[0].active=true;n.recipes[0].inputs=[a,b,d,e,f].map(i=>({itemId:i.id,amount:null,note:''}));n.recipes.push({...n.recipes[0],id:'extra-variant',variant:'Another variant'});
 const before=JSON.stringify(n),rows=m.kitchenInsights(n),row=id=>rows.find(r=>r.item.id===id);
 assert.equal(rows.length,5);assert.equal(row(a.id).dishes.length,1,'active variants count once');assert.equal(rows.some(r=>r.item.id===c.id),false,'unused preparations excluded');
 assert.equal(m.workMinutes(row(a.id),'day'),60);assert.equal(m.workMinutes(row(a.id),'week'),null,'no invented operating days');assert.equal(m.workMinutes(row(a.id),'batch'),30);
 assert.equal(row(b.id).scopeReview,true);for(const period of ['batch','day','week','service'])assert.equal(m.workMinutes(row(b.id),period),null);assert.match(m.outputText(row(b.id)),/not separated/);assert.equal(row(b.id).cadence,'scope');
 assert.equal(row(e.id).frequencyConflict,true);assert.equal(m.workMinutes(row(e.id),'week'),null);assert.equal(row(e.id).cadence,'unknown');assert.equal(m.workMinutes(row(f.id),'batch'),null,'supplied item cannot leak a stale batch estimate');
 assert.deepEqual(m.reportedServiceIssues(row(d.id)),['runout']);assert.equal(m.matchesInsight(row(d.id),'gar','bought'),true);assert.equal(m.matchesInsight(row(d.id),'gar','prep'),false);
 const frozenIds=rows.filter(x=>[a.id,b.id,d.id].includes(x.item.id)).map(x=>x.item.id),scopedFrozenIds=rows.filter(x=>!x.scopeReview&&[a.id,d.id].includes(x.item.id)).map(x=>x.item.id);assert.deepEqual(m.storageRows(rows,'frozen').map(x=>x.item.id),frozenIds,'one item appears once in a matching storage group, in stable direct-use order');assert.deepEqual(m.storageRows(rows.filter(x=>!x.scopeReview),'frozen').map(x=>x.item.id),scopedFrozenIds,'the summary can exclude held scope-review items from its storage calculation');assert.equal(m.storageRows(rows,'unknown').some(x=>x.item.id===e.id),true,'other and missing storage remain visible in the unknown group');assert.deepEqual(m.repeatedWorkRows(rows).map(x=>x.item.id),[d.id],'repeated work is not mixed with schedule status');
 a.prepProfile.batch.work.unknown=true;assert.equal(m.workMinutes(row(a.id),'day'),null);a.prepProfile.batch.work.unknown=false;
 const s=m.newStorageSetup();s.mode='frozen';s.temperature=-4;s.states=['thawed'];s.source='experience';assert.ok(m.storageChecks(s).length>=2);s.quality={value:5,unit:'days',unknown:false,start:'opened',startOther:''};assert.match(m.timeText(s.quality),/5 days.*pack opened/);s.quality.unknown=true;assert.equal(m.timeText(s.quality),'Not known');
 assert.equal(JSON.stringify(n),before,'projection and calculations never mutate source data');
 if(process.env.LABULA_INSIGHTS_SNAPSHOT){const raw=JSON.parse(await readFile(process.env.LABULA_INSIGHTS_SNAPSHOT,'utf8')),real=m.validateNotebook(raw.notebook),saved=JSON.stringify(real),r=m.kitchenInsights(real);assert.equal(r.filter(x=>x.item.kind==='prep').length,40);assert.equal(r.filter(x=>x.scopeReview).length,4);const cubes=r.find(x=>x.item.name==='beef shank cubes');assert.equal(m.workMinutes(cubes,'day'),120);assert.equal(JSON.stringify(real),saved);console.log('PASS private snapshot: 40 active house-made items, 4 scope-review items, daily cubes 120 person-min; no mutation.');}
 console.log('PASS insight calculations: active direct use, distinct dishes, unknowns, no period conversion, scope exclusions, frequency conflict, storage clock and source preservation.');
}finally{await rm(dir,{recursive:true,force:true});}
