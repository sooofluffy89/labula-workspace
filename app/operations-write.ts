'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/request-json';

// Unknown results retain the exact durable command, never a reconstructed request.
export function useOperationsWrite(accountId:string,endpoint:string,scope=''){
 const key=`labula-operations-v1:${encodeURIComponent(accountId)}:${endpoint}:${scope}`;
 const [pending,setPending]=useState<Record<string,unknown>|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState(''),[rejected,setRejected]=useState(false),[recoveryBlocked,setRecoveryBlocked]=useState(false),[initialized,setInitialized]=useState(false);
 const live=useRef(true),writing=useRef(false);
 useEffect(()=>{live.current=true;let cancelled=false;queueMicrotask(()=>{if(cancelled)return;try{const raw=localStorage.getItem(key);if(raw){const c=JSON.parse(raw);if(c.actorId!==accountId||typeof c.id!=='string')throw Error();setPending(c);setError('A previous save needs confirmation. Retry its original request.');}}catch{setRecoveryBlocked(true);setError('Could not read saved recovery. Keep browser data; this save is blocked until recovery is available.');}setInitialized(true);});return()=>{cancelled=true;live.current=false;};},[key,accountId]);
 const submit=async(input:Record<string,unknown>)=>{
  if(writing.current||!accountId||recoveryBlocked||!initialized)return false;const command=pending??{...input,id:crypto.randomUUID(),actorId:accountId};
  try{localStorage.setItem(key,JSON.stringify(command));}catch{setError('Browser storage is unavailable. No change was sent.');return false;}
  writing.current=true;setPending(command);setBusy(true);setError('');setRejected(false);
  try{const r=await requestJson<{operationId?:string;error?:string}>(endpoint,{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(command)});if(!live.current)return false;if(!r.res.ok){setRejected([400,403,409,422].includes(r.res.status));throw Error(r.body.error??'Could not confirm the save.');}if(r.body.operationId!==command.id)throw Error('Save confirmation is incomplete. Retry the original request.');localStorage.removeItem(key);setPending(null);return true;}
  catch(e){if(live.current)setError((e as Error).message);return false;}finally{writing.current=false;if(live.current)setBusy(false);}
 };
 const discard=()=>{if(!rejected||busy)return;try{localStorage.removeItem(key);setPending(null);setRejected(false);setError('');}catch{setError('Recovery could not be cleared. Keep browser data.');}};
 return {pending,busy,error,rejected,recoveryBlocked,submit,discard};
}
