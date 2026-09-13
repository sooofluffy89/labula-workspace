import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
const dir=await mkdtemp(path.join(tmpdir(),'labula-lease-'));
try{
 const out=path.join(dir,'lease.mjs');await build({stdin:{contents:"export * from './lib/prep-local';export * from './lib/prep-draft';export {initialNotebook,newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:out,logLevel:'silent'});
 const A=await import(out+'?A'),B=await import(out+'?B'),disk=new Map(),queues=new Map();let fail=false;
 globalThis.window=new EventTarget();globalThis.localStorage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>{if(fail)throw Error('Quota exceeded');disk.set(k,v);}};
 const locks={request(name,{signal},callback){return new Promise((resolve,reject)=>{
  const q=queues.get(name)??[];queues.set(name,q);const job={started:false,run(){job.started=true;signal.removeEventListener('abort',cancel);Promise.resolve().then(()=>callback({name})).then(resolve,reject).finally(()=>{q.shift();q[0]?.run();});}};
  const cancel=()=>{if(job.started)return;const i=q.indexOf(job);if(i>=0)q.splice(i,1);reject(new DOMException('Cancelled','AbortError'));};
  signal.addEventListener('abort',cancel,{once:true});if(signal.aborted){cancel();return;}q.push(job);if(q.length===1)job.run();
 });}};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{locks}});
 const tick=()=>new Promise(r=>setImmediate(r)),control=()=>new AbortController(),account='chef@test';
 const n=A.initialNotebook();n.items=['A','B'].map(A.newItem);n.recipes[0].inputs=n.items.map(i=>({itemId:i.id,amount:null,note:''}));
 let releaseA=await A.acquirePreparation(account,control().signal);const d=A.initialPreparationSession(n,null,account);d.drafts[n.items[0].id]={...A.makePrepEntry(n.items[0].prepProfile),value:{...n.items[0].prepProfile,note:'tab A'}};A.writeLocalPreparation(account,d);
 let entered=false;let waitB=B.acquirePreparation(account,control().signal).then(r=>{entered=true;return r;});await tick();assert.equal(entered,false);releaseA();let releaseB=await waitB;
 const b=B.readLocalPreparation(account);assert.equal(b.drafts[n.items[0].id].value.note,'tab A');b.drafts[n.items[1].id]={...A.makePrepEntry(n.items[1].prepProfile),value:{...n.items[1].prepProfile,note:'tab B'}};delete b.drafts[n.items[0].id];B.writeLocalPreparation(account,b);releaseB();
 releaseA=await A.acquirePreparation(account,control().signal);assert.equal(A.readLocalPreparation(account).drafts[n.items[0].id],undefined,'no resurrection from stale tab memory');
 fail=true;const volatile=A.readLocalPreparation(account);volatile.drafts[n.items[1].id].value.note='memory only';assert.throws(()=>A.writeLocalPreparation(account,volatile));releaseA();assert.equal(A.hasVolatilePreparation(),true);
 const cancelB=control();let cancelled=false;waitB=B.acquirePreparation(account,cancelB.signal).catch(e=>{cancelled=e.name==='AbortError';});await tick();assert.equal(cancelled,false);cancelB.abort();await waitB;assert.equal(cancelled,true);
 // StrictMode abort before the first reattachment continuation must not deadlock or release its successor.
 const abandoned=control(),p1=A.acquirePreparation(account,abandoned.signal);abandoned.abort();const p2=A.acquirePreparation(account,control().signal);const staleRelease=await p1;releaseA=await p2;staleRelease();assert.equal(A.readLocalPreparation(account).drafts[n.items[1].id].value.note,'memory only');
 fail=false;A.writeLocalPreparation(account,volatile);releaseA();releaseB=await B.acquirePreparation(account,control().signal);assert.equal(B.readLocalPreparation(account).drafts[n.items[1].id].value.note,'memory only');
 const receipt={id:crypto.randomUUID(),revision:4,command:{itemId:n.items[1].id,base:n.items[1].prepProfile,next:{...n.items[1].prepProfile,note:'pending'}}};const pending=B.readLocalPreparation(account);pending.pending=receipt;B.writeLocalPreparation(account,pending);releaseB();releaseA=await A.acquirePreparation(account,control().signal);assert.deepEqual(A.readLocalPreparation(account).pending,receipt);
 const otherRelease=await B.acquirePreparation('other@test',control().signal);assert.equal(B.readLocalPreparation('other@test'),null);otherRelease();
 assert.throws(()=>A.discardVolatilePreparation(account),'pending receipt cannot be discarded');
 const recover=A.readLocalPreparation(account);recover.pending=null;A.writeLocalPreparation(account,recover);fail=true;const ephemeral=structuredClone(recover);ephemeral.drafts[n.items[1].id].value.note='discard me';assert.throws(()=>A.writeLocalPreparation(account,ephemeral));A.discardVolatilePreparation(account);assert.equal(A.volatilePreparation(account),false);fail=false;assert.equal(A.readLocalPreparation(account).drafts[n.items[1].id].value.note,'memory only');
 releaseA();assert.throws(()=>A.writeLocalPreparation(account,d));
 console.log('PASS exclusive preparation lease: tab handoff, no stale resurrection, retained volatile memory, cancellation, StrictMode ownership, unchanged pending receipt and account isolation.');
}finally{await rm(dir,{recursive:true,force:true});}
