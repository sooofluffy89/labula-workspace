import {z} from 'zod';
import {actionMetaSchema} from './activity';

export const KITCHEN_TIME_ZONE='Europe/Prague';
export const OPERATIONAL_DAY_START_HOUR=4;
export const dateSchema=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>s>='2020-01-01'&&s<='2100-12-31'&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s,'Choose a valid date.');
export function calendarDay(now=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:KITCHEN_TIME_ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(now);}
export function shiftDay(day:string,days:number){if(!dateSchema.safeParse(day).success)return '';const d=new Date(day+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+days);return d.toISOString().slice(0,10);}
export function operationalDay(now=new Date()){const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:KITCHEN_TIME_ZONE,hour:'2-digit',hourCycle:'h23'}).format(now));return shiftDay(calendarDay(now),hour<OPERATIONAL_DAY_START_HOUR?-1:0);}
export function displayDay(day:string){if(!dateSchema.safeParse(day).success)return 'Choose a date';return new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(day+'T12:00:00Z'));}
const id=z.string().min(1).max(160),rev=z.number().int().nonnegative(),base={id:z.string().uuid(),actorId:id,scope:z.literal('kitchen'),meta:actionMetaSchema.optional()},check={checkId:dateSchema};
export const eveningCommandSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('start'),day:dateSchema,targetDay:dateSchema,calendarRevision:rev.optional(),extraItemIds:z.array(id).max(1000).optional()}),
 z.object({...base,...check,kind:z.literal('add-items'),revision:rev,itemIds:z.array(id).min(1).max(1000)}),
 z.object({...base,...check,kind:z.literal('answer'),itemId:id,revision:rev,generation:rev,value:z.enum(['have','missing']).nullable(),deviceId:z.string().uuid(),sequence:z.number().int().positive()}),
 z.object({...base,...check,kind:z.literal('resolve'),itemId:id,revision:rev,generation:rev,catalogId:id}),
 z.object({...base,...check,kind:z.literal('supersede'),itemId:id,revision:rev,generation:rev,targetItemId:id,notebookRevision:rev}),
 z.object({...base,...check,kind:z.literal('dates'),revision:rev,targetDay:dateSchema,calendarRevision:rev.optional()}),
 z.object({...base,...check,kind:z.literal('correct'),revision:rev,planRevision:rev}),
 z.object({...base,...check,kind:z.literal('confirm'),revision:rev,planRevision:rev,notebookRevision:rev}),
 z.object({...base,...check,kind:z.literal('ready'),itemId:id,revision:rev,value:z.boolean()}),
]);
export type EveningCommand=z.infer<typeof eveningCommandSchema>;
export type Availability='have'|'missing'|null;
export type CheckSummary={planPolicyVersion?:number;calendarRevision?:number|null;coveredBy?:string|null;roundsVersion?:number;id:string;targetDay:string;stage:'draft'|'confirmed';revision:number;planRevision:number;version:number;confirmedAt:string|null;confirmedBy:string|null};
export type CheckAnswer={suspended?:boolean;menuScope?:import('./menu-scope').MenuScopeState;stationId?:import('./checking-stations').StationId|null;instruction?:import('./prep-notes').RecordedInstruction|null;feedbackCount?:number;round?:import('./check-rounds').RoundReason|null;itemId:string;catalogId:string;name:string;kind:'bought'|'prep';position:number;value:Availability;revision:number;updatedAt:string;updatedBy:string;firstActor:string|null;firstDevice:string|null;firstSequence:number|null;supersededBy:string|null;mappingValid:boolean;currentName:string|null;groupId:string|null};
export type MorningTask={suspended?:boolean;menuScope?:import('./menu-scope').MenuScopeState;instruction?:import('./prep-notes').RecordedInstruction|null;feedbackCount?:number;itemId:string;catalogId:string;name:string;kind:'bought'|'prep';position:number;ready:boolean;cancelled:boolean;revision:number;updatedAt:string;updatedBy:string;mappingValid:boolean;groupId:string|null};
export type EveningCheck=CheckSummary&{answers:CheckAnswer[];tasks:MorningTask[];grouped:boolean};
export type EveningSnapshot={menuGaps?:string[];prepNotes?:1;sync?:{version:1;cursor:string};calendar?:import('./operating-calendar').CalendarSnapshot;planning?:{day:string;revision:number;dueCount:number;rounds:import('./check-rounds').Round[];items:import('./round-store').PlanningItem[]};scope:'kitchen';accountId:string;account:string;notebookRevision:number;trackedCount:number;catalog:{id:string;name:string;kind:'bought'|'prep'}[];checks:CheckSummary[];check:EveningCheck|null};
export type EveningSelection={day:string}|{morningDay:string};
export function selectionQuery(selection:EveningSelection){return new URLSearchParams(selection).toString();}
export function correctionDiff(check:EveningCheck){
 const active=new Map(check.tasks.filter(t=>!t.cancelled&&!t.suspended).map(t=>[t.itemId,t]));
 const included=(a:CheckAnswer)=>!a.suspended&&!a.supersededBy&&a.value==='missing';
 return {added:check.answers.filter(a=>included(a)&&(!active.has(a.itemId)||active.get(a.itemId)?.catalogId!==a.catalogId)),removed:check.tasks.filter(t=>!t.cancelled&&!check.answers.some(a=>a.itemId===t.itemId&&included(a)))};
}

// Persisted with the atomic publication; this is a commit receipt, not a sync cursor.
export type PublicationReceipt={protocol:1;actorId:string;checkId:string;targetDay:string;version:number;revision:number;planRevision:number;confirmedAt:string;confirmedBy:string};
export type PublicationPlan={check:CheckSummary&{grouped:boolean};tasks:MorningTask[]};
