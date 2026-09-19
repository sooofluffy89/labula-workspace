import type {ReviewSource} from '../data-review';
import {activeGroups,values,issues,fieldIssues,dateValid,taskHash,targetActive,type Draft,type Entity,type Issue,type CheckTask,type Authority,fingerprint} from './model';
import {confirmationStatus,unresolvedSourceChecks} from './confirmation';
import type {Group} from './fields';
export type Role='cook'|'owner';
export function answerGroups(d:Draft,e:Entity,source:ReviewSource,role:Role){return activeGroups(d,e,source).filter(g=>g.fields.length&&g.id!=='STORE-06'&&(role==='owner'||!g.manager&&e.kind!=='manager'));}
export function assigned(t:CheckTask,d:Draft,source:ReviewSource){return !!t.owner.trim()&&dateValid(t.due)&&!!t.method.trim()&&!!t.reason.trim()&&t.targets.length>0&&t.targets.every(target=>targetActive(d,target,source));}
export function openChecks(d:Draft){return d.tasks.filter(t=>!t.closedHash||t.closedHash!==taskHash(d,t));}
export function dedupeGaps(all:Issue[]){const result=new Map<string,Issue>();for(const i of all){const key=JSON.stringify([i.entityId,i.group,i.path]),old=result.get(key);result.set(key,old?{...old,hard:old.hard||i.hard,message:old.message===i.message?old.message:old.message+' '+i.message}:i);}return [...result.values()];}
export function assignedFor(d:Draft,source:ReviewSource,gap:Issue,opened=openChecks(d)){return gap.hard?[]:opened.filter(t=>assigned(t,d,source)&&t.targets.some(x=>x.entityId===gap.entityId&&x.group===gap.group&&x.path.every((p,i)=>gap.path[i]===p)));}
function entered(v:unknown):boolean{if(Array.isArray(v))return v.some(entered);if(v&&typeof v==='object')return Object.entries(v).some(([k,x])=>k!=='id'&&entered(x));return v!==undefined&&v!==null&&v!=='';}
export function topicProgress(d:Draft,e:Entity,g:Group,source:ReviewSource,knownIssues?:Issue[],opened=openChecks(d)){
 const gaps=dedupeGaps([...(g.manager?fieldIssues(d,e,g):(knownIssues??issues(d,e,source)).filter(x=>x.group===g.id)),...opened.flatMap(t=>t.targets.filter(x=>x.entityId===e.id&&x.group===g.id).map(x=>({...x,message:'This linked check still needs a result.',hard:false}))),...unresolvedSourceChecks(d,e,g.id).map(f=>({...f.target,message:'Check the previously recorded fact before confirming it.',hard:false}))]),confirmation=confirmationStatus(d,e,g.id,source);
 const deferred=gaps.filter(i=>assignedFor(d,source,i,opened).length),unassigned=gaps.filter(i=>!assignedFor(d,source,i,opened).length);
 const ownValues={...values(e,g.id)};if(['RUN-01','STORE-01','OPS-01'].includes(g.id)&&e.parentId){const key=g.id==='STORE-01'?'item':'process';if(ownValues[key]===e.parentId)delete ownValues[key];}
 const touched=entered(ownValues)||Object.values(d.ux?.facts??{}).some(f=>f.target.entityId===e.id&&f.target.group===g.id);
 const state=confirmation.previouslyConfirmed&&!confirmation.valid?'changed':confirmation.valid&&!gaps.length?'confirmed':!touched?'not-started':!gaps.length?'ready-to-confirm':'in-progress';
 return {position:{entityId:e.id,group:g.id},state,gaps,deferred,unassigned,waiting:gaps.length>0&&!unassigned.length,reasons:confirmation.reasons};
}
export function recordProgress(d:Draft,e:Entity,source:ReviewSource,role:Role,opened=openChecks(d)){
 const all=issues(d,e,source),topics=answerGroups(d,e,source,role).map(g=>topicProgress(d,e,g,source,all,opened));const confirmed=topics.filter(t=>t.state==='confirmed').length;
 const remaining=topics.filter(t=>t.state!=='confirmed'),state=!topics.length?'owner-only':confirmed===topics.length?'answers-complete':remaining.every(t=>t.waiting)?'waiting-for-check':topics.every(t=>t.state==='not-started')?'not-started':'in-progress';
 return {entityId:e.id,state,topics,confirmed,total:topics.length,unassigned:topics.flatMap(t=>t.unassigned).length,deferred:topics.flatMap(t=>t.deferred).length,needsReconfirmation:topics.some(t=>t.state==='changed')};
}
export const recordLabels:Record<string,string>={'not-started':'Not started','in-progress':'In progress','waiting-for-check':'Waiting for check','answers-complete':'Your answers complete','owner-only':'Owner step'};
export const topicLabels:Record<string,string>={'not-started':'Not started','in-progress':'In progress','ready-to-confirm':'Ready to confirm',confirmed:'Confirmed',changed:'Needs reconfirmation'};
export function summaryProgress(d:Draft,source:ReviewSource,role:Role){const opened=openChecks(d),records=d.entities.filter(e=>!e.archived).map(e=>recordProgress(d,e,source,role,opened)).filter(r=>r.total);return {records,confirmed:records.reduce((n,r)=>n+r.confirmed,0),topics:records.reduce((n,r)=>n+r.total,0),unassigned:records.reduce((n,r)=>n+r.unassigned,0),deferred:records.reduce((n,r)=>n+r.deferred,0),checks:openChecks(d).length};}
export function storageStatus(d:Draft,e:Entity,source:ReviewSource,authority:Authority[]){const latest=authority.find(a=>a.kind==='storage'&&a.entityId===e.id);return !latest?'Waiting for owner':latest.fingerprint!==fingerprint(d,e,source)?'Needs re-verification':['Checked and applicable','Applicable only with listed conditions','Confirmed: no storage interval for this state'].includes(String((latest.payload as {result?:string})?.result))?'Verified for this version':'Not approved for use';}
