import {fixtureAuthSource} from './access-fixture.mjs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdtemp,readFile,writeFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';

// Run with the Site checkout as cwd. This harness never opens persistent D1.
const {build}=createRequire(path.resolve('package.json'))('esbuild');
const dir=await mkdtemp(path.join(tmpdir(),'labula-merge-server-'));
try{
 const bundle=async(entry,name,extra={})=>{const outfile=path.join(dir,name+'.mjs');await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',...extra});return import(pathToFileURL(outfile));};
 const m=await bundle('lib/notebook.ts','model'),c=await bundle('lib/catalog.ts','catalog');
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.__mergeAuditDb;export const getAppAccessMode=()=>"application";');
 await writeFile(dir+'/auth.ts',fixtureAuthSource('globalThis.__mergeAuditUser','globalThis.__mergeAuditDb'));
 const options={alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'}};
 const api=await bundle('app/api/notebook/route.ts','api',options),cat=await bundle('app/api/catalog/route.ts','catalog-api',options);
 const migrations=await Promise.all((await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort().map(name=>readFile('drizzle/'+name,'utf8')));
 const owner={userId:'owner',email:'jan@bananasport.cz'},chef={userId:'chef',email:'xuewenokay@gmail.com'};
 const request=(method,body,revision,extra={})=>new Request('https://test.local/api/notebook',{method,headers:{Origin:'https://test.local','Content-Type':'application/json','If-Match':String(revision),...extra},body:JSON.stringify(body)});
 const send=(operation,revision,id=crypto.randomUUID(),headers={})=>cat.POST(request('POST',{operationId:id,operation},revision,headers));
 const json=async response=>{assert.equal(response.status,200,await response.clone().text());return response.json();};
 const state=()=>api.GET().then(json);
 const pairSet=pairs=>pairs.map(p=>JSON.stringify([...p].sort())).sort();
 const put=(data,revision)=>api.PUT(request('PUT',data,revision,{'X-Operation-Id':crypto.randomUUID()}));
 const fixture=()=>{
  const n=m.initialNotebook();
  const [a,b,third,d,e]=['Chilli oil','House chilli oil','Chili oil','Sesame oil','Rice'].map(name=>m.newItem(name));
  const prep=m.newItem('Dressing','prep');prep.inputs=[{itemId:a.id,amount:12,note:'Preserve saved amount and note'},{itemId:d.id,amount:3,note:''}];
  n.items=[a,b,third,d,e,prep];
  n.distinctPairs=[[third.id,a.id],[b.id,third.id],[d.id,b.id],[d.id,e.id],[a.id,b.id]];
  n.recipes[0].inputs=[{itemId:a.id,amount:null,note:''},{itemId:b.id,amount:null,note:''}];n.recipes[0].recorded=true;
  n.recipes[1].inputs=[{itemId:a.id,amount:8,note:'Inactive historical input'}];n.recipes[1].active=false;n.recipes[1].recorded=true;
  m.validateNotebook(n);return {n,a,b,third,d,e,prep,op:{kind:'merge',sourceId:a.id,targetId:b.id}};
 };
 const withDb=async(fn)=>{
  const db=new DatabaseSync(':memory:');for(const sql of migrations)db.exec(sql);
  const faults={afterSnapshot:null,rollbackAfterInsert:false,loseReply:false,failNextRead:false};
  const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values);},async first(){
   if(faults.failNextRead&&sql.startsWith('SELECT payload')){faults.failNextRead=false;throw Error('Expected test-only lost reply');}
   const row=db.prepare(sql).get(...args)??null;
   if(sql.startsWith('SELECT payload')&&faults.afterSnapshot){const action=faults.afterSnapshot;faults.afterSnapshot=null;await action();}
   return row;
  },async all(){return {results:db.prepare(sql).all(...args)};},async run(){return this._run();},_run(){return {meta:{changes:Number(db.prepare(sql).run(...args).changes)}};}});
  globalThis.__mergeAuditDb={prepare:stmt,async batch(statements){db.exec('BEGIN');try{const results=[];for(const [index,s]of statements.entries()){results.push(s._run());if(index===0&&faults.rollbackAfterInsert){faults.rollbackAfterInsert=false;throw Error('Expected test-only transaction rollback');}}db.exec('COMMIT');if(faults.loseReply){faults.loseReply=false;faults.failNextRead=true;}return results;}catch(e){db.exec('ROLLBACK');throw e;}}};
  globalThis.__mergeAuditUser=owner;
  const f=fixture();db.prepare('INSERT INTO notebooks(id,payload,revision,updated_at,updated_by) VALUES(?,?,?,?,?)').run('kitchen',JSON.stringify(f.n),0,'2026-09-12T00:00:00.000Z',owner.email);
  const snapshot=()=>({notebook:db.prepare('SELECT * FROM notebooks').all(),catalog:db.prepare('SELECT * FROM catalog_operations').all(),commands:db.prepare('SELECT * FROM notebook_commands').all()});
  try{await fn({...f,db,faults,snapshot});}finally{db.close();delete globalThis.__mergeAuditDb;delete globalThis.__mergeAuditUser;}
 };
 await withDb(async({n,a,b,third,d,e,prep,op,db,snapshot})=>{
  await state();const before=snapshot();
  globalThis.__mergeAuditUser=null;assert.equal((await send(op,0)).status,401);
  globalThis.__mergeAuditUser=chef;assert.equal((await send(op,0)).status,403);assert.equal((await cat.GET()).status,403);
  globalThis.__mergeAuditUser={userId:'other-owner-id',email:owner.email};assert.equal((await send(op,0)).status,403);
  globalThis.__mergeAuditUser=owner;assert.equal((await send(op,0,crypto.randomUUID(),{Origin:'https://untrusted.local'})).status,403);
  const direct=c.mergePreview(n,a.id,b.id).next;assert.equal((await put(direct,0)).status,400);assert.deepEqual(snapshot(),before);
  const id=crypto.randomUUID(),merged=await json(await send(op,0,id));
  assert.equal(merged.revision,1);assert.equal(merged.replayed,false);
  assert.deepEqual(pairSet(merged.data.distinctPairs),pairSet([[b.id,third.id],[b.id,d.id],[d.id,e.id]]));
  assert.ok(!merged.data.distinctPairs.flat().includes(a.id));
  assert.equal(merged.data.recipes[0].inputs.length,1);assert.equal(merged.data.recipes[0].recorded,false,'Changing ingredient identity reopens the own composition confirmation');
  assert.deepEqual(merged.data.recipes[1],{...n.recipes[1],recorded:false,ingredientsReviewed:false,inputs:[{...n.recipes[1].inputs[0],itemId:b.id}]});
  assert.deepEqual(merged.data.items.find(i=>i.id===prep.id).inputs,[{...prep.inputs[0],itemId:b.id},prep.inputs[1]]);
  const saved=await state();assert.deepEqual(saved.data,merged.data);
  const audit=db.prepare('SELECT * FROM catalog_operations WHERE id=?').get(id);assert.deepEqual(JSON.parse(audit.before_payload),n);assert.deepEqual(JSON.parse(audit.after_payload),merged.data);
  const after=snapshot();assert.equal((await json(await send(op,0,id))).replayed,true);assert.deepEqual(snapshot(),after);
  const mismatch=await send({...op,targetId:d.id},0,id);assert.equal(mismatch.status,409);assert.equal((await mismatch.json()).code,'command_mismatch');
  globalThis.__mergeAuditUser=chef;assert.equal((await send(op,0,id)).status,403);assert.equal((await send({kind:'undo',operationId:id},1)).status,403);globalThis.__mergeAuditUser=owner;
  assert.deepEqual(snapshot(),after);
  const undoId=crypto.randomUUID(),undone=await json(await send({kind:'undo',operationId:id},1,undoId));assert.deepEqual(undone.data,n);
  assert.deepEqual((await json(await send({kind:'undo',operationId:id},1,undoId))).data,n);
  const later=structuredClone(undone.data);later.recipes[0].recorded=false;await json(await put(later,undone.revision));
  const latest=await state(),written=snapshot();
  assert.deepEqual((await json(await send(op,0,id))).data,latest.data);
  assert.deepEqual((await json(await send({kind:'undo',operationId:id},1,undoId))).data,latest.data);
  assert.equal((await send({kind:'undo',operationId:id},latest.revision)).status,409);assert.deepEqual(snapshot(),written);
 });
 // Explicitly exercise an A-C decision that has no pre-existing B-C counterpart.
 await withDb(async({n,a,b,third,op,db})=>{
  n.distinctPairs=[[a.id,third.id]];db.prepare('UPDATE notebooks SET payload=?').run(JSON.stringify(n));
  const result=await json(await send(op,0));assert.deepEqual(pairSet(result.data.distinctPairs),pairSet([[b.id,third.id]]));assert.deepEqual((await state()).data.distinctPairs,result.data.distinctPairs);
 });
 await withDb(async({b,third,d,e,op,db,faults,snapshot})=>{
  await state();const before=snapshot(),id=crypto.randomUUID();
  faults.rollbackAfterInsert=true;assert.equal((await send(op,0,id)).status,503);assert.deepEqual(snapshot(),before);
  faults.loseReply=true;assert.equal((await send(op,0,id)).status,503);
  const persisted=await state();assert.deepEqual(pairSet(persisted.data.distinctPairs),pairSet([[b.id,third.id],[b.id,d.id],[d.id,e.id]]));assert.equal(db.prepare('SELECT count(*) n FROM catalog_operations WHERE id=?').get(id).n,1);
  const later=structuredClone(persisted.data);later.recipes[0].recorded=false;await json(await put(later,persisted.revision));
  const latest=await state(),written=snapshot(),retry=await json(await send(op,0,id));assert.equal(retry.replayed,true);assert.deepEqual(retry.data,latest.data);assert.deepEqual(snapshot(),written);
 });
 await withDb(async({b,third,d,e,op,db})=>{
  const id=crypto.randomUUID(),responses=await Promise.all([send(op,0,id),send(op,0,id)]);assert.deepEqual(responses.map(r=>r.status),[200,200]);
  assert.deepEqual(pairSet((await state()).data.distinctPairs),pairSet([[b.id,third.id],[b.id,d.id],[d.id,e.id]]));assert.equal(db.prepare('SELECT count(*) n FROM catalog_operations').get().n,1);
 });
 await withDb(async({op,third,d,n,db})=>{
  const results=await Promise.all([send(op,0),send({kind:'distinct',a:third.id,b:d.id,different:true},0)]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  const losing=results.find(r=>r.status===409);assert.equal((await losing.json()).code,'revision_conflict');
  const latest=await state();m.validateNotebook(latest.data);assert.equal(latest.revision,1);assert.equal(db.prepare('SELECT count(*) n FROM catalog_operations').get().n,1);
  const expected=results[0].status===200?c.applyOperation(n,op).next:c.applyOperation(n,{kind:'distinct',a:third.id,b:d.id,different:true}).next;assert.deepEqual(latest.data,expected);
 });
 await withDb(async({n,op,faults,db})=>{
  const newer=structuredClone(n);newer.recipes[0].recorded=false;
  faults.afterSnapshot=async()=>{await json(await put(newer,0));};
  const response=await send(op,0);assert.equal(response.status,409);assert.equal((await response.json()).code,'revision_conflict');
  assert.deepEqual((await state()).data,newer);assert.equal(db.prepare('SELECT count(*) n FROM catalog_operations').get().n,0);
 });
 console.log('PASS merge server: persisted third-party decisions, dedup/self-pair removal, historical references, exact Undo, current-state replay, owner/actor/origin checks, ordinary-PUT denial, atomic rollback, lost reply, same-ID concurrency, competing catalog writes and ordinary-save CAS race.');
}finally{await rm(dir,{recursive:true,force:true});}
