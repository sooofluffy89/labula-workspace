import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import seed from '../lib/ingredient-group-seed.json' with {type:'json'};
const dir=await mkdtemp(tmpdir()+'/labula-groups-');
try{
 const db=new DatabaseSync(':memory:');
 for(const file of (await readdir('drizzle')).filter(x=>x.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+file,'utf8'));
 const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){const q=db.prepare(sql);return q.columns().length?{results:q.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(q.run(...args).changes)}}}});
 globalThis.groupDb={prepare:stmt,async batch(statements){db.exec('BEGIN');try{const result=statements.map(x=>x.exec());db.exec('COMMIT');return result}catch(e){db.exec('ROLLBACK');throw e}}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.groupDb;');
 await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.groupUser;');
 await build({stdin:{contents:`export * as stock from './app/api/stock/route';export * as groups from './app/api/ingredient-groups/route';export * as evening from './app/api/evening/route';export * as catalog from './app/api/catalog/route';export * from './lib/notebook';export * from './lib/stock';export * from './lib/ingredient-groups';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/api.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/api.mjs'),owner={userId:'owner',email:'jan@bananasport.cz'},chef={userId:'chef',email:'chef@test'};globalThis.groupUser=owner;
 const s0=await m.stock.GET();assert.equal(s0.status,200);const n=m.initialNotebook();n.items=seed.assignments.map(row=>({...m.newItem(row.expectedName,row.expectedKind),id:row.itemId}));db.prepare("UPDATE notebooks SET payload=?,revision=1 WHERE id='kitchen'").run(JSON.stringify(n));
 const readStock=async()=>{const r=await m.stock.GET();assert.equal(r.status,200);return r.json()};
 let stock=await readStock();assert.equal(stock.items.length,79);assert.equal(stock.items.filter(i=>i.groupId).length,60);assert.equal(stock.items.filter(i=>!i.groupId).length,19);assert.equal(stock.items.filter(i=>i.track).length,0);assert.equal(stock.canManageGroups,true);
 const first=stock.items.find(i=>i.groupId==='vegetables'),unknown=stock.items.find(i=>!i.groupId);assert.ok(first&&unknown);
 const groupPost=c=>m.groups.POST(new Request('http://test.local/api/ingredient-groups',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(c)}));
 const change=(item,groupId)=>({id:crypto.randomUUID(),itemId:item.itemId,revision:item.groupRevision,groupId});
 const initial=change(first,'oils');let response=await groupPost(initial);assert.equal(response.status,200,await response.text());response=await groupPost(initial);assert.equal(response.status,200);assert.equal(db.prepare('SELECT count(*) n FROM ingredient_group_commands').get().n,1);
 stock=await readStock();assert.equal(stock.items.find(i=>i.itemId===first.itemId).groupId,'oils');assert.equal((await groupPost(change(first,'meat'))).status,409);
 const changed=stock.items.find(i=>i.itemId===first.itemId);assert.equal((await groupPost(change(changed,null))).status,200);stock=await readStock();assert.equal(stock.items.find(i=>i.itemId===first.itemId).groupId,null);assert.equal(stock.items.find(i=>i.itemId===first.itemId).groupSource,'owner');assert.equal((await readStock()).items.find(i=>i.itemId===first.itemId).groupId,null,'seed must not overwrite a manual null');
 // A new manual choice is independent of Track and stock revision.
 const restored=stock.items.find(i=>i.itemId===first.itemId);assert.equal((await groupPost(change(restored,'vegetables'))).status,200);stock=await readStock();assert.equal(stock.items.find(i=>i.itemId===first.itemId).revision,restored.revision);
 globalThis.groupUser=chef;assert.equal((await groupPost(change(restored,'broths'))).status,403);globalThis.groupUser=owner;
 const menuRows=stock.items.map((i,index)=>({...i,categories:index===0?['Starters','Main Dishes']:index===1?['Main Dishes']:[]}));assert.equal(m.stockRows(menuRows,'','all',true,'all',['Starters','Main Dishes']).length,2);
 db.prepare('UPDATE stock_items SET track=1,revision=revision+1 WHERE item_id IN (?,?)').run(first.itemId,unknown.itemId);
 const eveningPost=c=>m.evening.POST(new Request('http://test.local/api/evening',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(c)}));
 const ecommand=x=>({id:crypto.randomUUID(),scope:'kitchen',actorId:owner.userId,...x});
 const send=async c=>{const r=await eveningPost(c),body=await r.json();assert.equal(r.status,200,JSON.stringify(body));return body.snapshot};
 let check=(await send(ecommand({kind:'start',day:'2026-10-15',targetDay:'2026-10-16'}))).check;assert.equal(check.grouped,true);assert.equal(check.answers.length,2);assert.equal(check.answers.find(a=>a.itemId===first.itemId).groupId,'vegetables');assert.equal(check.answers.find(a=>a.itemId===unknown.itemId).groupId,null);
 stock=await readStock();const groupChanged=stock.items.find(i=>i.itemId===first.itemId);assert.equal((await groupPost(change(groupChanged,'oils'))).status,200);
 let r=await m.evening.GET(new Request('http://test.local/api/evening?day=2026-10-15'));check=(await r.json()).check;assert.equal(check.answers.find(a=>a.itemId===first.itemId).groupId,'vegetables','in-progress check is pinned');
 let seq=0;for(const answer of check.answers){const reply=await send(ecommand({kind:'answer',checkId:check.id,itemId:answer.itemId,revision:answer.revision,generation:0,value:'missing',deviceId:crypto.randomUUID(),sequence:++seq}));check=reply.check;}
 let evening=(await (await m.evening.GET(new Request('http://test.local/api/evening?day=2026-10-15'))).json());await send(ecommand({kind:'confirm',checkId:check.id,revision:check.revision,planRevision:check.planRevision,notebookRevision:evening.notebookRevision}));
 evening=await (await m.evening.GET(new Request('http://test.local/api/evening?morningDay=2026-10-16'))).json();assert.equal(evening.check.tasks.length,2);assert.equal(evening.check.tasks.find(t=>t.itemId===first.itemId).groupId,'vegetables','morning task inherits check group');
 check=(await send(ecommand({kind:'start',day:'2026-10-16',targetDay:'2026-10-17'}))).check;assert.equal(check.answers.find(a=>a.itemId===first.itemId).groupId,'oils','new check uses current group');
 db.prepare("INSERT INTO evening_checks(id,target_day,stage,revision,plan_revision,version,start_operation,created_at,created_by,updated_at) VALUES('2026-10-14','2026-10-15','draft',0,0,0,'old','now','old','now')").run();
 evening=await (await m.evening.GET(new Request('http://test.local/api/evening?day=2026-10-14'))).json();assert.equal(evening.check.grouped,false,'old checks remain flat');
 // A merge retains the target decision and the retired source metadata; undo does not erase it.
 const source=stock.items.find(i=>i.groupId==='meat'),target=stock.items.find(i=>i.groupId==='sauces');assert.ok(source&&target);
 const catalogPost=async(operation,operationId=crypto.randomUUID())=>{const revision=db.prepare("SELECT revision FROM notebooks WHERE id='kitchen'").get().revision;const res=await m.catalog.POST(new Request('http://test.local/api/catalog',{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(revision)},body:JSON.stringify({operationId,operation})}));assert.equal(res.status,200,await res.text());return operationId;};
 const mergeId=await catalogPost({kind:'merge',sourceId:source.itemId,targetId:target.itemId});stock=await readStock();assert.equal(stock.items.find(i=>i.itemId===target.itemId).groupId,'sauces');assert.ok(stock.groupConflicts.some(c=>c.sourceId===source.itemId&&c.targetId===target.itemId));await catalogPost({kind:'undo',operationId:mergeId});stock=await readStock();assert.equal(stock.items.find(i=>i.itemId===source.itemId).groupId,'meat');assert.equal(stock.items.find(i=>i.itemId===target.itemId).groupId,'sauces');
 assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='group'").get().n,4);
 console.log('PASS ingredient groups: 79 ID-verified seed entries, 60 assignments, manual null, idempotency, owner/CAS/exact replay, menu union, pinned evening/morning, legacy check, merge/undo and audit');db.close();
}finally{delete globalThis.groupDb;delete globalThis.groupUser;await rm(dir,{recursive:true,force:true});}
