'use client';
import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {AlertDialog,AlertDialogContent,AlertDialogHeader,AlertDialogTitle,AlertDialogDescription,AlertDialogFooter,AlertDialogCancel,AlertDialogAction} from '@/components/ui/alert-dialog';
import {Button} from '@/components/ui/button';
import {Textarea} from '@/components/ui/textarea';
import {Checkbox} from '@/components/ui/checkbox';
import {reconcileDraft,planBulk,resolveDraft,nameIndex,type DraftRow,type BulkCommand,type BulkSuggestion} from '@/lib/bulk';
import {copiedLines,transformCopiedLine,validKeptNames,type CopiedLine} from '@/lib/bulk-input';
import {matchPairs,applyMatch,type MatchEnd,type MatchPair} from '@/lib/bulk-review';
import {MAX_DRAFT_BYTES,readIngredientDraft,makeIngredientDraft,restoreIngredientDraft,type IngredientDraft,type BulkRecovery} from '@/lib/bulk-draft';
import {validationMessage,recipeTitle,normalizeName,type Notebook,type Item} from '@/lib/notebook';
import SuggestionWorker from '../lib/bulk-suggestion-worker?worker';
import type {BulkResult} from './use-notebook';
import type {SaveRecovery} from '@/lib/save-recovery';

type Props={notebook:Notebook;recipeId:string;onClose:()=>void;onApply:(command:BulkCommand)=>Promise<BulkResult>;onRefresh:()=>Promise<BulkResult>;getRecovery:()=>BulkRecovery|null;onRestoreRecovery:(recovery:BulkRecovery)=>BulkResult;unauthorized:boolean;earlierSavePending?:boolean;earlierSaveConflict?:boolean;getEarlierRecovery?:()=>SaveRecovery|null;onRestoreEarlierRecovery?:(recovery:SaveRecovery)=>BulkResult;onRetryEarlierSave?:()=>Promise<BulkResult>;onUseShared?:()=>BulkResult};
const kindLabel=(kind:Item['kind'])=>kind==='prep'?'Made in-house':'Bought ingredient';
export function BulkIngredients({notebook,recipeId,onClose,onApply,onRefresh,getRecovery,onRestoreRecovery,unauthorized,earlierSavePending=false,earlierSaveConflict=false,getEarlierRecovery,onRestoreEarlierRecovery,onRetryEarlierSave,onUseShared}:Props){
 const [text,setText]=useState(''),[rows,setRows]=useState<DraftRow[]>([]),[review,setReviewState]=useState(false),[formatting,setFormatting]=useState(false),[keptNames,setKeptNames]=useState<string[]>([]);
 const [error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(false),[conflict,setConflict]=useState(false),[accountIssue,setAccountIssue]=useState(false);
 const [confirmClose,setConfirmClose]=useState(false),[confirmSeparate,setConfirmSeparate]=useState(false),[confirmShared,setConfirmShared]=useState(false),[incoming,setIncoming]=useState<IngredientDraft|null>(null);
 const [keptPairs,setKeptPairs]=useState<string[]>([]),[needsReview,setNeedsReview]=useState<string[]>([]),[unverified,setUnverified]=useState(false),[allMatches,setAllMatches]=useState(false);
 const [announcement,setAnnouncement]=useState(''),[focusRequest,setFocusRequest]=useState<{key:string}|null>(null),[viewport,setViewport]=useState<CSSProperties>({});
 const busyRef=useRef(false),frozen=useRef<BulkCommand|null>(null),heading=useRef<HTMLHeadingElement>(null),input=useRef<HTMLTextAreaElement>(null),fileInput=useRef<HTMLInputElement>(null),cards=useRef(new Map<string,HTMLDivElement>()),fileAttempt=useRef(0);
 const recipe=notebook.recipes.find(r=>r.id===recipeId)!;
 const locked=busy||pending||unverified||earlierSavePending;
 const namesKey=JSON.stringify(rows.map(({key,name})=>({key,name})));
 const [checkAttempt,setCheckAttempt]=useState(0),[checkResult,setCheckResult]=useState<{items:Item[]|null;key:string;attempt:number;matches:Map<string,BulkSuggestion[]>;error:string}>({items:null,key:'',attempt:-1,matches:new Map(),error:''});
 const completedCheck=checkResult.items===notebook.items&&checkResult.key===namesKey&&checkResult.attempt===checkAttempt;
 const checksReady=completedCheck&&!checkResult.error,checking=review&&!completedCheck,checkError=completedCheck?checkResult.error:'',matches=checkResult.matches;
 const setReview=(value:boolean)=>{setReviewState(value);if(value)setCheckAttempt(v=>v+1);};
 useEffect(()=>{
  if(!review)return;
  let active=true,worker:Worker|undefined;
  const fail=()=>{if(!active)return;setCheckResult({items:notebook.items,key:namesKey,attempt:checkAttempt,matches:new Map(),error:'We could not check similar names. Retry the check before adding this list.'});worker?.terminate();};
  try{worker=new SuggestionWorker();worker.onmessage=(event:MessageEvent)=>{if(!active)return;if(event.data.error||!(event.data.matches instanceof Map)){fail();return;}setCheckResult({items:notebook.items,key:namesKey,attempt:checkAttempt,matches:event.data.matches,error:''});worker?.terminate();};worker.onerror=fail;worker.postMessage({items:notebook.items,rows:JSON.parse(namesKey)});}catch{queueMicrotask(fail);}
  return()=>{active=false;worker?.terminate();};
 },[notebook.items,namesKey,review,checkAttempt]);
 useEffect(()=>{if(review||formatting)heading.current?.focus();else input.current?.focus();},[review,formatting]);
 useEffect(()=>{if(focusRequest)cards.current.get(focusRequest.key)?.focus();},[focusRequest]);
 useEffect(()=>{const v=window.visualViewport;if(!v)return;const update=()=>setViewport({'--bulk-vh':`${v.height}px`,'--bulk-vtop':`${v.offsetTop}px`} as CSSProperties);update();v.addEventListener('resize',update);v.addEventListener('scroll',update);return()=>{v.removeEventListener('resize',update);v.removeEventListener('scroll',update);};},[]);
 useEffect(()=>{if(!text.trim()&&!pending)return;const warn=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',warn);return()=>window.removeEventListener('beforeunload',warn);},[text,pending]);
 useEffect(()=>()=>{fileAttempt.current++;},[]);
 const index=useMemo(()=>nameIndex(notebook.items),[notebook.items]);
 const resolution=useMemo(()=>resolveDraft(rows,notebook.items),[rows,notebook.items]);
 const preview=useMemo(()=>{if(!review)return {count:0,error:''};try{return {...planBulk(notebook,{recipeId,rows}),error:''};}catch(e){return {count:0,error:validationMessage(e)};}},[notebook,recipeId,rows,review]);
 const pairs=useMemo(()=>checksReady?matchPairs(rows,notebook.items,matches):[],[rows,notebook.items,matches,checksReady]);
 const decisions=pairs.filter(p=>!keptPairs.includes(p.id)),kept=pairs.filter(p=>keptPairs.includes(p.id));
 const stale=needsReview.filter(key=>rows.some(r=>r.key===key&&!r.skip));
 const copied=useMemo(()=>copiedLines(text),[text]);const uncheckedNames=copied.filter(line=>!keptNames.includes(line.key));
 const ready=review&&!formatting&&!uncheckedNames.length&&checksReady&&!checking&&!checkError&&!preview.error&&!conflict&&!decisions.length&&!stale.length&&!unverified;
 const canAdd=ready&&preview.count>0;
 const included=rows.filter(r=>!r.skip).length;
 const allAlready=rows.length>0&&rows.every(row=>{try{const r=resolution.resolve(row);return !!r.itemId&&recipe.inputs.some(p=>p.itemId===r.itemId);}catch{return false;}});
 const canFinish=ready&&!locked&&!error&&preview.count===0&&included>0&&allAlready;
 const zeroText=allAlready&&included?'Everything is already in this dish':!included?'No ingredients selected':'No new ingredients selected. Included items are already in this dish.';
 const focusRow=(key:string,message:string)=>{setFocusRequest({key});setAnnouncement(message);};
 const patch=(key:string,change:Partial<DraftRow>)=>{if(busyRef.current||locked)return;setRows(old=>old.map(r=>r.key===key?{...r,...change}:r));setNeedsReview(old=>old.filter(k=>k!==key));if(!conflict)setError('');};
 const resetMatch=(row:DraftRow)=>{const exact=index.get(row.key);patch(row.key,{target:exact?{type:'item',id:exact.id}:null,kind:exact?.kind??row.kind,separate:false});focusRow(row.key,`Reviewing ${row.name} again.`);};
 const chooseMatch=(pair:MatchPair,chosen:MatchEnd)=>{if(locked)return;setRows(old=>applyMatch(old,pair,chosen));const other=pair.a.type===chosen.type&&pair.a.key===chosen.key?pair.b:pair.a;setNeedsReview(old=>old.filter(key=>key!==other.key));focusRow(other.key,`Will use ${chosen.name}, ${kindLabel(chosen.kind)}.`);};
 const keepPair=(pair:MatchPair)=>{if(locked)return;setKeptPairs(old=>[...new Set([...old,pair.id])]);focusRow(pair.a.type==='row'?pair.a.key:pair.b.key,'These ingredients will stay separate.');};
 const close=()=>{if(busyRef.current||pending)return;if(text.trim()&&!canFinish)setConfirmClose(true);else onClose();};
 const downloadDraft=()=>{try{const recovery=getRecovery();const file=makeIngredientDraft(notebook,recipeId,text,rows,keptPairs,needsReview,recovery,unverified,keptNames,getEarlierRecovery?.()??null);const url=URL.createObjectURL(new Blob([JSON.stringify(file,null,2)],{type:'application/json'})),a=document.createElement('a');a.href=url;a.download='labula-ingredient-draft.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);setNotice('Draft download started. Use Restore draft in this dish to continue later.');}catch(e){setError(validationMessage(e));}};
 const readFile=async(file:File)=>{const attempt=++fileAttempt.current;if(busyRef.current||pending)return;try{if(file.size>MAX_DRAFT_BYTES)throw Error('This file is too large. Choose a Labula ingredient draft smaller than 5 MB.');const draft=readIngredientDraft(await file.text());if(attempt!==fileAttempt.current||busyRef.current||getRecovery())return;restoreIngredientDraft(draft,notebook,recipeId);setIncoming(draft);setError('');}catch(e){if(attempt===fileAttempt.current)setError(validationMessage(e));}};
 const restore=async()=>{
  if(!incoming||busyRef.current||pending)return;const draft=incoming;busyRef.current=true;setBusy(true);setError('');
  try{const latest=await onRefresh();if(!latest.ok)throw Error(latest.error??'Could not load the latest dish. Try again.');const restored=restoreIngredientDraft(draft,latest.notebook??notebook,recipeId);
   if(draft.priorSave){const result=onRestoreEarlierRecovery?.(draft.priorSave);if(!result?.ok)throw Error(result?.error??'This earlier save cannot be restored here.');}
   if(draft.save.state==='pending'){const result=onRestoreRecovery(draft.save.recovery);if(!result.ok)throw Error(result.error);frozen.current=structuredClone(draft.save.recovery.command);setPending(true);}else{frozen.current=null;setPending(false);}
   setText(restored.text);setRows(restored.rows);setKeptPairs(restored.keptPairs);setKeptNames(restored.keptNames);setNeedsReview(restored.needsReview);setUnverified(draft.save.state==='unverified');setConflict(false);setIncoming(null);const checkCopied=draft.save.state==='unsubmitted'&&copiedLines(restored.text).some(line=>!restored.keptNames.includes(line.key));setFormatting(checkCopied);setReview(!checkCopied&&(!restored.inputError&&!!restored.text.trim()||draft.save.state==='pending'));setError(restored.inputError??'');
   setNotice(draft.priorSave?'Earlier save restored. Retry it before reviewing or adding this ingredient list. Use the account that started the save.':draft.save.state==='pending'?'Unfinished save restored. Retry to check its result. Use the same account that started this save.':draft.save.state==='unverified'?'Older backup opened for reference. It has no save receipt, so it cannot be safely resubmitted. Compare it with the dish before entering any missing ingredients.':'Draft restored. Check the names and types before adding it to this dish.');setAnnouncement('Draft restored. Review ingredients.');
  }catch(e){setError(validationMessage(e));}finally{busyRef.current=false;setBusy(false);}
 };
 const reviewLatest=(latest:Notebook)=>{const draft=makeIngredientDraft(notebook,recipeId,text,rows,keptPairs,needsReview,null,unverified,keptNames);const restored=restoreIngredientDraft(draft,latest,recipeId);setRows(restored.rows);setKeptPairs(restored.keptPairs);setNeedsReview(restored.needsReview);const checkCopied=copiedLines(text).some(line=>!restored.keptNames.includes(line.key));setFormatting(checkCopied);setReview(!checkCopied&&!restored.inputError);setConflict(false);setError(restored.inputError??'');setNotice('Earlier save checked. Review this list before adding it.');};
 const retryEarlier=async()=>{if(busyRef.current||!onRetryEarlierSave)return;busyRef.current=true;setBusy(true);try{const result=await onRetryEarlierSave();if(!result.ok)throw Error(result.error??'Could not confirm the earlier save. Retry.');reviewLatest(result.notebook??notebook);}catch(e){setError(validationMessage(e));}finally{busyRef.current=false;setBusy(false);}};
 const submit=async()=>{
  if(busyRef.current||earlierSavePending||!pending&&!canAdd)return;busyRef.current=true;setBusy(true);setError('');setNotice('');
  const command=frozen.current??{recipeId,rows:structuredClone(rows)};
  try{const result=await onApply(command);setPending(result.pending);setConflict(result.conflict===true);setAccountIssue(result.code==='command_mismatch');if(result.ok){frozen.current=null;onClose();}else{frozen.current=result.pending?command:null;setError(result.error??'Your list was not saved. Review it and try again.');}}
  catch(e){frozen.current=command;setPending(true);setError(validationMessage(e));}finally{busyRef.current=false;setBusy(false);}
 };
 const startReview=()=>{if(busyRef.current||pending||earlierSavePending)return;try{if(!unverified&&uncheckedNames.length){setFormatting(true);setError('');return;}setFormatting(false);setRows(reconcileDraft(text,rows,notebook.items));setReview(true);if(!conflict)setError('');setNotice('');setAnnouncement('Review the ingredient types and any similar names.');}catch(e){setError(validationMessage(e));}};
 const loadLatest=async()=>{if(busyRef.current)return;busyRef.current=true;setBusy(true);try{const before=makeIngredientDraft(notebook,recipeId,text,rows,keptPairs,needsReview,null,unverified,keptNames);const result=await onRefresh();if(result.ok){const restored=restoreIngredientDraft(before,result.notebook??notebook,recipeId);setRows(restored.rows);setKeptPairs(restored.keptPairs);setKeptNames(restored.keptNames);setNeedsReview(restored.needsReview);setConflict(false);setError('');setNotice('Latest dish loaded. Check the matches and item count before adding again.');heading.current?.focus();}else setError(result.error??'Could not load the latest dish.');}catch(e){setError(validationMessage(e));}finally{busyRef.current=false;setBusy(false);}};
 const transformLine=(line:CopiedLine,parts:string[])=>{if(locked)return;try{const next=transformCopiedLine(text,line.key,parts);setText(next);setNeedsReview(old=>[...new Set([...old,...parts.map(name=>normalizeName(name))])]);setKeptNames(old=>validKeptNames(next,old));setError('');setAnnouncement('Text updated. Check the remaining copied lines, then review ingredient types.');heading.current?.focus();}catch(e){setError(validationMessage(e));}};
 const keepName=(line:CopiedLine)=>{if(locked||line.name.length>160)return;setKeptNames(old=>[...new Set([...old,line.key])]);setError('');setAnnouncement(`${line.name} will stay as one ingredient name.`);heading.current?.focus();};
 const editList=()=>{setReview(false);setFormatting(false);if(!conflict)setError('');setNotice('');};
 return <><Dialog open onOpenChange={open=>{if(!open)close();}}><DialogContent className="bulk-dialog" data-review={review} style={viewport} showCloseButton={!busy&&!pending} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(busy||pending)e.preventDefault();}}>
  <DialogHeader className="bulk-header"><p className="bulk-step">{review?'2 of 2 · Review ingredients':formatting?'1 of 2 · Check copied text':'1 of 2 · Enter ingredients'}</p><DialogTitle ref={heading} tabIndex={-1}>Ingredients for {recipeTitle(recipe)}</DialogTitle><DialogDescription>{review?'Check types and similar names before adding.':formatting?'Choose the intended names before reviewing ingredients.':'Names only, one per line. No amounts, bullets or numbering.'}</DialogDescription></DialogHeader>
  <div className="bulk-scroll">
   {formatting?<section className="bulk-formatting" aria-label="Check copied text"><h3>{uncheckedNames.length?`${uncheckedNames.length} ${uncheckedNames.length===1?'line needs':'lines need'} checking`:'Copied text checked'}</h3>
    {uncheckedNames.map(line=><div className="bulk-copy-card" key={line.key}><strong>{line.name}</strong><p className="muted small">{line.cleaned?'This looks like a numbered or bulleted entry.':'This may contain more than one ingredient.'}</p>
     {line.cleaned&&<div className="bulk-copy-option"><p className="small">Without numbering or bullet:</p><strong>{line.cleaned}</strong><Button variant="outline" aria-label={`Clean ${line.name}`} disabled={locked} onClick={()=>transformLine(line,[line.cleaned!])}>Use cleaned name</Button></div>}
     {line.parts&&<div className="bulk-copy-option"><p className="small">Separate ingredients:</p><ul>{line.parts.map((name,i)=><li key={i}>{name}</li>)}</ul><Button variant="outline" aria-label={`Split ${line.name}`} disabled={locked} onClick={()=>transformLine(line,line.parts!)}>Split into {line.parts.length} ingredients</Button></div>}
     <Button variant="link" disabled={locked||line.name.length>160} aria-label={`Keep ${line.name} as one name`} onClick={()=>keepName(line)}>Keep original as one name</Button>{line.name.length>160&&<p className="small error">This name is longer than 160 characters. Clean, split or edit it.</p>}
    </div>)}<label className="field"><span>Current list</span><Textarea readOnly value={text} aria-label="Checked ingredient list" rows={6}/></label><p className="muted small">Review the types and matches after checking this text.</p></section>:!review?<><Textarea ref={input} aria-label="Ingredient list, one per line" rows={10} placeholder={'Fresh coriander\nChilli garlic sauce\nSesame oil'} value={text} readOnly={unverified||earlierSavePending} onChange={e=>setText(e.target.value)}/><p className="muted small">{text.split(/\r?\n/).filter(s=>s.trim()).length} / 150 lines · up to 160 characters per name</p></>:<>
    {decisions.length>0&&!pending&&<section className="bulk-matches" aria-label="Similar names to review"><h3>{decisions.length} {decisions.length===1?'match needs':'matches need'} a decision</h3><p className="muted small">Use one item, or keep the ingredients separate.</p>
     {(allMatches?decisions:decisions.slice(0,5)).map(pair=><div className="bulk-pair" key={pair.id}>
      {[pair.a,pair.b].map(end=><div className="bulk-candidate" key={end.type+end.key}><strong>{end.name}</strong><span className="muted small">{kindLabel(end.kind)} · {end.type==='item'?'in the kitchen list':'from this list'}</span>{(end.type==='item'||pair.a.type==='row'&&pair.b.type==='row')&&<Button variant="outline" disabled={locked} aria-label={`Use ${end.name}`} onClick={()=>chooseMatch(pair,end)}>{end.type==='item'?'Use existing item':'Use this name'}</Button>}</div>)}
      <Button variant="link" disabled={locked} onClick={()=>keepPair(pair)}>Keep separate</Button>
     </div>)}
     {decisions.length>5&&!allMatches&&<Button variant="outline" onClick={()=>setAllMatches(true)}>Show all {decisions.length} matches</Button>}
     <Button variant="link" disabled={locked} onClick={()=>setConfirmSeparate(true)}>Keep all remaining matches separate…</Button>
    </section>}
    {rows.map(row=>{
     let resolved:ReturnType<typeof resolution.resolve>|null=null,rowError='';try{resolved=resolution.resolve(row);}catch(e){rowError=validationMessage(e);}
     const linked=!!resolved?.itemId&&recipe.inputs.some(p=>p.itemId===resolved!.itemId),exact=index.get(row.key);
     const status=row.skip?'Excluded':linked?'Already in this dish':resolved?.itemId?'Use existing item':row.target?.type==='row'?'Shares an item':'New item';
     return <div className="bulk-row" key={row.key} ref={node=>{if(node)cards.current.set(row.key,node);else cards.current.delete(row.key);}} tabIndex={-1} aria-label={`Review ${row.name}`}>
      <div className="bulk-row-top"><strong className="overflow-name">{row.name}</strong><label className="bulk-include"><Checkbox aria-label={`Include ${row.name}`} checked={!row.skip} disabled={locked} onCheckedChange={v=>patch(row.key,{skip:v!==true})}/>Include</label></div>
      <div className="bulk-row-meta"><span className={'badge '+(row.skip?'':resolved?.itemId?'done':'prep')}>{status}</span>{row.occurrences>1&&<span className="muted small">{row.occurrences} repeated lines · {row.skip?'excluded':linked?'already listed':'counted once'}</span>}</div>
      {!row.skip&&<fieldset disabled={locked} className="bulk-row-controls">
       {rowError?<><p role="alert" className="error small">{rowError}</p><Button variant="link" onClick={()=>resetMatch(row)}>Choose match again</Button></>:<>
        {resolved&&(resolved.itemId||row.target?.type==='row')?<p className="small bulk-result">Will use <strong>{resolved.name}</strong> · {kindLabel(resolved.kind)}</p>:<fieldset className="bulk-type"><legend className="sr-only">Type for {row.name}</legend>{(['bought','prep'] as const).map(kind=><label key={kind}><input type="radio" name={`kind-${row.key}`} aria-label={`${kind==='bought'?'Bought':'Made in-house'} for ${row.name}`} checked={row.kind===kind} onChange={()=>patch(row.key,{kind})}/>{kind==='bought'?'Bought':'Made in-house'}</label>)}</fieldset>}
        {needsReview.includes(row.key)&&<div className="notice"><p>This name or saved match changed. Check its current name and type.</p><Button variant="outline" onClick={()=>{setNeedsReview(old=>old.filter(k=>k!==row.key));focusRow(row.key,'Current match confirmed.');}}>Confirm name and type</Button></div>}
        {!exact&&row.target&&<Button variant="link" onClick={()=>{patch(row.key,{target:null,separate:false});focusRow(row.key,`Reviewing ${row.name} again.`);}}>Change match</Button>}
        {!row.target&&row.separate&&<Button variant="link" onClick={()=>patch(row.key,{separate:false})}>Review possible matches</Button>}
       </>}
      </fieldset>}
     </div>;
    })}
    {kept.length>0&&<details className="bulk-kept"><summary>{kept.length} {kept.length===1?'pair kept':'pairs kept'} separate</summary>{kept.map(pair=><div className="bulk-kept-pair" key={pair.id}><span>{pair.a.name} / {pair.b.name}</span><Button variant="link" disabled={locked} onClick={()=>{setKeptPairs(old=>old.filter(id=>id!==pair.id));setAnnouncement('This match needs a decision again.');}}>Review again</Button></div>)}</details>}
   </>}
  </div>
  <div className="bulk-footer">
   <div className="bulk-feedback">
    {(error||preview.error)&&<p role="alert" className="error">{error||preview.error}</p>}
    {review&&(checking||!checksReady)&&!checkError&&!pending&&<p role="status">Checking similar names…</p>}
    {checkError&&!pending&&<p role="alert" className="error">{checkError} <Button variant="link" onClick={()=>setCheckAttempt(x=>x+1)}>Retry match check</Button></p>}
    {earlierSavePending&&<p className="notice">Earlier dish edits need confirmation. Retry the earlier save first. Download draft includes both that save and this ingredient list.</p>}
    {earlierSaveConflict&&<Button variant="outline" onClick={()=>setConfirmShared(true)}>Continue with shared version</Button>}
    {pending&&<p className="notice">The save has not been confirmed. Retry to check it safely. This list stays unchanged until the result is known.</p>}
    {(unauthorized||accountIssue)&&<a className="click-link" href="/signin-with-chatgpt?return_to=/" target="_blank" rel="noreferrer">Sign in in a new tab, then return here to retry</a>}
    {notice&&<p role="status">{notice}</p>}
    {conflict&&!pending&&<Button variant="outline" disabled={busy} onClick={()=>void loadLatest()}>Load latest dish and review</Button>}
   </div>
   {formatting&&<p className="bulk-count" aria-live="polite">{uncheckedNames.length?`${uncheckedNames.length} copied ${uncheckedNames.length===1?'line':'lines'} to check`:'Ready to review ingredient names and types'}</p>}
   {review&&<p className="bulk-count" aria-live="polite" aria-atomic="true">{earlierSavePending?'Waiting for earlier save confirmation':pending?'Waiting for save confirmation':unverified?'Reference only · previous save cannot be verified':ready&&preview.count===0?zeroText:`${preview.count} ${preview.count===1?'ingredient':'ingredients'} to add${decisions.length?` · ${decisions.length} ${decisions.length===1?'match':'matches'} to review`:''}${stale.length?` · ${stale.length} ${stale.length===1?'name or type':'names or types'} to check`:''}`}</p>}
   <div className="bulk-primary"><Button variant="outline" disabled={busy||pending||earlierSavePending} onClick={review||formatting?editList:close}>{review?'Edit list':formatting?'Back to list':'Cancel'}</Button>{earlierSavePending?<Button disabled={busy||earlierSaveConflict} onClick={()=>void retryEarlier()}>{busy?'Saving…':'Retry earlier save'}</Button>:review?<Button disabled={busy||!pending&&!(canAdd||canFinish||ready&&preview.count===0)} onClick={()=>{if(canFinish)close();else if(!pending&&ready&&preview.count===0)focusRow(rows.find(row=>row.skip)?.key??rows[0].key,'Select the ingredients you want to include.');else void submit();}}>{busy?'Saving…':pending?'Retry saving':canFinish?'Done':ready&&preview.count===0?'Review selection':`Add ${preview.count} ${preview.count===1?'ingredient':'ingredients'}`}</Button>:<Button disabled={!text.trim()||busy||formatting&&uncheckedNames.length>0} onClick={startReview}>Review ingredients</Button>}</div>
   <div className="bulk-secondary"><Button variant="link" onClick={downloadDraft} disabled={!text.trim()}>Download draft</Button><Button variant="link" disabled={busy||pending||earlierSavePending} onClick={()=>fileInput.current?.click()}>Restore draft</Button></div>
   <input ref={fileInput} type="file" className="sr-only" tabIndex={-1} aria-label="Restore ingredient draft" accept=".json,application/json" disabled={busy||pending||earlierSavePending} onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void readFile(file);}}/>
   <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
  </div>
 </DialogContent></Dialog>
 <AlertDialog open={confirmClose} onOpenChange={setConfirmClose}><AlertDialogContent className="bulk-confirm"><AlertDialogHeader><AlertDialogTitle>Discard this ingredient list?</AlertDialogTitle><AlertDialogDescription>This draft may contain names or choices you have not added to the dish. Download it if you want to continue later.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep editing</AlertDialogCancel><Button variant="outline" onClick={downloadDraft}>Download draft</Button><AlertDialogAction onClick={onClose}>Discard list</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 <AlertDialog open={confirmShared} onOpenChange={setConfirmShared}><AlertDialogContent className="bulk-confirm"><AlertDialogHeader><AlertDialogTitle>Continue with the shared version?</AlertDialogTitle><AlertDialogDescription>The shared notebook contains newer changes. Download this draft to keep any extra edits from the earlier save. Continuing keeps the shared notebook and your ingredient list, but does not apply those extra earlier edits.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Keep my draft</AlertDialogCancel><Button variant="outline" onClick={downloadDraft}>Download draft</Button><AlertDialogAction onClick={()=>{const result=onUseShared?.();if(result?.ok)reviewLatest(result.notebook??notebook);else setError(result?.error??'Could not continue. Retry the earlier save.');}}>Use shared version</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 <AlertDialog open={confirmSeparate} onOpenChange={setConfirmSeparate}><AlertDialogContent className="bulk-confirm"><AlertDialogHeader><AlertDialogTitle>Keep {decisions.length} possible matches separate?</AlertDialogTitle><AlertDialogDescription>Similar names will remain different ingredients. Only confirm if they refer to different items.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Review matches</AlertDialogCancel><AlertDialogAction onClick={()=>{setKeptPairs(old=>[...new Set([...old,...decisions.map(p=>p.id)])]);setAnnouncement('Remaining ingredients will stay separate.');heading.current?.focus();}}>Keep separate</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
 <AlertDialog open={!!incoming} onOpenChange={open=>{if(!open&&!busy)setIncoming(null);}}><AlertDialogContent className="bulk-confirm" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}><AlertDialogHeader><AlertDialogTitle>Restore this ingredient draft?</AlertDialogTitle><AlertDialogDescription>{incoming?.recipeLabel}. {text.trim()?'This replaces the list currently in this dialog. Download your current draft first if you want to keep it.':'The saved list will open for review. Nothing is added to the dish until you confirm.'}{incoming?.priorSave?' This file includes earlier dish edits whose save must be checked with the original account.':incoming?.save.state==='pending'?' This file contains an unfinished save; it must be checked using the original account.':''}</AlertDialogDescription></AlertDialogHeader>{error&&<p role="alert" className="error">{error}</p>}<AlertDialogFooter><AlertDialogCancel disabled={busy}>Keep current list</AlertDialogCancel>{text.trim()&&<Button variant="outline" onClick={downloadDraft}>Download current draft</Button>}<Button disabled={busy} onClick={()=>void restore()}>{busy?'Restoring…':'Restore draft'}</Button></AlertDialogFooter></AlertDialogContent></AlertDialog>
 </>;
}
