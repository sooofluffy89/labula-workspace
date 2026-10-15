// Synthetic D1 execution-boundary diagnostic. No credentials, production data,
// remote database, migration writes, or application-schema repair are used.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {Miniflare,convertV4MiniflareOptions} from 'miniflare';

const source=await readFile(new URL('../drizzle/0023_workspace_runtime_policy.sql',import.meta.url),'utf8');
const trigger=source.split('--> statement-breakpoint').map(value=>value.trim()).find(value=>value.startsWith('CREATE TRIGGER workspace_request_policy '));
assert(trigger,'Expected the original complete policy trigger.');
const flat=trigger.replace(/\s*\n\s*/g,' ');
const modes=['exec-multiline','exec-single-line','prepare-multiline','prepare-single-line','batch-multiline'];
const mf=new Miniflare(convertV4MiniflareOptions({modules:true,script:'export default {fetch(){return new Response("synthetic")}}',compatibilityDate:'2026-09-18',d1Databases:Object.fromEntries(modes.map(name=>[name,name]))}));
const results=[];
try{
 for(const mode of modes){
  const db=await mf.getD1Database(mode);
  await db.prepare('CREATE TABLE access_write_guards(id TEXT,user_id TEXT,scope TEXT,client_version INTEGER DEFAULT 1)').run();
  await db.prepare('CREATE TABLE workspace_runtime_policy(id TEXT,write_paused INTEGER,min_client_version INTEGER,revision INTEGER,updated_at TEXT)').run();
  await db.prepare("INSERT INTO workspace_runtime_policy VALUES('kitchen',0,1,0,'initial-policy')").run();
  try{
   if(mode==='exec-multiline')await db.exec(trigger);
   if(mode==='exec-single-line')await db.exec(flat);
   if(mode==='prepare-multiline')await db.prepare(trigger).run();
   if(mode==='prepare-single-line')await db.prepare(flat).run();
   if(mode==='batch-multiline')await db.batch([db.prepare(trigger)]);
   const rows=await db.prepare("SELECT name FROM sqlite_schema WHERE type='trigger' AND name='workspace_request_policy'").all();
   results.push({mode,success:true,triggerCreated:rows.results.length===1});
  }catch(error){results.push({mode,success:false,error:error instanceof Error?error.message:String(error)});}
 }
}finally{await mf.dispose();}
console.log(JSON.stringify({data:'synthetic temporary D1 only',results,productionExecutorVerified:false},null,2));
assert.equal(results[0].success,false,'The installed D1 exec implementation no longer reproduces the observed error.');
assert.match(results[0].error,/incomplete input/);
for(const result of results.slice(1))assert(result.success&&result.triggerCreated,result.mode);
