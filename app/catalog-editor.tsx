'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { Field,Choice } from './recipe-ui';
import { itemSchema,itemNameSchema,newItem,validationMessage, type Item } from '@/lib/notebook';
import {exactItem,suggestions} from '@/lib/catalog';

type PendingSaveProps={pending?:boolean;onRetryPending?:()=>unknown|Promise<unknown>};
const pendingMessage='An earlier save needs confirmation. Your input is kept here. Retry that save before continuing.';

export function CreateItemDialog({name,items,onClose,onCreate,pending=false,onRetryPending}:{name:string;items:Item[];onClose:()=>void;onCreate:(item:Item)=>void}&PendingSaveProps){
 const [draft,setDraft]=useState(()=>newItem(name)),[error,setError]=useState(''),[retrying,setRetrying]=useState(false);
 const duplicate=exactItem(items,draft.name),blocked=pending||retrying;
 const create=(item:Item)=>{if(blocked)return;setError('');try{onCreate(item);}catch(e){setError(validationMessage(e));}};
 const retry=async()=>{if(retrying||!onRetryPending)return;setRetrying(true);setError('');try{await onRetryPending();}catch(e){setError(validationMessage(e));}finally{setRetrying(false);}};
 return <Dialog open onOpenChange={v=>{if(!v&&!retrying)onClose();}}><DialogContent onInteractOutside={e=>{if(pending||retrying)e.preventDefault();}} onEscapeKeyDown={e=>{if(retrying)e.preventDefault();}} showCloseButton={!retrying}>
  <DialogHeader><DialogTitle>Add to the shared kitchen list</DialogTitle><DialogDescription>Create this item once, then reuse it in any recipe.</DialogDescription></DialogHeader>
  {pending&&<div className="notice" role="status"><p>{pendingMessage}</p>{onRetryPending&&<Button variant="outline" disabled={retrying} onClick={()=>void retry()}>{retrying?'Checking earlier save…':'Retry earlier save'}</Button>}</div>}
  <fieldset disabled={blocked} style={{border:0,padding:0,margin:0,minWidth:0}}><div className="dialog-body">
   <Field label="Item name"><Input autoFocus disabled={blocked} placeholder="e.g. chilli garlic sauce" aria-invalid={!!error} aria-describedby={error?'item-name-error':undefined} value={draft.name} onChange={e=>{if(!blocked)setDraft({...draft,name:e.target.value});}}/></Field>
   <div><Choice label="What is it?" value={draft.kind} onChange={v=>{if(!blocked)setDraft({...draft,kind:v as Item['kind']});}} options={[["bought","Bought ingredient"],["prep","House-made preparation"]]}/></div>
   <div className="info">Use a specific name when the preparation differs: “coriander, whole” and “coriander, washed & trimmed” can be separate items.</div>
   {duplicate&&<div className="notice">“{duplicate.name}” already exists. Use it to keep your overview accurate.</div>}
   {!duplicate&&draft.name.trim().length>2&&suggestions(items,draft.name).length>0&&<div className="notice"><strong>Possible existing item — please check</strong>{suggestions(items,draft.name).map(({item})=><div key={item.id}><Button variant="link" disabled={blocked} onClick={()=>create(item)}>Use {item.name}</Button></div>)}</div>}
  </div></fieldset>
  {error&&<p id="item-name-error" role="alert" className="error small">{error}</p>}
  <DialogFooter><Button variant="outline" disabled={retrying} onClick={onClose}>Cancel</Button>{duplicate?<Button disabled={blocked} onClick={()=>create(duplicate)}>Use existing item</Button>:<Button disabled={blocked} onClick={()=>{if(blocked)return;const result=itemSchema.safeParse(draft);if(!result.success){const nameResult=itemNameSchema.safeParse(draft.name);setError(nameResult.success?validationMessage(result.error):nameResult.error.issues[0].message);return;}create(result.data);}}>Create item</Button>}</DialogFooter>
 </DialogContent></Dialog>;
}
export function ItemEditor({item,onClose,onSave,pending=false,onRetryPending}:{item:Item;onClose:()=>void;onSave:(item:Item)=>string|null}&PendingSaveProps){
 const [draft,setDraft]=useState<Item>(()=>structuredClone(item)),[error,setError]=useState(''),[retrying,setRetrying]=useState(false);
 const blocked=pending||retrying;
 const save=()=>{if(blocked)return;setError('');const nameResult=itemNameSchema.safeParse(draft.name);if(!nameResult.success){setError(nameResult.error.issues[0].message);return;}try{const result=onSave(draft);if(result)setError(result);else onClose();}catch(e){setError(validationMessage(e));}};
 const retry=async()=>{if(retrying||!onRetryPending)return;setRetrying(true);setError('');try{await onRetryPending();}catch(e){setError(validationMessage(e));}finally{setRetrying(false);}};
 return <Dialog open onOpenChange={v=>{if(!v&&!retrying)onClose();}}><DialogContent onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(retrying)e.preventDefault();}} showCloseButton={!retrying}>
  <DialogHeader><DialogTitle>Edit item name</DialogTitle><DialogDescription>This name is shared across all dishes that use the item.</DialogDescription></DialogHeader>
  {pending&&<div className="notice" role="status"><p>{pendingMessage}</p>{onRetryPending&&<Button variant="outline" disabled={retrying} onClick={()=>void retry()}>{retrying?'Checking earlier save…':'Retry earlier save'}</Button>}</div>}
  <div className="dialog-body"><Field label="Item name"><Input autoFocus disabled={blocked} aria-invalid={!!error} aria-describedby={error?'item-name-error':undefined} value={draft.name} onChange={e=>{if(!blocked)setDraft({...draft,name:e.target.value});}}/></Field><span className={'badge '+(item.kind==='prep'?'prep':'')}>{item.kind==='prep'?'House-made preparation':'Bought ingredient'}</span><p className="muted small">To correct this type, the owner can open Ingredients &amp; prep → Review names &amp; duplicates → Correct item type.</p>{error&&<p id="item-name-error" role="alert" className="error">{error}</p>}</div>
  <DialogFooter><Button variant="outline" disabled={retrying} onClick={onClose}>Cancel</Button><Button disabled={blocked} onClick={save}>Save item</Button></DialogFooter>
 </DialogContent></Dialog>;
}
