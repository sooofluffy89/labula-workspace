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
 await build({stdin:{contents:`export * as evening from './app/api/evening/route';export * as stock from './app/api/stock/route';export * as team from './app/api/team/route';export * as activity from './app/api/activity/route';export * from './lib/notebook';export * from './lib/evening-client';export * from './lib/activity';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',alias:{'@/db':dir+'/db.ts','@/app/chatgpt-auth':dir+'/auth.ts'},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const m=await import(dir+'/test.mjs'),chef={userId:'chef',email:'chef@test.test',fullName:'Cook One'},owner={userId:'owner',email:'jan@bananasport.cz',fullName:'Owner'};globalThis.activityUser=owner;
 const get=async(api,q='',status=200)=>{const r=await m[api].GET(new Request('http://test.local/api/'+api+q));assert.equal(r.status,status);return r.json()};
 const post=async(api,c,status=200)=>{const r=await m[api].POST(new Request('http://test.local/api/'+api,{method:'POST',headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(c)})),body=await r.json();assert.equal(r.status,status,JSON.stringify(body));return body};
 let team=await get('team');assert.ok(team.isOwner);const ownId=team.self.id;
 const add={id:crypto.randomUUID(),kind:'add',email:chef.email,name:'Wen'};await post('team',add);await post('team',add);assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE category='team'").get().n,1);
 globalThis.activityUser=chef;team=await get('team');assert.equal(team.self.id,add.id);assert.equal(team.self.name,'Wen');assert.equal(team.members.length,1);assert.equal(team.self.userId,chef.userId);await post('team',{...add,id:crypto.randomUUID(),email:'other@test.test'},403);await get('activity','?export=1',403);assert.equal((await get('activity')).events.length,0);
 await get('stock');const n=m.initialNotebook();n.items=[m.newItem('QA Broth','prep'),m.newItem('QA Onion')];db.prepare("UPDATE notebooks SET payload=?,revision=1 WHERE id='kitchen'").run(JSON.stringify(n));await get('stock');const [a,b]=n.items.map(i=>i.id),before=db.prepare('SELECT * FROM notebooks').get();
 const meta={occurredAt:'2026-09-23T20:10:00.000Z',sessionId:crypto.randomUUID(),sequence:1};
 const track={id:crypto.randomUUID(),changes:[a,b].map(itemId=>({itemId,revision:0,included:true,track:true})),meta};await post('stock',track);await post('stock',track);assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE category='stock'").get().n,2);
 const c=extra=>({id:crypto.randomUUID(),scope:'kitchen',actorId:chef.userId,meta:{...meta,sequence:++meta.sequence},...extra});const day='2026-09-23',target='2026-09-24';
 await post('evening',c({kind:'start',day,targetDay:target}));await post('evening',c({kind:'start',day,targetDay:target}));assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='start'").get().n,1);
 const answer=c({kind:'answer',checkId:day,itemId:a,revision:0,generation:0,value:'missing',deviceId:meta.sessionId,sequence:1});failEvent=true;await post('evening',answer,503);assert.equal(db.prepare('SELECT revision FROM evening_answers WHERE item_id=?').get(a).revision,0);assert.equal(db.prepare('SELECT count(*) n FROM evening_commands WHERE id=?').get(answer.id).n,0);await post('evening',answer);await post('evening',answer);
 await post('evening',c({kind:'answer',checkId:day,itemId:b,revision:0,generation:0,value:'have',deviceId:meta.sessionId,sequence:2}));
 let snapshot=(await get('evening','?day='+day)).check;const confirm=()=>c({kind:'confirm',checkId:day,revision:snapshot.revision,planRevision:snapshot.planRevision,notebookRevision:1});await post('evening',confirm());
 const taskEvent=db.prepare("SELECT * FROM kitchen_activity WHERE action='created'").get();assert.equal(taskEvent.source,'system');assert.equal(JSON.parse(taskEvent.after_value).ready,0);assert.equal(taskEvent.actor_name,'Wen');
 const ready=c({kind:'ready',checkId:day,itemId:a,revision:0,value:true});await post('evening',ready);await post('evening',ready);await post('evening',c({kind:'ready',checkId:day,itemId:a,revision:0,value:false}),409);await post('evening',c({kind:'ready',checkId:day,itemId:a,revision:1,value:false}));
 const readyEvents=db.prepare("SELECT * FROM kitchen_activity WHERE action='ready' ORDER BY rowid").all();assert.equal(readyEvents.length,2);assert.equal(JSON.parse(readyEvents[1].before_value).ready,1);assert.equal(JSON.parse(readyEvents[1].after_value).ready,false);assert.equal(readyEvents[0].client_at,meta.occurredAt);assert.equal(readyEvents[0].actor_id,chef.userId);
 // A new chef name must not rewrite a historical actor snapshot. Pause is enforced on old clients too.
 globalThis.activityUser=owner;team=await get('team');let chefRow=team.members.find(p=>p.userId===chef.userId);
 await post('team',{id:crypto.randomUUID(),kind:'edit',memberId:chefRow.id,revision:chefRow.revision,name:'Wen renamed',active:false});await post('team',{id:crypto.randomUUID(),kind:'edit',memberId:ownId,revision:0,name:'Owner',active:false},409);
 globalThis.activityUser=chef;await post('evening',c({kind:'ready',checkId:day,itemId:a,revision:2,value:true}),403);await post('stock',{id:crypto.randomUUID(),changes:[{itemId:b,revision:1,included:true,track:false}]},403);
 await post('evening',ready); // exact prior receipt remains recoverable while paused; no new effects
 assert.equal(db.prepare('SELECT actor_name FROM kitchen_activity WHERE command_id=?').get(ready.id).actor_name,'Wen');
 globalThis.activityUser=owner;team=await get('team');chefRow=team.members.find(p=>p.userId===chef.userId);await post('team',{id:crypto.randomUUID(),kind:'edit',memberId:chefRow.id,revision:chefRow.revision,name:'Wen renamed',active:true});globalThis.activityUser=chef;
 // Pause after authorization but before write is caught in the transaction gate.
 concurrent=()=>db.prepare('UPDATE kitchen_team SET active=0 WHERE user_id=?').run(chef.userId);
 // readEvening itself batches first, so this validates the final guard even if member was initially active.
 await post('evening',c({kind:'ready',checkId:day,itemId:a,revision:2,value:true}),409);db.prepare('UPDATE kitchen_team SET active=1 WHERE user_id=?').run(chef.userId);
 // Legacy payloads retain their exact receipt and don't invent device timestamps.
 const legacy={id:crypto.randomUUID(),scope:'kitchen',actorId:chef.userId,kind:'ready',checkId:day,itemId:a,revision:2,value:true};await post('evening',legacy);await post('evening',legacy);assert.equal(db.prepare('SELECT client_at FROM kitchen_activity WHERE command_id=?').get(legacy.id).client_at,null);
 // Correction-induced cancellation is not credited as a cook ticking Ready.
 snapshot=(await get('evening','?day='+day)).check;await post('evening',c({kind:'correct',checkId:day,revision:snapshot.revision,planRevision:snapshot.planRevision}));snapshot=(await get('evening','?day='+day)).check;await post('evening',c({kind:'answer',checkId:day,itemId:a,revision:snapshot.answers.find(x=>x.itemId===a).revision,generation:1,value:'have',deviceId:meta.sessionId,sequence:3}));snapshot=(await get('evening','?day='+day)).check;await post('evening',confirm());assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action='cancelled' AND source='system'").get().n,1);
 assert.deepEqual(db.prepare('SELECT * FROM notebooks').get(),before);
 assert.throws(()=>db.exec("UPDATE kitchen_activity SET actor_name='fake'"),/append_only/);assert.throws(()=>db.exec('DELETE FROM kitchen_activity'),/append_only/);
 globalThis.activityUser=owner;for(let i=0;i<65;i++)db.prepare('INSERT INTO kitchen_activity(id,command_id,category,action,source,actor_id,actor_email,actor_name,recorded_at) VALUES(?,?,?,?,?,?,?,?,?)').run('page'+String(i).padStart(3,'0'),'p'+i,'morning','ready','human','chef',chef.email,'Wen','2026-09-24T09:00:00.000Z');
 const p1=await get('activity','?category=morning');assert.equal(p1.events.length,60);assert.ok(p1.next);const p2=await get('activity','?category=morning&cursor='+encodeURIComponent(p1.next));assert.ok(p2.events.length>0);assert.equal(new Set([...p1.events,...p2.events].map(e=>e.id)).size,p1.events.length+p2.events.length);
 await get('activity','?from=2026-09-30&to=2026-09-01',400);assert.equal((await get('activity','?item='+a)).events.every(e=>e.item_id===a),true);assert.equal(m.csvCell('=SUM(1,2)'),`"'=SUM(1,2)"`);
 globalThis.activityUser=null;await get('activity','',401);await get('team','',401);
 console.log('PASS stock activity: authenticated identity, pending profile binding, owner-only management/export, pause/CAS, atomic event/state rollback, exact retries, timestamps, Ready/Undo, system effects, immutable history, stable paging, CSV safety, untouched recipes');
 db.close();
}finally{delete globalThis.activityDb;delete globalThis.activityUser;await rm(dir,{recursive:true,force:true})}
