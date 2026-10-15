import {recipeTitle} from '../notebook';
import type {ReviewSource} from '../data-review';
import {bindReviewSource,entity,values,list,str,excluded,outOfScope,processFor,same,type Draft,type Entity,type Target} from './model';
import {upgradeUX} from './confirmation';
export type Offer={id:string;target:Target;label:string;value:string;sourcePath:string;rowKey?:string;rowId?:string};
function stable(s:string){let a=2166136261,b=5381;for(const c of s){a=Math.imul(a^c.charCodeAt(0),16777619);b=Math.imul(b,33)^c.charCodeAt(0);}return (a>>>0).toString(36)+(b>>>0).toString(36);}
export function offers(d:Draft,e:Entity,group:string,source:ReviewSource):Offer[]{
 const item=source.notebook.items.find(i=>i.id===e.sourceId),dish=source.notebook.recipes.find(r=>r.id===e.sourceId),out:Offer[]=[];
 const add=(key:string,label:string,value:string,path:string,rowKey?:string)=>{const id='fact-'+stable([source.revision,e.id,group,key,value].join('|')),rowId=rowKey?'previous-'+stable(id):undefined;out.push({id,target:{entityId:e.id,group,path:rowKey?[rowKey,rowId!,key]:[key]},label,value,sourcePath:path,rowKey,rowId});};
 if(group==='ITEM-01'&&item)add('name','Product name',item.name,`items/${item.id}/name`);
 if(group==='MENU-01'&&dish)add('name','Dish / variant name',recipeTitle(dish,source.notebook),`recipes/${dish.id}/title`);
 if(group==='DISH-01'&&dish)for(const input of dish.inputs)if(entity(d,input.itemId))add('item',`${source.notebook.items.find(i=>i.id===input.itemId)?.name??'Product'} — previously listed directly${dish.active?'':' (inactive listing)'}`,input.itemId,`recipes/${dish.id}/inputs/${input.itemId}`,'components');
 if(group==='ITEM-05'&&item)for(const recipe of source.notebook.recipes.filter(r=>r.inputs.some(i=>i.itemId===item.id)))add('destination',`${recipeTitle(recipe,source.notebook)} — previous direct use${recipe.active?'':' (inactive listing)'}`,'dish:'+recipe.id,`recipes/${recipe.id}/inputs/${item.id}`,'uses');
 return out.filter((o,i)=>out.findIndex(x=>x.id===o.id)===i);
}
export function offerBlocked(d:Draft,o:Offer):string|undefined{
 if(d.ux?.facts[o.id])return 'A decision is already recorded. Edit the answer below to revise it.';
 const e=entity(d,o.target.entityId);if(!e)return 'The product is no longer available.';const v=values(e,o.target.group),key=o.target.path.at(-1)!;
 if(o.rowKey){if(list(v,o.rowKey).some(row=>row[key]===o.value))return 'Already present in your answer.';if(Object.hasOwn(v,o.rowKey)&&list(v,o.rowKey).length===0)return 'You cleared this list. Add a row below if needed.';}
 else if(Object.hasOwn(v,key)&&v[key]!==o.value)return 'Your own answer is preserved. Edit it below if needed.';
}
export function decideOffer(d:Draft,o:Offer,decision:'accepted'|'change'|'check',source:ReviewSource):Draft{
 if(!entity(d,o.target.entityId)||d.ux?.facts[o.id]||!offers(d,entity(d,o.target.entityId)!,o.target.group,source).some(x=>same(x,o)))return d;
 if(decision==='accepted'&&offerBlocked(d,o))return d;
 let next=upgradeUX(d,source);const e=entity(next,o.target.entityId)!;
 if(decision==='accepted'){const v=values(e,o.target.group),key=o.target.path.at(-1)!;const answer=o.rowKey?{...v,[o.rowKey]:[...list(v,o.rowKey),{id:o.rowId!,[key]:o.value}]}:{...v,[key]:o.value};next={...next,entities:next.entities.map(x=>x.id===e.id?{...x,answers:{...x.answers,[o.target.group]:answer}}:x)};}
 return bindReviewSource({...next,ux:{...next.ux!,facts:{...next.ux!.facts,[o.id]:{target:o.target,sourceRevision:source.revision,sourcePath:o.sourcePath,sourceValue:JSON.stringify(o.value),decision,at:new Date().toISOString()}}}},source);
}
export function contextItems(d:Draft,e:Entity,source:ReviewSource){
 const ids=new Set([e.sourceId,e.kind==='item'?e.id:undefined,e.parentId,str(values(e,'STORE-01'),'item')]);
 const process=processFor(d,e);for(const row of list(values(process,'PROC-03'),'outputs'))ids.add(str(row,'item'));
 return source.notebook.items.filter(i=>ids.has(i.id));
}
export function previousContext(d:Draft,e:Entity,group:string,source:ReviewSource):{name:string;value:unknown;note:string}[]{
 return contextItems(d,e,source).flatMap(item=>{
  const result:{name:string;value:unknown;note:string}[]=[],profile=item.prepProfile;
  if(['ITEM-02','ITEM-03'].includes(group))result.push({name:item.name,value:{catalogLabel:item.kind,previousWorkflow:profile?.workflow},note:'A catalog label does not establish the actual source or work done here.'});
  if((group.startsWith('RUN')||group.startsWith('OPS'))&&!excluded(d,item.id,source)&&!outOfScope(d,e,source))result.push({name:item.name,value:{previousBatch:profile?.batch,earlierFields:{yieldAmount:item.yieldAmount,activeMinutes:item.activeMinutes,passiveMinutes:item.passiveMinutes,frequencyHours:item.frequencyHours},previousFrequency:profile?.frequency,previousEffort:profile?.effort,effortBasis:profile?.effortBasis},note:'Historical answers, not a new observed run. The earlier fields may describe different batches or tasks. Clarify units, coverage and basis before entering a sample.'});
  if(group.startsWith('STORE'))result.push({name:item.name,value:{earlierStorage:item.storage,previousStorageStates:profile?.storage},note:'Keep each physical state and package separate. Quality experience is not an approved storage rule. Verification is a separate owner action.'});
  return result.map(r=>({...r,value:compactContext(r.value)})).filter(r=>r.value!==undefined);
 });
}

function compactContext(value:unknown):unknown{if(value===null||value===undefined||value===''||value==='unknown')return undefined;if(Array.isArray(value)){const a=value.map(compactContext).filter(x=>x!==undefined);return a.length?a:undefined;}if(typeof value==='object'){const o=Object.fromEntries(Object.entries(value).map(([k,v])=>[k,compactContext(v)]).filter(([,v])=>v!==undefined));return Object.keys(o).length?o:undefined;}return value;}
