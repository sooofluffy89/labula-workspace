'use client';
import {useEffect,useRef,useState} from 'react';
import {StockController,type StockState} from '@/lib/stock-client';
import {stockRows,stockCounts,type StockFilter,type StockTypeFilter,type StockCategoryFilter} from '@/lib/stock';
import {categories} from '@/lib/menu';
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';

export function StockList({account,active}:{account:string;active:boolean}){
 const controller=useRef<StockController|null>(null);
 const [state,setState]=useState<StockState>({snapshot:null,loading:false,saving:false,error:'',unauthorized:false,pending:null,notice:''});
 const [search,setSearch]=useState(''),[filter,setFilter]=useState<StockFilter>('all'),[typeFilter,setTypeFilter]=useState<StockTypeFilter>('all'),[addOpen,setAddOpen]=useState(false),[addSearch,setAddSearch]=useState(''),[selected,setSelected]=useState<string[]>([]);
 const [categoryFilter,setCategoryFilter]=useState<StockCategoryFilter>('all');
 const summary=useRef<HTMLParagraphElement>(null),actionFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{
  const storage={get length(){return window.localStorage.length;},key:(index:number)=>window.localStorage.key(index),getItem:(key:string)=>window.localStorage.getItem(key),setItem:(key:string,value:string)=>window.localStorage.setItem(key,value),removeItem:(key:string)=>window.localStorage.removeItem(key)};
  const c=new StockController(account,storage);controller.current=c;const unsubscribe=c.subscribe(()=>setState(c.getSnapshot()));
  return()=>{unsubscribe();c.dispose();controller.current=null;};
 },[account]);
 useEffect(()=>{if(!active)return;void controller.current?.refresh();const refresh=()=>{if(document.visibilityState==='visible')void controller.current?.refresh();};window.addEventListener('focus',refresh);document.addEventListener('visibilitychange',refresh);return()=>{window.removeEventListener('focus',refresh);document.removeEventListener('visibilitychange',refresh);};},[active,account]);
 useEffect(()=>{const protect=(e:BeforeUnloadEvent)=>{if(controller.current?.state.pending){e.preventDefault();e.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[]);
 const items=state.snapshot?.items??[],counts=stockCounts(items),rows=stockRows(items,search,filter,true,typeFilter,categoryFilter),available=stockRows(items,addSearch,'all',false);
 useEffect(()=>{if(state.loading||state.saving||state.pending)return;const source=actionFocus.current;if(!source)return;actionFocus.current=null;if(active&&document.activeElement===document.body){if(source.isConnected)source.focus();else summary.current?.focus();}},[state.snapshot,state.loading,state.saving,state.pending,active]);
 const blocked=state.loading||state.saving||!!state.pending||!!state.error||!state.snapshot;
 const refresh=()=>void controller.current?.refresh();
 const change=async(itemId:string,included:boolean,track:boolean)=>{
  const item=controller.current?.state.snapshot?.items.find(i=>i.itemId===itemId);if(!item)return;
  actionFocus.current=document.activeElement instanceof HTMLElement?document.activeElement:null;await controller.current?.change([{itemId,revision:item.revision,included,track}]);
 };
 const add=async()=>{
  const latest=controller.current?.state.snapshot?.items??[];const chosen=latest.filter(i=>selected.includes(i.itemId)&&!i.included);
  if(!chosen.length)return;
  const ok=await controller.current?.change(chosen.map(i=>({itemId:i.itemId,revision:i.revision,included:true,track:false})));
  if(ok){setSelected([]);setAddOpen(false);}
 };
 const pending=state.pending;
 const status=<div className="stock-save-state">
  <p role="status">{state.saving?'Saving stock list changes…':state.loading?'Loading shared stock list…':pending?pending.rejected?'Stock change needs review.':'Stock save confirmation needed.':state.error||!state.snapshot?'Stock settings are not confirmed.':state.notice||'Stock list settings saved.'}</p>
  {state.error&&<p role="alert" className="error">{state.error}</p>}
  {pending&&<><p className="muted small">Your intended change is kept on this device:</p><ul>{pending.command.changes.map(c=><li key={c.itemId}>{items.find(i=>i.itemId===c.itemId)?.name??'Catalog item no longer available'}: {c.included?`in list · Track ${c.track?'On':'Off'}`:'remove from stock list'}{pending.rejected&&<> · {state.error?'Previously loaded':'Shared (last refreshed)'}: {(()=>{const row=items.find(i=>i.itemId===c.itemId);return !row?'unavailable':row.included?`in list · Track ${row.track?'On':'Off'}`:'removed';})()}</>}</li>)}</ul></>}
  <div className="actions">{pending&&!pending.rejected&&<Button disabled={state.loading||state.saving} onClick={async()=>{const ok=await controller.current?.retry();if(ok&&addOpen){setSelected([]);setAddOpen(false);}}}>Retry stock save</Button>}
   {pending?.rejected&&<><Button variant="outline" disabled={state.loading||state.saving} onClick={refresh}>Refresh to review</Button><Button disabled={state.loading||state.saving||!!state.error} onClick={()=>void controller.current?.applyReviewed()}>Apply my changes</Button><Button variant="outline" disabled={state.loading||state.saving} onClick={()=>void controller.current?.keepShared()}>Keep shared settings</Button></>}
   {!pending&&state.error&&<Button variant="outline" disabled={state.loading} onClick={refresh}>Retry loading stock list</Button>}
   {state.unauthorized&&<a href="/signin-with-chatgpt?return_to=/" target="_blank" rel="noreferrer" className="click-link">Sign in in a new tab, then retry</a>}
  </div>
 </div>;
 return <section className="stock-view" aria-labelledby="stock-heading">
  <div className="view-heading"><h1 id="stock-heading">Manage list</h1><p className="muted">Choose which items to check each evening. Track does not mean an item is available.</p></div>
  {!addOpen&&status}
  {state.snapshot&&<>
   <p ref={summary} tabIndex={-1} className="stock-counts">{counts.total} items in list <span>·</span> {counts.tracked} tracked <span>·</span> {counts.untracked} not tracked</p>
   <div className="toolbar"><Input aria-label="Search stock items" placeholder="Search names or alternative names…" value={search} onChange={e=>setSearch(e.target.value)}/><div className="actions"><Button variant="outline" disabled={state.loading||state.saving} onClick={refresh}>Refresh</Button><Button disabled={blocked} onClick={()=>{setSelected([]);setAddSearch('');setAddOpen(true);}}>Add items</Button></div></div>
   <div className="actions stock-filters" role="group" aria-label="Ingredient type"><span className="muted small">Type</span>{([['all','All types'],['bought','Bought ingredients'],['prep','House-made prep']] as const).map(([value,label])=><Button key={value} variant={typeFilter===value?'default':'outline'} aria-pressed={typeFilter===value} onClick={()=>setTypeFilter(value)}>{label}</Button>)}</div>
   <div className="actions stock-filters" role="group" aria-label="Menu category"><span className="muted small">Menu</span>{(['all',...categories] as const).map(value=><Button key={value} variant={categoryFilter===value?'default':'outline'} aria-pressed={categoryFilter===value} onClick={()=>setCategoryFilter(value)}>{value==='all'?'All categories':value==='Main Dishes'?'Main dishes':value}</Button>)}</div>
   <div className="actions stock-filters" role="group" aria-label="Tracking status"><span className="muted small">Tracking</span>{(['all','tracked','untracked'] as const).map(f=><Button key={f} variant={filter===f?'default':'outline'} aria-pressed={filter===f} onClick={()=>setFilter(f)}>{f==='all'?'All':f==='tracked'?'Tracked':'Not tracked'}</Button>)}</div>
   <p className="muted small stock-result" aria-live="polite">Showing {rows.length} of {counts.total} items in list{categoryFilter!=='all'&&<> · Used in active {categoryFilter.toLowerCase()}, including prep ingredients.</>}</p>
   {!rows.length?<div className="empty-panel">{counts.total===0?(items.length===0?'The saved ingredient catalog is empty. Create an item in Ingredients & prep first.':'Your stock list is empty. Use Add items to bring catalog items back.') :search?'No items match this search and filters.':categoryFilter!=='all'?'No items match these filters. Try All categories or change the other filters.':typeFilter!=='all'?'No items match these filters. Try All types or All.':filter==='tracked'?'No tracked items yet. Choose All and turn Track on for the items you want checked.':'No untracked items.'}</div>:<ul className="stock-rows">{rows.map(i=><li key={i.itemId} className="stock-row"><div><strong className="overflow-name">{i.name}</strong><div><span className={'badge '+(i.kind==='prep'?'prep':'')}>{i.kind==='prep'?'House-made prep':'Bought ingredient'}</span></div></div><div className="stock-row-actions"><Button role="switch" aria-checked={i.track} aria-label={`Track ${i.name}`} variant={i.track?'default':'outline'} disabled={blocked} onClick={()=>void change(i.itemId,true,!i.track)}>Track {i.track?'On':'Off'}</Button><Button variant="ghost" disabled={blocked} aria-label={`Remove ${i.name} from stock list`} onClick={()=>void change(i.itemId,false,false)}>Remove from stock list</Button></div></li>)}</ul>}
  </>}
  <Dialog open={addOpen} onOpenChange={setAddOpen}><DialogContent><DialogHeader><DialogTitle>Add items to stock list</DialogTitle><DialogDescription>Choose existing catalog items. Create new ingredients in Ingredients & prep first; they appear here after saving. Re-added items start with Track Off.</DialogDescription></DialogHeader>
   {status}<Input aria-label="Search items to add" placeholder="Search catalog items…" value={addSearch} onChange={e=>setAddSearch(e.target.value)}/>
   <div className="stock-add-list">{available.length?available.map(i=><label key={i.itemId} className="stock-add-row"><input type="checkbox" checked={selected.includes(i.itemId)} disabled={blocked} onChange={e=>setSelected(old=>e.target.checked?[...old,i.itemId]:old.filter(id=>id!==i.itemId))}/><span className="overflow-name">{i.name}<small className="muted">{i.kind==='prep'?'House-made prep':'Bought ingredient'}</small></span></label>):<p>{items.some(i=>!i.included)?'No items match this search.':'All catalog items are already in this list.'}</p>}</div>
   <DialogFooter><Button variant="outline" onClick={()=>setAddOpen(false)}>Close</Button><>{items.some(i=>!i.included)&&<Button disabled={blocked||!selected.some(id=>items.some(i=>i.itemId===id&&!i.included))} onClick={()=>void add()}>Add selected items ({selected.filter(id=>items.some(i=>i.itemId===id&&!i.included)).length})</Button>}</></DialogFooter>
  </DialogContent></Dialog>
 </section>;
}
