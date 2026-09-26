import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(tmpdir()+'/labula-stock-motion-');
try{
 const db=new DatabaseSync(':memory:');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
 let failConfirmation=false;
 const stmt=(sql,args=[])=>({bind(...a){return stmt(sql,a)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){if(failConfirmation&&sql.startsWith('INSERT INTO morning_tasks')){failConfirmation=false;throw Error('simulated transactional failure')}const s=db.prepare(sql);return s.columns().length?{results:s.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(s.run(...args).changes)}}}});
 globalThis.eveningDb={prepare:stmt,async batch(ss){db.exec('BEGIN');let r;try{r=ss.map(s=>s.exec());db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');throw e}return r}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.eveningDb;');await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.eveningUser;');
 await build({stdin:{contents:`export * as api from './app/api/evening/route';export * as cat from './app/api/catalog/route';export * from './lib/notebook';export * from './lib/evening';export * from './lib/evening-client';export * from './lib/stock-feedback';export * from './app/stock-motion';export {MorningList} from './app/morning-list';export {createElement} from 'react';export {renderToStaticMarkup} from 'react-dom/server';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},banner:{js:"import {createRequire} from 'node:module';const require=createRequire(import.meta.url);"},jsx:'automatic',logLevel:'silent'});
 const m=await import(dir+'/test.mjs'),chef={userId:'chef',email:'chef@test'};globalThis.eveningUser=chef;
 const read=async(day='2026-09-23',morning=false)=>{const r=await m.api.GET(new Request('http://test.local/api/evening?'+(morning?'morningDay':'day')+'='+day));assert.equal(r.status,200);return r.json()};
 const cmd=c=>({id:crypto.randomUUID(),scope:'kitchen',actorId:globalThis.eveningUser?.userId,...c});
 const post=(c,origin='http://test.local')=>m.api.POST(new Request('http://test.local/api/evening',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(c)}));
 const send=async(c,status=200)=>{const r=await post(c),b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b};
 await read();const n=m.initialNotebook();n.items=Array.from({length:3},(_,i)=>m.newItem('QA '+String(i).padStart(2,'0')+(i===0?' long preparation':' item'),i%2?'bought':'prep'));
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
 let client=makeClient();await client.refresh();const ids=client.state.snapshot.check.tasks.map(t=>t.itemId);

 const feedback=(id=ids[0])=>m.rowFeedback(client.state,'ready',id);
 assert.equal(feedback().receiptId,null);assert.equal(m.savedStatus(client.state,chef.email),'Changes saved.');
 // Real controller -> real API -> SQLite. ACK A must not bless later B/C intents.
 fault='slow';client.ready(ids[0],true);client.ready(ids[0],false);client.ready(ids[0],true);
 const seen=[];const off=client.subscribe(()=>seen.push({pending:client.state.pending.length,feedback:feedback(),settled:client.state.settledSave}));
 await waitRelease();assert.equal(feedback().pending,true);assert.equal(feedback().ackEligible,false);release();assert.ok(await client.flush());
 assert.equal(feedback().ackEligible,true);assert.equal(feedback().receiptId,sent.at(-1).id);
 assert.ok(seen.some(s=>s.pending===2&&s.feedback.receiptId===sent[0].id&&!s.feedback.ackEligible));
 assert.ok(seen.some(s=>s.pending===1&&s.feedback.receiptId===sent[1].id&&!s.feedback.ackEligible));off();
 const stable=client.state.acknowledged,settled=client.state.settledSave,w=writes;client.ready(ids[0],true);await client.flush();assert.equal(writes,w);assert.equal(client.state.acknowledged,stable);assert.equal(client.state.settledSave,settled);
 await client.refreshVisible();assert.equal(client.state.acknowledged,stable,'poll does not mint receipts');
 fault='after';client.ready(ids[0],false);assert.equal(await client.flush(),false);const uncertain=client.state.pending[0].command;assert.equal(feedback().ackEligible,false);assert.equal(client.state.settledSave,null);
 globalThis.eveningUser=null;assert.equal(await client.retry(),false);assert.equal(feedback().ackEligible,false);globalThis.eveningUser=chef;assert.ok(await client.retry());assert.equal(feedback().receiptId,uncertain.id);assert.deepEqual(sent.at(-1),uncertain);
 // A conflicting choice discarded explicitly never produces an acknowledgement.
 let s=await read();let task=s.check.tasks[0];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:true}));
 client.ready(ids[0],true);assert.equal(await client.flush(),false);const beforeDiscard=client.state.acknowledged;assert.equal(feedback().ackEligible,false);assert.ok(await client.resolveRejected(false));assert.equal(client.state.acknowledged,beforeDiscard);assert.equal(client.state.settledSave,null);
 assert.equal(feedback().ackEligible,false,'old ACK differs from authoritative shared revision');
 failStorage=true;const beforeQuota=writes;assert.equal(client.ready(ids[0],false),false);assert.equal(writes,beforeQuota);assert.equal(feedback().ackEligible,false);failStorage=false;await client.retry();
 // Another actor's same value with a new revision invalidates earlier local ACK eligibility.
 client.ready(ids[0],false);await client.flush();assert.equal(feedback().ackEligible,true);s=await read();task=s.check.tasks[0];await send(cmd({kind:'ready',checkId:day,itemId:task.itemId,revision:task.revision,value:true}));await client.refreshVisible();assert.equal(feedback().ackEligible,false);
 const render=(component,props)=>m.renderToStaticMarkup(m.createElement(component,props));
 assert.equal(render(m.StockProgress,{value:0,total:0,label:'Ready'}),'');
 const progress=render(m.StockProgress,{value:2,total:3,label:'Ready'});assert.match(progress,/aria-valuenow="2"/);assert.match(progress,/aria-valuemax="3"/);assert.match(progress,/choices, not saved requests/);
 // Final Ready is never complete while waiting or in a failed/freshness state.
 for(const id of ids.slice(1))client.ready(id,true);await client.flush();assert.equal(m.morningProgress(client.state).complete,true);
 for(const patch of [{saving:true},{loading:true},{unauthorized:true},{recoveryBlocked:true},{error:'offline'},{freshnessError:'offline'},{lastVerifiedAt:Date.now()-80000}]){assert.equal(m.morningProgress({...client.state,...patch}).complete,false);assert.notEqual(m.savedStatus({...client.state,...patch},chef.email),'Changes saved.');}
 assert.notEqual(m.savedStatus(client.state,'another@test'),'Changes saved.');
 // A new controller, new day, or another account cannot replay a historical receipt.
 client.dispose();client=makeClient();await client.refresh();assert.equal(feedback().receiptId,null);assert.equal(client.state.settledSave,undefined);
 release=null;fault='slow';client.toggleReady(ids[1]);await waitRelease();const queued=client.state.pending[0].command;client.dispose();release();await new Promise(r=>setImmediate(r));assert.equal(client.state.acknowledged,undefined);
 client=makeClient();await client.refresh();assert.equal(client.state.acknowledged,undefined);assert.ok(await client.retry());assert.equal(m.rowFeedback(client.state,'ready',ids[1]).receiptId,queued.id);
 // Evening uses the same receipt path and excludes a superseded/invalid value.
 await client.refresh({day});s=await read();await send(cmd({kind:'correct',checkId:day,revision:s.check.revision,planRevision:s.check.planRevision}));await client.refresh();
 client.answer(ids[0],'have');await client.flush();assert.equal(m.rowFeedback(client.state,'answer',ids[0]).ackEligible,true);
 const count=writes;client.answer(ids[0],'have');await client.flush();assert.equal(writes,count);
 const mismatched={...client.state,snapshot:{...client.state.snapshot,accountId:'other'}};assert.equal(m.rowFeedback(mismatched,'answer',ids[0]).ackEligible,false);
 assert.deepEqual(db.prepare('SELECT * FROM notebooks').get(),notebookBefore);assert.deepEqual(db.prepare('SELECT * FROM stock_items ORDER BY item_id').all(),stockBefore);
 client.dispose();db.close();console.log('PASS functional stock feedback: actual API/SQLite ACK chain, newer intents, no-op, polling, lost ACK replay, 401, 409 discard, quota, remount, disposal, progress, stale completion and account isolation');
}finally{delete globalThis.eveningDb;delete globalThis.eveningUser;await rm(dir,{recursive:true,force:true})}
