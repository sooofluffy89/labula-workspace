// Run from the Labula project: node scripts/check-catalog-performance.mjs
// --reference also runs the intentionally slow, original 300-item algorithm.
// --worker additionally measures Node worker-thread/event-loop responsiveness.
// --project /path/to/project and --output /path/to/results.json are optional.
// All generated bundles are temporary. No application/database files are modified.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {pathToFileURL} from 'node:url';
import {Worker} from 'node:worker_threads';

const args=process.argv.slice(2);
const option=name=>{const index=args.indexOf(name);return index<0?undefined:args[index+1];};
const project=path.resolve(option('--project')??process.env.LABULA_PROJECT??process.cwd());
const require=createRequire(path.join(project,'package.json'));
const {build}=require('esbuild');
// Set after one verified original 300-item run. Covers exact scores and stable tie order.
const EXPECTED_300='042f70a3187ef58031252bd9479a980004e539205017db0438530d8d6ac0fc4a';

function legacyNormalize(value){return value.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');}
function legacyDistance(a,b){
 let row=Array.from({length:b.length+1},(_,i)=>i);
 for(let i=1;i<=a.length;i++){
  const next=[i];
  for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));
  row=next;
 }
 return row[b.length];
}
function legacySimilarity(a,b){
 a=legacyNormalize(a);b=legacyNormalize(b);
 if(a===b)return 1;if(!a||!b)return 0;
 const score=1-legacyDistance(a,b)/Math.max(a.length,b.length);
 const at=a.split(/\s+/),bt=b.split(/\s+/);
 const overlap=at.filter(token=>bt.includes(token)).length/Math.max(at.length,bt.length);
 return Math.max(score,overlap*.9);
}
const pairKey=(a,b)=>JSON.stringify([a,b].sort());
function referenceDuplicatePairs(notebook){
 const found=[];
 for(let i=0;i<notebook.items.length;i++)for(let j=i+1;j<notebook.items.length;j++){
  const a=notebook.items[i],b=notebook.items[j];
  if(a.kind!==b.kind||notebook.distinctPairs.some(pair=>pairKey(...pair)===pairKey(a.id,b.id)))continue;
  const score=Math.max(...[a.name,...a.aliases].flatMap(x=>[b.name,...b.aliases].map(y=>legacySimilarity(x,y))));
  if(score>=.7)found.push({a:a.id,b:b.id,score});
 }
 return found.sort((a,b)=>b.score-a.score);
}
const compact=pairs=>pairs.map(({a,b,score})=>({a:typeof a==='string'?a:a.id,b:typeof b==='string'?b:b.id,score}));
const digest=pairs=>createHash('sha256').update(JSON.stringify(pairs)).digest('hex');
function fixture(model,count){
 const notebook=model.initialNotebook();
 notebook.items=Array.from({length:count},(_,i)=>{
  const item=model.newItem('Fresh green vegetable ingredient '+i);
  item.id='00000000-0000-4000-8000-'+String(i).padStart(12,'0');
  item.aliases=Array.from({length:5},(_,j)=>item.name+' type '+j);
  return item;
 });
 const validated=model.validateNotebook(notebook);
 assert.ok(Buffer.byteLength(JSON.stringify(validated),'utf8')<750000,'fixture must fit notebook capacity');
 return validated;
}
async function nodeWorkerCheck(bundleUrl,notebook,expected){
 const workerSource=`import {parentPort,workerData} from 'node:worker_threads';const model=await import(workerData.bundle);const started=performance.now();const pairs=model.duplicatePairs(workerData.notebook).map(({a,b,score})=>({a:a.id,b:b.id,score}));parentPort.postMessage({pairs,workerMs:performance.now()-started});`;
 const file=new URL('worker.mjs',bundleUrl);
 await writeFile(file,workerSource);
 let ticks=0,maxGapMs=0,last=performance.now();
 const started=last;
 const timer=setInterval(()=>{const now=performance.now();maxGapMs=Math.max(maxGapMs,now-last);last=now;ticks++;},10);
 const worker=new Worker(file,{workerData:{bundle:bundleUrl.href,notebook}});
 try{
  const result=await new Promise((resolve,reject)=>{
   worker.once('message',resolve);worker.once('error',reject);
   worker.once('exit',code=>{if(code!==0)reject(Error('Worker exited '+code));});
  });
  assert.deepEqual(result.pairs,expected);
  return {workerComputeMs:Math.round(result.workerMs),elapsedMs:Math.round(performance.now()-started),timerTicks:ticks,maxTimerGapMs:Math.round(maxGapMs),scope:'Node worker thread only; not browser, DOM or the production worker asset'};
 }finally{clearInterval(timer);await worker.terminate();}
}

const dir=await mkdtemp(path.join(tmpdir(),'labula-catalog-perf-'));
try{
 const outfile=path.join(dir,'catalog.mjs');
 await build({stdin:{contents:'export {duplicatePairs} from "./lib/catalog";export {initialNotebook,newItem,validateNotebook} from "./lib/notebook";',resolveDir:project},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent'});
 const bundleUrl=pathToFileURL(outfile),model=await import(bundleUrl);
 const results={project,node:process.version,runAt:new Date().toISOString(),measurements:[]};
 let notebook300,optimized300;
 for(const size of [100,300]){
  const notebook=fixture(model,size);
  let started=performance.now();
  const optimized=compact(model.duplicatePairs(notebook));
  const optimizedMs=performance.now()-started;
  assert.equal(optimized.length,size*(size-1)/2);
  const signature=digest(optimized);
  const measurement={size,aliasesPerItem:5,notebookBytes:Buffer.byteLength(JSON.stringify(notebook),'utf8'),pairs:optimized.length,optimizedMs:Math.round(optimizedMs),sha256:signature};
  if(size===100||args.includes('--reference')){
   started=performance.now();const reference=referenceDuplicatePairs(notebook);const referenceMs=performance.now()-started;
   assert.deepEqual(optimized,reference,'pair IDs, scores and stable ordering must match the original implementation');
   Object.assign(measurement,{referenceMs:Math.round(referenceMs),speedup:Number((referenceMs/optimizedMs).toFixed(2)),referenceVerified:true});
  }else Object.assign(measurement,{referenceVerified:false,referenceSkipped:'Pass --reference for the slow original 300-item implementation'});
  if(size===300){notebook300=notebook;optimized300=optimized;if(EXPECTED_300){assert.equal(signature,EXPECTED_300,'300-item result must match the stored original reference digest');measurement.storedReferenceVerified=true;}}
  results.measurements.push(measurement);console.log(JSON.stringify(measurement));
 }
 if(args.includes('--worker')){results.worker=await nodeWorkerCheck(bundleUrl,notebook300,optimized300);console.log(JSON.stringify({worker:results.worker}));}
 results.note='Single runs on this machine under current load; timing is not a cross-device guarantee. Correctness assertions compare complete results, not only top20.';
 const output=option('--output');if(output)await writeFile(path.resolve(output),JSON.stringify(results,null,2)+'\n');
 console.log('PASS: original-reference matching, exact scores and stable order; valid 100/300 fixtures; optional worker results are identical.');
}finally{await rm(dir,{recursive:true,force:true});}
