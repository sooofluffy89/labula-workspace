'use client';
import {useInformation} from './information-context';
import {StockRow,StockProgress,useSavePulse} from './stock-motion';
import {settledReceipt} from '@/lib/stock-feedback';
import {Checkbox} from '@/components/ui/checkbox';
import {Button} from '@/components/ui/button';
import {displayDay} from '@/lib/evening';
import {morningProgress,readyBlocked,type EveningState} from '@/lib/evening-client';
import {groupRows} from '@/lib/ingredient-groups';
import {GroupSection,useCollapsedGroups} from './grouped-sections';

export function MorningList({state,day,now=0,onReady,onContinue,onCorrect,onManage,correctDisabled}:{state:EveningState;day:string;now?:number;onReady:(itemId:string)=>void;onContinue:(day:string)=>void;onCorrect:()=>void;onManage?:()=>void;correctDisabled:boolean}){
 const information=useInformation();const check=state.snapshot?.check,{tasks,ready,remaining,complete}=morningProgress(state,now);
 const completedPulse=useSavePulse(settledReceipt(state,'ready'),complete,`${state.snapshot?.accountId}:${check?.id}`);
 const pending=new Set(state.pending.flatMap(p=>p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[]));
 const drafts=state.snapshot?.checks.filter(c=>c.targetDay===day&&c.stage==='draft')??[];
 const grouping=useCollapsedGroups(state.snapshot?.accountId??'pending','morning',check?.id??day);
 const renderRows=(rows:typeof tasks)=>rows.map(t=><StockRow state={state} kind="ready" itemId={t.itemId} className={'morning-row'+(t.ready&&t.mappingValid?' is-ready':'')+(!t.mappingValid?' morning-invalid':'')} key={t.itemId} data-item-id={t.itemId} data-pending={pending.has(t.itemId)}>
      <button type="button" className="morning-name morning-detail" aria-label={`Details for ${t.name}`} onClick={()=>{if(check)information?.({kind:'source',id:check.id,version:check.version,item:t.itemId});}}>{t.name}{!t.mappingValid&&<small>Catalog link needs review. Use Correct check.</small>}</button>
      <div className="morning-control"><Checkbox className="morning-toggle" checked={t.ready&&t.mappingValid} disabled={readyBlocked(state,t.itemId)||!t.mappingValid} aria-label={`Ready: ${t.name}`} aria-describedby="stock-save-status" onCheckedChange={()=>onReady(t.itemId)}/>{pending.has(t.itemId)&&<span className="morning-pending" aria-hidden="true">…</span>}</div>
     </StockRow>);
 return <div className="morning-list">
  <div className="evening-meta"><strong>{displayDay(check?.targetDay??day)}</strong>{check&&check.version>0&&<span aria-live="polite">{ready} ready · {remaining} remaining</span>}</div>
  {check&&check.version>0&&<StockProgress key={`${state.snapshot?.accountId}:${check.id}`} value={ready} total={tasks.length} label="Morning items marked ready"/>}
  {!check&&state.snapshot&&!state.loading&&!state.error&&<div className="empty-panel"><h2>{drafts.length?'Evening check is still in progress':state.snapshot.trackedCount===0?'No items selected for checking':'No confirmed evening check for this date'}</h2><p>{drafts.length?'Continue the existing evening check to create Morning prep.':state.snapshot.trackedCount===0?(onManage?'Choose items in Manage list, then finish an evening check to create Morning prep.':'Ask the owner to select items, then finish an evening check to create Morning prep.'):'Morning prep will appear after an evening check for this date is confirmed.'}</p>{!drafts.length&&state.snapshot.trackedCount===0&&onManage&&<Button onClick={onManage}>Choose items in Manage list</Button>}{drafts.map(c=><Button key={c.id} onClick={()=>onContinue(c.id)}>Continue check · {displayDay(c.id)}</Button>)}</div>}
  {check&&check.version===0&&<div className="empty-panel"><h2>Evening check is still in progress</h2><p>Confirm the evening check before marking items ready.</p><Button onClick={()=>onContinue(check.id)}>Continue check · {displayDay(check.id)}</Button></div>}
  {check&&check.version>0&&<>
   <p className="morning-source">From {displayDay(check.id)} evening check · <button className="click-link" onClick={()=>information?.({kind:'source',id:check.id,version:check.version})}>View source check</button></p>
   {check.stage==='draft'&&<p className="notice">A correction is in progress. These tasks still use confirmed version {check.version}.</p>}
   {tasks.length===0&&!state.loading&&!state.error&&!state.pending.length?<div className="empty-panel"><h2>No tasks planned</h2><p>The evening check was confirmed with no preparation or restocking tasks for this date.</p></div>:<>
    <p className="morning-instruction">Tick when prepared or restocked and available. Untick to undo.</p>
    <div className="morning-completion" data-pulse={completedPulse} role="status">{complete?'✓ All morning items ready':state.pending.length?'Changes waiting to sync — not yet confirmed saved.':state.freshnessError?'Could not refresh shared tasks. Check your connection.':!state.lastVerifiedAt||now-state.lastVerifiedAt>=75000?'Shared tasks may have changed. Refresh to confirm.':'Ready = available; quantity not checked.'}</div>
    {(['prep','bought'] as const).map(kind=>{const group=tasks.filter(t=>t.kind===kind);return group.length>0&&<section key={kind} className="morning-group" aria-label={kind==='prep'?'House-made prep':'Bought ingredients'}>
     <div className="morning-columns"><h2>{kind==='prep'?'House-made prep · Prepare':'Bought ingredients · Restock'}</h2><span>Ready</span></div>
     {check.grouped?groupRows(group).map(section=><GroupSection key={section.id??'unassigned'} id={section.id} sectionId={'morning-'+kind} meta={`${section.rows.filter(t=>t.ready&&t.mappingValid).length}/${section.rows.length} ready${section.rows.some(t=>pending.has(t.itemId))?' · syncing':''}`} alert={section.rows.some(t=>!t.mappingValid)} open={!grouping.collapsed.includes(kind+'-'+(section.id??'unassigned'))} onToggle={()=>grouping.toggle(kind+'-'+(section.id??'unassigned'))}>{renderRows(section.rows)}</GroupSection>):<><p className="muted small">Grouping is available for new checks.</p>{renderRows(group)}</>}
    </section>;})}
   </>}
   <details className="morning-details"><summary>Check details &amp; activity</summary><p>Confirmed {check.confirmedAt?new Date(check.confirmedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'}):'—'} · {check.confirmedBy}</p><p>Last saved changes, Prague time. Pending changes are not included.</p><ul>{check.tasks.filter(t=>!t.cancelled).map(t=><li key={t.itemId}><strong>{t.name}</strong> · {t.ready?'Ready':'Not ready'} · {t.updatedBy} · {new Date(t.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'})}</li>)}</ul></details>
   <Button variant="outline" disabled={correctDisabled} onClick={onCorrect}>Correct check</Button>
  </>}
 </div>;
}
