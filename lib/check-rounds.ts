import {z} from 'zod';
import {isOpenDay,nextOpenDay,weekday,type CalendarVersion} from './operating-calendar';
import {operationalDay,shiftDay} from './evening';
import {stockRows,type StockItem,type StockFilter,type StockTypeFilter} from './stock';
import type {Category} from './menu';
export const roundIds=['daily','twice-weekly','weekly'] as const;
export type RoundId=typeof roundIds[number];
export const roundNames:Record<RoundId,string>={daily:'Daily check','twice-weekly':'Twice-weekly check',weekly:'Weekly check'};
export const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
export type Round={id:RoundId;days:number[];revision:number;updatedAt:string;updatedBy:string};
export type RoundItem=StockItem&{roundId:RoundId|null};
export type RoundsSnapshot={calendar?:CalendarVersion[];accountId:string;account:string;revision:number;activatedAt:string;rounds:Round[];items:RoundItem[]};
export const roundIdSchema=z.enum(roundIds);
const base={id:z.string().uuid(),actorId:z.string().min(1).max(160),revision:z.number().int().nonnegative()};
export const roundCommandSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('days'),roundId:roundIdSchema,days:z.array(z.number().int().min(0).max(6)).min(1).max(7)}).strict(),
 z.object({...base,kind:z.literal('members'),roundId:roundIdSchema.nullable(),itemIds:z.array(z.string().min(1).max(100)).min(1).max(1000)}).strict(),
]).superRefine((v,c)=>{
 if(v.kind==='days'&&(new Set(v.days).size!==v.days.length||v.days.length!==(v.roundId==='daily'?7:v.roundId==='weekly'?1:2)))c.addIssue({code:'custom',message:'Choose exactly the required number of different weekdays.'});
 if(v.kind==='members'&&new Set(v.itemIds).size!==v.itemIds.length)c.addIssue({code:'custom',message:'Duplicate item.'});
});
export type RoundCommand=z.infer<typeof roundCommandSchema>;
export function daysLabel(days:readonly number[]){return days.length===7?'Every open day':days.map(d=>weekdays[d]).join(' + ');}
export function roundLabel(id:RoundId|null,rounds:Round[]){const r=rounds.find(r=>r.id===id);return r?`${roundNames[r.id]} · ${daysLabel(r.days)}`:'Not assigned';}
export type RoundFilters={search:string;type:StockTypeFilter;menu:Category[];group:string;tracking:StockFilter;current:string};
export const emptyRoundFilters:RoundFilters={search:'',type:'all',menu:[],group:'all',tracking:'all',current:'all'};
export function filteredRoundItems(items:RoundItem[],target:RoundId,f:RoundFilters){
 const ids=new Set(stockRows(items,f.search,f.tracking,true,f.type,f.menu).map(i=>i.itemId));
 return items.filter(i=>ids.has(i.itemId)&&(f.group==='all'||(i.groupId??'none')===f.group)&&(f.current==='all'||(f.current==='this'?i.roundId===target:f.current==='other'?!!i.roundId&&i.roundId!==target:f.current==='none'?!i.roundId:i.roundId===f.current))).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.itemId.localeCompare(b.itemId));
}
export function toggleCandidates(selected:string[],candidates:string[]){const all=candidates.every(id=>selected.includes(id));return all?selected.filter(id=>!candidates.includes(id)):[...new Set([...selected,...candidates])];}
export type Timeline={seq:number;itemId:string;roundId:RoundId|null;days:number[];scheduleRevision:number;active:boolean;recordedAt:string;source:string};
export type RoundReason={scheduleNeedsReview?:boolean;roundId:RoundId|null;days:number[];scheduleRevision:number;reason:'scheduled'|'overdue'|'extra';firstDue:string|null;lastDue:string|null;lastConfirmed:string|null;planningRevision:number};
// Every interval is reconstructible from the immutable timeline. Same-day schedule moves
// retain that day's old obligation; Track off stops new obligations from that day.
export function obligation(events:Timeline[],day:string,lastConfirmed:string|null):{first:string;last:string}|null{
 let first:string|null=null,last:string|null=null;
 for(let i=0;i<events.length;i++){
  const e=events[i];if(!e.active||!e.days.length)continue;
  let start=operationalDay(new Date(e.recordedAt));
  if(lastConfirmed&&lastConfirmed>=start)start=shiftDay(lastConfirmed,1);
  const next=events[i+1];let end=day;
  if(next){const boundary=operationalDay(new Date(next.recordedAt));const stop=next.active?boundary:shiftDay(boundary,-1);if(stop<end)end=stop;}
  if(start>end)continue;
  for(let offset=0;offset<7;offset++){const d=shiftDay(start,offset);if(d>end)break;if(e.days.includes(new Date(d+'T12:00:00Z').getUTCDay())){if(!first||d<first)first=d;break;}}
  for(let offset=0;offset<7;offset++){const d=shiftDay(end,-offset);if(d<start)break;if(e.days.includes(new Date(d+'T12:00:00Z').getUTCDay())){if(!last||d>last)last=d;break;}}
 }
 return first&&last?{first,last}:null;
}

// Reconstruct obligations from effective intervals. Closed daily dates create no
// debt; an explicitly scheduled less frequent closed date is carried to opening.
export function calendarObligation(events:Timeline[],day:string,lastConfirmed:string|null,calendar:CalendarVersion[]){
 if(!calendar.length)return obligation(events,day,lastConfirmed);
 let first:string|null=null,last:string|null=null;
 for(let i=0;i<events.length;i++){
  const e=events[i];if(!e.active||!e.days.length)continue;
  let start=operationalDay(new Date(e.recordedAt)),end=day;
  if(lastConfirmed&&lastConfirmed>=start)start=shiftDay(lastConfirmed,1);
  const next=events[i+1];if(next){const boundary=operationalDay(new Date(next.recordedAt)),stop=next.active?boundary:shiftDay(boundary,-1);if(stop<end)end=stop;}
  for(let d=start;d&&d<=end;d=shiftDay(d,1)){
   if(!e.days.includes(weekday(d)))continue;
   const open=isOpenDay(d,calendar);if(!open&&e.roundId==='daily')continue;
   const due=open?d:nextOpenDay(d,calendar);
   if(due>day||lastConfirmed&&due<=lastConfirmed)continue;
   if(!first||due<first)first=due;if(!last||due>last)last=due;
  }
 }
 return first&&last?{first,last}:null;
}
