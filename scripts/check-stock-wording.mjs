import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/labula-wording-');
try{
 await build({stdin:{contents:`export * from './lib/stock-wording';export * from './lib/activity';export * from './lib/evening';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:dir+'/test.mjs',logLevel:'silent'});
 const m=await import(dir+'/test.mjs');
 const tomorrow=m.shiftDay(m.calendarDay(new Date('2026-09-24T21:59:00Z')),1);
 assert.deepEqual(m.morningChoice('2026-09-25',tomorrow),{label:'For tomorrow',column:'To do'});
 for(const target of ['2026-09-26','2026-09-23','2027-09-25']){
  const choice=m.morningChoice(target,tomorrow);assert.equal(choice.column,'To do');assert.ok(!/tomorrow/i.test(choice.label));assert.ok(choice.label.includes(target.slice(0,4)));
 }
 // Calendar midnight in Prague must not keep calling today's target tomorrow.
 assert.equal(m.morningChoice('2026-09-25',m.shiftDay(m.calendarDay(new Date('2026-09-24T22:01:00Z')),1)).label,'For 25 Sept 2026');
 for(const [value,label,history,activity] of [
  ['have','No action needed','No morning task selected','Not selected for Morning prep'],
  ['missing','For tomorrow','For Morning prep','Selected for Morning prep'],
  [null,'Unchecked','Unchecked','Returned to Unchecked']]){
  const event={category:'evening',action:'answer',after_value:JSON.stringify({value}),actor_name:'Historical cook',recorded_at:'2026-09-23T20:00:00Z'};
  const before=JSON.stringify(event);assert.equal(m.stockAnswerLabel(value,'For tomorrow'),label);assert.equal(m.historicalAnswerLabel(value),history);assert.equal(m.activityLabel(event),activity);assert.equal(JSON.stringify(event),before);
  assert.equal(m.csvCell(event.after_value),'"'+event.after_value.replaceAll('"','""')+'"');
  const legacy={id:crypto.randomUUID(),scope:'kitchen',actorId:'historical-cook',kind:'answer',checkId:'2026-09-23',itemId:crypto.randomUUID(),revision:0,generation:0,value,deviceId:crypto.randomUUID(),sequence:1};
  assert.deepEqual(m.eveningCommandSchema.parse(legacy),legacy);
 }
 assert.equal(m.activityLabel({category:'evening',action:'merge',after_value:'{"value":"missing"}'}),'Catalog merge affected stock');
 console.log('PASS stock wording: calendar dates, unchecked, historical meaning, unchanged legacy payload and CSV values.');
}finally{await rm(dir,{recursive:true,force:true});}
