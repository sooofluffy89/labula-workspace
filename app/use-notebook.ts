'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {initialNotebook,validateNotebook,validationMessage,type Notebook} from '@/lib/notebook';
import type {CatalogOperation} from '@/lib/catalog';
import type {BulkCommand} from '@/lib/bulk';
import {recoverySchema,type BulkRecovery} from '@/lib/bulk-draft';
type Reply={data?:unknown;revision:number;updatedAt:string;updatedBy:string;isOwner?:boolean;error?:string;code?:string};
export type BulkResult={ok:boolean;pending:boolean;conflict?:boolean;error?:string;code?:string;notebook?:Notebook};
type Pending={id:string;revision:number;uncertain:boolean}&({kind:'catalog';request:CatalogOperation}|{kind:'bulk';request:BulkCommand});
export function useNotebook(){
 const [data,setData]=useState<Notebook>(initialNotebook),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[unauthorized,setUnauthorized]=useState(false),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[operating,setOperating]=useState(false),[operationPending,setOperationPending]=useState(false),[bulkPending,setBulkPending]=useState(false),[isOwner,setIsOwner]=useState(false),[updatedAt,setUpdatedAt]=useState(''),[updatedBy,setUpdatedBy]=useState('');
 const current=useRef(data),revision=useRef(0),saved=useRef(''),inFlight=useRef<Promise<boolean>|null>(null),halted=useRef(false),locked=useRef(false),loadingRef=useRef(false),pending=useRef<Pending|null>(null),saveRequest=useRef<{id:string;revision:number;payload:string;uncertain:boolean}|null>(null),errorRef=useRef('');
 const report=(message:string)=>{errorRef.current=message;setError(message);};
 const accept=(body:Reply)=>{const next=validateNotebook(body.data);current.current=next;setData(next);revision.current=body.revision;saved.current=JSON.stringify(next);setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setIsOwner(body.isOwner===true);setDirty(false);setLoaded(true);halted.current=false;setUnauthorized(false);};
 const load=useCallback(async()=>{if(inFlight.current||locked.current||loadingRef.current||pending.current?.kind==='bulk')return false;loadingRef.current=true;setLoading(true);report('');try{const res=await fetch('/api/notebook',{cache:'no-store'});const body=await res.json() as Reply;if(!res.ok){setUnauthorized(res.status===401);throw Error(body.error??'Could not load recipes.');}accept(body);pending.current=null;saveRequest.current=null;setOperationPending(false);setBulkPending(false);return true;}catch(e){report(validationMessage(e));return false;}finally{loadingRef.current=false;setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const update=useCallback((transform:(old:Notebook)=>Notebook)=>{if(loadingRef.current)throw Error('Wait for the notebook to finish loading.');if(locked.current||pending.current)throw Error('Finish or retry the pending change first.');const next=validateNotebook(transform(current.current));current.current=next;setData(next);setDirty(JSON.stringify(next)!==saved.current);},[]);
 const save=useCallback(async():Promise<boolean>=>{
  if(inFlight.current)return inFlight.current;if(!loaded||loadingRef.current||pending.current)return false;
  if(!saveRequest.current){const payload=JSON.stringify(current.current);if(payload===saved.current){setDirty(false);return true;}try{validateNotebook(current.current);}catch(e){report(validationMessage(e));halted.current=true;return false;}saveRequest.current={id:crypto.randomUUID(),revision:revision.current,payload,uncertain:false};}
  const command=saveRequest.current;
  const task=(async()=>{setSaving(true);report('');try{
   const res=await fetch('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(command.revision),'X-Operation-Id':command.id},body:command.payload});const body=await res.json() as Reply;
   if(!res.ok){if(!command.uncertain&&res.status<500||body.code==='revision_conflict')saveRequest.current=null;setUnauthorized(res.status===401);throw Error(body.error??'Could not save recipes.');}
   revision.current=body.revision;saved.current=command.payload;saveRequest.current=null;setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setDirty(JSON.stringify(current.current)!==command.payload);halted.current=false;return true;
  }catch(e){if(saveRequest.current)saveRequest.current.uncertain=true;halted.current=true;report(validationMessage(e));return false;}finally{setSaving(false);inFlight.current=null;}})();inFlight.current=task;return task;
 },[loaded]);
 const flush=async()=>{if(inFlight.current&&!await inFlight.current)return false;if(!await save())return false;return JSON.stringify(current.current)===saved.current||await save();};
 const execute=async(kind:'catalog'|'bulk',request:CatalogOperation|BulkCommand):Promise<BulkResult>=>{
  if(locked.current||loadingRef.current)return {ok:false,pending:!!pending.current,error:'Another change is still being saved.'};
  if(pending.current&&(pending.current.kind!==kind||JSON.stringify(pending.current.request)!==JSON.stringify(request)))return {ok:false,pending:true,error:'Retry the unchanged pending request first.'};
  locked.current=true;setOperating(true);report('');
  try{
   if(!pending.current){if(!await flush())return {ok:false,pending:false,error:'Earlier dish edits could not be saved. Download this draft and close it. On the dish page, choose Save now; if the shared version changed, download your earlier edits before choosing Reload shared notebook. Then restore this ingredient draft.'};pending.current={id:crypto.randomUUID(),revision:revision.current,uncertain:false,...(kind==='bulk'?{kind,request:structuredClone(request as BulkCommand)}:{kind,request:structuredClone(request as CatalogOperation)})};setOperationPending(true);setBulkPending(kind==='bulk');}
   const command=pending.current;const res=await fetch(command.kind==='bulk'?'/api/bulk':'/api/catalog',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(command.revision)},body:JSON.stringify(command.kind==='bulk'?{commandId:command.id,command:command.request}:{operationId:command.id,operation:command.request})});const body=await res.json() as Reply;
   if(!res.ok){const resolved=body.code==='revision_conflict'||(!command.uncertain&&res.status<500);if(resolved){pending.current=null;setOperationPending(false);setBulkPending(false);}else command.uncertain=true;setUnauthorized(res.status===401);report(body.code==='command_mismatch'?'This saved request could not be verified for this account. Sign in with the account that started the save, then retry.':body.error??'Could not confirm this change. Retry the same request.');halted.current=true;return {ok:false,pending:!resolved,conflict:body.code==='revision_conflict',error:errorRef.current,code:body.code};}
   accept(body);pending.current=null;setOperationPending(false);setBulkPending(false);return {ok:true,pending:false};
  }catch(e){if(pending.current)pending.current.uncertain=true;halted.current=true;report(validationMessage(e));return {ok:false,pending:!!pending.current,error:errorRef.current};}finally{locked.current=false;setOperating(false);}
 };
 const runOperation=async(operation:CatalogOperation)=>(await execute('catalog',operation)).ok;
 const runBulk=async(command:BulkCommand)=>execute('bulk',command);
 const refreshBulk=async():Promise<BulkResult>=>{if(pending.current)return {ok:false,pending:true,error:'Retry the unfinished save before loading another list.'};if(inFlight.current||locked.current||loadingRef.current)return {ok:false,pending:false,error:'Wait for the current save or loading to finish, then try again.'};if(JSON.stringify(current.current)!==saved.current||saveRequest.current)return {ok:false,pending:false,error:'Earlier dish edits are not saved. Download this draft, close it and select Save now on the dish page. Then reopen this dish and restore the draft.'};const ok=await load();return {ok,pending:false,error:ok?undefined:errorRef.current,notebook:ok?current.current:undefined};};
 const getBulkRecovery=():BulkRecovery|null=>{const p=pending.current;return p?.kind==='bulk'?{id:p.id,revision:p.revision,command:structuredClone(p.request)}:null;};
 const restoreBulkRecovery=(raw:BulkRecovery):BulkResult=>{
  if(!loaded||loadingRef.current||locked.current||inFlight.current||pending.current||saveRequest.current||JSON.stringify(current.current)!==saved.current)return {ok:false,pending:false,error:'Finish saving the current dish before restoring an unfinished save.'};
  let recovery:BulkRecovery;try{recovery=recoverySchema.parse(raw);}catch{return {ok:false,pending:false,error:'The saved request could not be read. Your current list has been kept.'};}
  pending.current={kind:'bulk',id:recovery.id,revision:recovery.revision,request:structuredClone(recovery.command),uncertain:true};setOperationPending(true);setBulkPending(true);halted.current=true;
  return {ok:true,pending:true};
 };
 useEffect(()=>{if(!loaded||!dirty||saving||operating||operationPending||halted.current)return;const timer=setTimeout(()=>void save(),1200);return()=>clearTimeout(timer);},[data,dirty,loaded,saving,operating,operationPending,save]);
 useEffect(()=>{if(!dirty&&!operationPending)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty,operationPending]);
 const dismissBulk=()=>{if(!pending.current&&!saveRequest.current&&JSON.stringify(current.current)===saved.current){report('');halted.current=false;}};
 const retry=async()=>{if(pending.current){await execute(pending.current.kind,pending.current.request);return;}if(!loaded){await load();return;}halted.current=false;await flush();};
 return {data,update,loaded,loading,error,unauthorized,dirty,saving,operating,operationPending,bulkPending,isOwner,updatedAt,updatedBy,revision:revision.current,load,retry,save,flush,runOperation,runBulk,refreshBulk,dismissBulk,getBulkRecovery,restoreBulkRecovery};
}
