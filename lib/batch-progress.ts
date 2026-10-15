import {menuUsage} from './menu-scope';
import type {AppliedRecord} from './review-v2/applied';
import type {Notebook} from './notebook';
import {compareUsage} from './direct-usage';
import {batchCompletion} from './batch-profile';
export type BatchScope='house-made'|'priority';
export function batchProgress(n:Notebook,scope:BatchScope='house-made',records:AppliedRecord[]=[]){
 const usage=menuUsage(n,records);
 const items=n.items.filter(i=>usage.itemDishes.has(i.id)&&(scope==='house-made'?i.kind==='prep':i.prepProfile.issues.some(k=>['repeat','setup','replenish'].includes(k)))).sort((a,b)=>compareUsage(usage,a.id,b.id)).map(item=>({item,count:usage.itemDishes.get(item.id)?.size??0,...batchCompletion(item.prepProfile)}));
 const applicable=items.filter(i=>i.applicable),remaining=applicable.filter(i=>!i.complete);
 return {items,remaining,total:applicable.length,filled:applicable.length-remaining.length,notApplicable:items.length-applicable.length,unknown:applicable.filter(i=>i.complete&&i.unknown).length};
}
