import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {harness,sleep} from './sync-harness.mjs';

// Real routes/controllers/transactions. Bind identities to each async request,
// including the optional archived v71 bundle used for rolling-release checks.
const identities=new AsyncLocalStorage();let fallbackUser;
Object.defineProperty(globalThis,'syncUser',{configurable:true,get:()=>identities.getStore()??fallbackUser,set:v=>{fallbackUser=v;}});
const compatibility=process.env.P1_COMPAT_BUNDLE?await import(process.env.P1_COMPAT_BUNDLE):null;
const results=[];
async function scenario(name,run){
 const h=await harness(),clients=[],users=[h.owner,h.cook,{userId:'cook3',email:'cook3@example.test'}];
 h.db.prepare("INSERT INTO kitchen_team(id,user_id,email,name,access_role,active,access_enabled,revision,created_at) VALUES('cook3','cook3','cook3@example.test','Synthetic Cook 3','cook',1,1,0,?)").run(new Date().toISOString());
 const send=(u,c)=>identities.run(u,()=>h.send(c));
 const request=(u)=> (url,init)=>identities.run(u,()=>h.requester(url,init));
 const client=async({user=users[0],wrap=r=>r,Module=h.m,selection={day:h.day},storage=h.storage(),fast=true}={})=>{
  const c=new Module.EveningController(user.email,storage,selection,wrap(request(user)),fast);clients.push(c);assert(await c.refresh());return c;
 };
 const answer=(u,id,value)=>send(u,{kind:'answer',checkId:h.day,itemId:id,revision:h.db.prepare('SELECT revision FROM evening_answers WHERE item_id=?').get(id).revision,generation:0,value,deviceId:crypto.randomUUID(),sequence:1});
 const fill=async c=>{for(const a of c.visibleCheck().answers)assert(c.answer(a.itemId,'have'));assert(await c.flush());for(let i=0;i<52;i++)assert(c.answer('item-1',i%2?'have':'missing'));assert(await c.flush());};
 const publish=async(count=20)=>{for(let i=0;i<80;i++)await answer(users[0],'item-'+i,i<count?'missing':'have');const s=(await request(users[0])('/api/evening?day='+h.day)).body;await send(users[0],{kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision});};
 const undo=(u)=>send(u,{kind:'ready',checkId:h.day,itemId:'item-0',revision:h.db.prepare("SELECT revision FROM morning_tasks WHERE item_id='item-0'").get().revision,value:false});
 const idle=async c=>{for(let i=0;i<3000&&(c.state.saving||c.state.verifying||c.state.refreshing);i++)await sleep(1);assert(!c.state.saving&&!c.state.verifying&&!c.state.refreshing);};
 try{await run({...h,users,clients,client,send,request,answer,fill,publish,undo,idle});results.push(name);console.log('PASS '+name);}
 finally{clients.forEach(c=>c.dispose());await sleep(30);h.db.close();}
}

async function finishBoundary(s,Module=s.m){
 let changed=false,pages=0;
 const c=await s.client({Module,wrap:r=>async(url,init)=>{const reply=await r(url,init);if(url.includes('/sync?')){pages++;if(reply.body.more&&!changed){changed=true;await s.answer(s.users[1],'item-0','missing');}}return reply;}});
 await s.fill(c);const approved=c.reviewFinish();assert.equal(approved.check.answers[0].value,'have');assert(c.requestFinish(approved));await c.continueFinish();
 assert(changed&&pages>=3);assert.equal(c.state.finish.phase,'attention');assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);
 assert.equal(c.visibleCheck().answers[0].value,'missing');assert.equal(c.visibleCheck().answers[0].updatedBy,s.users[1].email);
 assert(c.requestFinish(c.reviewFinish()));await c.continueFinish();assert.equal(c.state.finish.phase,'complete');
 assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);assert.equal(s.db.prepare("SELECT count(*) n FROM morning_tasks WHERE item_id='item-0' AND cancelled=0").get().n,1);
}
async function morningBoundary(s,Module=s.m){
 await s.publish();let changed=false,pages=0;
 const c=await s.client({Module,selection:{morningDay:s.targetDay},wrap:r=>async(url,init)=>{const reply=await r(url,init);if(url.includes('/sync?')){pages++;if(reply.body.more&&!changed){changed=true;await s.undo(s.users[1]);}}return reply;}});
 for(let i=0;i<20;i++)assert(c.ready('item-'+i,true));for(let i=0;i<112;i++)assert(c.ready('item-1',i%2===1));assert(await c.flush());await s.idle(c);
 assert(changed&&pages>=3);assert.equal(c.visibleCheck().tasks[0].ready,false);assert.equal(c.visibleCheck().tasks[0].updatedBy,s.users[1].email);
 const stats=s.m.morningProgress(c.state);assert.equal(stats.remaining,1);assert.equal(stats.complete,false);assert.equal(c.state.needsVerification,false);
}
await scenario('P1: peer answer across page boundary blocks stale approval; explicit new approval publishes',s=>finishBoundary(s));
await scenario('P1: peer Undo across page boundary prevents false all-ready',s=>morningBoundary(s));
await scenario('shared cursor consumes more than two pages from another check before approving this check',async s=>{
 const initial=await s.client();await s.fill(initial);initial.dispose();
 const otherDay='2026-09-25';await s.send(s.users[0],{kind:'start',day:otherDay,targetDay:s.day});
 let changed=false,pages=0;
 const c=await s.client({wrap:r=>async(url,init)=>{const reply=await r(url,init);if(url.includes('/sync?')){pages++;if(reply.body.more&&!changed){changed=true;await s.answer(s.users[1],'item-0','missing');}}return reply;}});
 await identities.run(s.users[2],async()=>{for(let start=0;start<300;start+=20){const commands=Array.from({length:20},(_,i)=>s.command({kind:'answer',checkId:otherDay,itemId:'item-1',revision:start+i,generation:0,value:(start+i)%2?'missing':'have',deviceId:crypto.randomUUID(),sequence:start+i+1}));const r=await s.post(s.m.batch,{commands});assert.equal(r.status,200);assert((await r.json()).results.every(x=>x.status==='saved'));}});
 assert(c.requestFinish(c.reviewFinish()));await c.continueFinish();assert(changed&&pages>=4);assert.equal(c.state.finish.phase,'attention');assert.equal(c.visibleCheck().answers[0].value,'missing');assert.equal(c.visibleCheck().answers[1].value,'have');assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);assert.equal(JSON.parse(c.state.snapshot.sync.cursor).after,s.db.prepare('SELECT max(rowid) n FROM kitchen_activity').get().n);
});
await scenario('partial pages cannot stamp verification or finish; bounded live horizon retains cursor',async s=>{
 const c=await s.client();await s.fill(c);const before=c.state.lastVerifiedAt;let pages=0;
 const normal=s.request(s.users[0]);c.request=async(url,init)=>{
  const r=await normal(url,init);if(url.includes('/sync?')){
   pages++;
   // At least one new page per response keeps the backlog genuinely live.
   // These are actual accepted batches, not fabricated cursor metadata.
   await identities.run(s.users[1],async()=>{let {revision,value}=s.db.prepare("SELECT revision,value FROM evening_answers WHERE item_id='item-2'").get();for(let start=0;start<128;start+=20){const commands=[];for(let i=0;i<Math.min(20,128-start);i++){value=value==='have'?'missing':'have';commands.push(s.command({kind:'answer',checkId:s.day,itemId:'item-2',revision:revision++,generation:0,value,deviceId:crypto.randomUUID(),sequence:i+1}));}const res=await s.post(s.m.batch,{commands});assert.equal(res.status,200);assert((await res.json()).results.every(x=>x.status==='saved'));}});
  }return r;
 };
 c.subscribe(()=>{if(c.state.snapshot?.sync&&JSON.parse(c.state.snapshot.sync.cursor).through!==null){assert.equal(c.state.needsVerification,true);assert.equal(c.state.lastVerifiedAt,before);}});
 assert.equal(await c.syncVisible(true),false);assert.equal(pages,100);assert(c.state.needsVerification);assert.match(c.state.freshnessError,/More shared changes/);
 const cursor=c.state.snapshot.sync.cursor;assert(JSON.parse(cursor).after>0);c.request=normal;assert(await c.syncVisible(true));assert(!c.state.needsVerification);assert.equal(c.visibleCheck().answers[2].value,s.db.prepare("SELECT value FROM evening_answers WHERE item_id='item-2'").get().value);
});
await scenario('own acknowledged dependencies retain original approval without unnecessary reconfirmation',async s=>{
 const c=await s.client();for(const a of c.visibleCheck().answers)assert(c.answer(a.itemId,'missing'));
 const approved=c.reviewFinish();assert(c.requestFinish(approved));await c.continueFinish();assert.equal(c.state.finish.phase,'complete');assert.equal(s.db.prepare('SELECT count(*) n FROM morning_tasks WHERE cancelled=0').get().n,80);
});
await scenario('post-verification peer change is rejected by authoritative Confirm CAS',async s=>{
 let changed=false;const c=await s.client({wrap:r=>async(url,init)=>{if(init?.method==='POST'&&JSON.parse(init.body).kind==='confirm'&&!changed){changed=true;await s.answer(s.users[1],'item-0','missing');}return r(url,init);}});
 await s.fill(c);assert(c.requestFinish(c.reviewFinish()));await c.continueFinish();assert(changed);assert.equal(c.state.finish.phase,'attention');assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);
});
await scenario('missing or mismatched terminal proof uses one consistent full-read fallback',async s=>{
 for(const corrupt of [false,true]){
  let full=0,peer=false;const c=await s.client({wrap:r=>async(url,init)=>{if(url.startsWith('/api/evening?'))full++;const reply=await r(url,init);if(url.includes('/sync?')&&!reply.body.more){if(corrupt)reply.body.verifiedThrough=-1;else delete reply.body.verifiedThrough;if(!peer){peer=true;await s.answer(s.users[1],'item-3',corrupt?'have':'missing');}}return reply;}});
  const initial=full;assert(await c.syncVisible(true));assert.equal(full,initial+1);assert.equal(c.visibleCheck().answers[3].value,corrupt?'have':'missing');assert.equal(c.state.needsVerification,false);c.dispose();
 }
});
await scenario('failure during fallback retains unverified state until retry; auth rejection preserves work',async s=>{
 const c=await s.client();await s.fill(c);let fallback=false;const normal=s.request(s.users[0]);c.request=async(url,init)=>{if(url.startsWith('/api/evening?')&&fallback)throw Error('Synthetic fallback timeout');const r=await normal(url,init);if(url.includes('/sync?')){delete r.body.verifiedThrough;fallback=true;}return r;};
 assert.equal(await c.syncVisible(true),false);assert(c.state.needsVerification);assert.match(c.state.freshnessError,/timeout/);c.request=normal;assert(await c.retry());assert(!c.state.needsVerification);
 s.db.prepare("UPDATE kitchen_team SET access_enabled=0 WHERE user_id='owner'").run();assert.equal(await c.syncVisible(true),false);assert(c.state.unauthorized);assert.equal(c.answer('item-3','missing'),false);s.db.prepare("UPDATE kitchen_team SET access_enabled=1 WHERE user_id='owner'").run();assert(await c.retry());
});
await scenario('old scope response and disposal cannot complete newer verification',async s=>{
 let release,entered;const ready=new Promise(r=>entered=r);const c=await s.client({wrap:r=>async(url,init)=>{const reply=await r(url,init);if(url.includes('/sync?')){entered();await new Promise(done=>release=done);}return reply;}});
 const pending=c.syncVisible(true);await ready;assert(await c.refresh({day:'2026-09-25'}));release();assert.equal(await pending,false);assert.equal(c.state.snapshot.check,null);assert.equal(c.state.loadedSelection,'day=2026-09-25');
 const dying=await s.client();dying.dispose();assert.equal(await dying.syncVisible(true),false);
});
await scenario('metadata reset reloads complete data; legacy transport preserves Finish and Ready',async s=>{
 const c=await s.client();s.db.prepare("UPDATE notebooks SET revision=revision+1 WHERE id='kitchen'").run();assert(await c.syncVisible(true));assert.equal(c.state.snapshot.notebookRevision,2);assert(!c.state.needsVerification);
 const legacy=await s.client({fast:false});for(const a of legacy.visibleCheck().answers)assert(legacy.answer(a.itemId,'missing'));assert(await legacy.flush());assert(legacy.requestFinish(legacy.reviewFinish()));await legacy.continueFinish();assert.equal(legacy.state.finish.phase,'complete');assert(legacy.ready('item-0',true));assert(await legacy.flush());await s.idle(legacy);assert.equal(legacy.visibleCheck().tasks[0].ready,true);
});
await scenario('three scoped cooks share a multi-page backlog; simultaneous Finish publishes once',async s=>{
 const clients=await Promise.all(s.users.map(user=>s.client({user})));for(let i=0;i<80;i++)assert(clients[i%3].answer('item-'+i,i%5?'have':'missing'));assert((await Promise.all(clients.map(c=>c.flush()))).every(Boolean));
 for(let i=0;i<60;i++){const c=clients[i%3];await c.refreshVisible();assert(c.answer('item-1',i%2?'have':'missing'));assert(await c.flush());}
 await Promise.all(clients.map(c=>c.syncVisible(true)));const approvals=clients.map(c=>c.reviewFinish());clients.forEach((c,i)=>assert(c.requestFinish(approvals[i])));await Promise.all(clients.map(c=>c.continueFinish()));
 assert.equal(clients.filter(c=>c.state.finish.phase==='complete').length,1);assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
 const rows=s.db.prepare("SELECT updated_by FROM evening_answers WHERE item_id!='item-1'").all();assert(rows.every(r=>s.users.some(u=>u.email===r.updated_by)));
});
if(compatibility){
 await scenario('unchanged v71 client / repaired server: Finish boundary',s=>finishBoundary(s,compatibility));
 await scenario('unchanged v71 client / repaired server: Morning Undo boundary',s=>morningBoundary(s,compatibility));
 // Actual archived v71 server routes, not a fabricated pagination algorithm.
 const legacyRequest=(s,u)=>(url,init)=>identities.run(u,async()=>{
  const parsed=new URL(url,'http://test.local'),api=parsed.pathname.endsWith('/sync')?compatibility.sync:parsed.pathname.endsWith('/batch')?compatibility.batch:compatibility.api;
  const res=init?.method==='POST'?await s.post(api,JSON.parse(init.body),init):await api.GET(new Request(parsed,{headers:{'X-Labula-Stations':'4'}}));return {res,body:await res.json()};
 });
 for(const morning of [false,true])await scenario('new client / actual v71 server: '+(morning?'Morning Undo':'Finish changed answer'),async s=>{
  if(morning)await s.publish();let changed=false,full=0;const raw=legacyRequest(s,s.users[0]);const c=await s.client({selection:morning?{morningDay:s.targetDay}:{day:s.day},wrap:()=>async(url,init)=>{if(url.startsWith('/api/evening?'))full++;const r=await raw(url,init);if(url.includes('/sync?')&&r.body.more&&!changed){changed=true;if(morning)await s.undo(s.users[1]);else await s.answer(s.users[1],'item-0','missing');}return r;}});
  if(morning){for(let i=0;i<20;i++)assert(c.ready('item-'+i,true));for(let i=0;i<112;i++)assert(c.ready('item-1',i%2===1));assert(await c.flush());await s.idle(c);assert.equal(s.m.morningProgress(c.state).remaining,1);assert.equal(s.m.morningProgress(c.state).complete,false);}
  else{await s.fill(c);assert(c.requestFinish(c.reviewFinish()));await c.continueFinish();assert.equal(c.state.finish.phase,'attention');assert.equal(s.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);}
  assert(changed&&full>=2);
 });
}
console.log(JSON.stringify({pass:true,scenarios:results,archivedV71Compatibility:!!compatibility}));
