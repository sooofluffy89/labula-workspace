import {z} from 'zod';
import {actionMetaSchema} from './activity';
import {calendarObligation,type Round,type RoundId,type Timeline} from './check-rounds';
import {operationalDay,shiftDay,dateSchema} from './evening';
import {isOpenDay,nextOpenDay,calendarVersion,weekday,type CalendarVersion} from './operating-calendar';
import type {StockItem} from './stock';

export const frequencies=['off','daily','twice-weekly','weekly'] as const;
export type Frequency=typeof frequencies[number];
export const frequencyLabels:Record<Frequency,string>={off:'Do not check',daily:'Daily','twice-weekly':'Twice weekly',weekly:'Weekly'};
export type FrequencyFilter=Frequency|'all'|'tracked';
export type NextCheck={state:'off'|'due'|'unconfirmed'|'next'|'review';date:string|null;note:string};
export type FrequencyItem={roundId:RoundId|null;roundRevision:number;next:NextCheck};
export type FrequencySettings={day:string;capturedAt:string;revision:number;calendarRevision:number;rounds:Round[];items:Record<string,FrequencyItem>};
const revision=z.number().int().nonnegative();
export const frequencyCommandSchema=z.object({kind:z.literal('frequency'),id:z.string().uuid(),actorId:z.string().min(1),meta:actionMetaSchema.optional(),planningRevision:revision,calendarRevision:revision,day:dateSchema,
 changes:z.array(z.object({itemId:z.string().min(1).max(100),revision,roundRevision:revision,included:z.literal(true),track:z.boolean(),frequency:z.enum(frequencies)}).strict()).length(1)
}).strict().refine(c=>c.changes[0].track===(c.changes[0].frequency!=='off'),'Frequency and tracking must agree.');
export type FrequencyCommand=z.infer<typeof frequencyCommandSchema>;
export const isFrequencyCommand=(c:unknown):c is FrequencyCommand=>!!c&&typeof c==='object'&&'kind' in c&&c.kind==='frequency';
export function effectiveFrequency(item:Pick<StockItem,'track'>,setting?:FrequencyItem):Frequency|'unknown'{return !item.track?'off':setting?.roundId??'unknown';}
export function matchesFrequency(item:StockItem,setting:FrequencyItem|undefined,filter:FrequencyFilter){return filter==='all'||(filter==='tracked'?item.track:effectiveFrequency(item,setting)===filter);}
export function makeFrequencyCommand(item:StockItem,s:FrequencySettings,frequency:Frequency,actorId:string):FrequencyCommand{
 const setting=s.items[item.itemId];if(!setting||!item.included||s.day!==operationalDay())throw Error('Refresh the list before changing this frequency.');
 return frequencyCommandSchema.parse({kind:'frequency',id:crypto.randomUUID(),actorId,planningRevision:s.revision,calendarRevision:s.calendarRevision,day:s.day,changes:[{itemId:item.itemId,revision:item.revision,roundRevision:setting.roundRevision,included:true,track:frequency!=='off',frequency}]});
}
// Same immutable timeline/confirmed coverage rules as the operational planner.
// A single horizon evaluation finds the earliest obligation; no per-day database queries.
export function nextCheck({item,round,events,calendar,day,lastConfirmed,confirmedDays=[],currentCheck}:{item:Pick<StockItem,'included'|'track'>;round:Round|undefined;events:Timeline[];calendar:CalendarVersion[];day:string;lastConfirmed:string|null;confirmedDays?:string[];currentCheck:'included'|'absent'|null}):NextCheck{
 const context=currentCheck==='included'?'Still in the existing check.':currentCheck==='absent'?'Not in the existing check.':'';
 if(!item.included||!item.track)return {state:'off',date:null,note:currentCheck==='included'?context:''};
 if(!round||!round.days.length||!events.length||!calendar.length)return {state:'review',date:null,note:'Ask a Manager to review the shared schedule.'};
 const due=calendarObligation(events,day,lastConfirmed&&lastConfirmed<=day?lastConfirmed:null,calendar);
 if(due){const open=isOpenDay(day,calendar);return {state:due.first<day?'unconfirmed':'due',date:open?day:nextOpenDay(day,calendar),note:[due.first<day?`Unconfirmed since ${due.first}.`:'',context,!open?'Carried to the next open day.':''].filter(Boolean).join(' ')};}
 // A future published check covers only its own day and earlier dates once that day is reached.
 // Do not let a later confirmation suppress an earlier still-due future date.
 let covered=day,upcoming=calendarObligation(events,shiftDay(day,740),covered,calendar);
 const published=new Set(confirmedDays);
 while(upcoming&&published.has(upcoming.first)){covered=upcoming.first;upcoming=calendarObligation(events,shiftDay(day,740),covered,calendar);}
 const config=calendarVersion(upcoming?.first??day,calendar)?.config;
 const carried=upcoming&&round.id!=='daily'&&(!round.days.includes(weekday(upcoming.first))||config&&round.days.some(d=>!config.openDays.includes(d)));
 return upcoming?{state:'next',date:upcoming.first,note:[currentCheck==='included'?'Existing check keeps its list.':'',carried?'Closed-day checks carry to the next open day. Review Check rounds.':''].filter(Boolean).join(' ')}:{state:'review',date:null,note:'No upcoming open check could be verified.'};
}
export function nextCheckLabel(n:NextCheck,day:string){return n.state==='off'?'Not scheduled':n.state==='review'?'Schedule needs review':n.date===day?'Due today':n.date?new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(n.date+'T12:00:00Z')):'Could not verify';}
