'use client';
import { useCallback,useEffect,useRef,useState } from 'react';
import { initialNotebook,validateNotebook,validationMessage,type Notebook } from '@/lib/notebook';
type ApiReply={data?:unknown;revision:number;updatedAt:string;updatedBy:string;error?:string};
export function useNotebook(){
 const [data,setData]=useState<Notebook>(initialNotebook);const [loaded,setLoaded]=useState(false);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [unauthorized,setUnauthorized]=useState(false);const [dirty,setDirty]=useState(false);const [saving,setSaving]=useState(false);const [updatedAt,setUpdatedAt]=useState('');const [updatedBy,setUpdatedBy]=useState('');
 const current=useRef(data);const revision=useRef(0);const saved=useRef('');const inFlight=useRef(false);const halted=useRef(false);
 const load=useCallback(async()=>{setLoading(true);setError('');try{const res=await fetch('/api/notebook',{cache:'no-store'});const body=await res.json() as ApiReply;if(!res.ok){setUnauthorized(res.status===401);throw new Error(body.error??'Could not load recipes.');}const next=validateNotebook(body.data);setData(next);current.current=next;revision.current=body.revision;saved.current=JSON.stringify(next);setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setDirty(false);setLoaded(true);halted.current=false;setUnauthorized(false);}catch(e){setError(e instanceof Error?e.message:'Could not load recipes.');}finally{setLoading(false);}},[]);
 useEffect(()=>{void load();},[load]);
 const update=useCallback((transform:(old:Notebook)=>Notebook)=>{const next=transform(current.current);current.current=next;setData(next);setDirty(JSON.stringify(next)!==saved.current);},[]);
 const save=useCallback(async()=>{if(inFlight.current||!loaded)return;const snapshot=current.current;const payload=JSON.stringify(snapshot);if(payload===saved.current){setDirty(false);return;}try{validateNotebook(snapshot);}catch(e){setError(validationMessage(e));halted.current=true;return;}
 inFlight.current=true;setSaving(true);setError('');try{const res=await fetch('/api/notebook',{method:'PUT',headers:{'Content-Type':'application/json','If-Match':String(revision.current)},body:payload});const body=await res.json() as ApiReply;if(!res.ok){setUnauthorized(res.status===401);throw new Error(body.error??'Could not save recipes.');}revision.current=body.revision;saved.current=payload;setUpdatedAt(body.updatedAt);setUpdatedBy(body.updatedBy);setDirty(JSON.stringify(current.current)!==payload);halted.current=false;
 }catch(e){halted.current=true;setError(e instanceof Error?e.message:'Connection lost. Your edits remain on this page.');}finally{inFlight.current=false;setSaving(false);}},[loaded]);
 useEffect(()=>{if(!loaded||!dirty||saving||halted.current)return;const timer=setTimeout(()=>void save(),1200);return()=>clearTimeout(timer);},[data,dirty,loaded,saving,save]);
 useEffect(()=>{if(!dirty)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[dirty]);
 const retry=async()=>{if(!loaded){await load();return;}halted.current=false;await save();};
 return {data,update,loaded,loading,error,unauthorized,dirty,saving,updatedAt,updatedBy,load,retry,save};
}
