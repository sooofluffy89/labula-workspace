import assert from 'node:assert/strict';import {harness,sleep} from './sync-harness.mjs';import {writeFile} from 'node:fs/promises';
const rows=[],nativeTimeout=globalThis.setTimeout;
for(const phase of ['before','after'])for(const delay of [60,800])for(let run=1;run<=3;run++){
 const h=await harness({httpDelay:delay,sqlDelay:delay===60?2:20,bundlePath:phase==='before'?process.env.SYNC_BASELINE:undefined});const clients=[];
 try{
  let offline=true;const c=new h.m.EveningController(h.owner.email,h.storage(),{day:h.day},async(url,init)=>{if(offline&&init?.method==='POST')throw Error('Synthetic offline');return h.requester(url,init);});clients.push(c);await c.refresh();
  globalThis.setTimeout=(fn,ms,...args)=>nativeTimeout(fn,[2000,4000,8000].includes(ms)?10:ms,...args);
  for(let i=0;i<80;i++)c.answer('item-'+i,'missing');await c.flush();
  for(let i=0;i<10000&&(c.retryTimer||c.state.verifying||c.state.saving||c.retryCount<3);i++)await sleep(2);assert.equal(c.retryCount,3);globalThis.setTimeout=nativeTimeout;
  c.recoveryAt=Date.now()-15001;offline=false;const restoredAt=performance.now();await c.refreshVisible();for(let i=0;i<10000&&(c.state.saving||c.state.verifying);i++)await sleep(2);
  const automaticRecoveryMs=c.state.pending.length?null:performance.now()-restoredAt;const unresolved=c.state.pending.length;if(unresolved)assert.ok(await c.retry());
  const s=await c.summary();assert(s);c.endFinish();let hold=false,go;
  c.request=async(url,init)=>{const r=await h.requester(url,init);if(hold&&url.includes('/sync?')){hold=false;await new Promise(done=>go=done);}return r;};hold=true;const poll=c.refreshVisible();for(let i=0;!go&&i<1000;i++)await sleep(2);assert(go);
  const start=performance.now();const finish=c.summary();nativeTimeout(go,100);const fresh=await finish;const compatibleFinishMs=performance.now()-start;await poll;assert(fresh);const t=performance.now();assert.ok(await c.action(h.command({kind:'confirm',checkId:h.day,revision:fresh.check.revision,planRevision:fresh.check.planRevision,notebookRevision:fresh.notebookRevision})));const ack=performance.now()-t;while(c.state.publicationLoading)await sleep(2);const usable=performance.now()-t;c.endFinish();
  const other=new h.m.EveningController(h.cook.email,h.storage(),{day:h.day},async(url,init)=>{const prior=globalThis.syncUser;globalThis.syncUser=h.cook;try{return await h.requester(url,init);}finally{globalThis.syncUser=prior;}});clients.push(other);await other.refresh();
  h.reset();for(let i=0;i<30;i++)assert.ok(c.ready('item-'+i,true));assert.ok(await c.flush());await other.refreshVisible();const deliveryMs=performance.now()-h.metrics.commits.at(-1).at;assert.equal(other.visibleCheck().tasks.filter(t=>t.ready).length,30);
  rows.push({phase,httpDelay:delay,sqlDelay:delay===60?2:20,run,automaticRecoveryMs,unresolvedAfterSuccessfulRead:unresolved,compatibleFinishMs,confirmAckMs:ack,morningUsableMs:usable,commitToOtherClientMs:deliveryMs});console.log(JSON.stringify(rows.at(-1)));
 }finally{globalThis.setTimeout=nativeTimeout;for(const c of clients)c.dispose();await sleep(10);h.db.close();}
}
await writeFile(process.env.SYNC_OUT,JSON.stringify({environment:'Synthetic real controller/API/SQLite; recovery timer series accelerated to 10ms, 15s recovery cooldown elapsed explicitly; compatible poll held 100ms; second client read immediately after commit (poll scheduling excluded)',rows},null,2));
