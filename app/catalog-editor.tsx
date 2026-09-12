'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter } from '@/components/ui/dialog';
import { Field,Choice } from './recipe-ui';
import { itemSchema,normalizeName,newItem, type Item } from '@/lib/notebook';

export function CreateItemDialog({name,items,onClose,onCreate}:{name:string;items:Item[];onClose:()=>void;onCreate:(item:Item)=>void}){
 const [draft,setDraft]=useState(()=>newItem(name));const [error,setError]=useState('');const duplicate=items.find(i=>normalizeName(i.name)===normalizeName(draft.name));
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent><DialogHeader><DialogTitle>Add to the shared kitchen list</DialogTitle><DialogDescription>Create this item once, then reuse it in any recipe.</DialogDescription></DialogHeader><div className="dialog-body"><Field label="Item name"><Input autoFocus placeholder="e.g. chilli garlic sauce" value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><div><Choice label="What is it?" value={draft.kind} onChange={v=>setDraft({...draft,kind:v as Item['kind']})} options={[["bought","Bought ingredient"],["prep","House-made preparation"]]}/></div><div className="info">Use a specific name when the preparation differs: “coriander, whole” and “coriander, washed & trimmed” can be separate items.</div>{duplicate&&<div className="notice">“{duplicate.name}” already exists. Use it to keep your overview accurate.</div>}{error&&<p role="alert" className="error small">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button>{duplicate?<Button onClick={()=>onCreate(duplicate)}>Use existing item</Button>:<Button onClick={()=>{const result=itemSchema.safeParse(draft);if(!result.success){setError('Enter an item name before continuing.');return;}onCreate(result.data);}}>Create item</Button>}</DialogFooter></DialogContent></Dialog>;
}
export function ItemEditor({item,onClose,onSave}:{item:Item;onClose:()=>void;onSave:(item:Item)=>string|null}){
 const [draft,setDraft]=useState<Item>(()=>structuredClone(item));const [error,setError]=useState('');
 return <Dialog open onOpenChange={v=>{if(!v)onClose();}}><DialogContent onInteractOutside={e=>e.preventDefault()}><DialogHeader><DialogTitle>Edit item name</DialogTitle><DialogDescription>This name is shared across all dishes that use the item.</DialogDescription></DialogHeader><div className="dialog-body"><Field label="Item name"><Input autoFocus value={draft.name} onChange={e=>setDraft({...draft,name:e.target.value})}/></Field><span className={'badge '+(item.kind==='prep'?'prep':'')}>{item.kind==='prep'?'House-made preparation':'Bought ingredient'}</span>{error&&<p role="alert" className="error">{error}</p>}</div><DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={()=>{const result=onSave(draft);if(result)setError(result);else onClose();}}>Save item</Button></DialogFooter></DialogContent></Dialog>;
}
