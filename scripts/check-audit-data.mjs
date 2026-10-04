import {fixtureAuthSource} from './access-fixture.mjs';
import {readdir} from 'node:fs/promises';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(path.join(tmpdir(),'labula-audit-data-'));
try{
 const bundle=async(entry,name,extra={})=>{const outfile=path.join(dir,name+'.mjs');await build({entryPoints:[entry],bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',...extra});return import(outfile);};
 const m=await bundle('lib/notebook.ts','model'),c=await bundle('lib/catalog.ts','catalog'),draft=await bundle('lib/bulk-draft.ts','draft'),bulk=await bundle('lib/bulk.ts','bulk'),size=await bundle('lib/notebook-size.ts','size');
 for(const value of ['', '   ','x'.repeat(161),'香'.repeat(161)])assert.equal(m.itemNameSchema.safeParse(value).success,false);
 for(const value of ['Salt','x'.repeat(160),'香'.repeat(160),'🧂'.repeat(80)])assert.equal(m.itemNameSchema.safeParse(value).success,true);
 assert.match(m.itemNameSchema.safeParse('x'.repeat(161)).error.issues[0].message,/160/);
 const empty=m.initialNotebook();
 for(const [original,current] of [['prep','bought'],['bought','prep']]){
  const rows=bulk.reconcileDraft('House sauce',[],[]).map(row=>({...row,kind:original})),file=draft.makeIngredientDraft(empty,'s1-v1','House sauce',rows,[],[],null);
  const latest=structuredClone(empty);latest.items=[m.newItem('House sauce',current)];
  assert.deepEqual(draft.restoreIngredientDraft(file,latest,'s1-v1').needsReview,['house sauce']);
  const older=structuredClone(file);delete older.intents;assert.deepEqual(draft.restoreIngredientDraft(older,latest,'s1-v1').needsReview,['house sauce']);
 }
 const n=m.initialNotebook(),a=m.newItem('Chilli oil'),b=m.newItem('House chilli oil'),third=m.newItem('Chili oil');n.items=[a,b,third];n.distinctPairs=[[a.id,third.id],[b.id,third.id],[a.id,b.id]];n.recipes[0].inputs=[{itemId:a.id,amount:null,note:''}];
 const merged=c.mergePreview(n,a.id,b.id).next;assert.deepEqual(merged.distinctPairs,[[b.id,third.id].sort()]);assert.equal(c.duplicatePairs(merged).length,0);
 const renamed=c.applyOperation(n,{kind:'reclassify',itemId:a.id,itemKind:'prep'}).next;assert.equal(renamed.items[0].kind,'prep');assert.deepEqual({...renamed.items[0],kind:'bought'},a);assert.deepEqual(renamed.recipes,n.recipes);assert.throws(()=>c.validateOrdinaryEdit(n,renamed),/Only the item name/);
 renamed.items[0].inputs=[{itemId:third.id,amount:12,note:'Keep historical recipe'}];assert.throws(()=>c.applyOperation(renamed,{kind:'reclassify',itemId:a.id,itemKind:'bought'}),/saved recipe/);
 const sqlite=new DatabaseSync(':memory:');for(const file of (await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())sqlite.exec(await readFile('drizzle/'+file,'utf8'));
 const stmt=(sql,args=[])=>({bind(...values){return stmt(sql,values);},async first(){return sqlite.prepare(sql).get(...args)??null;},async all(){return {results:sqlite.prepare(sql).all(...args)};},async run(){return this._run();},_run(){return {meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}};}});
 globalThis.auditDb={prepare:stmt,async batch(statements){sqlite.exec('BEGIN');try{const result=statements.map(s=>s._run());sqlite.exec('COMMIT');return result;}catch(e){sqlite.exec('ROLLBACK');throw e;}}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.auditDb;export const getAppAccessMode=()=>"application";');await writeFile(dir+'/auth.ts',fixtureAuthSource('globalThis.auditUser','globalThis.auditDb'));
 const options={alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'}};
 const api=await bundle('app/api/notebook/route.ts','api',options),cat=await bundle('app/api/catalog/route.ts','cat',options),bulkApi=await bundle('app/api/bulk/route.ts','bulk-api',options);
 const owner={userId:'owner',email:'jan@bananasport.cz'},chef={userId:'chef',email:'xuewenokay@gmail.com'};globalThis.auditUser=owner;
 await api.GET();let revision=1;
 const seed=data=>{sqlite.prepare('UPDATE notebooks SET payload=?,revision=? WHERE id=?').run(JSON.stringify(data),revision++,'kitchen');return revision-1;};
 const request=(method,body,rev,receipt)=>new Request('https://test.local/api/notebook',{method,headers:{Origin:'https://test.local','Content-Type':'application/json','If-Match':String(rev),...(receipt?{'X-Operation-Id':receipt}:{})},body:JSON.stringify(body)});
 const command=(operation,rev,id=crypto.randomUUID())=>cat.POST(request('POST',{operationId:id,operation},rev));
 let rev=seed(n),op={kind:'reclassify',itemId:a.id,itemKind:'prep'},id=crypto.randomUUID();globalThis.auditUser=chef;assert.equal((await command(op,rev,id)).status,403);globalThis.auditUser=owner;
 assert.equal((await command(op,rev,id)).status,200);assert.equal((await command(op,rev,id)).status,200);assert.equal(sqlite.prepare('SELECT count(*) count FROM catalog_operations WHERE id=?').get(id).count,1);assert.equal((await command({...op,itemKind:'bought'},rev,id)).status,409);
 // Each notebook payload boundary is measured in UTF-8 bytes, independently of the wire envelope.
 for(const character of ['x','ž','香','🧂']){
  const heavy=m.initialNotebook();for(let i=0;i<990;i++)heavy.items.push(m.newItem('Item '+i));
  let missing=750000-size.utf8Bytes(JSON.stringify(heavy));
  for(const item of heavy.items){if(missing<=0)break;const count=Math.min(1500,Math.floor(missing/size.utf8Bytes(character)));item.specification=character.repeat(count);missing-=size.utf8Bytes(item.specification);}
  assert.ok(missing<20);heavy.equipment.notes='x'.repeat(missing);assert.equal(size.utf8Bytes(JSON.stringify(heavy)),750000);m.validateNotebook(heavy);
  const boundary=seed(heavy);assert.equal((await api.PUT(request('PUT',heavy,boundary))).status,200);
  const current=await (await api.GET()).json();const over=structuredClone(heavy);over.items[989].name+='x';
  assert.throws(()=>size.serializeNotebook(over),/storage limit/);
  // Both legacy and receipt-backed PUT reject oversize valid payloads without changing data.
  for(const receipt of [undefined,crypto.randomUUID()]){const before=sqlite.prepare('SELECT payload,revision FROM notebooks WHERE id=?').get('kitchen');assert.equal((await api.PUT(request('PUT',over,current.revision,receipt))).status,413);assert.deepEqual(sqlite.prepare('SELECT payload,revision FROM notebooks WHERE id=?').get('kitchen'),before);}
  const countBefore=sqlite.prepare('SELECT count(*) count FROM catalog_operations').get().count;
  assert.equal((await command({kind:'aliases',itemId:heavy.items[0].id,aliases:['extra '+character]},current.revision)).status,413);
  assert.equal(sqlite.prepare('SELECT count(*) count FROM catalog_operations').get().count,countBefore);
  assert.equal((await (await api.GET()).json()).revision,current.revision);
  const added={recipeId:'s1-v1',rows:bulk.reconcileDraft('Extra ingredient',[],heavy.items)};
  const receiptsBefore=sqlite.prepare('SELECT count(*) count FROM notebook_commands').get().count;
  const response=await bulkApi.POST(request('POST',{commandId:crypto.randomUUID(),command:added},current.revision));assert.equal(response.status,413);
  assert.equal(sqlite.prepare('SELECT count(*) count FROM notebook_commands').get().count,receiptsBefore);
 }
 sqlite.close();console.log('PASS audit data: exact-match type restore; field validation; owner-only reclassify/replay; merge decisions; byte limits for legacy/receipt/catalog/bulk with ASCII, Czech, Chinese and emoji, and no partial writes.');
}finally{await rm(dir,{recursive:true,force:true});}
