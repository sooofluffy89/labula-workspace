'use client';
import {useEffect,useRef,useState} from 'react';
import {requestJson} from '@/lib/request-json';
import {groupCommandSchema,groupLabel,ingredientGroups,type GroupCommand,type IngredientGroupId} from '@/lib/ingredient-groups';
import type {GroupConflict,StockSnapshot} from '@/lib/stock';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';

type Pending={accountId:string;command:GroupCommand;rejected?:boolean};
const storageKey=(account:string)=>`labula.group-change.v1.${encodeURIComponent(account)}`;
export function StockGroupEditor({account,snapshot,selection,onSelection,onRefresh,blocked}:{account:string;snapshot:StockSnapshot|null;selection:string|null;onSelection:(id:string|null)=>void;onRefresh:()=>void;blocked:boolean}){
 const [pending,setPending]=useState<Pending|null>(null),[desired,setDesired]=useState<IngredientGroupId|null>(null),[saving,setSaving]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const [baseline,setBaseline]=useState<{id:string;revision:number;groupId:IngredientGroupId|null;reviews:GroupConflict[]}|null>(null);
 const busy=useRef(false),trigger=useRef<HTMLElement|null>(null);
 const row=snapshot?.items.find(i=>i.itemId===selection);
 useEffect(()=>{if(!snapshot)return;const k=storageKey(account);try{const raw=localStorage.getItem(k);if(!raw)return;const stored=JSON.parse(raw) as Pending;const command=groupCommandSchema.parse(stored.command);if(stored.accountId!==snapshot.accountId||typeof stored.rejected!=='undefined'&&typeof stored.rejected!=='boolean')throw Error('A saved group change belongs to another account or is invalid. Keep this browser data and ask a Manager for help.');queueMicrotask(()=>setPending({accountId:stored.accountId,command,rejected:stored.rejected}));}catch(e){queueMicrotask(()=>setError((e as Error).message));}},[account,snapshot]);
 useEffect(()=>{if(!selection){queueMicrotask(()=>setBaseline(null));return;}if(row&&baseline?.id!==selection){trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;queueMicrotask(()=>{setBaseline({id:selection,revision:row.groupRevision,groupId:row.groupId,reviews:snapshot?.groupConflicts.filter(c=>c.targetId===selection)??[]});setDesired(pending?.command.itemId===selection?pending.command.groupId:row.groupId);});}},[selection,row,pending,baseline,snapshot]);
 const reviews=baseline?.id===selection?baseline.reviews:[];
 const revisionChanged=!!row&&baseline?.id===selection&&baseline.revision!==row.groupRevision;
 const persist=(value:Pending)=>{localStorage.setItem(storageKey(account),JSON.stringify(value));setPending(value);};
 const clear=()=>{localStorage.removeItem(storageKey(account));setPending(null);};
 const send=async(value:Pending)=>{if(busy.current)return;busy.current=true;setSaving(true);setError('');setNotice('');try{
  const auth=await requestJson<StockSnapshot&{error?:string}>('/api/stock',{cache:'no-store'});
  if(!auth.res.ok)throw Error(auth.body.error??'Could not verify your account. Sign in, then retry.');
  if(auth.body.accountId!==value.accountId)throw Error('This group change belongs to another account. Sign in with the original account.');
  const r=await requestJson<{operationId?:string;error?:string;code?:string}>('/api/ingredient-groups',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(value.command)});
  if(!r.res.ok){if(r.res.status===409&&['group_conflict','command_mismatch'].includes(r.body.code??''))persist({...value,rejected:true});throw Error(r.body.error??'Could not confirm the group change.');}
  if(r.body.operationId!==value.command.id)throw Error('The server did not confirm the original group change. Retry safely.');
  clear();onSelection(null);setNotice(value.command.reviewedMerges?'Group confirmed. Merge review resolved. New checks will use this group.':'Group saved. New checks will use this group.');onRefresh();
  requestAnimationFrame(()=>{if(trigger.current?.isConnected)trigger.current.focus();else document.getElementById('stock-group-heading-'+(value.command.groupId??'unassigned'))?.focus();});
 }catch(e){setError(e instanceof Error?e.message:'Could not confirm the group change. Retry safely.');}finally{busy.current=false;setSaving(false);}};
 const change=()=>{if(!snapshot||!row||baseline?.id!==selection||pending||saving||blocked||revisionChanged)return;const value:Pending={accountId:snapshot.accountId,command:{id:crypto.randomUUID(),itemId:row.itemId,revision:row.groupRevision,groupId:desired,...(reviews.length?{reviewedMerges:reviews.map(c=>({operationId:c.operationId,sourceRevision:c.sourceRevision}))}:{})}};
  try{persist(value);}catch{setError('Your browser could not keep a recovery copy. Nothing was sent.');return;}
  void send(value);
 };
 const reapply=()=>{if(!pending?.rejected||!snapshot)return;const latest=snapshot.items.find(i=>i.itemId===pending.command.itemId);if(!latest){setError('This ingredient no longer exists. Keep the shared result.');return;}
  if(pending.command.reviewedMerges){try{clear();setBaseline({id:latest.itemId,revision:latest.groupRevision,groupId:latest.groupId,reviews:snapshot.groupConflicts.filter(c=>c.targetId===latest.itemId)});setDesired(pending.command.groupId);onSelection(latest.itemId);setError('');setNotice('Review the current groups below, then confirm your choice.');}catch{setError('Could not reopen the group review. Retry.');}return;}
  const next:Pending={accountId:snapshot.accountId,command:{id:crypto.randomUUID(),itemId:latest.itemId,revision:latest.groupRevision,groupId:pending.command.groupId}};
  try{persist(next);}catch{setError('Could not keep the reviewed change on this device. Retry.');return;}void send(next);
 };
 const begin=(id:string)=>{trigger.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setError('');onSelection(id);};
 return <>
  {snapshot?.canManageGroups&&<>
   {snapshot.groupConflicts.length>0&&<div className="notice ingredient-group-conflicts"><strong>Review merged ingredient groups</strong><p>Confirm the group for {snapshot.groupConflicts.length===1?'this merged ingredient':'these merged ingredients'}. Your confirmation resolves the review for everyone.</p>{snapshot.groupConflicts.map(c=><Button key={c.operationId} variant="outline" onClick={()=>begin(c.targetId)}>{c.targetName}: {groupLabel(c.targetGroupId)} · review</Button>)}</div>}
   {pending&&!selection&&<div className="notice" role="status"><strong>Group change needs confirmation</strong><p>{snapshot.items.find(i=>i.itemId===pending.command.itemId)?.name??'Unavailable item'} → {groupLabel(pending.command.groupId)}. {pending.rejected?'The shared item changed. Refresh and review before applying your choice.':'The save result is uncertain. Retry the same request.'}</p><div className="actions"><Button disabled={saving||blocked} onClick={()=>{if(pending.rejected){setError('');onRefresh();}else void send(pending);}}>{pending.rejected?'Refresh shared group':'Retry group save'}</Button>{pending.rejected&&<><Button disabled={saving||blocked||!!error} variant="outline" onClick={reapply}>{pending.command.reviewedMerges?'Review group again':'Apply my group after review'}</Button><Button disabled={saving} variant="outline" onClick={()=>{try{clear();setError('');setNotice('Kept the shared group.');onRefresh();}catch{setError('Could not clear saved recovery. Retry.');}}}>Keep shared group</Button></>}</div></div>}
   {!selection&&saving&&<p role="status">Saving ingredient group…</p>}{notice&&<p role="status">{notice}</p>}{!selection&&error&&<p className="error" role="alert">{error}</p>}
  </>}
  <Dialog open={!!selection} onOpenChange={open=>{if(!open&&!saving)onSelection(null);}}><DialogContent><DialogHeader><DialogTitle>{reviews.length?'Review merged ingredient group':'Change ingredient group'}</DialogTitle><DialogDescription>{row?.name??'This ingredient is unavailable.'} · Applies to new evening checks. Existing checks keep their original list.</DialogDescription></DialogHeader>
   {reviews.length>0&&<div className="notice"><p>Kept ingredient: <strong>{row?.name}</strong> · {groupLabel(baseline?.groupId)}</p>{reviews.map(c=><p key={c.operationId}>Merged ingredient: <strong>{c.sourceName}</strong> · {groupLabel(c.sourceGroupId)}</p>)}<p>Keep the current group or choose another, then confirm to resolve this review.</p></div>}
   <label className="ingredient-group-select">Practical group<select value={desired??''} onChange={e=>setDesired(e.target.value?e.target.value as IngredientGroupId:null)} disabled={!row||saving||!!pending}>
    <option value="">Needs grouping</option>{ingredientGroups.map(g=><option key={g.id} value={g.id}>{g.label}</option>)}
   </select></label>
   {saving&&<p role="status">Checking and saving ingredient group…</p>}
   {error&&<p className="error" role="alert">{error}</p>}
   {revisionChanged&&!pending&&<div className="notice"><p>This group changed on another device. Your selection is kept: {groupLabel(desired)}. Shared group: {groupLabel(row?.groupId??null)}.</p><Button variant="outline" onClick={()=>{if(row){setBaseline({id:row.itemId,revision:row.groupRevision,groupId:row.groupId,reviews:snapshot?.groupConflicts.filter(c=>c.targetId===row.itemId)??[]});setError('');setNotice('Reviewed the updated shared group. Save to apply your selection.');}}}>Use my selection after review</Button><Button variant="outline" onClick={()=>{if(row){setBaseline({id:row.itemId,revision:row.groupRevision,groupId:row.groupId,reviews:snapshot?.groupConflicts.filter(c=>c.targetId===row.itemId)??[]});setDesired(row.groupId);setError('');setNotice('Kept the updated shared group.');}}}>Use shared group</Button></div>}
   {pending&&<div className="notice"><p>{pending.command.itemId===selection?`Your saved selection: ${groupLabel(pending.command.groupId)}. ${pending.rejected?'Shared data changed. Review before applying.':'The result is uncertain; retry the original request.'}`:'Another group change is waiting. Close this dialog to resolve it first.'}</p>{pending.command.itemId===selection&&<><Button disabled={saving||blocked} onClick={()=>pending.rejected?(setError(''),onRefresh()):void send(pending)}>{saving?'Checking original save…':pending.rejected?'Refresh shared group':'Retry original group save'}</Button>{pending.rejected&&<><p>Shared group: {groupLabel(row?.groupId??null)}</p><Button disabled={saving||blocked} onClick={reapply}>{pending.command.reviewedMerges?'Review group again':'Apply my group after review'}</Button><Button variant="outline" disabled={saving} onClick={()=>{try{clear();setDesired(row?.groupId??null);if(row)setBaseline({id:row.itemId,revision:row.groupRevision,groupId:row.groupId,reviews:snapshot?.groupConflicts.filter(c=>c.targetId===row.itemId)??[]});setError('');}catch{setError('Could not clear saved recovery. Retry.');}}}>Keep shared group</Button></>}</>}</div>}
   <DialogFooter><Button variant="outline" disabled={saving} onClick={()=>onSelection(null)}>Close</Button><Button disabled={!row||baseline?.id!==selection||saving||!!pending||blocked||revisionChanged||(desired===row.groupId&&!reviews.length)} onClick={change}>{saving?'Saving…':reviews.length?'Confirm group & resolve':'Save group'}</Button></DialogFooter>
  </DialogContent></Dialog>
 </>;
}
