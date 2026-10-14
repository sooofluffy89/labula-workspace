import {tmpdir} from 'node:os';
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {harness,sleep} from './sync-harness.mjs';
const results=[],interval=Number(process.env.SYNC_PEER_INTERVAL??2500);
for(const scenario of ['publish to peer','Ready to peer'])for(let run=1;run<=5;run++){
 const h=await harness({httpDelay:60,sqlDelay:2,bundlePath:process.env.SYNC_BUNDLE});
 h.db.prepare("UPDATE evening_answers SET value='missing',revision=1").run();h.db.prepare('UPDATE evening_checks SET revision=80').run();
 const owner=new h.m.EveningController(h.owner.email,h.storage(),{day:h.day},h.requester);await owner.refresh();
 const confirm=async()=>{const s=await owner.summary();assert.ok(s);assert.ok(await owner.action(h.command({kind:'confirm',checkId:h.day,revision:s.check.revision,planRevision:s.check.planRevision,notebookRevision:s.notebookRevision})));owner.endFinish?.();};
 if(scenario==='Ready to peer')await confirm();
 const peer=new h.m.EveningController(h.owner.email,h.storage(),{morningDay:h.targetDay},h.requester);await peer.refresh();h.reset();const start=performance.now();let visibleAt=null;
 const delivered=(async()=>{await sleep(interval);assert.ok(await peer.refreshVisible());visibleAt=performance.now();assert.ok(scenario==='publish to peer'?peer.visibleCheck()?.tasks.length===80:peer.visibleCheck()?.tasks.filter(t=>t.ready).length===30);})();
 if(scenario==='publish to peer')await confirm();else{for(let i=0;i<30;i++)assert.ok(owner.ready('item-'+i,true));assert.ok(await owner.flush());}
 const acknowledgedAt=performance.now();await delivered;const commit=h.metrics.commits.at(-1)?.at;assert.ok(commit);
 results.push({scenario,run,intervalMs:interval,commitToPeerMs:visibleAt-commit,actionToPeerMs:visibleAt-start,acknowledgedMs:acknowledgedAt-start,http:h.metrics.http,bytes:h.metrics.bytes,sqlTrips:h.metrics.trips});owner.dispose();peer.dispose();h.db.close();
}
await writeFile(process.env.SYNC_PEER_OUT??tmpdir()+'/labula-sync-peer.json',JSON.stringify({environment:'Real SQLite/API/controllers; 60 ms synthetic HTTP + 2 ms SQL round trip; configured polling interval; UI painting measured separately in browser',results},null,2));console.log(JSON.stringify(results));
