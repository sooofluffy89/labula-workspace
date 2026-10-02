import assert from 'node:assert/strict';
import {harness,sleep} from './sync-harness.mjs';
const until=async(fn)=>{for(let i=0;i<3000;i++){if(fn())return;await sleep(2);}throw Error('Timed out waiting for actual Finish');};
const clients=[];
async function setup(options={}){
 const h=await harness(options),store=h.storage();
 const c=new h.m.EveningController(h.owner.email,store,{day:h.day},h.requester);clients.push(c);await c.refresh();
 for(const a of c.visibleCheck().answers)c.answer(a.itemId,a.itemId==='item-0'?'missing':'have');
 return {h,c,store};
}
{
 const {h,c,store}=await setup({httpDelay:20});
 try{
  const t=performance.now(),summary=c.reviewFinish();assert(summary);assert(performance.now()-t<20,'summary does not wait for slow writes');
  assert.equal(summary.check.answers.filter(a=>a.value!==null).length,80);
  assert(c.requestFinish(summary));const id=c.state.finish.id;
  assert(store.records.has('labula-finish-v1:owner:'+id),'approval is durable before return');
  assert.equal(c.requestFinish(summary),false,'double click cannot replace approval');
  assert.equal(c.answer('item-1','missing'),false,'handlers guard the approved content');
  c.cancelNavigation();c.endFinish();h.m.releaseEveningController(h.owner.email,c);assert(c.finishActive(),'unmount does not cancel Finish');
  await until(()=>c.state.finish?.phase==='complete');
  assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
  assert.equal(c.state.finish.receipt.checkId,h.day);assert.equal(c.state.finish.receipt.targetDay,h.targetDay);
  const persisted=JSON.parse(store.getItem('labula-finish-v1:owner:'+id));assert.equal(persisted.phase,'complete');
  const peer=new h.m.EveningController(h.cook.email,h.storage(),{morningDay:h.targetDay},h.requester);clients.push(peer);globalThis.syncUser=h.cook;await peer.refresh();assert.equal(peer.visibleCheck().tasks.length,1,'another cook reads the committed actual plan');
  assert.equal(peer.visibleCheck().tasks[0].ready,false,'publication is not all Ready');
 }finally{c.dispose();h.db.close();}
}
{
 const {h,c,store}=await setup();
 try{
  await c.flush();let offline=true,loseAck=true;
  const requester=async(url,init)=>{if(offline)throw Error('Synthetic offline');const r=await h.requester(url,init);if(loseAck&&init?.method==='POST'&&JSON.parse(init.body).kind==='confirm'){loseAck=false;throw Error('Synthetic lost ACK after commit');}return r;};
  c.dispose();const r=new h.m.EveningController(h.owner.email,store,{day:h.day},requester);clients.push(r);offline=false;await r.refresh();offline=true;assert(r.requestFinish(r.reviewFinish()));await r.continueFinish();assert.equal(r.state.finish.phase,'offline');assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0);
  offline=false;await r.retry();assert.equal(r.state.finish.phase,'offline');const original=r.state.finish.command.id;
  assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1,'server commit precedes lost reply');
  await r.retry();assert.equal(r.state.finish.phase,'complete');assert.equal(r.state.finish.id,original);
  assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1,'uncertain original request is replayed once');
  r.dispose();const reload=new h.m.EveningController(h.owner.email,store,{day:h.day},requester);clients.push(reload);await reload.refresh();assert.equal(reload.state.finish.phase,'complete');assert.equal(reload.state.pending.length,0);
 }finally{h.db.close();}
}
{
 const {h,c}=await setup();
 try{
  await c.flush();const summary=c.reviewFinish();
  await h.send({kind:'answer',checkId:h.day,itemId:'item-1',revision:c.visibleCheck().answers[1].revision,generation:0,value:'missing',deviceId:crypto.randomUUID(),sequence:1});
  assert(c.requestFinish(summary));await c.continueFinish();assert.equal(c.state.finish.phase,'attention');assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,0,'changed content is never automatically approved');
  const changes=h.m.finishChanges(c.state.finish,c.state.snapshot);assert.equal(changes[0].mine,'No action needed');assert.equal(changes[0].shared,'Preparation / restocking needed');assert(changes[0].by);assert(changes[0].at);
  const old=c.state.finish.id;assert(c.requestFinish(c.reviewFinish()));await c.continueFinish();assert.equal(c.state.finish.phase,'complete');assert.equal(c.state.finish.supersedes,old);
  assert.equal(h.db.prepare('SELECT count(*) n FROM morning_tasks WHERE cancelled=0').get().n,2);
 }finally{c.dispose();h.db.close();}
}
{
 const {h,c}=await setup();
 try{
  await c.flush();
  const as=user=>async(url,init)=>{globalThis.syncUser=user;return h.requester(url,init);};
  const owner=new h.m.EveningController(h.owner.email,h.storage(),{day:h.day},as(h.owner));
  const cook=new h.m.EveningController(h.cook.email,h.storage(),{day:h.day},as(h.cook));clients.push(owner,cook);await owner.refresh();await cook.refresh();
  assert(owner.requestFinish(owner.reviewFinish()));assert(cook.requestFinish(cook.reviewFinish()));await Promise.all([owner.continueFinish(),cook.continueFinish()]);
  assert.equal([owner,cook].filter(x=>x.state.finish.phase==='complete').length,1);
  assert.equal([owner,cook].filter(x=>x.state.finish.phase==='attention').length,1);
  assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1,'simultaneous Finish is atomic across two authors');
  const winner=[owner,cook].find(x=>x.state.finish.phase==='complete');globalThis.syncUser=winner===owner?h.owner:h.cook;
  await h.send({kind:'ready',checkId:h.day,itemId:'item-0',revision:0,value:true});
  const fresh=await h.send({kind:'correct',checkId:h.day,revision:winner.visibleCheck().revision,planRevision:winner.visibleCheck().planRevision+1});
  await winner.refresh();const summary=winner.reviewFinish();assert(summary.check.tasks[0].ready);
  await h.send({kind:'ready',checkId:h.day,itemId:'item-0',revision:fresh.check.tasks[0].revision,value:false});
  assert(winner.requestFinish(summary));await winner.continueFinish();assert.equal(winner.state.finish.phase,'attention','a changed existing Ready is approval relevant');
  assert.equal(h.db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
 }finally{for(const x of clients)x.dispose();h.db.close();}
}
for(const c of clients)c.dispose();
console.log('PASS actual controller → API → SQLite: immediate local summary, durable last approval, double click, handler guard, unmount, two cooks, offline, post-commit lost ACK/replay, reload, content conflict and explicitly superseding approval.');
