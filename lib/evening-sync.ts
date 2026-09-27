import type {CheckAnswer,CheckSummary,EveningSnapshot,MorningTask} from './evening';
export const EVENING_BATCH_LIMIT=20;
export type SyncCursor={v:1;accountId:string;scope:string;after:number;through:number|null;notebook:number;rounds:number;calendar:number};
export type EveningDelta={accountId:string;account:string;cursor:string;reset:boolean;more:boolean;check:CheckSummary|null;answers:CheckAnswer[];tasks:MorningTask[]};
export type BatchResult={operationId:string;status:'saved'|'conflict'|'blocked';revision?:number;checkId:string;error?:string};
export type EveningBatchReply={accountId:string;account:string;results:BatchResult[];changes:{check:CheckSummary|null;answers:CheckAnswer[];tasks:MorningTask[]}};
// The cursor only advances after applying a consistent read. Write ACKs never advance it.
export function mergeEveningSnapshot(current:EveningSnapshot|null,next:EveningSnapshot):EveningSnapshot{
 if(!current||current.accountId!==next.accountId||current.check?.id!==next.check?.id)return next;
 const a=current.check,b=next.check;
 if(!a||!b)return next;
 if(a.revision>b.revision||a.planRevision>b.planRevision)return current;
 return next;
}
export function applyEveningDelta(snapshot:EveningSnapshot,delta:EveningDelta):EveningSnapshot{
 const current=snapshot.check,next=delta.check;
 if(delta.reset||!current||!next||current.id!==next.id)return snapshot;
 const merge=<T extends {itemId:string;revision:number;mappingValid:boolean}>(rows:T[],updates:T[])=>rows.map(row=>{const update=updates.find(x=>x.itemId===row.itemId);return update&&update.revision>=row.revision?{...update,mappingValid:row.mappingValid,...('currentName' in row?{currentName:row.currentName}:{})}:row;});
 const header=next.revision>=current.revision&&next.planRevision>=current.planRevision?next:current;
 return {...snapshot,sync:{version:1,cursor:delta.cursor},checks:snapshot.checks.map(c=>c.id===next.id?{...c,...header}:c),check:{...current,...header,answers:merge(current.answers,delta.answers),tasks:merge(current.tasks,delta.tasks)}};
}
