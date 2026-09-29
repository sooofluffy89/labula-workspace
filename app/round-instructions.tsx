'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/request-json';
import type {InstructionIndex} from '@/lib/prep-notes';
import {usePrepNotes,PrepInstructionLine,PrepInstructionEditor} from './prep-notes';
import {Button} from '@/components/ui/button';
export function useInstructionIndex(){
 const notes=usePrepNotes(),[data,setData]=useState<InstructionIndex|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),serial=useRef(0),alive=useRef(true);
 useEffect(()=>{const token=serial;alive.current=true;return()=>{alive.current=false;token.current++;};},[]);
 const accountId=notes.state.identity?.accountId;
 const refresh=async()=>{const seq=++serial.current;setLoading(true);setError('');try{const {res,body}=await requestJson<InstructionIndex&{error?:string}>('/api/prep-instructions',{cache:'no-store'});if(!alive.current||seq!==serial.current)return;if(!res.ok||body.supported!==1||!Array.isArray(body.instructions))throw Error(body.error??'Instruction previews are unavailable on this server. Retry after updating.');if(body.accountId!==accountId)throw Error('The signed-in account changed.');setData(body);}catch(e){if(alive.current&&seq===serial.current){setData(null);setError(e instanceof SyntaxError?'Instruction previews are unavailable on this server. Retry after updating.':(e as Error).message);}}finally{if(alive.current&&seq===serial.current)setLoading(false);}};
 useEffect(()=>{const token=serial;let cancelled=false;queueMicrotask(()=>{if(!cancelled&&notes.state.identity?.canEdit)void refresh();});return()=>{cancelled=true;token.current++;}; // eslint-disable-next-line react-hooks/exhaustive-deps
 },[accountId,notes.state.identity?.canEdit,notes.state.received]);
 return {data:data?.accountId===accountId?data:null,loading,error,refresh,notes};
}
export function RoundInstruction({itemId,name,index,loading,error,open,onOpen,onClose}:{itemId:string;name:string;index:InstructionIndex|null;loading:boolean;error:string;open:boolean;onOpen:()=>void;onClose:()=>void}){
 const {controller,state}=usePrepNotes(),instruction=index?.instructions.find(i=>i.item_id===itemId),pending=state.pending.find(p=>p.command.kind==='instruction'&&p.command.itemId===itemId);let draft=false;
 try{draft=!!controller?.draft('instruction.'+encodeURIComponent(itemId));}catch{draft=true;}
 return <div className="round-instruction"><div className="round-instruction-preview">{instruction?.text?<PrepInstructionLine instruction={{catalogId:itemId,text:instruction.text,revision:instruction.revision}} name={name} onDetails={onOpen} onComments={()=>{}}/>:index?<p className="small muted">No prep instruction yet</p>:<p className="small muted">{error?'Instruction unavailable': 'Loading instruction…'}</p>}
 {pending?<p className="small" role="status">{pending.rejected?'Instruction needs review':state.sending===pending.command.id?'Saving instruction…':'Waiting to share instruction'}</p>:draft?<p className="small">Draft on this device</p>:null}</div>
 <Button variant="ghost" aria-label={`${instruction?.text?'Edit':'Add'} instruction for ${name}`} aria-expanded={open} aria-controls={'round-instruction-'+itemId} disabled={!state.identity?.canEdit||!index||loading} onClick={open?onClose:onOpen}>{open?'Close instruction':instruction?.text?'Edit instruction':'Add instruction'}</Button>
 {open&&<div id={'round-instruction-'+itemId} className="round-inline-editor"><PrepInstructionEditor key={itemId} itemId={itemId} inline onClose={onClose}/></div>}</div>;
}
