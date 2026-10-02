import {writeFile} from 'node:fs/promises';
import {harness} from './sync-harness.mjs';
// Explicit invocation only: this measurement writes exclusively to in-memory SQLite.
const [baselineFile,output]=process.argv.slice(2);if(!baselineFile||!output)throw Error('Provide the bundled baseline controller and output JSON path.');
const baseline=await import(baselineFile),results=[];
for(const slow of [false,true])for(const fullQueue of [false,true])for(const version of ['v60','background'])for(let run=0;run<3;run++){
 const h=await harness({httpDelay:slow?500:20,sqlDelay:slow?5:0});
 const Controller=version==='v60'?baseline.EveningController:h.m.EveningController;
 const c=new Controller(h.owner.email,h.storage(),{day:h.day},h.requester);
 try{
  await c.refresh();
  const peer=new h.m.EveningController(h.owner.email,h.storage(),{morningDay:h.targetDay},h.requester);await peer.refresh();
  if(!fullQueue){for(const a of c.visibleCheck().answers)c.answer(a.itemId,a.itemId==='item-0'?'missing':'have');await c.flush();}
  h.reset();
  if(fullQueue)for(const a of c.visibleCheck().answers)c.answer(a.itemId,a.itemId==='item-0'?'missing':'have');
  const clicked=performance.now();const summary=version==='v60'?await c.summary():c.reviewFinish();const summaryMs=performance.now()-clicked;
  const final=performance.now();let id,acceptedMs;
  if(version==='v60'){id=crypto.randomUUID();acceptedMs=null;await c.action({id,scope:'kitchen',actorId:h.owner.userId,kind:'confirm',checkId:h.day,revision:summary.check.revision,planRevision:summary.check.planRevision,notebookRevision:summary.notebookRevision});c.endFinish();}
  else{if(!c.requestFinish(summary))throw Error(c.state.notice);id=c.state.finish.id;acceptedMs=performance.now()-final;await c.continueFinish();if(c.state.finish.phase!=='complete')throw Error(c.state.finish.reason);}
  const receivedMs=performance.now()-final,commit=h.metrics.commits.find(x=>x.ids.includes(id));
  const publicationMetrics=structuredClone(h.metrics);
  await peer.syncVisible(true);const shown=performance.now();if(peer.visibleCheck()?.tasks.length!==1)throw Error('Peer did not receive committed plan');
  results.push({version,slow,fullQueue,run,summaryMs,acceptedMs,receivedMs,commitMs:commit.at-final,peerMs:shown-commit.at,http:publicationMetrics.http,bytes:publicationMetrics.bytes,trips:publicationMetrics.trips,requests:publicationMetrics.requests});
  console.log(JSON.stringify(results.at(-1)));peer.dispose();
 }finally{c.dispose();h.db.close();}
}
await writeFile(output,JSON.stringify({conditions:{rows:80,runs:3,httpDelayMs:[20,500],sqlDelayMs:[0,5],database:'actual routes on in-memory SQLite with D1 adapter; artificial per-request/round-trip delay; no production network claim'},results},null,2));
