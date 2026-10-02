import type {EveningCommand,EveningSnapshot,PublicationReceipt} from './evening';

export type FinishIntent={
 protocol:1;id:string;accountId:string;account:string;checkId:string;targetDay:string;
 generation:number;createdAt:string;approved:EveningSnapshot;fingerprint:string;
 dependencies:string[];supersedes?:string;resolved?:true;
 phase:'sending'|'checking'|'publishing'|'offline'|'attention'|'complete';
 reason?:string;command?:Extract<EveningCommand,{kind:'confirm'}>;receipt?:PublicationReceipt;
};
// Completed device receipts do not retain the full approval snapshot. Pending
// approvals always keep the original full record and immutable commands.
export type CompletedFinish=Pick<FinishIntent,'protocol'|'id'|'accountId'|'account'|'checkId'|'targetDay'|'generation'|'createdAt'|'supersedes'|'reason'>&{
 compact:1;phase:'complete';resolved?:never;command:Extract<EveningCommand,{kind:'confirm'}>;receipt:PublicationReceipt;
};
export type FinishRecord=FinishIntent|CompletedFinish;
export type FinishRecovery=Pick<FinishIntent,'id'|'checkId'|'targetDay'|'phase'|'reason'>;
// Check-wide revisions advance for our own acknowledged answers. Item revisions
// in the local overlay already include those writes, so compare those instead.
// Ignore presentation counters/timestamps; retain every fact that affects approval.
export function finishFingerprint(s:EveningSnapshot){
 const c=s.check;if(!c)return '';
 return JSON.stringify({id:c.id,target:c.targetDay,stage:c.stage,version:c.version,
  planRevision:c.planRevision,calendarRevision:c.calendarRevision,coveredBy:c.coveredBy,
  notebookRevision:s.notebookRevision,grouped:c.grouped,
  answers:c.answers.map(a=>[a.itemId,a.catalogId,a.name,a.kind,a.position,a.value,a.revision,a.mappingValid,a.supersededBy,a.instruction]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))),
  tasks:c.tasks.map(t=>[t.itemId,t.catalogId,t.ready,t.cancelled,t.revision,t.mappingValid]).sort((a,b)=>String(a[0]).localeCompare(String(b[0]))) });
}
export function finishProblem(s:EveningSnapshot){
 const c=s.check;if(!c)return 'This check is not loaded. Open its saved date first.';
 if(c.stage!=='draft'||c.coveredBy)return 'This check is already finished or covered. Review its shared result.';
 const rows=c.answers.filter(a=>!a.supersededBy);
 const invalid=rows.find(a=>!a.mappingValid);if(invalid)return `Review the catalog link for ${invalid.name}.`;
 const missing=rows.filter(a=>a.value===null);if(missing.length)return `${missing.length} items still unchecked. Start with ${missing[0].name}.`;
 return '';
}
export function finishStatus(f:FinishRecord){
 if(f.phase==='complete')return 'Evening check finished';
 if(f.phase==='attention')return 'Needs your attention';
 if(f.phase==='offline')return 'Saved on this device';
 if(f.phase==='checking')return 'Checking shared answers…';
 if(f.command)return 'Verifying your check…';
 return 'Sending your check…';
}

export function finishChanges(f:FinishRecord,s:EveningSnapshot|null){
 if(!('approved' in f))return [];
 const before=f.approved.check,after=s?.check;
 const changes:{name:string;mine:string;shared:string;by?:string;at?:string}[]=[];
 if(!before||!after||before.id!==after.id)return changes;
 const value=(v:unknown)=>v==='have'?'No action needed':v==='missing'?'Preparation / restocking needed':'Unchecked';
 for(const a of before.answers){
  const b=after.answers.find(row=>row.itemId===a.itemId);
  if(!b){changes.push({name:a.name,mine:value(a.value),shared:'Item removed'});continue;}
  if(a.value!==b.value||a.revision!==b.revision||a.catalogId!==b.catalogId||a.mappingValid!==b.mappingValid||a.supersededBy!==b.supersededBy){
   changes.push({name:b.name,mine:value(a.value),shared:b.supersededBy?'Replaced by another item':!b.mappingValid?'Catalog link needs review':a.catalogId!==b.catalogId?'Catalog link changed · '+value(b.value):value(b.value),by:b.updatedBy,at:b.updatedAt});
  }
 }
 for(const b of after.answers)if(!before.answers.some(a=>a.itemId===b.itemId))changes.push({name:b.name,mine:'Not in your approved list',shared:value(b.value),by:b.updatedBy,at:b.updatedAt});
 for(const a of before.tasks){const b=after.tasks.find(t=>t.itemId===a.itemId);if(!b||a.ready!==b.ready||a.cancelled!==b.cancelled||a.revision!==b.revision)changes.push({name:a.name+' · Morning prep',mine:a.cancelled?'Removed':a.ready?'Ready':'Not ready',shared:!b||b.cancelled?'Removed':b.ready?'Ready':'Not ready',by:b?.updatedBy,at:b?.updatedAt});}
 if(before.targetDay!==after.targetDay)changes.push({name:'Morning prep date',mine:before.targetDay,shared:after.targetDay});
 if(before.version!==after.version||before.stage!==after.stage)changes.push({name:'Shared check',mine:before.stage+' · version '+before.version,shared:after.stage+' · version '+after.version,by:after.confirmedBy??undefined,at:after.confirmedAt??undefined});
 return changes;
}
