'use client';
import {useCallback,useEffect} from 'react';
import type {InstructionIndex} from '@/lib/prep-notes';
import {usePrepNotes,PrepInstructionLine,PrepInstructionEditor} from './prep-notes';
import {Button} from '@/components/ui/button';
export function useInstructionIndex(){
 const notes=usePrepNotes(),actor=notes.state.identity?.accountId,canEdit=notes.state.identity?.canEdit;
 const refresh=useCallback((maxAge=0)=>notes.controller?.refreshIndex(maxAge)??Promise.resolve(false),[notes.controller]);
 useEffect(()=>{if(canEdit)void notes.controller?.refreshIndex();},[actor,canEdit,notes.controller]);
 return {data:canEdit&&notes.state.index?.accountId===actor?notes.state.index??null:null,loading:!!notes.state.indexLoading,error:notes.state.indexError??'',checkedAt:notes.state.indexCheckedAt,refresh,notes};
}
export function RoundInstruction({itemId,name,index,loading,error,open,onOpen,onClose}:{itemId:string;name:string;index:InstructionIndex|null;loading:boolean;error:string;open:boolean;onOpen:()=>void;onClose:()=>void}){
 const {controller,state}=usePrepNotes(),instruction=index?.instructions.find(i=>i.item_id===itemId),pending=state.pending.find(p=>p.command.kind==='instruction'&&p.command.itemId===itemId);let draft=false;
 try{draft=!!controller?.draft('instruction.'+encodeURIComponent(itemId));}catch{draft=true;}
 return <div className="round-instruction"><div className="round-instruction-preview">{instruction?.text?<PrepInstructionLine instruction={{catalogId:itemId,text:instruction.text,revision:instruction.revision}} name={name} onDetails={onOpen} onComments={()=>{}}/>:index?<p className="small muted">No prep instruction yet</p>:<p className="small muted">{error?'Instruction unavailable': 'Loading instruction…'}</p>}
 {pending?<p className="small" role="status">{pending.rejected?'Instruction needs review':state.sending===pending.command.id?'Saving instruction…':'Waiting to share instruction'}</p>:draft?<p className="small">Draft on this device</p>:null}</div>
 <Button variant="ghost" aria-label={`${instruction?.text?'Edit':'Add'} instruction for ${name}`} aria-expanded={open} aria-controls={'round-instruction-'+itemId} disabled={!state.identity?.canEdit||!index||!!error||loading&&!index} onClick={open?onClose:onOpen}>{open?'Close instruction':instruction?.text?'Edit instruction':'Add instruction'}</Button>
 {open&&<div id={'round-instruction-'+itemId} className="round-inline-editor"><PrepInstructionEditor key={itemId} itemId={itemId} inline onClose={onClose}/></div>}</div>;
}
