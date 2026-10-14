'use client';
import {useRef,useState} from 'react';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import {PrepInstructionLine,ServiceFeedback,noteContext} from './prep-notes';
import {useInformation} from './information-context';
import {StockRow,useSavePulse} from './stock-motion';
import {settledReceipt} from '@/lib/stock-feedback';
import {Checkbox} from '@/components/ui/checkbox';
import {Button} from '@/components/ui/button';
import {displayDay} from '@/lib/evening';
import {morningProgress,readyBlocked,type EveningState} from '@/lib/evening-client';
import {groupRows} from '@/lib/ingredient-groups';
import {GroupSection,useCollapsedGroups} from './grouped-sections';
import {useMorningLayout} from './morning-layout';

export function MorningList({state,day,now=0,onReady,onContinue,onCorrect,onManage,correctDisabled,correcting=false}:{state:EveningState;day:string;now?:number;onReady:(itemId:string)=>boolean|void;onContinue:(day:string)=>void;onCorrect:()=>void;onManage?:()=>void;correctDisabled:boolean;correcting?:boolean}){
 const opener=useRef<HTMLElement|null>(null);
 const [selected,setSelected]=useState<string|null>(null),[feedbackOpen,setFeedbackOpen]=useState(false);
 const information=useInformation();const check=state.snapshot?.check,{tasks,remaining,complete}=morningProgress(state,now);
 const completedPulse=useSavePulse(settledReceipt(state,'ready'),complete,`${state.snapshot?.accountId}:${check?.id}`);
 const pending=new Set(state.pending.flatMap(p=>p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[]));
 const rejected=new Set(state.pending.flatMap(p=>p.rejected&&p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[]));
 const drafts=state.snapshot?.checks.filter(c=>c.targetDay===day&&c.stage==='draft')??[];
 const grouping=useCollapsedGroups(state.snapshot?.accountId??'pending','morning',check?.id??day);
 const scope=`${state.snapshot?.accountId??'pending'}:${check?.id??day}:${check?.version??0}:${check?.targetDay??day}`;
 const {readySet,readyOpen,root:layoutRoot,readyHeading,toggleReady,onPointerDownCapture,onKeyDownCapture,noteAction}=useMorningLayout(scope,tasks.map(t=>t.itemId),tasks.filter(t=>t.ready&&t.mappingValid&&!rejected.has(t.itemId)).map(t=>t.itemId),!!selected);
 const toPrepare=tasks.filter(t=>!readySet.has(t.itemId));
 const readyRows=tasks.filter(t=>readySet.has(t.itemId));
 const renderRows=(rows:typeof tasks)=>rows.map(t=><StockRow state={state} kind="ready" itemId={t.itemId} className={'morning-row'+(t.ready&&t.mappingValid?' is-ready':'')+(!t.mappingValid?' morning-invalid':'')+(rejected.has(t.itemId)?' morning-conflicted':'')} key={t.itemId} data-item-id={t.itemId} data-pending={pending.has(t.itemId)}>
      <div className="prep-row-content"><button type="button" className="morning-name morning-detail" aria-label={`Details for ${t.name}`} onClick={()=>{opener.current=document.activeElement as HTMLElement;setSelected(t.itemId);setFeedbackOpen(false);}}>{t.name}{!t.mappingValid&&<small>Catalog link needs review. Use Correct check.</small>}</button><PrepInstructionLine instruction={t.instruction} count={t.feedbackCount} name={t.name} onDetails={()=>{opener.current=document.activeElement as HTMLElement;setSelected(t.itemId);setFeedbackOpen(false);}} onComments={()=>{opener.current=document.activeElement as HTMLElement;setSelected(t.itemId);setFeedbackOpen(true);}}/>{rejected.has(t.itemId)&&<small className="morning-review">Ready change needs review.</small>}</div>
      <div className="morning-control"><Checkbox className="morning-toggle" checked={t.ready&&t.mappingValid} disabled={readyBlocked(state,t.itemId)||!t.mappingValid} aria-label={`${t.ready?'Undo ready':'Mark ready'}: ${t.name}`} aria-describedby="stock-save-status" onCheckedChange={()=>{noteAction();onReady(t.itemId);}}/></div>
     </StockRow>);
 const selectedTask=tasks.find(t=>t.itemId===selected);
 return <div className="morning-list" ref={layoutRoot} onPointerDownCapture={onPointerDownCapture} onKeyDownCapture={onKeyDownCapture}><Dialog open={!!selectedTask} onOpenChange={open=>{if(!open)setSelected(null);}}><DialogContent className="prep-service-dialog" onCloseAutoFocus={e=>{e.preventDefault();if(opener.current?.isConnected)opener.current.focus({preventScroll:true});}}><DialogHeader><DialogTitle>{selectedTask?.name??'Preparation details'}</DialogTitle><DialogDescription>Instruction and optional feedback for this morning.</DialogDescription></DialogHeader>{selectedTask&&check&&<><ServiceFeedback key={`${check.id}:${selectedTask.itemId}:${selectedTask.catalogId}:${check.version}`} context={noteContext(check.id,check.version,selectedTask,'morning')} instruction={selectedTask.instruction} count={selectedTask.feedbackCount} expanded={feedbackOpen}/><Button variant="outline" onClick={()=>{setSelected(null);information?.({kind:'source',id:check.id,version:check.version,item:selectedTask.itemId});}}>View confirmed evening answer</Button></>}</DialogContent></Dialog>
  <div className="evening-meta"><strong>{displayDay(check?.targetDay??day)}</strong></div>
  {!check&&state.snapshot&&!state.loading&&!state.error&&<div className="empty-panel"><h2>{drafts.length?'Evening check is still in progress':state.snapshot.trackedCount===0?'No items selected for checking':'No confirmed evening check for this date'}</h2><p>{drafts.length?'Continue the existing evening check to create Morning prep.':state.snapshot.trackedCount===0?(onManage?'Choose items in Manage list, then finish an evening check to create Morning prep.':'Ask the owner to select items, then finish an evening check to create Morning prep.'):'Morning prep will appear after an evening check for this date is confirmed.'}</p>{!drafts.length&&state.snapshot.trackedCount===0&&onManage&&<Button onClick={onManage}>Choose items in Manage list</Button>}{drafts.map(c=><Button key={c.id} onClick={()=>onContinue(c.id)}>Continue check · {displayDay(c.id)}</Button>)}</div>}
  {check&&check.version===0&&<div className="empty-panel"><h2>Evening check is still in progress</h2><p>Confirm the evening check before marking items ready.</p><Button onClick={()=>onContinue(check.id)}>Continue check · {displayDay(check.id)}</Button></div>}
  {check&&check.version>0&&<>
   <p className="morning-source">From {displayDay(check.id)} evening check · <button className="click-link" onClick={()=>information?.({kind:'source',id:check.id,version:check.version})}>View source check</button></p>
   {check.stage==='draft'&&<p className="notice">A correction is in progress. These tasks still use confirmed version {check.version}.</p>}
   {tasks.length===0&&!state.loading&&!state.error&&!state.pending.length?<div className="empty-panel"><h2>No tasks planned</h2><p>The evening check was confirmed with no preparation or restocking tasks for this date.</p></div>:<>
    <p className="morning-instruction">Tick when prepared or restocked and available. Untick to undo.</p>
    <div className="morning-completion" data-pulse={completedPulse}>{complete?'✓ All morning items ready':state.verifying?'Verifying the shared morning plan…':state.pending.length?'Changes waiting to sync — not yet confirmed saved.':state.freshnessError?'Could not refresh shared tasks. Check your connection.':state.needsVerification?'Changes shared · complete plan needs verification.':!state.lastVerifiedAt||now-state.lastVerifiedAt>=75000?'Shared tasks may have changed. Refresh to confirm.':'Ready = available; quantity not checked.'}</div>
    <section className="morning-to-prepare" aria-label="To prepare"><h2 className="morning-list-heading">To prepare <span>· {remaining} remaining</span></h2>
    {readyRows.some(t=>rejected.has(t.itemId))&&<p className="notice" role="alert">A Ready change needs review. <button type="button" className="click-link" onClick={()=>document.getElementById('stock-save-details')?.scrollIntoView({block:'center'})}>Review the conflict</button></p>}
    {toPrepare.length===0&&<p className="muted small">No items left to prepare or restock.</p>}
    {(['prep','bought'] as const).map(kind=>{const group=toPrepare.filter(t=>t.kind===kind);return group.length>0&&<section key={kind} className="morning-group" aria-label={kind==='prep'?'House-made prep':'Bought ingredients'}>
     <div className="morning-columns"><h2>{kind==='prep'?'House-made prep · Prepare':'Bought ingredients · Restock'}</h2><span>Ready</span></div>
     {check.grouped?groupRows(group).map(section=><GroupSection key={section.id??'unassigned'} id={section.id} sectionId={'morning-'+kind} meta={`${section.rows.length} shown${section.rows.some(t=>pending.has(t.itemId))?' · syncing':''}`} alert={section.rows.some(t=>!t.mappingValid||rejected.has(t.itemId))} open={!grouping.collapsed.includes(kind+'-'+(section.id??'unassigned'))} onToggle={()=>grouping.toggle(kind+'-'+(section.id??'unassigned'))}>{renderRows(section.rows)}</GroupSection>):<><p className="muted small">Grouping is available for new checks.</p>{renderRows(group)}</>}
    </section>;})}
    </section>
    {readyRows.length>0&&<section className="morning-ready-section" aria-label="Ready items"><button type="button" ref={readyHeading} className="morning-ready-heading" aria-expanded={readyOpen} aria-controls="morning-ready-rows" onClick={toggleReady}><span aria-hidden="true">{readyOpen?'▾':'▸'}</span><strong>Ready · {readyRows.length}</strong>{readyRows.some(t=>pending.has(t.itemId))&&<small>Waiting to sync</small>}{readyRows.some(t=>rejected.has(t.itemId))&&<small>Needs review</small>}</button><div id="morning-ready-rows" hidden={!readyOpen}>{(['prep','bought'] as const).map(kind=>{const group=readyRows.filter(t=>t.kind===kind);return group.length>0&&<section key={kind} className="morning-group" aria-label={kind==='prep'?'Ready house-made prep':'Ready bought ingredients'}><div className="morning-columns"><h2>{kind==='prep'?'House-made prep · Prepare':'Bought ingredients · Restock'}</h2><span>Undo</span></div>{check.grouped?groupRows(group).map(section=><GroupSection key={section.id??'unassigned'} id={section.id} sectionId={'morning-ready-'+kind} meta={`${section.rows.length} ready${section.rows.some(t=>pending.has(t.itemId))?' · syncing':''}`} alert={section.rows.some(t=>rejected.has(t.itemId))} open={!grouping.collapsed.includes('ready-'+kind+'-'+(section.id??'unassigned'))} onToggle={()=>grouping.toggle('ready-'+kind+'-'+(section.id??'unassigned'))}>{renderRows(section.rows)}</GroupSection>):renderRows(group)}</section>;})}</div></section>}
   </>}
   <details className="morning-details"><summary>Check details &amp; activity</summary><p>Confirmed {check.confirmedAt?new Date(check.confirmedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'}):'—'} · {check.confirmedBy}</p><p>Last saved changes, Prague time. Pending changes are not included.</p><ul>{check.tasks.filter(t=>!t.cancelled).map(t=><li key={t.itemId}><strong>{t.name}</strong> · {t.ready?'Ready':'Not ready'} · {t.updatedBy} · {new Date(t.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'})}</li>)}</ul></details>
   <Button variant="outline" disabled={correctDisabled} onClick={onCorrect}>{correcting?'Opening correction…':'Correct check'}</Button>
  </>}
 </div>;
}
