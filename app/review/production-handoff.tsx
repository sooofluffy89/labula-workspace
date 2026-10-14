'use client';
import type {ProductionHandoff} from '@/lib/review-production-handoff';

export function ProductionHandoffNotice({value}:{value?:ProductionHandoff}){
 if(!value||!value.processes.length&&!value.conflicts.length)return null;
 return <section className="notice" aria-label="Production source handoff"><h3>Notebook production moving to history</h3><p>Applying this reviewed version replaces the listed notebook tasks as the production source. Their exact saved values remain in catalog history. Other tasks keep their current records.</p><ul>{value.processes.map(p=><li key={p.id}><strong>{p.name}</strong> · {p.outputs.map(o=>value.outputNames.find(i=>i.id===o.itemId)?.name??o.itemId).join(', ')} · {p.activeMinutes===null?'unknown work':p.activeMinutes+' person-min / batch'} · {p.batchesPerWeek===null?'unknown weekly routine':p.batchesPerWeek+' batches / week'}</li>)}</ul>{value.conflicts.map(message=><p key={message} role="alert">{message}</p>)}<p>Incomplete reviewed composition or weekly work stays unknown. This handoff does not establish a new quantity or labour estimate.</p></section>;
}
