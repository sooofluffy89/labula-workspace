import {z} from 'zod';
import {dateSchema,type CheckAnswer,type MorningTask} from './evening';
import {deadlineAt,type CalendarVersion} from './operating-calendar';
import type {ActivityEvent} from './activity';

export const outcomeNames={on_time:'Prepared on time — forgot to mark',late:'Prepared late',not_prepared:'Not prepared',not_needed:'No longer needed',unknown:'Not sure'} as const;
export type OutcomeKey=keyof typeof outcomeNames;
export type Outcome={id:string;check_id:string;item_id:string;version:number;outcome:OutcomeKey;note:string;reported_ready_at:string|null;supersedes_id:string|null;actor_id:string;actor_name:string;created_at:string};
export const outcomeCommandSchema=z.object({kind:z.literal('outcome'),id:z.string().uuid(),actorId:z.string().min(1),checkId:dateSchema,itemId:z.string().min(1).max(160),version:z.number().int().positive(),outcome:z.enum(['on_time','late','not_prepared','not_needed','unknown']),note:z.string().max(500),reportedReadyAt:z.string().datetime().nullable(),supersedesId:z.string().uuid().nullable()}).strict();
export type PublishedCheck={version:number;created_at:string;created_by:string;payload:{checkId:string;targetDay:string;answers:CheckAnswer[];priorTasks:MorningTask[];actor:string;confirmedAt:string}};
export type HistoryEvent=ActivityEvent&{seq:number};
export type HistoryBundle={check:{id:string;target_day:string;stage:string;version:number;created_at:string;created_by:string;confirmed_at:string|null;confirmed_by:string|null};answers:CheckAnswer[];tasks:MorningTask[];versions:PublishedCheck[];events:HistoryEvent[];outcomes:Outcome[]};
export type TaskMeasure={itemId:string;catalogId:string;name:string;kind:'bought'|'prep';groupId:string|null;roundId:string|null;ready:boolean|null;lastReadyAt:string|null;status:'on-time'|'late-recorded'|'not-recorded'|'pending'|'unknown';outcome:Outcome|null;sourceVersion:number;addedAfterDeadline:boolean;removedAfterDeadline:boolean};
export type DayMeasure={id:string;targetDay:string;stage:string;version:number;startedAt:string|null;startedBy:string|null;firstAnswerAt:string|null;lastAnswerAt:string|null;confirmedAt:string|null;confirmedBy:string|null;firstReadyAt:string|null;lastReadyAt:string|null;eveningDeadline:string|null;morningDeadline:string|null;handover:'on-time'|'late'|'not-confirmed'|'pending'|'unknown'|'not-required';readiness:'measured'|'no-plan'|'no-tasks'|'pending'|'unknown';tasks:TaskMeasure[];currentTasks:number;currentReady:number;changes:number;addedAfter:number;removedAfter:number;coverageFrom:string|null;reason:string|null};
export function jsonState(value:string|null):Record<string,unknown>{try{return value?JSON.parse(value):{};}catch{return {};}}
export function publishedAt(bundle:HistoryBundle,time:string){return bundle.versions.filter(v=>v.created_at<=time).sort((a,b)=>b.version-a.version)[0]??null;}
function taskState(version:PublishedCheck,answer:CheckAnswer,events:HistoryEvent[],at:string){
 const prior=version.payload.priorTasks?.find(t=>t.itemId===answer.itemId&&!t.cancelled&&t.catalogId===answer.catalogId);
 let ready=prior?.ready??false,lastReadyAt=ready?prior?.updatedAt??null:null;
 for(const e of events.filter(e=>e.item_id===answer.itemId&&e.category==='morning'&&e.action==='ready'&&e.recorded_at<=at).sort((a,b)=>a.recorded_at.localeCompare(b.recorded_at)||a.seq-b.seq)){
  const after=jsonState(e.after_value),plan=after.planVersion;
  if(e.recorded_at<version.created_at||typeof plan==='number'&&plan<version.version||e.recorded_at===version.created_at&&plan===undefined)continue;
  if(typeof after.ready==='boolean'){ready=after.ready;lastReadyAt=ready?e.recorded_at:null;}
 }
 return {ready,lastReadyAt};
}
export function measureDay(bundle:HistoryBundle,calendar:CalendarVersion[],asOf:string):DayMeasure{
 const c=bundle.check,eveningDeadline=deadlineAt(c.id,'evening',calendar),morningDeadline=deadlineAt(c.target_day,'morning',calendar);
 const latest=publishedAt(bundle,asOf),atDeadline=morningDeadline&&morningDeadline<=asOf?publishedAt(bundle,morningDeadline):null;
 const first=bundle.versions.filter(v=>v.created_at<=asOf).sort((a,b)=>a.version-b.version)[0];
 const handover=!eveningDeadline?'unknown':eveningDeadline>asOf?'pending':first?(first.created_at<=eveningDeadline?'on-time':'late'):'not-confirmed';
 const evaluated=!!morningDeadline&&morningDeadline<=asOf&&!!atDeadline;
 const basis=atDeadline??latest;
 const active=basis?.payload.answers.filter(a=>a.value==='missing'&&!a.supersededBy)??[];
 const latestActive=latest?.payload.answers.filter(a=>a.value==='missing'&&!a.supersededBy)??[];
 const same=(a:CheckAnswer,b:CheckAnswer)=>a.itemId===b.itemId&&a.catalogId===b.catalogId;
 const combined=[...active,...latestActive.filter(a=>!active.some(x=>same(x,a)))];
 const tasks:TaskMeasure[]=combined.map(a=>{
  const addedAfterDeadline=!!morningDeadline&&morningDeadline<=asOf&&(!atDeadline||!active.some(x=>same(x,a)))&&!!latest;
  const source=addedAfterDeadline?latest!:basis!,state=taskState(source,a,bundle.events,evaluated&&!addedAfterDeadline?morningDeadline!:asOf);
  const current=bundle.tasks.find(t=>t.itemId===a.itemId&&t.catalogId===a.catalogId&&!t.cancelled);
  const sourceEvents=bundle.events.filter(e=>e.item_id===a.itemId&&e.recorded_at>=source.created_at);
  const coverage=sourceEvents.some(e=>e.category==='morning'&&['created','reopened','ready'].includes(e.action))||!!source.payload.priorTasks?.some(t=>t.itemId===a.itemId&&t.catalogId===a.catalogId&&!t.cancelled);
  const laterReady=bundle.events.some(e=>e.item_id===a.itemId&&e.category==='morning'&&e.action==='ready'&&jsonState(e.after_value).ready===true&&(!jsonState(e.before_value).catalogId||jsonState(e.before_value).catalogId===a.catalogId)&&e.recorded_at>(morningDeadline??asOf)&&e.recorded_at<=asOf);
  const outcome=bundle.outcomes.filter(o=>o.item_id===a.itemId&&o.version===source.version&&o.created_at<=asOf).at(-1)??null;
  return {itemId:a.itemId,catalogId:a.catalogId,name:a.name,kind:a.kind,groupId:a.groupId??null,roundId:a.round?.roundId??null,ready:evaluated&&!addedAfterDeadline?state.ready:null,lastReadyAt:current?.ready?current.updatedAt:null,status:!morningDeadline||addedAfterDeadline||!coverage?'unknown':morningDeadline>asOf?'pending':!atDeadline?'unknown':state.ready?'on-time':laterReady?'late-recorded':'not-recorded',outcome,sourceVersion:source.version,addedAfterDeadline,removedAfterDeadline:evaluated&&!latestActive.some(x=>same(x,a))};
 });
 const humanAnswers=bundle.events.filter(e=>e.category==='evening'&&e.action==='answer'),readyEvents=bundle.events.filter(e=>e.category==='morning'&&e.action==='ready'&&jsonState(e.after_value).ready===true);
 return {id:c.id,targetDay:c.target_day,stage:c.stage,version:latest?.version??0,startedAt:c.created_at,startedBy:c.created_by,firstAnswerAt:humanAnswers[0]?.recorded_at??null,lastAnswerAt:humanAnswers.at(-1)?.recorded_at??null,confirmedAt:first?.created_at??null,confirmedBy:bundle.events.find(e=>e.action==='confirm'&&e.recorded_at===first?.created_at)?.actor_name??first?.created_by??null,firstReadyAt:readyEvents[0]?.recorded_at??null,lastReadyAt:readyEvents.at(-1)?.recorded_at??null,eveningDeadline,morningDeadline,handover,readiness:!morningDeadline?'unknown':morningDeadline>asOf?'pending':!atDeadline?'no-plan':active.length?'measured':'no-tasks',tasks,currentTasks:bundle.tasks.filter(t=>!t.cancelled).length,currentReady:bundle.tasks.filter(t=>!t.cancelled&&t.ready).length,changes:bundle.events.filter(e=>first&&e.recorded_at>first.created_at&&e.category==='evening').length,addedAfter:tasks.filter(t=>t.addedAfterDeadline).length,removedAfter:tasks.filter(t=>t.removedAfterDeadline).length,coverageFrom:bundle.events[0]?.recorded_at??null,reason:!morningDeadline?'Deadline not configured':!atDeadline&&morningDeadline<=asOf?'No confirmed check by the deadline':null};
}
export function summarizeDays(days:DayMeasure[]){const tasks=days.flatMap(d=>d.tasks),evaluable=tasks.filter(t=>['on-time','late-recorded','not-recorded'].includes(t.status));const handovers=days.filter(d=>['on-time','late','not-confirmed'].includes(d.handover));return {days:days.length,handovers:handovers.length,onTimeHandovers:handovers.filter(d=>d.handover==='on-time').length,evaluable:evaluable.length,onTime:evaluable.filter(t=>t.status==='on-time').length,reportedMissed:tasks.filter(t=>t.outcome&&['late','not_prepared'].includes(t.outcome.outcome)).length,unclarified:evaluable.filter(t=>t.status!=='on-time'&&!t.outcome).length,unknown:tasks.filter(t=>t.status==='unknown').length,pending:tasks.filter(t=>t.status==='pending').length,noPlan:days.filter(d=>d.readiness==='no-plan').length,noTasks:days.filter(d=>d.readiness==='no-tasks').length,notEvaluableDays:days.filter(d=>d.readiness==='unknown'||d.handover==='unknown'||d.tasks.some(t=>t.status==='unknown'&&!t.addedAfterDeadline)).length};}
export type OperationsFilters={from:string;to:string;search:string;actor:string;type:string;group:string;round:string;status:string;stage:string;phase:string;item:string};
export type OperationsPage={accountId:string;account:string;isOwner:boolean;capturedThrough:string;next:string|null;days:DayMeasure[];summary:ReturnType<typeof summarizeDays>;recurring:{id:string;name:string;kind:string;groupIds:(string|null)[];currentGroupId:string|null;currentName:string|null;mergedInto:string|null;count:number;evaluable:number;onTime:number;missing:number;missed:number;changes:number}[];calendar:CalendarVersion[];people:{id:string;name:string}[];total:number;range:{from:string;to:string};sources?:HistoryBundle[]};
