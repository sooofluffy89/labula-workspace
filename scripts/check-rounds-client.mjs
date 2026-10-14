import assert from 'node:assert/strict';import {build} from 'esbuild';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/round-client-');
try{
 await build({entryPoints:['lib/check-rounds-client.ts'],bundle:true,platform:'node',format:'esm',outfile:dir+'/client.mjs',logLevel:'silent'});const {RoundClient}=await import(dir+'/client.mjs');
 const map=new Map();let storageFails=false;const storage={get length(){return map.size},key:i=>[...map.keys()][i]??null,getItem:k=>map.get(k)??null,setItem:(k,v)=>{if(storageFails)throw Error('Storage full');map.set(k,v)},removeItem:k=>{if(storageFails)throw Error('Storage full');map.delete(k)}};
 let actor='owner',revision=1,mode='ok',posts=[],pendingResolve,commits=new Set();
 const snapshot=()=>({account:'owner@test',accountId:actor,revision,activatedAt:'2026-09-26T10:00:00Z',rounds:[],items:[]});
 const reply=(body,status=200)=>({res:new Response(JSON.stringify(body),{status}),body});
 const request=async(url,init)=>{if(!init?.method)return reply(snapshot());const c=JSON.parse(init.body);posts.push(c);if(mode==='401')return reply({error:'Sign in again'},401);if(mode==='hold')return new Promise(r=>{pendingResolve=()=>r(reply({operationId:c.id}))});if(mode==='409')return reply({error:'Review changed schedule',code:'round_conflict'},409);if(!commits.has(c.id)){commits.add(c.id);revision++;}if(mode==='lost')throw Error('Synthetic lost reply');return reply({operationId:c.id});};
 const command=()=>({id:crypto.randomUUID(),actorId:'owner',revision,kind:'members',roundId:'weekly',itemIds:['a','b']});
 let c=new RoundClient('owner@test',storage,request);await c.refresh();mode='lost';const original=command();assert.equal(await c.submit(original),false);assert.deepEqual(c.state.pending.command,original);assert.equal(map.size,1);c.dispose();
 c=new RoundClient('owner@test',storage,request);await c.refresh();assert.equal(c.state.pending.command.id,original.id);mode='ok';assert.equal(await c.retry(),true);assert.equal(commits.size,1);assert.equal(map.size,0);assert.deepEqual(posts[0],posts[1]);
 mode='401';assert.equal(await c.submit(command()),false);assert.ok(c.state.pending);const before=posts.length;actor='other';assert.equal(await c.retry(),false);assert.equal(posts.length,before);actor='owner';mode='ok';assert.equal(await c.retry(),true);
 mode='409';await c.submit(command());assert.ok(c.state.pending.rejected);const rejectedPosts=posts.length;assert.equal(await c.retry(),false);assert.equal(posts.length,rejectedPosts);await c.refresh();c.discardRejected();assert.equal(c.state.pending,null);
 storageFails=true;mode='ok';const n=posts.length;assert.equal(await c.submit(command()),false);assert.equal(posts.length,n);storageFails=false;
 mode='hold';const held=command(),work=c.submit(held);await new Promise(r=>setImmediate(r));assert.equal(await c.submit(command()),false);assert.equal(await c.retry(),false);c.dispose();pendingResolve();await work;assert.equal(map.size,0,'confirmed committed request can be cleared after unmount');
 console.log('PASS rounds controller: original-request durable retry, reload, committed lost reply, 401, account switch, conflict requires review, local storage rejection before send, double click and unmount.');
}finally{await rm(dir,{recursive:true,force:true});}
