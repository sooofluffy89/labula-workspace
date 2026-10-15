'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import type {useNotebook} from './use-notebook';
import {NotebookRestore} from './notebook-restore';
import {PrepWorkflow} from './prep-workflow';
import {CatalogManager} from './catalog-manager';
import {WorkspaceError} from './workspace-shell';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription,DialogFooter} from '@/components/ui/dialog';
import {downloadJson} from '@/lib/download';
import {makeNotebookDraft,type NotebookDraft} from '@/lib/notebook-draft';
import {hasAliasChanges,type AliasDrafts} from '@/lib/catalog-draft';
import {hasPrepDraftChanges,type PrepDraft} from '@/lib/prep-draft';
import {readLocalPreparation,hasVolatilePreparation,prepLocalEvent} from '@/lib/prep-local';
import {registerSignOutWork} from '@/lib/profile-signout';
import {accessDraftEvent,accessDraftAvailableEvent} from '@/lib/access-client';
import {exportDishIngredientsCsv,validationMessage} from '@/lib/notebook';
import {workspaceDraftPrefix,readReviewedDeviceNotebookDrafts,acknowledgeDeviceNotebookDraft,type DeviceNotebookDraft} from '@/lib/workspace-device-draft';

function downloadCsv(name:string,value:string){const url=URL.createObjectURL(new Blob([value],{type:'text/csv;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}
export function WorkspaceData({nb,account,active,canManage,onReview}:{nb:ReturnType<typeof useNotebook>;account:string;active:boolean;canManage:boolean;onReview:()=>void}){
 const [hydrated,setHydrated]=useState(false);
 const [restore,setRestore]=useState(false),[initial,setInitial]=useState<NotebookDraft|null>(null),[restoringCopy,setRestoringCopy]=useState<DeviceNotebookDraft|null>(null);
 const [copies,setCopies]=useState<DeviceNotebookDraft[]>([]),[deviceError,setDeviceError]=useState(''),[scanError,setScanError]=useState(''),[error,setError]=useState(''),[showReviewed,setShowReviewed]=useState(false),[recoveryNotice,setRecoveryNotice]=useState('');
 const [aliases,setAliases]=useState<AliasDrafts>({}),[aliasOpen,setAliasOpen]=useState(false);
 const [,setPrepRevision]=useState(0),[prepSession,setPrepSession]=useState<{controller:AbortController;restore?:PrepDraft}|null>(null),[opening,setOpening]=useState(false);
 const [reload,setReload]=useState(false);
 const source=useRef<HTMLElement|null>(null),controller=useRef<AbortController|null>(null),ownKey=useRef<string|null>(null),loadedAccount=useRef('');
 useEffect(()=>{setHydrated(true);},[]);
 let prep:PrepDraft|null=null,prepError='';if(hydrated){try{prep=readLocalPreparation(account);}catch(e){prepError=validationMessage(e);}}
 const prepDirty=hasPrepDraftChanges(prep),aliasDirty=Object.values(aliases).some(hasAliasChanges);
 const makeDraft=()=>{let currentPrep:PrepDraft|null=null;try{currentPrep=readLocalPreparation(account);}catch{/* An unreadable preparation key is retained separately; it must not stop notebook recovery. */}return makeNotebookDraft(nb.data,nb.getSavedBase(),nb.user||account,Object.values(aliases).filter(hasAliasChanges),nb.getSaveRecovery(),nb.getCatalogRecovery(),nb.getBulkRecovery(),currentPrep);};
 const refreshCopies=useCallback(async()=>{try{const result=await readReviewedDeviceNotebookDrafts(localStorage,account);setCopies(result.drafts.filter(copy=>copy.key!==ownKey.current));setScanError(result.issues.length?`${result.issues.length} earlier device ${result.issues.length===1?'copy could':'copies could'} not be opened. Their original data is kept; other drafts can still be saved and recovered.`:'');}catch(e){setScanError(validationMessage(e));}},[account]);
 const visibleCopies=copies.filter(copy=>showReviewed||!copy.reviewed),unreviewedCount=copies.filter(copy=>!copy.reviewed).length;
 const download=()=>{try{downloadJson('workspace-2.0-notebook-draft.json',makeDraft());}catch(e){setError(validationMessage(e));}};
 useEffect(()=>{const changed=()=>setPrepRevision(v=>v+1);window.addEventListener(prepLocalEvent,changed);const storageChanged=()=>{changed();void refreshCopies();};window.addEventListener('storage',storageChanged);return()=>{window.removeEventListener(prepLocalEvent,changed);window.removeEventListener('storage',storageChanged);};},[refreshCopies]);
 useEffect(()=>{if(!nb.user||loadedAccount.current===nb.user)return;loadedAccount.current=nb.user;ownKey.current=workspaceDraftPrefix(nb.user)+crypto.randomUUID();void refreshCopies();},[nb.user,refreshCopies]);
 // Every mounted tab owns a separate key. A save cannot erase another tab's draft.
 useEffect(()=>{if(!nb.loaded||!ownKey.current)return;try{if(nb.dirty||nb.savePending||nb.operationPending||aliasDirty)localStorage.setItem(ownKey.current,JSON.stringify(makeDraft()));else localStorage.removeItem(ownKey.current);setDeviceError('');}catch{setDeviceError('This browser could not keep a device copy. Keep this tab open and download your draft before leaving.');}},[nb.data,nb.dirty,nb.savePending,nb.operationPending,nb.loaded,nb.saving,nb.operating,aliases]); // Current receipts are captured after each state transition.
 useEffect(()=>{const protect=(event:BeforeUnloadEvent)=>{if(aliasDirty||hasVolatilePreparation()){event.preventDefault();event.returnValue='';}};window.addEventListener('beforeunload',protect);return()=>window.removeEventListener('beforeunload',protect);},[aliasDirty]);
 useEffect(()=>{const handler=()=>download();window.addEventListener(accessDraftEvent,handler);window.dispatchEvent(new CustomEvent(accessDraftAvailableEvent,{detail:nb.loaded}));return()=>{window.removeEventListener(accessDraftEvent,handler);};});
 useEffect(()=>registerSignOutWork(()=>nb.loaded&&(nb.dirty||nb.saving||nb.savePending||nb.operationPending||aliasDirty||prepDirty)?{label:'Recipe notebook draft',safe:true,value:makeDraft()}:null));
 useEffect(()=>()=>{controller.current?.abort();},[]);
 const closePrep=()=>{controller.current?.abort();controller.current=null;setOpening(false);setPrepSession(null);};
 const openPrep=async(draft?:PrepDraft)=>{
  if(controller.current)return false;
  if(draft&&draft.account.toLowerCase()!==account.toLowerCase())return false;
  const signal=new AbortController();controller.current=signal;source.current=document.activeElement instanceof HTMLElement?document.activeElement:null;setOpening(true);setError('');
  try{await nb.beginPreparation(signal.signal);if(signal.signal.aborted)return false;setPrepSession({controller:signal,restore:draft});return true;}catch(e){if(!signal.signal.aborted)setError(validationMessage(e));signal.abort();controller.current=null;return false;}finally{setOpening(false);}
 };
 const restored=()=>{if(!restoringCopy)return;
  // A recovered alias/preparation form still needs its own explicit save. Keep its source visible.
  if(initial&&(initial.aliasDrafts.some(hasAliasChanges)||hasPrepDraftChanges(initial.prepDraft??null))){setRecoveryNotice('The notebook was restored. Its original device copy stays available while you finish the recovered forms.');setRestoringCopy(null);return;}
  const copy=restoringCopy;setRestoringCopy(null);
  void acknowledgeDeviceNotebookDraft(localStorage,copy).then(()=>{setRecoveryNotice('Draft restored. Its original copy is retained under Show reviewed copies; newer edits in its originating tab remain recoverable.');return refreshCopies();}).catch(()=>setDeviceError('The draft was restored. Its original device copy is retained because this browser could not record the review.'));
 };
 return <>
  <section hidden={!active} className="ws-settings-page">
   <h1>Data &amp; backup</h1><p className="muted">Saved workspace data and drafts kept on this device.</p>
   {(nb.error||error||deviceError||scanError||prepError)&&<WorkspaceError title={error||deviceError||scanError||prepError||nb.error} onRetry={()=>void nb.retry()}/>}
   {recoveryNotice&&<p role="status">{recoveryNotice}</p>}
   {copies.length>0&&<section className="ws-data-panel"><h2>Recover device drafts</h2><p>Review each earlier copy against the current shared version.</p>{copies.some(copy=>copy.reviewed)&&<label><input type="checkbox" checked={showReviewed} onChange={event=>setShowReviewed(event.target.checked)}/> Show reviewed copies</label>}{visibleCopies.map(copy=><div key={copy.key} className="ws-recovery-notice"><p>Draft from {new Date(copy.draft.exportedAt).toLocaleString('en-GB')}{copy.reviewed?' · reviewed':''}</p><div className="actions"><Button disabled={!nb.loaded||nb.dirty||nb.savePending||nb.operationPending} onClick={()=>{setInitial(copy.draft);setRestoringCopy(copy);setRestore(true);}}>Review this draft</Button><Button variant="outline" onClick={()=>downloadJson('workspace-2.0-device-draft.json',copy.draft)}>Download copy</Button></div></div>)}</section>}
   <section className="ws-data-panel"><h2>Notebook &amp; device drafts</h2><p>A notebook export includes your current recipe edits and recoverable save requests. It is not a complete workspace backup.</p><div className="actions"><Button variant="outline" disabled={!nb.loaded} onClick={download}>Download notebook / draft</Button><Button variant="outline" disabled={!nb.loaded} onClick={()=>{setInitial(null);setRestoringCopy(null);setRestore(true);}}>Restore notebook draft</Button>{(nb.error||nb.dirty||nb.savePending||nb.operationPending)&&<Button disabled={nb.saving||nb.operating} onClick={()=>void nb.retry()}>Retry saving</Button>}{nb.loaded&&nb.error&&<Button variant="outline" disabled={nb.savePending&&!nb.saveRecoveryConflict||nb.operationPending} onClick={()=>setReload(true)}>Review shared version</Button>}</div></section>
   <section className="ws-data-panel"><h2>Menu exports</h2><p>CSV contains saved recipe values from the selected scope. Unknown amounts stay unknown.</p><div className="actions"><Button variant="outline" disabled={!nb.loaded} onClick={()=>downloadCsv('workspace-2.0-current-menu.csv',exportDishIngredientsCsv(nb.data,'current'))}>Current menu CSV</Button><Button variant="outline" disabled={!nb.loaded} onClick={()=>downloadCsv('workspace-2.0-all-recipes.csv',exportDishIngredientsCsv(nb.data,'all'))}>All dish recipes CSV</Button></div></section>
   {canManage&&<section className="ws-data-panel"><h2>Complete workspace backup</h2><p>Download saved recipes, review records, approvals and operational history. Device drafts must be saved or downloaded separately.</p><Button asChild variant="outline"><a href="/review-backup">Open full workspace backup</a></Button></section>}
   <section className="ws-data-panel"><h2>Earlier records &amp; recovery</h2><p>Previous assessments and unfinished preparation forms remain available. They are not required for daily work.</p><div className="actions"><Button variant="outline" onClick={onReview}>Review archive</Button><Button variant="outline" disabled={!nb.loaded||nb.preparationBusy} onClick={()=>void openPrep()}>Preparation records{prepDirty?' · device draft':''}</Button>{aliasDirty&&<Button variant="outline" onClick={()=>setAliasOpen(true)}>Recovered alternative names</Button>}</div></section>
  </section>
  {/* A real recovery problem stays visible outside Settings without blocking Today. */}
  {!active&&(unreviewedCount>0||deviceError||scanError)&&<details className="ws-recovery-notice"><summary>Recipe draft recovery available</summary><p>{deviceError||scanError||`${unreviewedCount} earlier device draft${unreviewedCount===1?'':'s'} kept. Open Settings → Data & backup to review.`}</p>{deviceError&&<Button variant="outline" onClick={download}>Download current draft</Button>}</details>}
  <NotebookRestore nb={nb} canManage={canManage} open={restore} onOpenChange={setRestore} initialDraft={initial} onRestored={restored} hasAliasDrafts={aliasDirty} hasPrepDrafts={prepDirty} onDownloadCurrent={download} onRestorePrep={draft=>openPrep(draft)} onRestoreAliases={drafts=>{setAliases(old=>({...old,...Object.fromEntries(drafts.map(draft=>[draft.itemId,draft]))}));if(drafts.length)setAliasOpen(true);}}/>
  {opening&&<Dialog open onOpenChange={value=>{if(!value)closePrep();}}><DialogContent><DialogHeader><DialogTitle>Opening preparation records</DialogTitle><DialogDescription>Your earlier recipe changes are being saved.</DialogDescription></DialogHeader><Button variant="outline" onClick={closePrep}>Cancel opening</Button></DialogContent></Dialog>}
  {prepSession&&<PrepWorkflow notebook={nb.data} revision={nb.revision} account={account} restoreDraft={prepSession.restore} onRestoreHandled={()=>setPrepSession(old=>old?{...old,restore:undefined}:null)} returnFocus={()=>{const target=source.current;requestAnimationFrame(()=>{if(target?.isConnected)target.focus();else document.getElementById('workspace-content')?.focus();});}} onClose={closePrep} onSaved={body=>nb.acceptProfileSnapshot(body,prepSession.controller.signal)} onDraftChange={()=>setPrepRevision(value=>value+1)}/>}
  <Dialog open={aliasOpen} onOpenChange={setAliasOpen}><DialogContent className="notebook-restore-dialog"><DialogHeader><DialogTitle>Recovered alternative names</DialogTitle><DialogDescription>Review and save the recovered names against the current catalog.</DialogDescription></DialogHeader><CatalogManager notebook={nb.data} revision={nb.revision} busy={nb.operating} pending={nb.operationPending} error={nb.error} unauthorized={nb.unauthorized} drafts={aliases} onDraftsChange={setAliases} onDownload={download} onRetry={nb.retry} onOperation={nb.runOperation}/></DialogContent></Dialog>
  <Dialog open={reload} onOpenChange={setReload}><DialogContent><DialogHeader><DialogTitle>Replace this draft with the shared version?</DialogTitle><DialogDescription>Download your current draft first if you want to keep its changes. Uncertain requests must be checked before reloading.</DialogDescription></DialogHeader><DialogFooter><Button variant="outline" onClick={()=>setReload(false)}>Keep my edits</Button><Button onClick={async()=>{if(nb.saveRecoveryConflict)nb.useSharedAfterRecovery();else await nb.load();setReload(false);}}>Use shared version</Button></DialogFooter></DialogContent></Dialog>
 </>;
}
