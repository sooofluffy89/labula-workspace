import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-coverage-'));
try{
 const outfile=path.join(dir,'model.mjs');
 await build({stdin:{contents:"export * from './lib/prep-completion';export * from './lib/prep-profile';export * from './lib/prep-draft';export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const m=await import(outfile),complete=p=>m.profileCompletion(m.cleanProfile(p)).complete;
 const unknown=()=>({...m.emptyProfile(),workflow:'unknown',problems:'unknown',storage:[{...m.newStorageSetup(),states:['unknown'],pack:'unknown',mode:'unknown',quality:{...m.emptyTime(),unknown:true},source:'unknown'}]});
 assert.equal(complete(m.emptyProfile()),false);assert.equal(complete(unknown()),true);
 for(const workflow of ['supplied','ahead','hybrid','order','unknown']){
  const p={...unknown(),workflow};assert.equal(complete(p),!['ahead','hybrid','order'].includes(workflow));
  p.effort='unknown';p.frequency='unknown';assert.equal(complete(p),true);
 }
 let p=unknown();p.problems='yes';assert.equal(complete(p),false);p.issues=['runout'];assert.equal(complete(p),true);p.workflow='supplied';p.issues=['repeat'];assert.equal(complete(p),false);
 for(const field of ['pack','mode','source']){p=unknown();p.storage[0][field]=null;assert.equal(complete(p),false,field);}
 p=unknown();p.storage[0].states=[];assert.equal(complete(p),false);
 p=unknown();p.storage[0].states=['other'];assert.equal(complete(p),false);p.storage[0].stateOther='Special form';assert.equal(complete(p),true);
 p=unknown();p.storage[0].mode='other';assert.equal(complete(p),false);p.storage[0].container='A described setup';assert.equal(complete(p),true);
 p=unknown();p.storage[0].mode='immediate';p.storage[0].source=null;p.storage[0].quality=m.emptyTime();assert.equal(complete(p),true);
 p=unknown();p.storage[0].quality={...m.emptyTime(),value:2,unit:'days'};assert.equal(complete(p),false);p.storage[0].quality.start='unknown';assert.equal(complete(p),true);p.storage[0].quality.start='other';assert.equal(complete(p),false);p.storage[0].quality.startOther='End of cooling';assert.equal(complete(p),true);
 for(const source of ['manufacturer','procedure']){
  p=unknown();Object.assign(p.storage[0],{source,reference:'TEST reference',ruleText:'TEST wording',ruleKind:'duration',rule:{...m.emptyTime(),value:18,unit:'hours',start:'thawed'}});assert.equal(complete(p),true);
  for(const field of ['reference','ruleText','ruleKind']){const broken=structuredClone(p);broken.storage[0][field]=field==='ruleKind'?null:'';assert.equal(complete(broken),false,field);}
  p.storage[0].rule.start=null;assert.equal(complete(p),false);p.storage[0].rule.unknown=true;assert.equal(complete(p),true);
  for(const kind of ['packdate','text','unknown']){p.storage[0].ruleKind=kind;p.storage[0].rule=m.emptyTime();assert.equal(complete(p),true,kind);}
 }
 p=unknown();p.storage.push(m.newStorageSetup());assert.equal(m.cleanProfile(p).storage.length,2,'blank explicitly added setup is preserved');assert.equal(complete(p),false);assert.ok(m.profileCompletion(p).missing.every(q=>q.setupNumber===2));assert.match(m.missingAnswerText(m.profileCompletion(p).missing),/Storage setup 2/);p.storage.pop();assert.equal(complete(p),true);
 const n=m.initialNotebook();n.items=['A','B','C'].map(m.newItem);const [a,b,c]=n.items;
 n.recipes.forEach(r=>r.active=false);n.recipes[0].active=true;n.recipes[0].inputs=[a,b,c].map(i=>({itemId:i.id,amount:null,note:''}));n.recipes[1].active=true;n.recipes[1].inputs=[{itemId:b.id,amount:null,note:''}];
 assert.equal(m.preparationProgress(n).total,3);assert.equal(m.preparationProgress(n).remaining[0].item.id,b.id);
 n.recipes.push({...structuredClone(n.recipes[0]),id:'extra-variant'});assert.equal(m.preparationProgress(n).total,3);assert.equal(m.preparationProgress(n).items.find(i=>i.item.id===a.id).count,1,'union per dish');
 a.prepProfile=m.cleanProfile(unknown());assert.equal(m.preparationProgress(n).filled,1);a.name='renamed';assert.equal(m.preparationProgress(n).filled,1);
 const d=m.initialPreparationSession(n,null,'chef@test',{remaining:true});assert.equal(d.queue.includes(a.id),false);d.drafts[c.id]={...m.makePrepEntry(c.prepProfile),value:unknown(),step:'storage'};d.cursor=d.queue.indexOf(c.id);
 let resumed=m.initialPreparationSession(n,d,'chef@test',{remaining:true});assert.equal(resumed.queue[resumed.cursor],c.id);assert.equal(m.preparationProgress(n).filled,1,'local complete draft does not affect shared count');
 resumed=m.initialPreparationSession(n,d,'chef@test',{remaining:true,startItemId:b.id});assert.equal(resumed.queue[resumed.cursor],b.id,'explicit selection wins');
 n.recipes.forEach(r=>r.active=false);assert.equal(m.preparationProgress(n).total,0);assert.equal(m.resumePreparation(n,d),null);
 d.pending={id:crypto.randomUUID(),revision:1,command:{itemId:c.id,base:c.prepProfile,next:m.cleanProfile(unknown())}};n.items=n.items.filter(i=>i.id!==c.id);resumed=m.initialPreparationSession(n,d,'chef@test',{remaining:true});assert.equal(resumed.pending.id,d.pending.id);assert.equal(resumed.queue[resumed.cursor],c.id,'removed item pending request remains reachable');
 n.items.push(c);n.recipes[0].active=true;assert.equal(m.preparationProgress(n).filled,1,'reactivation retains profiles');
 const queue=m.initialPreparationSession(n,null,'chef@test',{remaining:true});const first=queue.queue[0];n.items.find(i=>i.id===first).prepProfile=m.cleanProfile(unknown());const next=m.nextPreparationCursor(n,queue,true);assert.equal(next,1);queue.cursor=next;assert.equal(m.nextPreparationCursor(n,queue,true),null,'does not loop');
 assert.throws(()=>m.readPrepDraft(JSON.stringify(d),'other@test'),/another account/);
 console.log('PASS preparation coverage: applicable branches, explicit unknowns, source evidence, independent time starts, Other, multiple/blank setups, active dish union, saved-only counts, rename/reactivation, stable remaining queue, explicit selection, account drafts and orphan pending recovery.');
}finally{await rm(dir,{recursive:true,force:true});}
