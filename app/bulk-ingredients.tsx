'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {Choice} from './recipe-ui';
import {reconcileDraft,planBulk,resolveDraft,nameIndex,type DraftRow,type BulkCommand,type BulkSuggestion} from '@/lib/bulk';
import {validationMessage,type Notebook,type Item} from '@/lib/notebook';
import SuggestionWorker from '../lib/bulk-suggestion-worker?worker';
import type {BulkResult} from './use-notebook';

type Props={notebook:Notebook;recipeId:string;onClose:()=>void;onApply:(command:BulkCommand)=>Promise<BulkResult>;onRefresh:()=>Promise<BulkResult>;unauthorized:boolean};
export function BulkIngredients({notebook,recipeId,onClose,onApply,onRefresh,unauthorized}:Props){
 const [text,setText]=useState(''),[rows,setRows]=useState<DraftRow[]>([]),[review,setReview]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[conflict,setConflict]=useState(false),[confirmClose,setConfirmClose]=useState(false);
 const busyRef=useRef(false),frozen=useRef<BulkCommand|null>(null);
 const recipe=notebook.recipes.find(r=>r.id===recipeId)!;
 // Choices do not affect similarity scores. Recompute only for changed names/catalog.
 const namesKey=JSON.stringify(rows.map(({key,name})=>({key,name})));
 const checkedNames=useRef<{items:Item[]|null;key:string}>({items:null,key:''});
 const checksReady=checkedNames.current.items===notebook.items&&checkedNames.current.key===namesKey;
 const [matches,setMatches]=useState<Map<string,BulkSuggestion[]>>(new Map()),[checking,setChecking]=useState(false),[checkError,setCheckError]=useState(''),[checkAttempt,setCheckAttempt]=useState(0);
 useEffect(()=>{
  if(!review)return;
  let active=true,worker:Worker;
  setChecking(true);setCheckError('');
  const fail=()=>{if(!active)return;setCheckError('Could not check possible matches. Retry the check before saving.');setChecking(false);worker?.terminate();};
  try{
   worker=new SuggestionWorker();
   worker.onmessage=(event:MessageEvent)=>{
    if(!active)return;
    if(event.data.error||!(event.data.matches instanceof Map)){fail();return;}
    checkedNames.current={items:notebook.items,key:namesKey};
    setMatches(event.data.matches);setChecking(false);worker.terminate();
   };
   worker.onerror=fail;
   worker.postMessage({items:notebook.items,rows:JSON.parse(namesKey)});
  }catch{fail();}
  return()=>{active=false;worker?.terminate();};
 },[notebook.items,namesKey,review,checkAttempt]);
 const index=useMemo(()=>nameIndex(notebook.items),[notebook.items]);
 const resolution=useMemo(()=>resolveDraft(rows,notebook.items),[rows,notebook.items]);
 const preview=useMemo(()=>{if(!review)return {count:0,error:''};try{return {...planBulk(notebook,{recipeId,rows}),error:''};}catch(e){return {count:0,error:validationMessage(e)};}},[notebook,recipeId,rows,review]);
 const patch=(key:string,change:Partial<DraftRow>)=>{if(busyRef.current||pending)return;setRows(old=>old.map(r=>r.key===key?{...r,...change}:r));if(!conflict)setError('');};
 const resetMatch=(row:DraftRow)=>{const exact=index.get(row.key);patch(row.key,{target:exact?{type:'item',id:exact.id}:null,kind:exact?.kind??row.kind,separate:false});};
 const close=()=>{if(busyRef.current||pending)return;if(text.trim())setConfirmClose(true);else onClose();};
 const downloadDraft=()=>{const content=JSON.stringify({recipeId,text,rows},null,2),url=URL.createObjectURL(new Blob([content],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='labula-ingredient-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);};
 useEffect(()=>{if(!text.trim()&&!pending)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[text,pending]);
 const submit=async()=>{
  if(busyRef.current)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
  const command=frozen.current??{recipeId,rows:structuredClone(rows)};
  try{const result=await onApply(command);setPending(result.pending);setConflict(result.conflict===true);if(result.ok){frozen.current=null;onClose();}else{frozen.current=result.pending?command:null;setError(result.error??'Your list was not saved. Review it and try again.');}}
  catch(e){frozen.current=command;setPending(true);setError(validationMessage(e));}
  finally{busyRef.current=false;setBusy(false);}
 };
 return <><Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent showCloseButton={!busy&&!pending} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(busy||pending)e.preventDefault();}}>
  <DialogHeader><DialogTitle>Add multiple ingredients</DialogTitle><DialogDescription>One ingredient or preparation per line. Review your list before saving it to this dish.</DialogDescription></DialogHeader>
  <div className="dialog-body">
   {!review?<Textarea autoFocus aria-label="Ingredient list, one per line" rows={10} placeholder={'Fresh coriander\nChilli garlic sauce\nSesame oil'} value={text} onChange={e=>setText(e.target.value)}/>:<>
    <p className="muted small">{preview.count} new {preview.count===1?'item':'items'} for this dish. Original ingredients stay unchanged. Repeated names share one decision.</p>
    {rows.map(row=>{
     let resolved:ReturnType<typeof resolution.resolve>|null=null,rowError='';try{resolved=resolution.resolve(row);}catch(e){rowError=validationMessage(e);}
     const linked=resolved?.itemId&&recipe.inputs.some(p=>p.itemId===resolved!.itemId),exact=index.get(row.key);
     const options=(checksReady?matches.get(row.key)??[]:[]).filter(s=>{if(s.target.type==='item')return true;const other=rows.find(r=>r.key===(s.target as {key:string}).key&&!r.skip);if(!other)return false;try{return resolution.resolve(other).key!==resolved?.key;}catch{return false;}});
     return <div className="bulk-row" key={row.key}><div className="section-top"><div><strong className="overflow-name">{row.name}</strong>{row.occurrences>1&&<p className="muted small">Repeated {row.occurrences} times · added once</p>}</div><label className="actions small"><Checkbox aria-label={`Include ${row.name}`} checked={!row.skip} disabled={busy||pending} onCheckedChange={v=>patch(row.key,{skip:v!==true})}/>Include</label></div>
      <span className={'badge '+(resolved?.itemId?'done':'prep')}>{row.skip?'Excluded':linked?'Already in this dish':resolved?.itemId?'Existing item':row.target?.type==='row'?'Shared item from this list':'New item'}</span>
      {!row.skip&&<fieldset disabled={busy||pending} style={{marginTop:12}}>
       {rowError?<><p role="alert" className="error small">{rowError}</p><Button variant="link" onClick={()=>resetMatch(row)}>Review match for {row.name}</Button></>:<>
        {resolved&&(resolved.itemId||row.target?.type==='row')?<p className="small">Use <strong>{resolved.name}</strong> · {resolved.kind==='prep'?'House-made preparation':'Bought ingredient'}</p>:<Choice label={`Type for ${row.name}`} value={row.kind} onChange={value=>patch(row.key,{kind:value as Item['kind']})} options={[["bought","Bought ingredient"],["prep","House-made preparation"]]}/>}
        {!exact&&row.target&&<Button variant="link" onClick={()=>patch(row.key,{target:null,separate:false})}>Review original name</Button>}
        {!exact&&!row.target&&options.length>0&&!row.separate&&<div className="notice" style={{marginTop:10}}><strong>Possible matches — please check</strong>{options.map(s=><div key={JSON.stringify(s.target)}><Button variant="link" onClick={()=>patch(row.key,{target:s.target,separate:false})}>Use {s.name}{s.target.type==='row'?' (from this list)':''}</Button></div>)}<Button variant="outline" onClick={()=>patch(row.key,{separate:true})}>Keep {row.name} separate</Button></div>}
        {!row.target&&row.separate&&<p className="muted small">Kept separate. <Button variant="link" onClick={()=>patch(row.key,{separate:false})}>Show possible matches</Button></p>}
       </>}
      </fieldset>}
     </div>;
    })}
   </>}
   {review&&(checking||!checksReady)&&!checkError&&<p role="status" className="info">Checking possible matches… You can keep reviewing item types.</p>}
   {checkError&&<p role="alert" className="error">{checkError}<Button variant="link" onClick={()=>setCheckAttempt(x=>x+1)}>Retry match check</Button></p>}
   {(error||preview.error)&&<p role="alert" className="error">{error||preview.error}</p>}
   {unauthorized&&<a className="click-link" href="/signin-with-chatgpt?return_to=/" target="_blank" rel="noreferrer">Sign in in a new tab, then return here to retry</a>}
   {pending&&<p className="notice">The save result is unknown. Your original request is kept unchanged. Retry saving to confirm it before editing or closing this list.</p>}
   {notice&&<p role="status" className="info">{notice}</p>}
   {!pending&&!!error&&<Button variant="outline" disabled={busy} onClick={async()=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);try{const result=await onRefresh();if(result.ok){setConflict(false);setError('');setNotice('Latest notebook loaded. Review the matches and item count before saving again.');}else setError(result.error??'Could not load the latest notebook.');}finally{busyRef.current=false;setBusy(false);}}}>Load latest notebook and review</Button>}
  </div>
  <DialogFooter><Button variant="ghost" onClick={downloadDraft} disabled={!text.trim()}>Download this list</Button><Button variant="outline" disabled={busy||pending} onClick={review?()=>{setReview(false);if(!conflict)setError('');setNotice('');}:close}>{review?'Edit list':'Cancel'}</Button>{review?<Button disabled={busy||!pending&&(!checksReady||checking||!!checkError||!!preview.error||preview.count===0||conflict)} onClick={()=>void submit()}>{busy?'Saving…':pending?'Retry saving':`Add ${preview.count} ingredients`}</Button>:<Button onClick={()=>{try{setRows(reconcileDraft(text,rows,notebook.items));setReview(true);if(!conflict)setError('');}catch(e){setError(validationMessage(e));}}}>Review ingredients</Button>}</DialogFooter>
 </DialogContent></Dialog>
 <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Discard this ingredient list?</AlertDialogTitle><AlertDialogDescription>This list has not been saved to the dish. Keep editing or download it before discarding.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><Button variant="outline" onClick={downloadDraft}>Download list</Button><AlertDialogAction onClick={onClose}>Discard list</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
