import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(tmpdir()+'/labula-morning-');
try{
 const db=new DatabaseSync(':memory:');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
 let failConfirmation=false;
 const stmt=(sql,args=[])=>({bind(...a){return stmt(sql,a)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){if(failConfirmation&&sql.startsWith('INSERT INTO morning_tasks')){failConfirmation=false;throw Error('simulated transactional failure')}const s=db.prepare(sql);return s.columns().length?{results:s.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(s.run(...args).changes)}}}});
 globalThis.eveningDb={prepare:stmt,async batch(ss){db.exec('BEGIN');let r;try{r=ss.map(s=>s.exec());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return r}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.eveningDb;');await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.eveningUser;');
 await build({stdin:{contents:`export * as api from './app/api/evening/route';export * as cat from './app/api/catalog/route';export * from './lib/notebook';export * from './lib/evening';export * from './lib/evening-client';export {MorningList} from './app/morning-list';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',logLevel:'silent'});
 const m=await import(dir+'/test.mjs'),chef={userId:'chef',email:'chef@test'},owner={userId:'owner',email:'jan@bananasport.cz'};globalThis.eveningUser=chef;
 const read=async(day='2026-09-23',morning=false)=>{const r=await m.api.GET(new Request('http://test.local/api/evening?'+(morning?'morningDay':'day')+'='+day));assert.equal(r.status,200);return r.json()};
 const cmd=c=>({id:crypto.randomUUID(),scope:'kitchen',actorId:globalThis.eveningUser?.userId,...c});
 const post=(c,origin='http://test.local')=>m.api.POST(new Request('http://test.local/api/evening',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(c)}));
 const send=async(c,status=200)=>{const r=await post(c),b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b};
 await read();const n=m.initialNotebook();n.items=Array.from({length:24},(_,i)=>m.newItem('QA '+String(i).padStart(2,'0')+(i===0?' long preparation':' item'),i%2?'bought':'prep'));
 db.prepare("UPDATE notebooks SET payload=?,revision=1 WHERE id='kitchen'").run(JSON.stringify(n));await read();db.prepare('UPDATE stock_items SET track=1,revision=revision+1 WHERE included=1').run();
 const notebookBefore=db.prepare('SELECT * FROM notebooks').get(),stockBefore=db.prepare('SELECT * FROM stock_items ORDER BY item_id').all();
 const day='2026-09-23';await send(cmd({kind:'start',day,targetDay:'2026-09-24'}));let snap=await read();
 for(const [i,row] of snap.check.answers.entries())await send(cmd({kind:'answer',checkId:day,itemId:row.itemId,revision:0,generation:0,value:'missing',deviceId:crypto.randomUUID(),sequence:i+1}));
 const confirm=s=>cmd({kind:'confirm',checkId:day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision});await send(confirm(await read()));
 const records=new Map();let failStorage=false,failNewResolution=false;
 const storage={get length(){return records.size},key:i=>[...records.keys()][i]??null,getItem:k=>records.get(k)??null,setItem(k,v){if(failStorage||failNewResolution&&!k.includes('resolution:')&&[...records.keys()].some(x=>x.includes('resolution:')))throw Error('quota');records.set(k,v)},removeItem:k=>records.delete(k)};
 let fault='',release=null,writes=0;const sent=[];
 const adapter=async(url,init={})=>{
  if(init.method==='POST'){
   writes++;const operation=JSON.parse(init.body);sent.push(operation);
   if(fault==='before'){fault='';throw Error('offline before commit')}
   const res=await post(operation);
   if(fault==='after'){fault='';throw Error('lost reply after commit')}
   if(fault==='slow'){fault='';await new Promise(r=>release=r)}
   return {res,body:await res.json()};
  }
  if(fault==='get'){fault='';throw Error('offline while refreshing')}
  const res=await m.api.GET(new Request('http://test.local'+url));return {res,body:await res.json()};
 };
 const waitRelease=async()=>{for(let i=0;!release&&i<100;i++)await new Promise(r=>setImmediate(r));assert.ok(release)};
 const makeClient=()=>new m.EveningController(chef.email,storage,{morningDay:'2026-09-24'},adapter);
 let client=makeClient();await client.refresh();const ids=client.state.snapshot.check.tasks.map(t=>t.itemId);const positions=client.visibleCheck().tasks.map(t=>t.itemId);
 // Multiple pending rows, rapid same-row transitions and captured revisions.
 fault='slow';assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[0]));for(const id of ids.slice(1))assert.ok(client.ready(id,true));
 assert.equal(client.state.pending.length,26);assert.equal(m.morningProgress(client.state).ready,24);assert.equal(m.morningProgress(client.state).complete,false);
 assert.deepEqual(client.visibleCheck().tasks.map(t=>t.itemId),positions);assert.deepEqual(client.state.pending.slice(0,3).map(p=>p.command.revision),[0,1,2]);
 assert.equal(await client.action(cmd({kind:'correct',checkId:day,revision:0,planRevision:0})),false);
 await waitRelease();release();assert.ok(await client.flush());assert.equal(m.morningProgress(client.state).complete,true);assert.equal(records.size,0);
 const readyReceipt=sent[0];await send(readyReceipt);assert.equal((await read()).check.tasks[0].revision,3);
 // Exact recovery with tied wall clock; no reordering after reload.
 release=null;fault='slow';const realNow=Date.now;Date.now=()=>12345;
 try{assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[1]));}finally{Date.now=realNow}
 const queue=client.state.pending.map(p=>p.command);assert.ok(client.state.pending.every((p,i,a)=>!i||p.created>a[i-1].created));
 await waitRelease();client.dispose();release();await new Promise(r=>setImmediate(r));client=makeClient();await client.refresh();assert.deepEqual(client.state.pending.map(p=>p.command),queue);assert.ok(await client.retry());assert.equal(client.visibleCheck().tasks[0].ready,false);assert.equal(client.visibleCheck().tasks[1].ready,false);
 // Lost acknowledgement and unauthorized retries cannot create new IDs or write as another user.
 fault='after';client.ready(ids[0],true);assert.equal(await client.flush(),false);const uncertain=client.state.pending[0].command;client.dispose();client=makeClient();await client.refresh();assert.deepEqual(client.state.pending[0].command,uncertain);
 const beforeWrites=writes;globalThis.eveningUser=null;assert.equal(await client.retry(),false);assert.equal(client.state.unauthorized,true);globalThis.eveningUser=owner;assert.equal(await client.retry(),false);assert.equal(writes,beforeWrites);globalThis.eveningUser=chef;assert.ok(await client.retry());assert.deepEqual(sent.at(-1),uncertain);
 fault='before';client.ready(ids[1],true);assert.equal(await client.flush(),false);assert.ok(await client.retry());
 // No acceptance with unavailable local durability.
 failStorage=true;const w=writes;assert.equal(client.toggleReady(ids[0]),false);assert.equal(writes,w);failStorage=false;assert.ok(await client.retry());
 // Same task conflict and explicit comparison. Refresh changing the comparison needs another click.
 let s=await read(),task=s.check.tasks[0];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:false}));
 assert.ok(client.toggleReady(ids[0]));assert.ok(client.toggleReady(ids[1]));assert.equal(await client.flush(),false);assert.ok(client.state.pending[0].rejected);
 assert.equal(client.state.snapshot.check.tasks[0].ready,false,'409 comparison auto-loads fresh shared row');assert.ok(client.state.conflictReview);
 s=await read();task=s.check.tasks[0];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:true}));
 assert.equal(await client.resolveRejected(true),false);assert.match(client.state.error,/Shared result changed again/);assert.equal(client.state.snapshot.check.tasks[0].ready,true);
 assert.equal(await client.resolveRejected(true),true);assert.equal(client.visibleCheck().tasks[1].ready,false);
 // Two clients editing unrelated rows coexist; same-row edits are never rebased automatically.
 const other=new m.EveningController(chef.email,{...storage,get length(){return 0},key:()=>null,setItem(){},removeItem(){}},{morningDay:'2026-09-24'},adapter);await other.refresh();assert.ok(other.toggleReady(ids[2]));assert.ok(await other.flush());assert.ok(client.toggleReady(ids[3]));assert.ok(await client.flush());assert.equal(client.visibleCheck().tasks[2].ready,false);other.dispose();
 // Correction publish guards concurrent Ready and preserves unchanged Ready tasks.
 s=await read();await send(cmd({kind:'correct',checkId:day,revision:s.check.revision,planRevision:s.check.planRevision}));s=await read();const staleConfirm=confirm(s);client.toggleReady(ids[4]);await client.flush();await send(staleConfirm,409);s=await read();await send(confirm(s));const preserved=(await read()).check.tasks[4];assert.equal(preserved.ready,false);
 // Cancellation during pending Ready cannot revive an obsolete task.
 await client.refresh();s=await read();await send(cmd({kind:'correct',checkId:day,revision:s.check.revision,planRevision:s.check.planRevision}));s=await read();const a=s.check.answers.find(a=>a.itemId===ids[5]);await send(cmd({kind:'answer',checkId:day,itemId:a.itemId,revision:a.revision,generation:s.check.version,value:'have',deviceId:crypto.randomUUID(),sequence:1}));await send(confirm(await read()));client.toggleReady(ids[5]);assert.equal(await client.flush(),false);await client.refresh();assert.equal(await client.resolveRejected(true),false);assert.match(client.state.error,/no longer available/);assert.ok(await client.resolveRejected(false));assert.ok(client.state.snapshot.check.tasks[5].cancelled);
 // Catalog removal blocks Ready and completion, with the unchanged task still visible.
 const changed=structuredClone(n);changed.items=changed.items.filter(i=>i.id!==ids[6]);db.prepare('UPDATE notebooks SET payload=?,revision=revision+1').run(JSON.stringify(changed));await client.refresh();assert.equal(client.toggleReady(ids[6]),false);assert.equal(client.visibleCheck().tasks[6].mappingValid,false);assert.equal(m.morningProgress(client.state).complete,false);
 db.prepare('UPDATE notebooks SET payload=?,revision=?').run(notebookBefore.payload,notebookBefore.revision);await client.refresh();
 // Storage interruption in explicit conflict resolution is journaled, restored, and sent once.
 s=await read();task=s.check.tasks[7];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:!task.ready}));client.toggleReady(ids[7]);await client.flush();await client.refresh();failNewResolution=true;
 assert.equal(await client.resolveRejected(true),false);assert.equal(client.state.recoveryBlocked,true);assert.ok([...records.keys()].some(k=>k.includes('resolution:')));const journal=JSON.parse([...records].find(([k])=>k.includes('resolution:'))[1]);
 client.dispose();failNewResolution=false;client=makeClient();await client.refresh();assert.deepEqual(client.state.pending.map(p=>p.command),journal.next.map(p=>p.command));assert.ok(await client.retry());assert.equal(records.size,0);
 // Existing v32 single Ready recovery keeps its exact schema and command ID.
 fault='after';client.toggleReady(ids[8]);await client.flush();const legacy=client.state.pending[0];assert.equal(Object.keys(legacy).sort().join(','),'account,accountId,command,created,rejected,sent');client.dispose();client=makeClient();await client.refresh();assert.ok(await client.retry());assert.deepEqual(sent.at(-1),legacy.command);
 // Render the actual React component, using authoritative details, optimistic counts and errors.
 const render=state=>m.renderToStaticMarkup(m.createElement(m.MorningList,{state,day:'2026-09-24',onReady(){},onContinue(){},onCorrect(){},correctDisabled:false}));
 let html=render(client.state);assert.equal((html.match(/role="checkbox"/g)||[]).length,23);assert.ok(html.includes('Check details &amp; activity'));assert.ok(html.includes('Bought ingredients · Restock'));assert.ok(!html.includes('Finish morning'));assert.ok(!html.includes('Mark ready'));
 const failure={...client.state,error:'offline'};assert.equal(m.morningProgress(failure).complete,false);assert.ok(!render(failure).includes('All morning items ready'));
 const absent={...client.state,snapshot:{...client.state.snapshot,check:null}};assert.ok(render(absent).includes('No confirmed evening check'));assert.ok(!render({...absent,error:'offline'}).includes('No confirmed evening check'));
 const empty={...client.state,snapshot:{...client.state.snapshot,check:{...client.state.snapshot.check,tasks:[]}}};assert.ok(render(empty).includes('No tasks planned'));assert.ok(!render(empty).includes('All morning items ready'));
 const draft={...client.state,snapshot:{...client.state.snapshot,check:{...client.state.snapshot.check,version:0}}};assert.ok(!render(draft).includes('role="checkbox"'));
 // Active morning reads update another cook's Ready state without touching local recovery.
 const viewer=new m.EveningController(chef.email,{length:0,key:()=>null,getItem:()=>null,setItem(){},removeItem(){}},{morningDay:'2026-09-24'},adapter);
 await viewer.refresh();s=await read();task=s.check.tasks[9];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:!task.ready}));
 assert.equal(viewer.state.snapshot.check.tasks[9].ready,task.ready);assert.ok(await viewer.refreshVisible());assert.equal(viewer.state.snapshot.check.tasks[9].ready,!task.ready);
 fault='get';assert.equal(await viewer.refreshVisible(),false);assert.match(viewer.state.freshnessError,/offline/);assert.equal(m.morningProgress(viewer.state).complete,false);
 assert.ok(await viewer.refreshVisible());assert.equal(viewer.state.freshnessError,'');
 release=null;fault='slow';assert.ok(viewer.toggleReady(ids[10]));await waitRelease();const local=viewer.state.pending[0].command;assert.equal(await viewer.refreshVisible(),false);assert.deepEqual(viewer.state.pending[0].command,local);release();assert.ok(await viewer.flush());
 assert.equal(m.morningProgress({...viewer.state,lastVerifiedAt:Date.now()-90000}).complete,false);viewer.dispose();
 const zeroTrack={...absent,snapshot:{...absent.snapshot,trackedCount:0}};assert.ok(render(zeroTrack).includes('No items selected for checking'));
 assert.deepEqual(db.prepare('SELECT * FROM notebooks').get(),notebookBefore);assert.deepEqual(db.prepare('SELECT * FROM stock_items ORDER BY item_id').all(),stockBefore);assert.equal(db.prepare('SELECT count(*) n FROM data_review_commands').get().n,0);
 client.dispose();db.close();console.log('PASS Morning A: 24-row queue, rapid Undo, durable order, exact replay, auth, conflicts, recovery journal, correction concurrency, mappings, actual UI and unchanged notebook/stock');
}finally{delete globalThis.eveningDb;delete globalThis.eveningUser;await rm(dir,{recursive:true,force:true})}
