'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {initialNotebook,validateNotebook,validationMessage,type Notebook} from '@/lib/notebook';
import type {CatalogOperation} from '@/lib/catalog';
import {catalogRecoverySchema,type CatalogRecovery} from '@/lib/catalog-draft';
import type {BulkCommand} from '@/lib/bulk';
import {recoverySchema,type BulkRecovery} from '@/lib/bulk-draft';
import {requestJson,RequestTimeoutError} from '@/lib/request-json';
import {saveRecoverySchema,type SaveRecovery} from '@/lib/save-recovery';
type Reply={data?:unknown;revision:number;updatedAt:string;updatedBy:string;isOwner?:boolean;error?:string;code?:string;user?:string};
export type BulkResult={ok:boolean;pending:boolean;conflict?:boolean;error?:string;code?:string;notebook?:Notebook};
type Pending={id:string;revision:number;uncertain:boolean}&({kind:'catalog';request:CatalogOperation}|{kind:'bulk';request:BulkCommand});
export function useNotebook(){
 const [data,setData]=useState<Notebook>(initialNotebook),[loaded,setLoaded]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[unauthorized,setUnauthorized]=useState(false),[dirty,setDirty]=useState(false),[saving,setSaving]=useState(false),[savePending,setSavePending]=useState(false),[operating,setOperating]=useState(false),[operationPending,setOperationPending]=useState(false),[bulkPending,setBulkPending]=useState(false),[isOwner,setIsOwner]=useState(false),[updatedAt,setUpdatedAt]=useState(''),[updatedBy,setUpdatedBy]=useState('');
 const [serverRevision,setServerRevision]=useState(0),[user,setUser]=useState('');
 const [saveRecoveryConflict,setSaveRecoveryConflict]=useState(false);
 const current=useRef(data),revision=useRef(0),saved=useRef(''),inFlight=useRef<Promise<boolean>|null>(null),halted=useRef(false),locked=useRef(false),loadingRef=useRef(false),pending=useRef<Pending|null>(null),saveRequest=useRef<{id:string;revision:number;payload:string;uncertain:boolean;localPayload?:string;restored?:boolean;conflict?:boolean}|null>(null),errorRef=useRef('');
 const report=(message:string)=>{errorRef.current=message;setError(message);};
 const accept=(body:Reply)=>{const next=validateNotebook(body.data);current.current=next;setData(next);revision.current=body.revision;setServerRevision(body.revision);if(body.user)setUser(body.user);saved.current=JSON.stringify(next);setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setIsOwner(body.isOwner===true);setDirty(false);setLoaded(true);halted.current=false;setUnauthorized(false);};
 const load=useCallback(async()=>{if(inFlight.current||locked.current||loadingRef.current||pending.current)return false;if(saveRequest.current?.uncertain||saveRequest.current?.restored){report('Retry the unfinished save before reloading the notebook.');return false;}loadingRef.current=true;setLoading(true);report('');try{const {res,body}=await requestJson<Reply>('/api/notebook',{cache:'no-store'});if(!res.ok){setUnauthorized(res.status===401);throw Error(body.error??'Could not load recipes.');}accept(body);pending.current=null;saveRequest.current=null;setOperationPending(false);setBulkPending(false);return true;}catch(e){report(e instanceof RequestTimeoutError?'Loading took too long. Your current data has been kept. Try again.':validationMessage(e));return false;}finally{loadingRef.current=false;setLoading(false);}},[]);
 useEffect(()=>{let active=true;void Promise.resolve().then(()=>{if(active)return load();});return()=>{active=false;};},[load]);
 const update=useCallback((transform:(old:Notebook)=>Notebook)=>{if(loadingRef.current)throw Error('Wait for the notebook to finish loading.');if(locked.current||pending.current||saveRequest.current?.uncertain||saveRequest.current?.restored)throw Error('Finish or retry the pending change first.');const next=validateNotebook(transform(current.current));current.current=next;setData(next);setDirty(JSON.stringify(next)!==saved.current);},[]);
 const save=useCallback(async():Promise<boolean>=>{
  if(inFlight.current)return inFlight.current;if(!loaded||loadingRef.current||pending.current)return false;
  if(!saveRequest.current){const payload=JSON.stringify(current.current);if(payload===saved.current){setDirty(false);return true;}try{validateNotebook(current.current);}catch(e){report(validationMessage(e));halted.current=true;return false;}saveRequest.current={id:crypto.randomUUID(),revision:revision.current,payload,uncertain:false};}
  const command=saveRequest.current;
  if(command.conflict){report('The earlier save was checked, but the shared notebook has changed. Download this draft to keep your extra local edits, then choose Continue with shared version.');return false;}
  const task=(async()=>{setSaving(true);report('');try{
   const {res,body}=await requestJson<Reply>('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(command.revision),'X-Operation-Id':command.id},body:command.payload});
   if(!res.ok){if(!command.restored&&(!command.uncertain&&res.status<500||body.code==='revision_conflict')){saveRequest.current=null;setSavePending(false);}setUnauthorized(res.status===401);if(command.restored&&body.code==='revision_conflict'){const latest=await requestJson<Reply>('/api/notebook',{cache:'no-store'});if(!latest.res.ok){setUnauthorized(latest.res.status===401);throw Error(latest.body.error??'Could not load the shared notebook. Retry the earlier save.');}accept(latest.body);command.conflict=true;setSaveRecoveryConflict(true);throw Error('The shared notebook changed before this earlier save could be applied. Download this draft to keep those edits, then choose Continue with shared version.');}throw Error(body.code==='command_mismatch'?'This saved request belongs to another account. Sign in with the account that started it, then retry.':body.error??'Could not save recipes.');}
   if(command.restored){
    const latest=await requestJson<Reply>('/api/notebook',{cache:'no-store'});if(!latest.res.ok){setUnauthorized(latest.res.status===401);throw Error(latest.body.error??'Could not load the shared notebook. Retry the earlier save.');}
    const extra=command.localPayload!==command.payload;accept(latest.body);
    if(extra&&latest.body.revision!==body.revision){command.conflict=true;setSaveRecoveryConflict(true);throw Error('The earlier save was confirmed, but the shared notebook changed afterwards. Download this draft to keep your extra local edits, then choose Continue with shared version.');}
    if(extra){const local=validateNotebook(JSON.parse(command.localPayload!));current.current=local;setData(local);setDirty(JSON.stringify(local)!==saved.current);saveRequest.current={id:crypto.randomUUID(),revision:latest.body.revision,payload:command.localPayload!,localPayload:command.localPayload!,uncertain:false,restored:true};setSavePending(true);halted.current=false;return true;}
    saveRequest.current=null;setSavePending(false);setSaveRecoveryConflict(false);halted.current=false;return true;
   }
   revision.current=body.revision;setServerRevision(body.revision);if(body.user)setUser(body.user);saved.current=command.payload;saveRequest.current=null;setSavePending(false);setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setDirty(JSON.stringify(current.current)!==command.payload);halted.current=false;return true;
  }catch(e){if(saveRequest.current){saveRequest.current.uncertain=true;setSavePending(true);}halted.current=true;report(validationMessage(e));return false;}finally{setSaving(false);inFlight.current=null;}})();inFlight.current=task;return task;
 },[loaded]);
 const flush=async()=>{if(inFlight.current&&!await inFlight.current)return false;if(!await save())return false;return JSON.stringify(current.current)===saved.current||await save();};
 const execute=async(kind:'catalog'|'bulk',request:CatalogOperation|BulkCommand):Promise<BulkResult>=>{
  if(locked.current||loadingRef.current)return {ok:false,pending:!!pending.current,error:'Another change is still being saved.'};
  if(pending.current&&(pending.current.kind!==kind||JSON.stringify(pending.current.request)!==JSON.stringify(request)))return {ok:false,pending:true,error:'Retry the unchanged pending request first.'};
  locked.current=true;setOperating(true);report('');
  try{
   if(!pending.current){if(!await flush())return {ok:false,pending:false,error:'Earlier dish edits have not been confirmed. If Retry earlier save is shown, use it first. Download draft keeps the earlier save and this list. Otherwise download your drafts, close this list and resolve the earlier edits on the dish page before restoring it.'};pending.current={id:crypto.randomUUID(),revision:revision.current,uncertain:false,...(kind==='bulk'?{kind,request:structuredClone(request as BulkCommand)}:{kind,request:structuredClone(request as CatalogOperation)})};setOperationPending(true);setBulkPending(kind==='bulk');}
   const command=pending.current;const {res,body}=await requestJson<Reply>(command.kind==='bulk'?'/api/bulk':'/api/catalog',{method:'POST',headers:{'Content-Type':'application/json','If-Match':String(command.revision)},body:JSON.stringify(command.kind==='bulk'?{commandId:command.id,command:command.request}:{operationId:command.id,operation:command.request})});
   if(!res.ok){const resolved=body.code==='revision_conflict'||(!command.uncertain&&res.status<500);if(resolved){pending.current=null;setOperationPending(false);setBulkPending(false);}else command.uncertain=true;setUnauthorized(res.status===401);report(body.code==='command_mismatch'?'This saved request could not be verified for this account. Sign in with the account that started the save, then retry.':body.error??'Could not confirm this change. Retry the same request.');halted.current=true;return {ok:false,pending:!resolved,conflict:body.code==='revision_conflict',error:errorRef.current,code:body.code};}
   accept(body);pending.current=null;setOperationPending(false);setBulkPending(false);return {ok:true,pending:false};
  }catch(e){if(pending.current)pending.current.uncertain=true;halted.current=true;report(validationMessage(e));return {ok:false,pending:!!pending.current,error:errorRef.current};}finally{locked.current=false;setOperating(false);}
 };
 const runOperation=async(operation:CatalogOperation)=>(await execute('catalog',operation)).ok;
 const runBulk=async(command:BulkCommand)=>execute('bulk',command);
 const refreshBulk=async():Promise<BulkResult>=>{if(pending.current)return {ok:false,pending:true,error:'Retry the unfinished save before loading another list.'};if(inFlight.current||locked.current||loadingRef.current)return {ok:false,pending:false,error:'Wait for the current save or loading to finish, then try again.'};if(JSON.stringify(current.current)!==saved.current||saveRequest.current)return {ok:false,pending:false,error:'Earlier dish edits are not saved. Download this draft, close it and select Save now on the dish page. Then reopen this dish and restore the draft.'};const ok=await load();return {ok,pending:false,error:ok?undefined:errorRef.current,notebook:ok?current.current:undefined};};
 const getBulkRecovery=():BulkRecovery|null=>{const p=pending.current;return p?.kind==='bulk'?{id:p.id,revision:p.revision,command:structuredClone(p.request)}:null;};
 const getCatalogRecovery=():CatalogRecovery|null=>{const p=pending.current;return p?.kind==='catalog'?{id:p.id,revision:p.revision,operation:structuredClone(p.request)}:null;};
 const getSavedBase=()=>saved.current?{revision:revision.current,notebook:validateNotebook(JSON.parse(saved.current))}:null;
 const getSaveRecovery=():SaveRecovery|null=>{const p=saveRequest.current;return p?{id:p.id,revision:p.revision,payload:p.payload,localPayload:p.localPayload??JSON.stringify(current.current)}:null;};
 const restoreSaveRecovery=(raw:SaveRecovery):BulkResult=>{
  if(!loaded||loadingRef.current||locked.current||inFlight.current||pending.current||saveRequest.current||JSON.stringify(current.current)!==saved.current)return {ok:false,pending:false,error:'Finish saving the current dish before restoring an earlier save.'};
  let recovery:SaveRecovery;try{recovery=saveRecoverySchema.parse(raw);}catch{return {ok:false,pending:false,error:'The earlier save could not be read. Your current list has been kept.'};}
  saveRequest.current={...recovery,uncertain:true,restored:true};setSavePending(true);setSaveRecoveryConflict(false);halted.current=true;return {ok:true,pending:false};
 };
 const retryEarlierSave=async():Promise<BulkResult>=>{if(!await flush())return {ok:false,pending:false,error:errorRef.current};return refreshBulk();};
 const acceptSharedAfterRecovery=():BulkResult=>{if(!saveRequest.current?.conflict||inFlight.current||locked.current)return {ok:false,pending:false,error:'Check the earlier save before choosing the shared version.'};saveRequest.current=null;setSavePending(false);setSaveRecoveryConflict(false);halted.current=false;report('');return {ok:true,pending:false,notebook:current.current};};
 const restoreBulkRecovery=(raw:BulkRecovery):BulkResult=>{
  if(!loaded||loadingRef.current||locked.current||inFlight.current||pending.current||saveRequest.current||JSON.stringify(current.current)!==saved.current)return {ok:false,pending:false,error:'Finish saving the current dish before restoring an unfinished save.'};
  let recovery:BulkRecovery;try{recovery=recoverySchema.parse(raw);}catch{return {ok:false,pending:false,error:'The saved request could not be read. Your current list has been kept.'};}
  pending.current={kind:'bulk',id:recovery.id,revision:recovery.revision,request:structuredClone(recovery.command),uncertain:true};setOperationPending(true);setBulkPending(true);halted.current=true;
  return {ok:true,pending:true};
 };
 const restoreCatalogRecovery=(raw:CatalogRecovery):BulkResult=>{
  if(!isOwner)return {ok:false,pending:false,error:'Only the owner can check this catalog change. Sign in with the account that started it.'};
  if(!loaded||loadingRef.current||locked.current||inFlight.current||pending.current||saveRequest.current||JSON.stringify(current.current)!==saved.current)return {ok:false,pending:false,error:'Finish saving the current draft before checking a catalog change.'};
  const parsed=catalogRecoverySchema.safeParse(raw);if(!parsed.success)return {ok:false,pending:false,error:'This catalog recovery request could not be read.'};
  const r=parsed.data;pending.current={kind:'catalog',id:r.id,revision:r.revision,request:r.operation,uncertain:true};setOperationPending(true);setBulkPending(false);halted.current=true;return {ok:true,pending:true};
 };
 const reconcileImported=async():Promise<BulkResult>=>{
  if(pending.current){const result=await execute(pending.current.kind,pending.current.request);if(!result.ok&&!result.conflict)return result;return refreshBulk();}
  if(saveRequest.current){await save();if(saveRequest.current?.conflict){acceptSharedAfterRecovery();return refreshBulk();}if(saveRequest.current)return {ok:false,pending:false,error:errorRef.current};}
  return refreshBulk();
 };
 useEffect(()=>{if(!loaded||!dirty||saving||operating||operationPending||halted.current)return;const timer=setTimeout(()=>void save(),1200);return()=>clearTimeout(timer);},[data,dirty,loaded,saving,operating,operationPending,save]);
 useEffect(()=>{if(!dirty&&!operationPending&&!savePending)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty,operationPending,savePending]);
 const dismissBulk=()=>{if(!pending.current&&!saveRequest.current&&JSON.stringify(current.current)===saved.current){report('');halted.current=false;}};
 const retry=async()=>{if(pending.current)return (await execute(pending.current.kind,pending.current.request)).ok;if(!loaded)return load();halted.current=false;return flush();};
 const refreshRestore=async():Promise<BulkResult>=>{const ok=await load();return {ok,pending:!!pending.current,error:ok?undefined:errorRef.current,notebook:ok?current.current:undefined};};
 return {data,update,loaded,loading,error,unauthorized,dirty,saving,savePending,saveRecoveryConflict,operating,operationPending,bulkPending,isOwner,updatedAt,updatedBy,revision:serverRevision,user,refreshRestore,load,retry,save,flush,getSavedBase,getCatalogRecovery,restoreCatalogRecovery,reconcileImported,runOperation,runBulk,refreshBulk,dismissBulk,getBulkRecovery,restoreBulkRecovery,getSaveRecovery,restoreSaveRecovery,retryEarlierSave,useSharedAfterRecovery:acceptSharedAfterRecovery};
}
