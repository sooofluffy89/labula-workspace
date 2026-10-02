'use client';
import {useEffect,useState} from 'react';
import {stationIds,stationLabel,stationFilterSchema,makeStationCommand,isStationCommand,matchesStation,stationGroups,type StationId,type StationFilter} from '@/lib/checking-stations';
import type {StockItem} from '@/lib/stock';
import type {StockController,StockState} from '@/lib/stock-client';
import type {CheckAnswer} from '@/lib/evening';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {GroupSection,useCollapsedGroups} from './grouped-sections';

export function useStationSelection(account:string){
 const key='labula.station-selection.v1.'+encodeURIComponent(account.toLowerCase());
 const [value,setValue]=useState<{key:string;ids:string[]}>({key,ids:[]});
 useEffect(()=>{let ids:string[]=[];try{const v=JSON.parse(localStorage.getItem(key)??'[]');if(Array.isArray(v))ids=[...new Set(v.filter((x):x is string=>typeof x==='string'&&x.length<=100))];}catch{}queueMicrotask(()=>setValue({key,ids}));},[key]);
 const ids=value.key===key?value.ids:[];
 const write=(next:string[])=>{setValue({key,ids:next});try{localStorage.setItem(key,JSON.stringify(next));}catch{/* Selection is not a submitted operation. */}};
 return {ids,write,toggle:(id:string,on:boolean)=>write(on?[...new Set([...ids,id])]:ids.filter(i=>i!==id))};
}
export type StationReview={items:StockItem[];desired?:StationId|null};
export function StationEditor({review,onClose,state,getController,onRefresh,onReturnFocus}:{review:StationReview|null;onClose:()=>void;state:StockState;getController:()=>StockController|null;onRefresh:()=>void;onReturnFocus:()=>void}){
 const [sending,setSending]=useState(false);
 const [desired,setDesired]=useState<StationId|null>(null),[baseline,setBaseline]=useState<StockItem[]>([]);
 const pending=isStationCommand(state.pending?.command)?state.pending!:null;
 useEffect(()=>{if(review)queueMicrotask(()=>{setBaseline(review.items);setDesired(review.desired!==undefined?review.desired:review.items.length===1?review.items[0].stationId??null:null);});},[review]);
 const current=baseline.map(i=>state.snapshot?.items.find(x=>x.itemId===i.itemId));
 const changed=current.some((i,n)=>!i||i.stationRevision!==baseline[n].stationRevision);
 const changes=baseline.filter(i=>(i.stationId??null)!==desired);
 const busy=sending||state.saving||state.loading;
 const recover=async()=>{if(busy)return;setSending(true);try{if(await getController()?.retry())onClose();}finally{setSending(false);}};
 const save=async()=>{if(!state.snapshot||busy||changed||state.pending||state.error||!changes.length)return;const c=makeStationCommand(changes,desired,state.snapshot.accountId);setSending(true);try{if(await getController()?.changeStation(c))onClose();}finally{setSending(false);}};
 return <Dialog open={!!review} onOpenChange={open=>{if(!open&&!busy)onClose();}}><DialogContent showCloseButton={!busy} className="station-dialog" onCloseAutoFocus={e=>{e.preventDefault();onReturnFocus();}}><DialogHeader><DialogTitle>Assign checking station</DialogTitle><DialogDescription>Applies to new checks. Existing checks keep their station assignment.</DialogDescription></DialogHeader>
  <label>Checking station<select value={desired??'none'} disabled={busy||!!state.pending} onChange={e=>setDesired(e.target.value==='none'?null:e.target.value as StationId)}><option value="none" disabled={baseline.some(i=>i.track&&!!i.stationId)}>Not assigned</option>{stationIds.map(id=><option key={id} value={id}>{stationLabel(id)}</option>)}</select></label>
  <p>{baseline.length} selected · {changes.length} {changes.length===1?'change':'changes'}</p>
  <ul className="station-review-items">{baseline.map((i,n)=><li key={i.itemId}><strong>{i.name}</strong><span>{stationLabel(i.stationId)} → {stationLabel(desired)}</span>{changed&&<small>Shared: {current[n]?stationLabel(current[n]?.stationId):'No longer in list'}</small>}</li>)}</ul>
  {busy&&<p role="status">{state.saving?'Checking and saving stations…':'Loading shared stations…'}</p>}
  {state.error&&<p className="error" role="alert">{state.error}</p>}
  {!sending&&(changed||pending?.rejected)&&<div className="notice"><p>Shared settings changed. Your selection is kept. Refresh, compare and review before saving again.</p><Button variant="outline" disabled={busy} onClick={onRefresh}>Refresh shared stations</Button>{!state.error&&!busy&&<Button variant="outline" disabled={current.some(i=>!i)} onClick={async()=>{if(pending&&!await getController()?.keepShared())return;const s=getController()?.state.snapshot;const latest=baseline.map(i=>s?.items.find(x=>x.itemId===i.itemId)).filter((i):i is StockItem=>!!i);if(latest.length===baseline.length)setBaseline(latest);}}>Use my selection after review</Button>}</div>}
  <DialogFooter><Button variant="outline" disabled={busy} onClick={onClose}>{state.pending?'Close · keep pending change':'Cancel'}</Button>{pending&&!pending.rejected?<Button disabled={busy} onClick={()=>void recover()}>{busy?'Verifying original save…':'Retry original save'}</Button>:<Button disabled={busy||!!state.pending||!!state.error||changed||!changes.length} onClick={()=>void save()}>{busy?'Saving stations…':'Save station'}</Button>}</DialogFooter>
 </DialogContent></Dialog>;
}

export function useEveningStation(account:string){
 const key='labula.evening-station.v1.'+encodeURIComponent(account.toLowerCase());
 const [value,setValue]=useState<{key:string;filter:StationFilter}>({key,filter:'all'});
 useEffect(()=>{let filter:StationFilter='all';try{const result=stationFilterSchema.safeParse(localStorage.getItem(key));if(result.success)filter=result.data;}catch{}queueMicrotask(()=>setValue({key,filter}));},[key]);
 const filter=value.key===key?value.filter:'all';
 const choose=(filter:StationFilter)=>{setValue({key,filter});try{localStorage.setItem(key,filter);}catch{/* Optional display preference. */}};
 return {filter,choose};
}
export function EveningStations({answers,filter,onFilter,renderRows,account,checkId}:{answers:CheckAnswer[];filter:StationFilter;onFilter:(v:StationFilter)=>void;renderRows:(rows:CheckAnswer[])=>React.ReactNode;account:string;checkId:string}){
 const groups=stationGroups(answers),collapse=useCollapsedGroups(account,'evening-stations',checkId);
 const total=answers.filter(a=>a.value!==null&&a.mappingValid).length;
 const remaining=answers.length-total;
 const visible=answers.filter(i=>matchesStation(i,filter));
 const checked=visible.filter(a=>a.value!==null&&a.mappingValid).length;
 return <div className="evening-stations"><div className="station-tabs" role="group" aria-label="Checking station"><Button variant={filter==='all'?'default':'outline'} aria-pressed={filter==='all'} onClick={()=>onFilter('all')}>All<span>{total}/{answers.length}</span></Button>{groups.filter(g=>g.id!==null||g.rows.length>0||filter==='none').map(g=><Button key={g.id??'none'} variant={filter===(g.id??'none')?'default':'outline'} aria-pressed={filter===(g.id??'none')} onClick={()=>onFilter(g.id??'none')}>{g.label}<span>{g.checked}/{g.rows.length}</span></Button>)}</div>
  {answers.some(a=>a.stationId===undefined)&&<p className="muted small">Station assignments were not recorded for some items in this check. They remain in Not assigned.</p>}
  {filter!=='all'&&visible.length>0&&checked===visible.length&&<p className="muted small">{stationLabel(filter==='none'?null:filter)} checked · {remaining} {remaining===1?'item remains':'items remain'} in other stations.</p>}
  {!visible.length?<div className="empty-panel"><p>No items in this station for this check.</p><Button variant="outline" onClick={()=>onFilter('all')}>Show all items</Button></div>:filter!=='all'?renderRows(visible):<div className="ingredient-groups">{groups.filter(g=>g.rows.length).map(g=><GroupSection key={g.id??'none'} id={g.id} sectionId="evening-station" label={g.label} meta={`${g.checked}/${g.rows.length} checked`} alert={g.rows.some(a=>!a.mappingValid)} open={!collapse.collapsed.includes(g.id??'unassigned')} onToggle={()=>collapse.toggle(g.id??'unassigned')}>{renderRows(g.rows)}</GroupSection>)}</div>}
 </div>;
}
