import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,readFile,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
const dir=await mkdtemp(tmpdir()+'/labula-activity-');
try{
 const db=new DatabaseSync(':memory:');for(const f of(await readdir('drizzle')).filter(f=>f.endsWith('.sql')).sort())db.exec(await readFile('drizzle/'+f,'utf8'));
 let failEvent=false,concurrent=null;
 const stmt=(sql,args=[])=>({bind(...a){return stmt(sql,a)},async first(){return db.prepare(sql).get(...args)??null},async all(){return {results:db.prepare(sql).all(...args)}},async run(){return this.exec()},exec(){if(failEvent&&sql.includes('INSERT OR IGNORE INTO kitchen_activity')){failEvent=false;throw Error('event write failed')}const s=db.prepare(sql);return s.columns().length?{results:s.all(...args),meta:{changes:0}}:{results:[],meta:{changes:Number(s.run(...args).changes)}}}});
 globalThis.activityDb={prepare:stmt,async batch(ss){if(concurrent){const fn=concurrent;concurrent=null;fn();}db.exec('BEGIN');try{const r=ss.map(s=>s.exec());db.exec('COMMIT');return r}catch(e){db.exec('ROLLBACK');throw e}}};
 await writeFile(dir+'/db.ts','export const getRawDb=()=>globalThis.activityDb;');await writeFile(dir+'/auth.ts','export const getChatGPTUser=async()=>globalThis.activityUser;');
 await build({stdin:{contents:`export * as evening from './app/api/evening/route';export * as stock from './app/api/stock/route';export * as team from './app/api/team/route';export * as activity from './app/api/activity/route';export * from './lib/notebook';export * from './lib/evening-client';export * from './lib/activity';export * from './lib/team-client';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/test.mjs');
 const owner={userId:'owner',email:'jan@bananasport.cz',fullName:'Owner'},chef={userId:'chef',email:'chef@qa.test',fullName:'Chef'};
 globalThis.activityUser=owner;
 const req=()=>new Request('http://test.local/api/team?management=1');
 // Read-only management cannot bootstrap ownership or profiles.
 assert.equal((await m.team.GET(req())).status,403);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_team').get().n,0);
 await m.team.GET();const original=db.prepare('SELECT * FROM kitchen_team').all();
 assert.equal((await m.team.GET(req())).status,200);assert.deepEqual(db.prepare('SELECT * FROM kitchen_team').all(),original);
 globalThis.activityUser=chef;assert.equal((await m.team.GET(req())).status,403);assert.deepEqual(db.prepare('SELECT * FROM kitchen_team').all(),original);
 globalThis.activityUser=null;assert.equal((await m.team.GET(req())).status,401);
 globalThis.activityUser=owner;
 let fault='',postCount=0,gate=null;
 const transport=async(url,init={})=>{
  if(!init.method){const res=await m.team.GET(new Request('http://test.local'+url));return {res,body:await res.json()};}
  postCount++;if(fault==='before'){fault='';throw Error('Offline before sending');}
  const res=await m.team.POST(new Request('http://test.local'+url,{...init,headers:{...init.headers,Origin:'http://test.local'}}));
  const body=await res.json();if(fault==='after'){fault='';throw Error('Reply lost after commit');}if(gate){const g=gate;gate=null;await g;}
  return {res,body};
 };
 const values=new Map();let broken=false;
 const storage={get length(){if(broken)throw Error('Storage blocked');return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(broken)throw Error('Storage blocked');values.set(k,v)},removeItem:k=>{if(broken)throw Error('Storage blocked');values.delete(k)}};
 const controller=()=>new m.TeamController(owner.email,storage,()=>{},transport);
 let c=controller();await c.refresh();assert.ok(c.state.directory?.isOwner);
 const add=(email='cook@qa.test')=>({id:crypto.randomUUID(),kind:'add',name:'QA Cook',email});
 const command=add('  COOK@qa.test  ');fault='after';assert.equal(await c.save(command),false);assert.equal(c.state.pending.length,1);
 const count=db.prepare('SELECT count(*) n FROM kitchen_team').get().n;
 const pending=c.state.pending[0];assert.equal(pending.command.email,'cook@qa.test');assert.equal(await c.save(pending.command,pending.key),true);assert.equal(db.prepare('SELECT count(*) n FROM kitchen_team').get().n,count);assert.equal(c.state.pending.length,0);
 assert.equal(db.prepare('SELECT count(*) n FROM kitchen_activity WHERE command_id=?').get(command.id).n,1);
 const dup=add('COOK@QA.TEST');assert.equal(await c.save(dup),false);assert.equal(c.state.pending[0].rejected,true);await c.discardRejected(c.state.pending[0].key);assert.equal(c.state.pending.length,0);
 // Legacy v1 recovery survives migration to a different UI.
 const old=add('legacy@qa.test');storage.setItem('labula-team-v1:owner',JSON.stringify(old));c.dispose();c=controller();await c.refresh();assert.equal(c.state.pending[0].command.id,old.id);assert.equal(await c.save(old,'labula-team-v1:owner'),true);assert.equal(storage.getItem('labula-team-v1:owner'),null);
 // Two tabs' different records are both retained, and other-account records are isolated.
 const a=add('tab-a@qa.test'),b=add('tab-b@qa.test');storage.setItem('labula-team-v2:owner:'+a.id,JSON.stringify(a));storage.setItem('labula-team-v2:owner:'+b.id,JSON.stringify(b));storage.setItem('labula-team-v1:other',JSON.stringify(add()));await c.refresh();assert.equal(c.state.pending.length,2);assert.equal(await c.save(add()),false);for(const p of [...c.state.pending])assert.equal(await c.save(p.command,p.key),true);assert.ok(storage.getItem('labula-team-v1:other'));
 // Malformed recovery remains available for download until an explicit clear.
 storage.setItem('labula-team-v1:owner','{broken');await c.refresh();assert.equal(c.state.unreadable.length,1);const beforePosts=postCount;assert.equal(await c.save(add()),false);assert.equal(postCount,beforePosts);assert.equal(storage.getItem('labula-team-v1:owner'),'{broken');await c.clearUnreadable();assert.equal(c.state.unreadable.length,0);
 broken=true;await c.refresh();assert.equal(c.state.storageError,true);assert.equal(await c.save(add()),false);assert.equal(postCount,beforePosts);broken=false;await c.refresh();assert.equal(c.state.storageError,false);
 // Already-running saves block duplicate clicks; disposal keeps an unresolved receipt.
 let release;gate=new Promise(r=>{release=r});const slow=add('slow@qa.test');const sending=c.save(slow);while(!release||postCount===beforePosts)await new Promise(r=>setImmediate(r));assert.equal(await c.save(slow),false);c.dispose();release();assert.equal(await sending,false);assert.ok([...values.keys()].some(k=>k.endsWith(slow.id)));c=controller();await c.refresh();let p=c.state.pending.find(x=>x.command.id===slow.id);assert.ok(p);assert.equal(await c.save(p.command,p.key),true);
 // Authentication and account changes never submit a queued owner command as someone else.
 const unconfirmed=add('offline@qa.test');fault='before';await c.save(unconfirmed);p=c.state.pending[0];globalThis.activityUser=chef;const posts=postCount;assert.equal(await c.save(p.command,p.key),false);assert.equal(postCount,posts);assert.ok(storage.getItem(p.key));globalThis.activityUser=null;await c.refresh();assert.match(c.state.error,/Sign in/);globalThis.activityUser=owner;await c.refresh();assert.equal(await c.save(p.command,p.key),true);
 // Editing with an old revision is rejected; refresh never silently rebases intent.
 let person=c.state.directory.members.find(x=>x.id===command.id);const edit={id:crypto.randomUUID(),kind:'edit',memberId:person.id,revision:person.revision,name:'Renamed QA',active:false};assert.equal(await c.save(edit),true);assert.equal(await c.save({...edit,id:crypto.randomUUID(),name:'Stale overwrite'}),false);assert.equal(c.state.pending[0].rejected,true);assert.equal(db.prepare('SELECT name FROM kitchen_team WHERE id=?').get(person.id).name,'Renamed QA');await c.discardRejected(c.state.pending[0].key);
 person=c.state.directory.members.find(x=>x.owner);assert.equal(await c.save({id:crypto.randomUUID(),kind:'edit',memberId:person.id,revision:person.revision,name:person.name,active:false}),false);assert.equal(db.prepare('SELECT active FROM kitchen_team WHERE id=?').get(person.id).active,1);
 c.dispose();console.log('PASS Team workspace: read-only owner directory, legacy recovery, normalized duplicates, lost replies, concurrent records, malformed/blocked storage, disposal, double-click, account change, revision conflicts and owner protection');db.close();
}finally{delete globalThis.activityDb;delete globalThis.activityUser;await rm(dir,{recursive:true,force:true});}
