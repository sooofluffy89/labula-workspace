import {directUsage} from './direct-usage';
import {normalizeName,type Item,type Notebook} from './notebook';
import {batchCompletion,type BatchProfile} from './batch-profile';
import {optionLabel,startOptions,type PrepTime,type StorageSetup} from './prep-profile';

export type Cadence='service'|'day'|'week'|'order'|'supplied'|'unknown'|'scope';
export type InsightRow={item:Item;dishes:{id:string;name:string}[];scopeReview:boolean;cadence:Cadence;frequencyConflict:boolean;batch:BatchProfile|undefined};
const positive=(n:number|null|undefined):n is number=>typeof n==='number'&&Number.isFinite(n)&&n>0;
export const numberText=(n:number)=>new Intl.NumberFormat('en-GB',{maximumFractionDigits:2}).format(n);

/** Read-only projection. Menu activation and source answers are never rewritten. */
export function kitchenInsights(n:Notebook):InsightRow[]{
 const usage=directUsage(n);
 return n.items.filter(i=>usage.itemDishes.has(i.id)).map(item=>{
  const p=item.prepProfile,batch=p.batch;
  // A mention is a conservative review flag, not proof that an item belongs to one location.
  const scopeReview=/\bmanifesto\b/i.test([p.note,batch?.note,item.method,item.specification].join(' '));
  const fortnight=/once\s+(?:(?:in|every|per)\s+)?(?:2|two)\s+weeks|every\s+(?:2|two)\s+weeks|fortnight/i.test(batch?.note??'');
  const frequencyConflict=!!batch&&!batch.frequency.unknown&&batch.frequency.period==='week'&&fortnight&&batch.frequency.times!==0.5;
  const cadence:Cadence=p.workflow==='supplied'?'supplied':p.workflow==='order'?'order':scopeReview?'scope':frequencyConflict?'unknown':batch&&!batch.frequency.unknown&&positive(batch.frequency.times)&&batch.frequency.period?batch.frequency.period:p.frequency==='daily'||p.frequency==='several'?'day':'unknown';
  return {item,batch,scopeReview,frequencyConflict,cadence,dishes:usage.dishes.filter(d=>usage.itemDishes.get(item.id)!.has(d.id)).map(d=>({id:d.id,name:d.name}))};
 }).sort((a,b)=>b.dishes.length-a.dishes.length||a.item.name.localeCompare(b.item.name,'en')||a.item.id.localeCompare(b.item.id));
}
export function matchesInsight(row:InsightRow,query:string,kind:string){return (kind==='all'||row.item.kind===kind)&&normalizeName([row.item.name,...row.item.aliases,...row.dishes.map(d=>d.name)].join(' ')).includes(normalizeName(query));}
export function outputText(r:InsightRow){
 if(r.scopeReview)return 'Labula amount not separated';
 if(!batchCompletion(r.item.prepProfile).applicable)return 'No advance batch';
 const o=r.batch?.output;if(!o||o.unknown||!positive(o.amount)||!o.unit)return 'Not known';
 return o.unit==='other'?`${numberText(o.amount)} · unit entered: “${o.unitOther.trim()}”`:`${numberText(o.amount)} ${o.unit}`;
}
export function frequencyText(r:InsightRow){
 if(r.cadence==='supplied')return 'Use as supplied';if(r.cadence==='order')return 'Prepare to order';
 if(r.scopeReview)return 'Labula routine not separated';
 if(r.frequencyConflict)return 'Frequency needs clarification';
 const f=r.batch?.frequency;
 if(f&&!f.unknown&&positive(f.times)&&f.period)return `${numberText(f.times)} batch${f.times===1?'':'es'} / ${f.period==='day'?'operating day':f.period==='week'?'typical week':'service'}`;
 const p=r.item.prepProfile;return p.frequency==='daily'?'Once a day · earlier estimate':p.frequency==='several'?'Several times a day · earlier estimate':p.frequency==='less'?'Less than daily · exact frequency unknown':'Frequency not known';
}
export function workMinutes(r:InsightRow,period:'batch'|'day'|'week'|'service'){
 if(r.scopeReview||!batchCompletion(r.item.prepProfile).applicable||!r.batch||r.batch.work.unknown||!positive(r.batch.work.minutes))return null;
 if(period==='batch')return r.batch.work.minutes;
 const f=r.batch.frequency;if(r.frequencyConflict||f.unknown||f.period!==period||!positive(f.times))return null;
 return r.batch.work.minutes*f.times;
}
export function scheduleText(r:InsightRow){if(r.scopeReview)return 'Routine needs separating';return ({planned:'Mostly planned',mixed:'Planned + unexpected top-ups',unplanned:'Mostly unexpected top-ups',unknown:'Not known'} as Record<string,string>)[r.batch?.schedule??'']??'Not answered';}
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
