import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness,sleep} from './sync-harness.mjs';
const results=[],interval=2500;
for(const withComment of (process.env.PREP_NOTES_BASELINE?[false]:[false,true]))for(const scenario of ['80 answers + Finish','30 Ready'])for(let run=1;run<=3;run++){
 const h=await harness({httpDelay:60,sqlDelay:2});
 const c=new h.m.EveningController(h.owner.email,h.storage(),{day:h.day},h.requester);
 const notes=h.m.PrepNotesController?new h.m.PrepNotesController(h.owner.email,h.storage(),h.requester):null;if(notes)await notes.initialize();
 if(scenario==='30 Ready'){
  h.db.prepare("UPDATE evening_answers SET value='missing',revision=1").run();h.db.prepare('UPDATE evening_checks SET revision=80').run();await c.refresh();const s=await c.summary();assert(s);await c.action(h.command({kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision}));c.endFinish();
 }else await c.refresh();
 const peer=new h.m.EveningController(h.owner.email,h.storage(),{morningDay:h.targetDay},h.requester);await peer.refresh();h.reset();const start=performance.now(),taps=[];let noteId=null;
 if(withComment){const t=performance.now();assert.ok(notes.enqueue({kind:'feedback',text:'SYNTHETIC benchmark comment',context:{checkId:h.day,itemId:'item-0',catalogId:'item-0',version:scenario==='30 Ready'?1:0,instructionRevision:0,phase:scenario==='30 Ready'?'morning':'evening'}}));taps.push(performance.now()-t);noteId=notes.state.pending[0].command.id;}
 for(let i=0;i<(scenario==='30 Ready'?30:80);i++){const t=performance.now();assert.ok(scenario==='30 Ready'?c.ready('item-'+i,true):c.answer('item-'+i,'missing'));taps.push(performance.now()-t);}
 const lastTap=performance.now();let finishSummaryMs=null,confirmMs=null;
 if(scenario==='80 answers + Finish'){
  if(notes)assert.ok(await notes.prepareFinish(h.day,h.owner.userId,true));const s=await c.summary();assert(s);finishSummaryMs=performance.now()-lastTap;const t=performance.now();assert.ok(await c.action(h.command({kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision})));confirmMs=performance.now()-t;c.endFinish();
 }else{assert.ok(await c.flush());if(notes)assert.ok(await notes.flush());}
 const acknowledgedAt=performance.now(),writes={http:h.metrics.http,bytes:h.metrics.bytes,sqlTrips:h.metrics.trips},commits=[...h.metrics.commits],firstCommit=commits[0].at,lastCommit=commits.at(-1).at;
 await sleep(Math.max(0,interval-(performance.now()-start)));assert.ok(await peer.refreshVisible());const visibleAt=performance.now();assert.equal(peer.visibleCheck()?.tasks.length,80);if(scenario==='30 Ready')assert.equal(peer.visibleCheck()?.tasks.filter(t=>t.ready).length,30);assert.equal(peer.visibleCheck()?.tasks.find(t=>t.itemId==='item-0').feedbackCount??0,withComment?1:0);
 let commentReadMs=null;if(withComment){const t=performance.now();const x={checkId:h.day,itemId:'item-0',catalogId:'item-0',version:1,instructionRevision:0,phase:'morning'};const r=await h.requester('/api/prep-notes?context='+encodeURIComponent(JSON.stringify(x)));assert(r.body.comments.some(c=>c.id===noteId));commentReadMs=performance.now()-t;}
 results.push({scenario,withComment,run,httpDelayMs:60,sqlDelayMs:2,peerPollIntervalMs:interval,localMaxMs:Math.max(...taps),firstServerCommitMs:firstCommit-start,lastServerCommitMs:lastCommit-start,noteServerCommitMs:noteId?commits.find(c=>c.ids.includes(noteId)).at-start:null,allAcknowledgedMs:acknowledgedAt-start,finishSummaryMs,confirmMs,lastCommitToPeerMs:visibleAt-lastCommit,actionToPeerMs:visibleAt-start,commentReadMs,writes,totalWithPeer:{http:h.metrics.http,bytes:h.metrics.bytes,sqlTrips:h.metrics.trips}});
 c.dispose();notes?.dispose();peer.dispose();h.db.close();
}
await writeFile(process.env.PREP_NOTES_BENCH_OUT??'/private/tmp/labula-prep-notes-benchmark.json',JSON.stringify({environment:'Actual controllers, route handlers and in-memory SQLite transactions. Synthetic 60 ms HTTP RTT, 2 ms SQL RTT. Second client polls at 2500 ms from burst start. Timings include committed writes, not only local UI. No production writes.',results},null,2));console.log(JSON.stringify(results));
