'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Checkbox} from '@/components/ui/checkbox';
import {Dialog,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Choice} from './recipe-ui';
import {readNotebookDraft,planNotebookRestore,recoverAliasDrafts,MAX_NOTEBOOK_DRAFT_BYTES,type NotebookDraft,type RestoreDecision} from '@/lib/notebook-draft';
import {downloadJson} from '@/lib/download';
import {validationMessage,type Notebook} from '@/lib/notebook';
import type {PrepDraft} from '@/lib/prep-draft';
import type {AliasDraft} from '@/lib/catalog-draft';
import type {useNotebook} from './use-notebook';
type Props={open:boolean;onOpenChange:(open:boolean)=>void;nb:ReturnType<typeof useNotebook>;hasAliasDrafts:boolean;hasPrepDrafts?:boolean;onRestoreAliases:(drafts:AliasDraft[])=>void;onDownloadCurrent:()=>void;onRestorePrep:(draft:PrepDraft)=>Promise<boolean>};
export function NotebookRestore({open,onOpenChange,nb,hasAliasDrafts,hasPrepDrafts=false,onRestoreAliases,onDownloadCurrent,onRestorePrep}:Props){
 const [file,setFile]=useState<NotebookDraft|null>(null),[shared,setShared]=useState<Notebook|null>(null),[decisions,setDecisions]=useState<Record<string,RestoreDecision>>({}),[mappings,setMappings]=useState<Record<string,string>>({}),[newIds,setNewIds]=useState<Record<string,string>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[reviewed,setReviewed]=useState(false),[discard,setDiscard]=useState(false),[applied,setApplied]=useState(false);
 const active=useRef(false),installed=useRef(false),attempt=useRef(0),appliedPayload=useRef('');
 const plan=useMemo(()=>file&&shared?planNotebookRestore(file,shared,decisions,mappings):null,[file,shared,decisions,mappings]);
 useEffect(()=>{if(!file)return;const protect=(e:BeforeUnloadEvent)=>{e.preventDefault();e.returnValue='';};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[file]);
 useEffect(()=>()=>{attempt.current++;},[]);
 const chooseFile=async(input:File)=>{if(active.current)return;const sequence=++attempt.current;setError('');try{if(nb.dirty||nb.operationPending||nb.savePending||hasAliasDrafts||hasPrepDrafts)throw Error('Save or resolve your current edits and preparation drafts before opening another notebook draft.');if(input.size>MAX_NOTEBOOK_DRAFT_BYTES)throw Error('Choose a notebook draft smaller than 6 MB.');const parsed=readNotebookDraft(await input.text());if(parsed.prepDraft&&parsed.prepDraft.account.toLowerCase()!==nb.user.toLowerCase())throw Error('This file includes a preparation draft for another account. Sign in with the account that created it.');if(sequence!==attempt.current)return;setFile(parsed);setShared(null);setDecisions({});setMappings({});setNewIds(Object.fromEntries(parsed.notebook.items.map(i=>[i.id,crypto.randomUUID()])));setReviewed(false);setApplied(false);installed.current=false;}catch(e){if(sequence===attempt.current)setError(validationMessage(e));}};
 const reviewLatest=async()=>{if(active.current||!file)return;active.current=true;setBusy(true);setError('');try{
  if(applied&&nb.dirty&&JSON.stringify(nb.data)!==appliedPayload.current)throw Error('You made more dish edits after this restore attempt. Save those edits or download the current draft before reloading. The imported draft stays here.');
  if(!installed.current&&file.recovery.kind!=='none'){
   const current=await nb.refreshBulk();if(!current.ok)throw Error(current.error);
   let result;
   if(file.recovery.kind==='save'){const receipt=file.recovery.receipt;result=nb.restoreSaveRecovery({...receipt,localPayload:receipt.payload});}
   else if(file.recovery.kind==='catalog')result=nb.restoreCatalogRecovery(file.recovery.receipt);
   else result=nb.restoreBulkRecovery(file.recovery.receipt);
   if(!result.ok)throw Error(result.error);installed.current=true;
  }
  const result=applied&&!nb.savePending&&!nb.operationPending?await nb.refreshRestore():installed.current?await nb.reconcileImported():await nb.refreshBulk();
  if(!result.ok||!result.notebook)throw Error(result.error??'Could not load the latest shared version.');
  setShared(result.notebook);setDecisions({});setMappings({});setReviewed(false);setApplied(false);
 }catch(e){setError(validationMessage(e));}finally{active.current=false;setBusy(false);}};
 const complete=async()=>{if(hasAliasDrafts){setError('Your newer alternative-name edits are still unsaved. Close this review and save or discard those edits first. The imported draft is kept.');return false;}if(file?.prepDraft){if(file.prepDraft.account.toLowerCase()!==nb.user.toLowerCase()){setError('The preparation draft belongs to another account. Sign in with that account to restore it.');return false;}if(!await onRestorePrep(file.prepDraft)){setError('The preparation form did not open. Your imported draft is kept here. Resolve the earlier save, then try again.');return false;}}
  if(file&&(nb.canManage??nb.isOwner))onRestoreAliases(recoverAliasDrafts(file,plan?.next??nb.data));setFile(null);setShared(null);installed.current=false;onOpenChange(false);return true;};
 const finish=async()=>{if(active.current||!file||!shared||!plan||plan.unresolved||plan.error||!reviewed)return;active.current=true;setBusy(true);setError('');try{
  if(hasAliasDrafts)throw Error('Alternative names were edited while this restore was open. Close this dialog and save or discard those edits first. Your imported draft stays here.');
  if(JSON.stringify(nb.data)!==JSON.stringify(shared))throw Error('The notebook changed since this review. Load the latest version and review again.');
  if(plan.changed){appliedPayload.current=JSON.stringify(plan.next);nb.update(()=>plan.next);setApplied(true);if(!await nb.flush())throw Error('This restore has not been confirmed. Your selected changes are kept. Use Retry saving, or download this draft before reloading.');}
  await complete();
 }catch(e){setError(validationMessage(e));}finally{active.current=false;setBusy(false);}};
 const clear=()=>{attempt.current++;setFile(null);setShared(null);setDecisions({});setMappings({});setDiscard(false);setError('');installed.current=false;};
 const blocked=busy||nb.saving||nb.operating;
 return <><Dialog open={open} onOpenChange={value=>{if(!blocked)onOpenChange(value);}}><DialogContent className="notebook-restore-dialog" showCloseButton={!blocked} onInteractOutside={e=>e.preventDefault()} onEscapeKeyDown={e=>{if(blocked)e.preventDefault();}}><DialogHeader><DialogTitle>Restore a notebook draft</DialogTitle><DialogDescription>Review names, preparation and storage answers, and dish ingredient lists against the latest shared version. Existing quantities, recipe methods and catalog permissions stay protected.</DialogDescription></DialogHeader><div className="dialog-body">
 {!file?<label className="field"><span>Choose a complete notebook / draft (.json)</span><input type="file" accept=".json,application/json" disabled={blocked} onChange={e=>{const selected=e.target.files?.[0];if(selected)void chooseFile(selected);e.target.value='';}}/></label>:<><div className="info"><strong>Draft from {new Date(file.exportedAt).toLocaleString('en-GB')}</strong>{file.actorEmail&&<p>Created by {file.actorEmail}</p>}<p>{file.base?'Changes are compared with the original saved version.':'Older backup: differences need your explicit choice. Nothing is removed automatically.'}</p><Button variant="outline" onClick={()=>downloadJson('labula-notebook-imported-draft.json',file)}>Download imported draft</Button></div>
 {file.recovery.kind!=='none'&&!shared&&<p className="notice">This file contains an earlier {file.recovery.kind==='catalog'?'catalog change':'save'} whose result needs checking. The original request will be checked before any other changes are restored.</p>}
 {!shared&&<Button disabled={blocked} onClick={()=>void reviewLatest()}>{busy?'Checking…':file.recovery.kind==='none'?'Load latest version & review':'Check earlier save & review'}</Button>}
 {plan&&<>{hasAliasDrafts&&<p className="notice">Save or discard your newer alternative-name edits before applying this imported draft. You can close and reopen this review.</p>}<p><strong>{plan.changes.length} differences to review</strong></p>{plan.unmapped.map(({item,reason,canCreate,currentMatch})=><div className="notice" key={item.id}><strong>{item.name} · {item.kind==='prep'?'Made in-house':'Bought'}</strong><p>{reason}</p>{currentMatch&&<p>Current match: {currentMatch.name} · {currentMatch.kind==='prep'?'Made in-house':'Bought'}</p>}<Choice label={'Restore '+item.name+' as'} value={mappings[item.id]??''} onChange={value=>{setMappings(old=>({...old,[item.id]:value}));setReviewed(false);}} options={[...shared!.items.map(i=>[i.id,i.name+' · '+(i.kind==='prep'?'Made in-house':'Bought')] as const),...(canCreate?[[`new:${newIds[item.id]}`,'Create a new entry'] as const]:[]),['skip','Skip this saved item'] as const]}/></div>)}
 {Object.keys(mappings).length>0&&<Button variant="ghost" disabled={blocked} onClick={()=>{setMappings({});setReviewed(false);}}>Review item mappings again</Button>}
 {plan.changes.map(change=><div className={'restore-change '+(change.conflict?'notice':'info')} key={change.id}><strong>{change.label}</strong><div className="restore-values"><p>Shared: {change.shared}</p><p>Draft: {change.draft}</p></div><Choice label={'Decision for '+change.label} value={change.decision??''} options={[["shared","Keep shared"],["draft","Use draft"]]} onChange={value=>{setDecisions(old=>({...old,[change.id]:value as RestoreDecision}));setReviewed(false);}}/></div>)}
 {plan.notices.map(message=><p className="small" key={message}>{message}</p>)}
 {file.prepDraft&&<p className="info">This file also includes preparation drafts kept on the original device. They will open for review after restoring the notebook.</p>}{file.aliasDrafts.length>0&&<p className="notice">{file.aliasDrafts.length} alternative-name drafts are included. {(nb.canManage??nb.isOwner)?'They will be restored as unsaved drafts in catalog management.':'A Manager can restore these catalog edits. They remain in the downloaded file.'}</p>}
 {plan.error&&<p role="alert" className="error">{plan.error}</p>}
 {plan.unresolved>0&&<p role="status">Choose what to keep for {plan.unresolved} remaining differences.</p>}
 <label className="actions"><Checkbox checked={reviewed} disabled={blocked||!!plan.unresolved||!!plan.error} onCheckedChange={value=>setReviewed(value===true)}/>I have checked the selected changes.</label>
 <Button variant="outline" disabled={blocked||nb.operationPending||nb.savePending} onClick={()=>void reviewLatest()}>Load latest version & review again</Button></>}
 </>}
 {(error||nb.error)&&<div className="notice" role="alert"><p>{error||nb.error}</p><div className="actions">{(nb.savePending||nb.operationPending||applied)&&<Button disabled={blocked} onClick={async()=>{setError('');if(await nb.retry()){if(applied){await complete();}else await reviewLatest();}}}>Retry saving</Button>}{nb.unauthorized&&<a href="/signin-with-chatgpt?return_to=/" target="_blank" rel="noreferrer">Sign in in a new tab, then return here</a>}<Button variant="outline" onClick={onDownloadCurrent}>Download current draft</Button></div></div>}
 </div><DialogFooter><Button variant="outline" disabled={blocked} onClick={()=>onOpenChange(false)}>{file?'Close — keep this draft':'Close'}</Button>{file&&<Button variant="ghost" disabled={blocked||nb.savePending||nb.operationPending} onClick={()=>setDiscard(true)}>Discard imported draft</Button>}{plan&&<Button disabled={blocked||hasAliasDrafts||!!plan.unresolved||!!plan.error||!reviewed||nb.savePending||nb.operationPending} onClick={()=>void finish()}>Apply selected changes</Button>}</DialogFooter></DialogContent></Dialog>
 <Dialog open={discard} onOpenChange={setDiscard}><DialogContent><DialogHeader><DialogTitle>Discard this imported draft?</DialogTitle><DialogDescription>The shared notebook stays unchanged. Keep your downloaded file if you may need it again.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setDiscard(false)}>Keep draft</Button><Button onClick={clear}>Discard imported draft</Button></DialogFooter></DialogContent></Dialog></>;
}
