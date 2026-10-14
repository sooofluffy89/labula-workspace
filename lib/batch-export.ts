import {menuScope} from './menu-scope';
import type {AppliedRecord} from './review-v2/applied';
import {safeCsvCell,type Notebook} from './notebook';
import {directUsage,compareUsage} from './direct-usage';
import {batchCompletion,batchPeriods,batchSchedules} from './batch-profile';
import {optionLabel,workflowOptions} from './prep-profile';

export function exportBatchCsv(n:Notebook,records:AppliedRecord[]=[],scope:'all'|'current'='all'){
 const eligible=menuScope(n,records).menu;
 const usage=directUsage(n),rows:unknown[][]=[['Item ID','Item name','Catalog type','Active dish count (direct use, not consumption)','Workflow','Batch form status','Missing answers','Data basis','Usual finished output','Output unit','Output unknown','Usual batches of this size','Frequency period','Frequency unknown','Hands-on person-minutes per batch','Hands-on time unknown','Scheduling','Note']];
 for(const item of n.items.filter(i=>(scope==='all'||eligible.has(i.id))&&(i.kind==='prep'||i.prepProfile.batch)).sort((a,b)=>compareUsage(usage,a.id,b.id))){
  const p=item.prepProfile,c=batchCompletion(p),b=c.applicable?p.batch:undefined;
  rows.push([item.id,item.name,item.kind,usage.itemDishes.get(item.id)?.size??0,optionLabel(workflowOptions,p.workflow),!c.applicable?'Not applicable':c.complete?c.unknown?'Filled in with unknowns':'Filled in':'Needs answers',c.missing.join('; '),n.processes.some(task=>task.outputs.some(output=>output.itemId===item.id))?'Earlier answer — superseded by current production task':b?'Current routine estimate':'',b?.output.amount,b?.output.unit==='other'?b.output.unitOther:b?.output.unit,b?.output.unknown,b?.frequency.times,b?.frequency.period?optionLabel(batchPeriods,b.frequency.period):'',b?.frequency.unknown,b?.work.minutes,b?.work.unknown,b?.schedule?optionLabel(batchSchedules,b.schedule):'',b?.note]);
 }
 return '\uFEFF'+rows.map((row,index)=>[...row,index===0?'Export scope':scope==='current'?'Current menu':'All items'].map(safeCsvCell).join(',')).join('\r\n');
}
