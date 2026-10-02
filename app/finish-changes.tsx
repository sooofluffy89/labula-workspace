import {finishChanges,type FinishIntent} from '@/lib/finish-intent';
import type {EveningSnapshot} from '@/lib/evening';
export function FinishChanges({intent,snapshot}:{intent:FinishIntent;snapshot:EveningSnapshot|null}){
 const changes=finishChanges(intent,snapshot);if(!changes.length)return null;
 return <details className="finish-changes"><summary>Review {changes.length} shared changes</summary><ul>{changes.map((c,i)=><li key={i}><strong>{c.name}</strong><p>Your approved summary: {c.mine}</p><p>Shared now: {c.shared}</p>{c.by&&<p className="muted small">{c.by}{c.at&&Number.isFinite(Date.parse(c.at))&&<> · {new Date(c.at).toLocaleString('en-GB',{timeZone:'Europe/Prague'})} (Prague time)</>}</p>}</li>)}</ul></details>;
}
