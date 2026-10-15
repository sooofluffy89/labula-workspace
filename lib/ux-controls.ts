import type {StationId} from './checking-stations';
import type {CalendarConfig} from './operating-calendar';
/** Undefined means mixed: it is deliberately different from explicit unassignment. */
export function commonStation(items:readonly {stationId?:StationId|null}[]):StationId|null|undefined{
 if(!items.length)return undefined;const value=items[0].stationId??null;
 return items.every(i=>(i.stationId??null)===value)?value:undefined;
}
const days=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const clock=(v:string|null)=>v??'Unset';
export function calendarChanges(before:CalendarConfig,after:CalendarConfig):string[]{
 const changes:string[]=[];
 if([...before.openDays].sort().join()!==[...after.openDays].sort().join())changes.push(`Open weekdays: ${before.openDays.map(d=>days[d]).join(', ')||'None'} → ${after.openDays.map(d=>days[d]).join(', ')||'None'}`);
 for(const next of after.deadlines){const old=before.deadlines.find(d=>d.weekday===next.weekday);if(!old)continue;
  if(old.evening!==next.evening)changes.push(`${days[next.weekday]} evening deadline: ${clock(old.evening)} → ${clock(next.evening)}`);
  if(old.eveningOffset!==next.eveningOffset)changes.push(`${days[next.weekday]} evening cutoff day: ${old.eveningOffset?'Next calendar day':'Same calendar day'} → ${next.eveningOffset?'Next calendar day':'Same calendar day'}`);
  if(old.morning!==next.morning)changes.push(`${days[next.weekday]} morning deadline: ${clock(old.morning)} → ${clock(next.morning)}`);
 }
 const opening=(v:CalendarConfig['exceptions'][number])=>`${v.open?'Open':'Closed'}${v.note?' · '+v.note:''}`;
 for(const day of [...new Set([...before.exceptions,...after.exceptions].map(e=>e.day))].sort()){
  const old=before.exceptions.find(e=>e.day===day),next=after.exceptions.find(e=>e.day===day);
  if(JSON.stringify(old)!==JSON.stringify(next))changes.push(`Opening exception ${day}: ${old?opening(old):'No exception'} → ${next?opening(next):'Removed (regular weekdays apply)'}`);
 }
 const deadline=(v:CalendarConfig['deadlineExceptions'][number])=>`evening ${clock(v.evening)} (${v.eveningOffset?'next':'same'} calendar day), morning ${clock(v.morning)}`;
 for(const day of [...new Set([...before.deadlineExceptions,...after.deadlineExceptions].map(e=>e.day))].sort()){
  const old=before.deadlineExceptions.find(e=>e.day===day),next=after.deadlineExceptions.find(e=>e.day===day);
  if(JSON.stringify(old)!==JSON.stringify(next))changes.push(`Deadline exception ${day}: ${old?deadline(old):'No exception'} → ${next?deadline(next):'Removed (regular deadlines apply)'}`);
 }
 return changes;
}
