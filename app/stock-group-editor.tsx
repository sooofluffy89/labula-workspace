'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/request-json';
import {groupCommandSchema,groupLabel,ingredientGroups,type GroupCommand,type IngredientGroupId} from '@/lib/ingredient-groups';
import type {StockSnapshot} from '@/lib/stock';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';

type Pending={accountId:string;command:GroupCommand;rejected?:boolean};
const storageKey=(account:string)=>`labula.group-change.v1.${encodeURIComponent(account)}`;
export function StockGroupEditor({account,snapshot,selection,onSelection,onRefresh,blocked}:{account:string;snapshot:StockSnapshot|null;selection:string|null;onSelection:(id:string|null)=>void;onRefresh:()=>void;blocked:boolean}){
 const [pending,setPending]=useState<Pending|null>(null),[desired,setDesired]=useState<IngredientGroupId|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const busy=useRef(false),trigger=useRef<HTMLElement|null>(null);
 const row=snapshot?.items.find(i=>i.itemId===selection);
 useEffect(()=>{if(!snapshot)return;const k=storageKey(account);try{const raw=localStorage.getItem(k);if(!raw)return;const stored=JSON.parse(raw) as Pending;const command=groupCommandSchema.parse(stored.command);if(stored.accountId!==snapshot.accountId||typeof stored.rejected!=='undefined'&&typeof stored.rejected!=='boolean')throw Error('A saved group change belongs to another account or is invalid. Keep this browser data and ask the owner for help.');queueMicrotask(()=>setPending({accountId:stored.accountId,command,rejected:stored.rejected}));}catch(e){queueMicrotask(()=>setError((e as Error).message));}},[account,snapshot]);
 useEffect(()=>{if(row)queueMicrotask(()=>setDesired(row.groupId));},[row]);
 const persist=(value:Pending)=>{localStorage.setItem(storageKey(account),JSON.stringify(value));setPending(value);};
 const clear=()=>{localStorage.removeItem(storageKey(account));setPending(null);};
 const send=async(value:Pending)=>{if(busy.current)return;busy.current=true;setSaving(true);setError('');setNotice('');try{
  const auth=await requestJson<StockSnapshot&{error?:string}>('/api/stock',{cache:'no-store'});
  if(!auth.res.ok)throw Error(auth.body.error??'Could not verify your account. Sign in, then retry.');
  if(auth.body.accountId!==value.accountId)throw Error('This group change belongs to another account. Sign in with the original account.');
  const r=await requestJson<{operationId?:string;error?:string;code?:string}>('/api/ingredient-groups',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(value.command)});
  if(!r.res.ok){if(r.res.status===409&&['group_conflict','command_mismatch'].includes(r.body.code??''))persist({...value,rejected:true});throw Error(r.body.error??'Could not confirm the group change.');}
  if(r.body.operationId!==value.command.id)throw Error('The server did not confirm the original group change. Retry safely.');
  clear();onSelection(null);setNotice('Group saved. New checks will use this group.');onRefresh();
  requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus();else document.getElementById('stock-group-heading-'+(value.command.groupId??'unassigned'))?.focus();});
 }catch(e){setError(e instanceof Error?e.message:'Could not confirm the group change. Retry safely.');}finally{busy.current=false;setSaving(false);}};
 const change=()=>{if(!snapshot||!row||pending||saving||blocked)return;const value:Pending={accountId:snapshot.accountId,command:{id:crypto.randomUUID(),itemId:row.itemId,revision:row.groupRevision,groupId:desired}};
  try{persist(value);}catch{setError('Your browser could not keep a recovery copy. Nothing was sent.');return;}
  void send(value);
 };
 const reapply=()=>{if(!pending?.rejected||!snapshot)return;const latest=snapshot.items.find(i=>i.itemId===pending.command.itemId);if(!latest){setError('This ingredient no longer exists. Keep the shared result.');return;}
  const next:Pending={accountId:snapshot.accountId,command:{id:crypto.randomUUID(),itemId:latest.itemId,revision:latest.groupRevision,groupId:pending.command.groupId}};
  try{persist(next);}catch{setError('Could not keep the reviewed change on this device. Retry.');return;}void send(next);
 };
 const begin=(id:string)=>{trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setError('');onSelection(id);};
 return <>
  {snapshot?.canManageGroups&&<>
   {snapshot.groupConflicts.length>0&&<div className="notice ingredient-group-conflicts"><strong>Review merged ingredient groups</strong><p>{snapshot.groupConflicts.length} merged item{snapshot.groupConflicts.length===1?' has':'s have'} a different group from the kept item. The kept item’s group remains in use.</p>{snapshot.groupConflicts.map(c=><Button key={c.sourceId} variant="outline" onClick={()=>begin(c.targetId)}>{c.targetName}: {groupLabel(c.targetGroupId)} · review</Button>)}</div>}
   {pending&&<div className="notice" role="status"><strong>Group change needs confirmation</strong><p>{snapshot.items.find(i=>i.itemId===pending.command.itemId)?.name??'Unavailable item'} → {groupLabel(pending.command.groupId)}. {pending.rejected?'The shared item changed. Refresh and review before applying your choice.':'The save result is uncertain. Retry the same request.'}</p><div className="actions"><Button disabled={saving||blocked} onClick={()=>{if(pending.rejected){setError('');onRefresh();}else void send(pending);}}>{pending.rejected?'Refresh shared group':'Retry group save'}</Button>{pending.rejected&&<><Button disabled={saving||blocked||!!error} variant="outline" onClick={reapply}>Apply my group after review</Button><Button disabled={saving} variant="outline" onClick={()=>{try{clear();setError('');setNotice('Kept the shared group.');onRefresh();}catch{setError('Could not clear saved recovery. Retry.');}}}>Keep shared group</Button></>}</div></div>}
   {saving&&<p role="status">Saving ingredient group…</p>}{notice&&<p role="status">{notice}</p>}{error&&<p className="error" role="alert">{error}</p>}
  </>}
  <Dialog open={!!selection} onOpenChange={open=>{if(!open&&!saving)onSelection(null);}}><DialogContent><DialogHeader><DialogTitle>Change ingredient group</DialogTitle><DialogDescription>{row?.name??'This ingredient is unavailable.'} · Applies to new evening checks. Existing checks keep their original list.</DialogDescription></DialogHeader>
   <label className="ingredient-group-select">Practical group<select value={desired??''} onChange={e=>setDesired(e.target.value?e.target.value as IngredientGroupId:null)} disabled={!row||saving||!!pending}>
    <option value="">Needs grouping</option>{ingredientGroups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
   </select></label>
   <DialogFooter><Button variant="outline" disabled={saving} onClick={()=>onSelection(null)}>Close</Button><Button disabled={!row||saving||!!pending||blocked||desired===row.groupId} onClick={change}>{saving?'Saving…':'Save group'}</Button></DialogFooter>
  </DialogContent></Dialog>
 </>;
}
