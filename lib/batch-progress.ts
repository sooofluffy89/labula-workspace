import type {Notebook} from './notebook';
import {directUsage,compareUsage} from './direct-usage';
import {batchCompletion} from './batch-profile';
export type BatchScope='house-made'|'priority';
export function batchProgress(n:Notebook,scope:BatchScope='house-made'){
 const usage=directUsage(n);
 const items=n.items.filter(i=>scope==='house-made'?i.kind==='prep':usage.itemDishes.has(i.id)&&i.prepProfile.issues.some(k=>['repeat','setup','replenish'].includes(k))).sort((a,b)=>compareUsage(usage,a.id,b.id)).map(item=>({item,count:usage.itemDishes.get(item.id)?.size??0,...batchCompletion(item.prepProfile)}));
 const applicable=items.filter(i=>i.applicable),remaining=applicable.filter(i=>!i.complete);
 return {items,remaining,total:applicable.length,filled:applicable.length-remaining.length,notApplicable:items.length-applicable.length,unknown:applicable.filter(i=>i.complete&&i.unknown).length};
}
