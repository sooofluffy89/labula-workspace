import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(tmpdir()+'/labula-stock-');
try {
 const db=new DatabaseSync(':memory:');
 for(const file of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 const stmt=(sql,args=[])=>({bind(...a){return stmt(sql,a);},async first(){return db.prepare(sql).get(...args)??null;},async all(){return {results:db.prepare(sql).all(...args)};},async run(){return this.exec();},exec(){const s=db.prepare(sql);if(s.columns().length)return {results:s.all(...args),meta:{changes:0}};return {results:[],meta:{changes:Number(s.run(...args).changes)}};}});
 let beforeBatch=null,loseCommit=false;
 globalThis.stockDb={prepare:stmt,async batch(ss){if(beforeBatch){const hook=beforeBatch;beforeBatch=null;await hook();}db.exec('BEGIN');let result;try{result=ss.map(s=>s.exec());db.exec('COMMIT');}catch(e){db.exec('ROLLBACK');throw e;}if(loseCommit){loseCommit=false;throw Error('lost reply after commit');}return result;}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.stockDb;');await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.stockUser;');
 await build({stdin:{contents:`export * as api from './app/api/stock/route';export * as cat from './app/api/catalog/route';export * as notebook from './app/api/notebook/route';export * from './lib/notebook';export * from './lib/stock';export * from './lib/stock-client';export * from './lib/request-json';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/test.mjs'),owner={userId:'owner',email:'jan@bananasport.cz'},chef={userId:'chef',email:'chef@test'};
 globalThis.stockUser=chef;
 const read=async()=>{const res=await m.api.GET();assert.equal(res.status,200);return res.json();};
 const request=(body,origin='http://test.local')=>new Request('http://test.local/api/stock',{method:'POST',headers:{'Content-Type':'application/json',Origin:origin,'If-Match':'0'},body:JSON.stringify(body)});
 const send=command=>m.api.POST(request(command));const make=changes=>({id:crypto.randomUUID(),changes});
 let s=await read();assert.equal(s.items.length,0);
 let n=m.initialNotebook();n.items=[m.newItem('Coriander'),m.newItem('Coriander duplicate'),m.newItem('Rice','prep'),m.newItem('Unused catalog')];n.items[0].aliases=['Cilántro'];n.recipes[0].inputs=[{itemId:n.items[0].id,amount:null,note:''}];
 db.prepare("UPDATE notebooks SET payload=?,revision=1 WHERE id='kitchen'").run(JSON.stringify(n));
 s=await read();const [a,b,c,d]=s.items.map(i=>i.itemId);assert.equal(s.items.length,4);assert.ok(s.items.every(i=>i.included&&!i.track&&i.revision===0));assert.deepEqual((await read()).items,s.items);
 // Categories come from saved active recipes, including nested preparation inputs.
 const categoryNotebook=structuredClone(n);
 categoryNotebook.items[2].inputs=[{itemId:a,amount:null,note:''}];
 categoryNotebook.recipes.find(r=>r.menuId==='m1').inputs=[{itemId:c,amount:null,note:''}];
 categoryNotebook.recipes.find(r=>r.menuId==='p2').inputs=[{itemId:a,amount:null,note:''}];
 const inactive=categoryNotebook.recipes.find(r=>r.menuId==='p3');inactive.active=false;inactive.inputs=[{itemId:b,amount:null,note:''}];
 const stockBeforeCategories=db.prepare('SELECT * FROM stock_items ORDER BY item_id').all();
 db.prepare("UPDATE notebooks SET payload=? WHERE id='kitchen'").run(JSON.stringify(categoryNotebook));
 const categorized=await read(),item=id=>categorized.items.find(i=>i.itemId===id);
 assert.deepEqual(item(a).categories,['Starters','Main Dishes','Specials']);
 assert.deepEqual(item(c).categories,['Main Dishes']);
 assert.deepEqual(item(b).categories,[]);assert.deepEqual(item(d).categories,[]);
 assert.deepEqual(m.stockRows(categorized.items,'','all',true,'all','Main Dishes').map(i=>i.itemId),[a,c]);
 assert.deepEqual(m.stockRows(categorized.items,'cilantro','untracked',true,'bought','Specials').map(i=>i.itemId),[a]);
 assert.equal(m.stockRows(categorized.items,'','all',true,'prep','Starters').length,0);
 assert.equal(m.stockRows(categorized.items,'','tracked',true,'all','Main Dishes').length,0);
 assert.equal(m.stockRows(categorized.items,'','all').length,4);
 categoryNotebook.recipes.find(r=>r.menuId==='m1').active=false;
 db.prepare("UPDATE notebooks SET payload=? WHERE id='kitchen'").run(JSON.stringify(categoryNotebook));
 assert.equal(m.stockRows((await read()).items,'','all',true,'all','Main Dishes').length,0);
 assert.deepEqual(db.prepare('SELECT * FROM stock_items ORDER BY item_id').all(),stockBeforeCategories);
 db.prepare("UPDATE notebooks SET payload=? WHERE id='kitchen'").run(JSON.stringify(n));
 console.log('PASS stock menu categories: active saved recipes, shared/nested inputs, inactive/unused items, composed filters, unchanged stock settings');
 const protectedBefore=db.prepare('SELECT * FROM notebooks').get();
 const change=(itemId,revision,included,track)=>({itemId,revision,included,track});
 let cmd=make([change(a,0,true,true)]);assert.equal((await send(cmd)).status,200);assert.equal((await send(cmd)).status,200);assert.equal(db.prepare('SELECT revision FROM stock_items WHERE item_id=?').get(a).revision,1);assert.deepEqual(db.prepare('SELECT * FROM notebooks').get(),protectedBefore);
 assert.equal((await send({...cmd,changes:[change(a,0,true,false)]})).status,409);globalThis.stockUser=owner;assert.equal((await send(cmd)).status,409);globalThis.stockUser=chef;
 assert.equal((await send(make([change(a,0,true,false)]))).status,409);assert.equal((await send(make([change(b,0,false,false)]))).status,200);
 cmd=make([change(a,1,false,false),change(c,0,false,false),change(d,0,false,false)]);assert.equal((await send(cmd)).status,200);s=await read();assert.equal(m.stockCounts(s.items).total,0);globalThis.stockUser=owner;assert.equal(m.stockCounts((await read()).items).total,0);globalThis.stockUser=chef;
 cmd=make(s.items.map(i=>change(i.itemId,i.revision,true,false)));assert.equal((await send(cmd)).status,200);assert.equal((await send(cmd)).status,200);s=await read();assert.equal(s.items.filter(i=>i.included).length,4);assert.ok(s.items.every(i=>!i.track));
 assert.equal((await send(make([change(a,s.items[0].revision,false,true)]))).status,400);assert.equal((await send(make([change('missing',0,true,false)]))).status,409);assert.equal((await send(make([change(a,0,true,false),change(a,0,true,false)]))).status,400);
 assert.equal((await m.api.POST(request(make([change(a,0,true,false)]),'http://evil.local'))).status,403);globalThis.stockUser=null;assert.equal((await m.api.GET()).status,401);assert.equal((await send(cmd)).status,401);globalThis.stockUser=chef;
 // Two independently loaded clients: unrelated edits preserved, same row conflicts, multi-add is atomic.
 s=await read();const find=id=>s.items.find(i=>i.itemId===id);const concurrent=await Promise.all([send(make([change(a,find(a).revision,true,true)])),send(make([change(b,find(b).revision,false,false)]))]);assert.deepEqual(concurrent.map(r=>r.status),[200,200]);
 const atomic=make([change(c,find(c).revision,false,false),change(a,find(a).revision,false,false)]);assert.equal((await send(atomic)).status,409);assert.equal((await read()).items.find(i=>i.itemId===c).included,true);
 s=await read();const same=await Promise.all([send(make([change(c,find(c).revision,true,true)])),send(make([change(c,find(c).revision,false,false)]))]);assert.deepEqual(same.map(r=>r.status).sort(),[200,409]);
 // Stable IDs survive names, aliases, menu activity, and old notebook restores; unsaved items never appear.
 const unsaved=m.newItem('Unsaved only');assert.ok(!(await read()).items.some(i=>i.itemId===unsaved.id));
 n.items[0].name='Fresh coriander';n.items[0].aliases=['Cilántro','Chinese parsley'];n.recipes[0].active=false;db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(n));s=await read();assert.equal(s.items.find(i=>i.itemId===a).track,true);assert.equal(m.stockRows(s.items,'cilantro').length,1);assert.equal(m.stockRows(s.items,'none').length,0);assert.equal(m.stockCounts(s.items).total,3);assert.equal(m.stockRows(s.items,'','all',true,'bought').length,2);assert.equal(m.stockRows(s.items,'','tracked',true,'bought').length,1);assert.equal(m.stockRows(s.items,'','untracked',true,'bought').length,1);assert.equal(m.stockRows(s.items,'','all',true,'prep').length,1);assert.equal(m.stockRows(s.items,'cilantro','all',true,'prep').length,0);assert.equal(m.stockRows(s.items,'cilantro','tracked',true,'bought').length,1);assert.equal(m.stockRows(s.items,'','all',false,'bought').length,1);
 n.items.push(unsaved);db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(n));s=await read();assert.equal(s.items.find(i=>i.itemId===unsaved.id).track,false);n.items.pop();db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(n));assert.ok(!(await read()).items.some(i=>i.itemId===unsaved.id));assert.equal((await read()).items.find(i=>i.itemId===a).track,true);
 // Actual catalog API and database triggers: merge OR semantics + reversible before state.
 globalThis.stockUser=owner;const catSend=async(op,id=crypto.randomUUID())=>{const revision=db.prepare('SELECT revision FROM notebooks').get().revision;return m.cat.POST(new Request('http://test.local/api/catalog',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify({operationId:id,operation:op})}));};
 const beforeMerge=await read(),mergeId=crypto.randomUUID();assert.equal((await catSend({kind:'merge',sourceId:a,targetId:b},mergeId)).status,200);s=await read();assert.ok(!s.items.some(i=>i.itemId===a));assert.equal(s.items.find(i=>i.itemId===b).track,true);assert.equal(s.items.find(i=>i.itemId===b).included,true);
 assert.equal((await catSend({kind:'undo',operationId:mergeId})).status,200);s=await read();for(const id of [a,b]){assert.equal(s.items.find(i=>i.itemId===id).track,beforeMerge.items.find(i=>i.itemId===id).track);assert.equal(s.items.find(i=>i.itemId===id).included,beforeMerge.items.find(i=>i.itemId===id).included);}
 const merge2=crypto.randomUUID();assert.equal((await catSend({kind:'merge',sourceId:a,targetId:b},merge2)).status,200);s=await read();assert.equal((await send(make([change(b,s.items.find(i=>i.itemId===b).revision,true,false)]))).status,200);const beforeUndo=db.prepare('SELECT * FROM notebooks').get();assert.equal((await catSend({kind:'undo',operationId:merge2})).status,409);assert.deepEqual(db.prepare('SELECT * FROM notebooks').get(),beforeUndo);
 // Older-client catalog merge races a stock write: trigger sees newest committed settings inside its transaction.
 const duplicate=m.newItem('Rice duplicate','prep');n=JSON.parse(beforeUndo.payload);n.items.push(duplicate);db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(n));s=await read();const source=s.items.find(i=>i.itemId===c);beforeBatch=async()=>{assert.equal((await send(make([change(c,source.revision,true,false)]))).status,200);};assert.equal((await catSend({kind:'merge',sourceId:c,targetId:duplicate.id})).status,200);assert.equal((await read()).items.find(i=>i.itemId===duplicate.id).track,false);
 console.log('PASS stock API: dynamic initialization, tombstones, per-row CAS, atomic multi-add, identities/origin, idempotency, old notebook restores, merge/undo and raced merge');
 // Real controller against real API, durable storage, network/response faults, account boundaries.
 const records=new Map(),storage={get length(){return records.size},key:i=>[...records.keys()][i]??null,getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
 globalThis.stockUser=chef;let fault='',delayed=null,postCount=0;
 const adapter=async(url,init={})=>{
  if(init.method==='POST'){postCount++;if(fault==='before'){fault='';throw Error('network before commit');}const res=await send(JSON.parse(init.body));if(fault==='after'){fault='';throw Error('network after commit');}if(fault==='delay'){fault='';await new Promise(resolve=>delayed=resolve);}return {res,body:await res.json()};}
  const res=await m.api.GET();return {res,body:await res.json()};
 };
 let client=new m.StockController(chef.email,storage,adapter);assert.equal(await client.refresh(),true);let row=client.state.snapshot.items.find(i=>i.itemId===b);fault='after';assert.equal(await client.change([change(b,row.revision,true,true)]),false);const original=client.state.pending.command;assert.equal(records.size,1);assert.equal(client.state.saving,false);assert.match(client.state.error,/network/);
 assert.equal(await client.change([change(d,0,true,true)]),false);client.dispose();client=new m.StockController(chef.email,storage,adapter);await client.refresh();assert.deepEqual(client.state.pending.command,original);assert.equal(await client.retry(),true);assert.equal(records.size,0);assert.equal(client.state.snapshot.items.find(i=>i.itemId===b).revision,row.revision+1);
 row=client.state.snapshot.items.find(i=>i.itemId===b);fault='before';assert.equal(await client.change([change(b,row.revision,true,false)]),false);assert.equal(await client.retry(),true);assert.equal(client.state.snapshot.items.find(i=>i.itemId===b).track,false);
 // 401 and account switch cannot send a foreign pending command; original user can safely retry.
 row=client.state.snapshot.items.find(i=>i.itemId===b);fault='before';await client.change([change(b,row.revision,true,true)]);globalThis.stockUser=null;assert.equal(await client.retry(),false);assert.equal(client.state.unauthorized,true);globalThis.stockUser=owner;const writes=postCount;assert.equal(await client.retry(),false);assert.equal(postCount,writes);const other=new m.StockController(owner.email,storage,adapter);await other.refresh();assert.equal(other.state.pending,null);other.dispose();globalThis.stockUser=chef;assert.equal(await client.retry(),true);
 // Conflict retains intent, requires fresh review, rebases only explicitly; shared option can discard rejected intent.
 row=client.state.snapshot.items.find(i=>i.itemId===b);await send(make([change(b,row.revision,false,false)]));assert.equal(await client.change([change(b,row.revision,true,false)]),false);assert.equal(client.state.pending.rejected,true);assert.equal(await client.applyReviewed(),false);await client.refresh();assert.equal(await client.applyReviewed(),true);assert.equal(client.state.snapshot.items.find(i=>i.itemId===b).included,true);
 row=client.state.snapshot.items.find(i=>i.itemId===b);await send(make([change(b,row.revision,true,true)]));await client.change([change(b,row.revision,false,false)]);assert.equal(await client.keepShared(),true);assert.equal(client.state.snapshot.items.find(i=>i.itemId===b).track,true);
 // Unmount during reply + rapid repeated clicks: no stale component update; same receipt recovers after reload.
 row=client.state.snapshot.items.find(i=>i.itemId===b);fault='delay';const running=client.change([change(b,row.revision,true,false)]);for(let i=0;!delayed&&i<50;i++)await new Promise(r=>setImmediate(r));assert.ok(delayed);assert.equal(await client.retry(),false);client.dispose();delayed();await running;assert.equal(records.size,1);client=new m.StockController(chef.email,storage,adapter);await client.refresh();assert.equal(await client.retry(),true);assert.equal(records.size,0);client.dispose();
 // Browser storage unavailable: no POST, no lost intent claimed saved.
 const broken=new m.StockController(chef.email,{...storage,setItem(){throw Error('quota')}},adapter);await broken.refresh();row=broken.state.snapshot.items.find(i=>i.itemId===b);const beforeBlocked=postCount;assert.equal(await broken.change([change(b,row.revision,true,true)]),false);assert.equal(postCount,beforeBlocked);broken.dispose();
 // Real bounded request helper includes unfinished JSON body and ignores late fetch responses.
 const nativeFetch=globalThis.fetch,nativeTimer=globalThis.setTimeout;let release;
 try{globalThis.setTimeout=(fn,ms,...args)=>nativeTimer(fn,ms===30000?5:ms,...args);globalThis.fetch=async()=>({json:()=>new Promise(r=>release=r)});await assert.rejects(m.requestJson('/body'),m.RequestTimeoutError);release({late:true});globalThis.fetch=()=>new Promise(r=>release=r);await assert.rejects(m.requestJson('/fetch'),m.RequestTimeoutError);release({json:async()=>({late:true})});}finally{globalThis.fetch=nativeFetch;globalThis.setTimeout=nativeTimer;}
 console.log('PASS stock client+API: uncertain pre/post-commit retry, reload/unmount, no duplicate clicks, 401/account isolation, explicit conflicts/rebase, durable intents, bounded body/fetch deadlines');
 db.close();
}finally{delete globalThis.stockDb;delete globalThis.stockUser;await rm(dir,{recursive:true,force:true});}
