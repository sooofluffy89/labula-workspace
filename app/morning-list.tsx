'use client';
import {Checkbox} from '@/components/ui/checkbox';
import {Button} from '@/components/ui/button';
import {displayDay} from '@/lib/evening';
import {morningProgress,type EveningState} from '@/lib/evening-client';

export function MorningList({state,day,onReady,onContinue,onCorrect,correctDisabled}:{state:EveningState;day:string;onReady:(itemId:string)=>void;onContinue:(day:string)=>void;onCorrect:()=>void;correctDisabled:boolean}){
 const check=state.snapshot?.check,{tasks,ready,remaining,complete}=morningProgress(state);
 const locked=state.loading||!!state.error||state.unauthorized||state.recoveryBlocked||state.pending.some(p=>p.rejected||p.command.kind!=='ready');
 const pending=new Set(state.pending.flatMap(p=>p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[]));
 const drafts=state.snapshot?.checks.filter(c=>c.targetDay===day&&c.stage==='draft')??[];
 return <div className="morning-list">
  <div className="evening-meta"><strong>{displayDay(check?.targetDay??day)}</strong>{check&&check.version>0&&<span aria-live="polite">{ready} ready · {remaining} remaining</span>}</div>
  {!check&&state.snapshot&&!state.loading&&!state.error&&<div className="empty-panel"><h2>{drafts.length?'Evening check is still in progress':'No confirmed evening check'}</h2><p>Morning prep will appear after the evening check is confirmed.</p>{drafts.map(c=><Button key={c.id} onClick={()=>onContinue(c.id)}>Continue check · {displayDay(c.id)}</Button>)}</div>}
  {check&&check.version===0&&<div className="empty-panel"><h2>Evening check is still in progress</h2><p>Confirm the evening check before marking items ready.</p><Button onClick={()=>onContinue(check.id)}>Continue check · {displayDay(check.id)}</Button></div>}
  {check&&check.version>0&&<>
   <p className="morning-source">From confirmed evening check · {displayDay(check.id)}</p>
   {check.stage==='draft'&&<p className="notice">A correction is in progress. These tasks still use confirmed version {check.version}.</p>}
   {tasks.length===0&&!state.loading&&!state.error&&!state.pending.length?<div className="empty-panel"><h2>No missing items</h2><p>The evening check was confirmed with no items to replenish.</p></div>:<>
    <p className="morning-instruction">Tick when available. Untick to undo.</p>
    <div className="morning-completion" role="status">{complete?'✓ All morning items ready':state.pending.length?'Changes waiting to sync — not yet confirmed saved.':'Ready means available, not enough for the whole service.'}</div>
    {(['prep','bought'] as const).map(kind=>{const group=tasks.filter(t=>t.kind===kind);return group.length>0&&<section key={kind} className="morning-group" aria-label={kind==='prep'?'House-made prep':'Bought ingredients'}>
     <div className="morning-columns"><h2>{kind==='prep'?'House-made prep':'Bought ingredients · Restock'}</h2><span>Ready</span></div>
     {group.map(t=><div className={'morning-row'+(t.ready&&t.mappingValid?' is-ready':'')+(!t.mappingValid?' morning-invalid':'')} key={t.itemId} data-item-id={t.itemId} data-pending={pending.has(t.itemId)}>
      <div className="morning-name">{t.name}{!t.mappingValid&&<small>Catalog link needs review. Use Correct check.</small>}</div>
      <div className="morning-control"><Checkbox className="morning-toggle" checked={t.ready&&t.mappingValid} disabled={locked||!t.mappingValid} aria-label={`Ready: ${t.name}`} aria-describedby="stock-save-status" onCheckedChange={()=>onReady(t.itemId)}/>{pending.has(t.itemId)&&<span className="morning-pending" aria-hidden="true">…</span>}</div>
     </div>)}
    </section>;})}
   </>}
   <details className="morning-details"><summary>Check details &amp; activity</summary><p>Confirmed {check.confirmedAt?new Date(check.confirmedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'}):'—'} · {check.confirmedBy}</p><p>Last saved changes, Prague time. Pending changes are not included.</p><ul>{check.tasks.filter(t=>!t.cancelled).map(t=><li key={t.itemId}><strong>{t.name}</strong> · {t.ready?'Ready':'Not ready'} · {t.updatedBy} · {new Date(t.updatedAt).toLocaleString('en-GB',{timeZone:'Europe/Prague'})}</li>)}</ul></details>
   <Button variant="outline" disabled={correctDisabled} onClick={onCorrect}>Correct check</Button>
  </>}
 </div>;
}
