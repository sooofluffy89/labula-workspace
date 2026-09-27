import {harness,sleep} from './sync-harness.mjs';
import {writeFile,copyFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const out=process.env.SYNC_OUT??'/private/tmp/labula-sync-benchmark.json';
const httpDelay=Number(process.env.SYNC_HTTP_MS??60),sqlDelay=Number(process.env.SYNC_SQL_MS??2),runs=Number(process.env.SYNC_RUNS??5),results=[];
for(const scenario of (process.env.SYNC_SATURDAY?['Saturday: 40 daily + 20 twice-weekly + 20 weekly']:['80 answers and Finish','30 Ready']))for(let run=0;run<runs;run++){
 const h=await harness({httpDelay,sqlDelay,saturday:!!process.env.SYNC_SATURDAY,bundlePath:process.env.SYNC_BUNDLE});
 if(process.env.SYNC_KEEP_BUNDLE){await mkdir(process.env.SYNC_KEEP_BUNDLE,{recursive:true});await copyFile(h.bundle,process.env.SYNC_KEEP_BUNDLE+'/baseline.mjs');}
 if(scenario==='30 Ready'){
  h.db.prepare("UPDATE evening_answers SET value='missing',revision=1").run();h.db.prepare('UPDATE evening_checks SET revision=80').run();
  const s=await h.m.api.GET(new Request('http://test.local/api/evening?day='+h.day)).then(r=>r.json());await h.send({kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision});
 }
 const c=new h.m.EveningController(h.owner.email,h.storage(),{day:h.day},h.requester);await c.refresh();h.reset();let drainedAt=null;const unsub=c.subscribe(()=>{if(c.state.pending.length===0&&c.state.saving)drainedAt=performance.now();});const start=performance.now(),taps=[];
 for(let i=0;i<(scenario!=='30 Ready'?80:30);i++){const t=performance.now();assert.ok(scenario!=='30 Ready'?c.answer('item-'+i,i%3?'missing':'have'):c.ready('item-'+i,true));taps.push(performance.now()-t);}
 const lastTap=performance.now();let summaryMs=null,confirmMs=null;
 if(scenario!=='30 Ready'){const s=await c.summary();assert.ok(s?.check);summaryMs=performance.now()-lastTap;const drainedAnswers=drainedAt;const t=performance.now();assert.ok(await c.action(h.command({kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision})));confirmMs=performance.now()-t;drainedAt=drainedAnswers;}else assert.ok(await c.flush());
 const row={scenario,run:run+1,httpDelay,sqlDelay,localMaxMs:Math.max(...taps),lastTapToDrainedMs:drainedAt===null?null:drainedAt-lastTap,finishSummaryMs:summaryMs,confirmMs,totalMs:performance.now()-start,lastTapToReceiptsMs:(h.metrics.receipts.filter(r=>r.kind!=='confirm').at(-1)?.at??lastTap)-lastTap,firstTapToReceiptMs:(h.metrics.receipts[0]?.at??start)-start,http:h.metrics.http,bytes:h.metrics.bytes,sqlTrips:h.metrics.trips,sqlStatements:h.metrics.queries,returnedRows:h.metrics.rows,events:h.db.prepare("SELECT count(*) n FROM kitchen_activity WHERE action=?").get(scenario!=='30 Ready'?'answer':'ready').n};results.push(row);unsub();c.dispose();h.db.close();console.log(JSON.stringify(row));await writeFile(out,JSON.stringify({environment:'Node real SQLite and real API/controller; synthetic HTTP and SQL round-trip delays, not production network',results},null,2));await sleep(1);
}
