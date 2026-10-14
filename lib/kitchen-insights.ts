import {appliedProductionItems,productionExcluded,type AppliedRecord} from './review-v2/applied';
import {directUsage} from './direct-usage';
import {normalizeName,type Item,type Notebook,type ProductionProcess} from './notebook';
import {processForItem} from './production';
import {approvedProduction} from './approved-production';
import {batchCompletion,type BatchProfile} from './batch-profile';
import {optionLabel,startOptions,type PrepTime,type StorageSetup} from './prep-profile';

export type Cadence='service'|'day'|'week'|'order'|'supplied'|'unknown'|'scope';
export type InsightRow={item:Item;dishes:{id:string;name:string}[];scopeReview:boolean;productionHeld?:boolean;reviewed?:boolean;cadence:Cadence;frequencyConflict:boolean;batch:BatchProfile|undefined;process?:ProductionProcess;workRepresentative?:boolean};
export const summaryStorageModes=['frozen','chilled','dry','immediate','unknown'] as const;
export type SummaryStorageMode=(typeof summaryStorageModes)[number];
const positive=(n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export const numberText=(n:number)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(n);

/** Read-only projection. Menu activation and source answers are never rewritten. */
export function kitchenInsights(n:Notebook,reviewed:AppliedRecord[]=[],protectedIds?:string[]) :InsightRow[]{
 const usage=directUsage(n),replaced=new Set([...appliedProductionItems(reviewed),...approvedProduction(n,reviewed).held]);
 return n.items.filter(i=>usage.itemDishes.has(i.id)).map(item=>{
  const p=item.prepProfile,process=processForItem(n,item.id),productionHeld=productionExcluded(n,item.id,protectedIds),wasReviewed=replaced.has(item.id)||!!process?.sourceReviewId,batch=productionHeld||wasReviewed||process?undefined:p.batch;
  // A mention is a conservative review flag, not proof that an item belongs to one location.
  const scopeReview=productionHeld||/\bmanifesto\b/i.test([p.note,p.batch?.note,item.method,item.specification].join(' '));
  const fortnight=/once\s+(?:(?:in|every|per)\s+)?(?:2|two)\s+weeks|every\s+(?:2|two)\s+weeks|fortnight/i.test(batch?.note??'');
  const frequencyConflict=!!batch&&!batch.frequency.unknown&&batch.frequency.period==='week'&&fortnight&&batch.frequency.times!==0.5;
  const cadence:Cadence=productionHeld?'scope':wasReviewed?'unknown':scopeReview?'scope':process?process.batchesPerWeek!==null?'week':'unknown':p.workflow==='supplied'?'supplied':p.workflow==='order'?'order':frequencyConflict?'unknown':batch&&!batch.frequency.unknown&&positive(batch.frequency.times)&&batch.frequency.period?batch.frequency.period:p.frequency==='daily'||p.frequency==='several'?'day':'unknown';
  return {item,batch,process,workRepresentative:!process||process.outputs.find(o=>usage.itemDishes.has(o.itemId))?.itemId===item.id,productionHeld,reviewed:wasReviewed,scopeReview,frequencyConflict,cadence,dishes:usage.dishes.filter(d=>usage.itemDishes.get(item.id)!.has(d.id)).map(d=>({id:d.id,name:d.name}))};
 }).sort((a,b)=>b.dishes.length-a.dishes.length||a.item.name.localeCompare(b.item.name,'en')||a.item.id.localeCompare(b.item.id));
}
export function matchesInsight(row:InsightRow,query:string,kind:string){return (kind==='all'||row.item.kind===kind)&&normalizeName([row.item.name,...row.item.aliases,...row.dishes.map(d=>d.name)].join(' ')).includes(normalizeName(query));}
/** A preparation can have more than one setup, but only contributes once to a selected storage group. */
export function matchesStorageMode(row:InsightRow,mode:SummaryStorageMode|'all'){
 if(mode==='all')return true;
 const setups=row.item.prepProfile.storage;
 if(mode==='unknown')return !setups.length||setups.some(s=>!s.mode||s.mode==='unknown'||s.mode==='other');
 return setups.some(s=>s.mode===mode);
}
/** Stable direct-menu-use ordering used by both summary previews and detailed lists. */
export function compareInsightRows(a:InsightRow,b:InsightRow){return b.dishes.length-a.dishes.length||a.item.name.localeCompare(b.item.name,'en')||a.item.id.localeCompare(b.item.id);}
export function storageRows(rows:InsightRow[],mode:SummaryStorageMode|'all'){return rows.filter(r=>matchesStorageMode(r,mode)).sort(compareInsightRows);}
export function repeatedWorkRows(rows:InsightRow[]){return rows.filter(r=>r.item.prepProfile.issues.includes('repeat')).sort(compareInsightRows);}
export function outputText(r:InsightRow){
 if(r.productionHeld)return 'Production outside review';if(r.reviewed)return 'See approved process samples';
 if(r.scopeReview)return 'Labula amount not separated';
 if(r.process){const o=r.process.outputs.find(o=>o.itemId===r.item.id);return o?.amount!=null?`${numberText(o.amount)} ${r.item.unit} · current task`:'Current task output not known';}
 if(!batchCompletion(r.item.prepProfile).applicable)return 'No advance batch';
 const o=r.batch?.output;if(!o||o.unknown||!positive(o.amount)||!o.unit)return 'Not known';
 return o.unit==='other'?`${numberText(o.amount)} · unit entered: “${o.unitOther.trim()}”`:`${numberText(o.amount)} ${o.unit}`;
}
export function frequencyText(r:InsightRow){
 if(r.productionHeld)return 'Production outside review';if(r.reviewed)return 'See approved routine records';if(r.cadence==='supplied')return 'Use as supplied';if(r.cadence==='order')return 'Prepare to order';
 if(r.scopeReview)return 'Labula routine not separated';
 if(r.process)return r.process.batchesPerWeek!==null?`${numberText(r.process.batchesPerWeek)} batches / typical week · current task`:'Current task frequency not known';
 if(r.frequencyConflict)return 'Frequency needs clarification';
 const f=r.batch?.frequency;
 if(f&&!f.unknown&&positive(f.times)&&f.period)return `${numberText(f.times)} batch${f.times===1?'':'es'} / ${f.period==='day'?'operating day':f.period==='week'?'typical week':'service'}`;
 const p=r.item.prepProfile;return p.frequency==='daily'?'Once a day · earlier estimate':p.frequency==='several'?'Several times a day · earlier estimate':p.frequency==='less'?'Less than daily · exact frequency unknown':'Frequency not known';
}
export function workMinutes(r:InsightRow,period:'batch'|'day'|'week'|'service'){
 if(r.process){if(r.productionHeld||r.reviewed||r.scopeReview||!r.workRepresentative||r.process.activeMinutes===null)return null;return period==='batch'?r.process.activeMinutes:period==='week'&&r.process.batchesPerWeek!==null?r.process.activeMinutes*r.process.batchesPerWeek:null;}
 if(r.productionHeld||r.reviewed||r.scopeReview||!batchCompletion(r.item.prepProfile).applicable||!r.batch||r.batch.work.unknown||!positive(r.batch.work.minutes))return null;
 if(period==='batch')return r.batch.work.minutes;
 const f=r.batch.frequency;if(r.frequencyConflict||f.unknown||f.period!==period||!positive(f.times))return null;
 return r.batch.work.minutes*f.times;
}
export function scheduleText(r:InsightRow){if(r.productionHeld)return 'Production outside review';if(r.reviewed)return 'See approved routine records';if(r.scopeReview)return 'Routine needs separating';if(r.process)return 'Current production task · '+(r.workRepresentative?'shared work counted once':'work counted with another output');return ({planned:'Mostly planned',mixed:'Planned + unexpected top-ups',unplanned:'Mostly unexpected top-ups',unknown:'Not known'} as Record<string,string>)[r.batch?.schedule??'']??'Not answered';}
export function timeText(t:PrepTime){if(t.unknown||!positive(t.value))return 'Not known';return `${numberText(t.value)} ${t.unit} · from ${t.start==='other'?t.startOther:optionLabel(startOptions,t.start).toLowerCase()}`;}
export function storageChecks(s:StorageSetup){const checks:string[]=[];
 if(s.mode==='frozen'&&(s.states.includes('thawed')||s.states.includes('raw')&&s.states.includes('cooked')))checks.push('Clarify which storage stage this describes');
 if(s.mode==='frozen'&&!s.temperatureUnknown&&s.temperature!==null&&s.temperature>-10)checks.push('Confirm the entered temperature and storage stage');
 if(s.mode==='dry'&&s.states.includes('cooked'))checks.push('Clarify storage of the cooked product');
 if(s.mode!=='immediate'&&(s.source==='experience'||s.source==='unknown'||!s.source))checks.push('No documented storage rule recorded');
 return checks;
}
export const serviceIssues=['runout','replenish','equipment','cook'] as const;
export function reportedServiceIssues(r:InsightRow){return r.item.prepProfile.issues.filter(i=>serviceIssues.some(k=>k===i));}
