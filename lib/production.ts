import {approvedProduction,type ApprovedProductionTask} from './approved-production';
import {duplicatePairs} from './catalog';
import {normalizeName,safeCsvCell,type Notebook,type Item,type ProductionProcess,type RecipeInput} from './notebook';
import {appliedProductionItems,productionExcluded,type AppliedRecord} from './review-v2/applied';

export const processForItem=(n:Notebook,id:string)=>n.processes.find(p=>p.outputs.some(o=>o.itemId===id));
/** Explicit process is the current source; retained per-item fields are historical. */
export const productionInputs=(n:Notebook,id:string):RecipeInput[]=>processForItem(n,id)?.inputs??n.items.find(i=>i.id===id)?.inputs??[];
export function outputAmount(n:Notebook,id:string){const p=processForItem(n,id);return p?(p.outputs.find(o=>o.itemId===id)?.amount??null):(n.items.find(i=>i.id===id)?.yieldAmount??null);}
export function newProcess(n:Notebook,id:string):ProductionProcess{
 const item=n.items.find(i=>i.id===id);if(!item)throw Error('Item no longer exists.');const b=item.prepProfile.batch;
 const conversion=b?.output.unit==='kg'&&item.unit==='g'?1000:b?.output.unit==='l'&&item.unit==='ml'?1000:b?.output.unit===item.unit||b?.output.unit==='pieces'&&item.unit==='pcs'?1:null;
 return {id:crypto.randomUUID(),name:(item.name+' preparation').slice(0,160),inputs:structuredClone(item.inputs),outputs:[{itemId:id,amount:b?.output.unknown?null:item.yieldAmount??(b?.output.amount&&conversion?b.output.amount*conversion:null),note:''}],method:item.method,activeMinutes:b?.work.unknown?null:b?.work.minutes??item.activeMinutes,passiveMinutes:item.passiveMinutes,batchesPerWeek:!b?.frequency.unknown&&b?.frequency.period==='week'?b.frequency.times:null,externalUse:item.externalUse,reviewStatus:'unverified',reviewNote:'',sourceReviewId:null};
}
const duplicateSignatures=new WeakMap<Notebook,string>();
const duplicateCache=new Map<string,Set<string>>();
export function catalogReviewReasons(n:Notebook,item:Item){
 const out:string[]=[];let signature=duplicateSignatures.get(n);if(signature===undefined){signature=JSON.stringify({items:n.items.map(({id,name,kind,aliases})=>({id,name,kind,aliases})),distinctPairs:n.distinctPairs});duplicateSignatures.set(n,signature);}let pairs=duplicateCache.get(signature);if(!pairs){pairs=new Set(duplicatePairs(n).flatMap(p=>[p.a.id,p.b.id]));duplicateCache.set(signature,pairs);if(duplicateCache.size>2)duplicateCache.delete(duplicateCache.keys().next().value!);}if(pairs.has(item.id))out.push('Possible duplicate — compare actual products');
 if(item.reviewStatus==='needs-review')out.push(item.reviewNote||'Flagged for review');
 if(item.reviewStatus==='unverified')out.push('Identity and type not verified');
 if(/\bsauce box\s*\d|changes seasonally|chef.s choice/i.test(item.name))out.push('Describe the actual product or current seasonal version');
 const p=processForItem(n,item.id);
 if(item.kind==='prep'&&!productionInputs(n,item.id).length)out.push('Preparation composition not recorded');
 if(item.kind==='prep'&&!p)out.push('Production process not linked — legacy answers retained');
 if(p&&p.reviewStatus!=='verified')out.push('Production process needs verification');
 const used=n.recipes.some(r=>r.inputs.some(x=>x.itemId===item.id))||n.items.some(i=>i.inputs.some(x=>x.itemId===item.id))||n.processes.some(p=>p.inputs.some(x=>x.itemId===item.id));
 if(!used&&!item.externalUse&&!p?.externalUse)out.push('No recorded recipe, preparation or external use — check before retiring');
 return [...new Set(out)];
}
/** A deterministic change token, not a security signature. Scenarios themselves are excluded. */
export function menuFingerprint(n:Notebook){
 const s=JSON.stringify({dishes:n.dishes,recipes:n.recipes,items:n.items,processes:n.processes,reviewSourceRevision:n.reviewSourceRevision});let a=2166136261,b=5381;
 for(let i=0;i<s.length;i++){a=Math.imul(a^s.charCodeAt(i),16777619);b=Math.imul(b,33)^s.charCodeAt(i);}return (a>>>0).toString(16).padStart(8,'0')+(b>>>0).toString(16).padStart(8,'0');
}
export type ProductionTask={id:string;name:string;outputs:string[];weeklyMinutes:number|null;verified:boolean;external:boolean;source:'process'|'legacy'|'review';gaps:string[];sampleMinutes?:number};
export type MenuProjection={recipeIds:Set<string>;dishIds:Set<string>;required:Set<string>;produced:Set<string>;tasks:Map<string,ProductionTask>;gaps:string[];bought:number;prep:number;knownWeeklyMinutes:number;knownTasks:number;recordedSampleMinutes:number;recordedSampleContributions:number};
export function projectMenu(n:Notebook,recipeIds?:ReadonlySet<string>,reviewed:AppliedRecord[]=[],protectedIds?:string[]):MenuProjection{
 const selected=n.recipes.filter(r=>(recipeIds?recipeIds.has(r.id):r.active)&&n.dishes.some(d=>d.id===r.menuId&&d.state!=='archived'));
 const required=new Set<string>(),produced=new Set<string>(),tasks=new Map<string,ProductionTask>(),gaps=new Set<string>(),items=new Map(n.items.map(i=>[i.id,i])),held=appliedProductionItems(reviewed),approved=approvedProduction(n,reviewed),sampleWork=new Map<string,number>(),sampleConflicts=new Set<string>();
 const unavailable=!!n.reviewSourceRevision&&!reviewed.length;
 for(const gap of approved.gaps)gaps.add(gap);
 if(unavailable)gaps.add('Approved composition records are unavailable; current production dependencies and work cannot be established');
 const addTask=(item:Item,p?:ProductionProcess)=>{
  const id=p?.id??'legacy:'+item.id;if(tasks.has(id))return;
  const ownGaps:string[]=[],b=item.prepProfile.batch;
  let minutes=p?p.activeMinutes:b?.work.unknown?null:b?.work.minutes??item.activeMinutes;const frequency=p?p.batchesPerWeek:!b?.frequency.unknown&&b?.frequency.period==='week'?b.frequency.times:null;
  const outputs=p?.outputs.map(o=>o.itemId)??[item.id];
  if(unavailable||outputs.some(id=>held.has(id)||productionExcluded(n,id,protectedIds))){minutes=null;ownGaps.push('Approved or shared production has its own scope; review its current source before using a weekly total');}
  if(p?.sourceReviewId){minutes=null;ownGaps.push('Linked review evidence must be reconciled in Review before weekly work can be calculated');}
  if(minutes===null||minutes===undefined)ownGaps.push('Person-minutes per batch not recorded');
  if(frequency===null||frequency===undefined)ownGaps.push('Batches per typical week not recorded');
  if(!p&&item.prepProfile.workflow==='unknown')ownGaps.push('Work scope not recorded');
  if(!p&&/\bmanifesto\b/i.test([item.method,item.specification,item.prepProfile.note,b?.note].join(' '))){minutes=null;ownGaps.push('Work shared outside this menu is not separated');}
  const task:ProductionTask={id,name:p?.name??item.name,outputs,weeklyMinutes:minutes!=null&&frequency!=null?minutes*frequency:null,verified:(p?.reviewStatus??item.reviewStatus)==='verified',external:p?.externalUse??item.externalUse,source:p?'process':'legacy',gaps:ownGaps};tasks.set(id,task);
  for(const gap of ownGaps)gaps.add(task.name+': '+gap);
 };
 const addApproved=(task:ApprovedProductionTask)=>{
  if(tasks.has(task.id))return;
  const ownGaps=[...task.gaps,'Approved samples do not establish batches per typical week'];
  const recorded=new Map(task.sampleWork.map(part=>[part.id,part.personMinutes]));
  for(const [id,minutes] of recorded){if(sampleConflicts.has(id))continue;if(sampleWork.has(id)&&sampleWork.get(id)!==minutes){gaps.add('Recorded sample work has conflicting versions; review its evidence');sampleConflicts.add(id);sampleWork.delete(id);}else sampleWork.set(id,minutes);}
  tasks.set(task.id,{id:task.id,name:task.name,outputs:task.outputs,weeklyMinutes:task.weeklyMinutes,verified:task.verified,external:task.external,source:'review',gaps:ownGaps,...(recorded.size?{sampleMinutes:[...recorded.values()].reduce((sum,value)=>sum+value,0)}:{})});
  for(const gap of ownGaps)gaps.add(task.name+': '+gap);
 };
 const visit=(reference:string,path:Set<string>)=>{
  const id=approved.resolveItem(reference)??reference;
  if(path.has(id)){gaps.add('Circular production dependency');return;}if(required.has(id))return;const item=items.get(id);if(!item){gaps.add('Unknown ingredient reference: '+id);return;}required.add(id);const next=new Set(path).add(id),p=processForItem(n,id),sources=approved.byItem.get(id)??[];
  if(sources.length){
   if(sources.length>1)gaps.add(item.name+': approved composition has several current producers; review its exact source');
   for(const source of sources){for(const gap of source.gaps)gaps.add(source.name+': '+gap);if(source.workApplicable){addApproved(source);for(const output of source.outputs)produced.add(output);}for(const input of source.inputs)visit(input,next);}
   return;
  }
  // A marker from an approved apply cannot make old item recipes authoritative when its records are unavailable.
  if(unavailable&&(item.kind==='prep'||p||['ahead','hybrid'].includes(item.prepProfile.workflow??''))){addTask(item,p);return;}
  if(held.has(id)||p?.sourceReviewId||p?.outputs.some(output=>held.has(output.itemId))){gaps.add(item.name+': composition source requires reconciliation in Review');addTask(item,p);return;}
  if(p){addTask(item,p);for(const output of p.outputs)produced.add(output.itemId);if(p.outputs.some(output=>items.get(output.itemId)?.kind==='prep')&&!p.inputs.length)gaps.add(p.name+': preparation composition not recorded');for(const input of p.inputs)visit(input.itemId,next);}
  else{const inputs=item.inputs;if(item.kind==='prep'){if(!inputs.length)gaps.add(item.name+': preparation composition not recorded');if(item.prepProfile.workflow!=='supplied'&&item.prepProfile.workflow!=='order')addTask(item);}else if(item.prepProfile.workflow==='ahead'||item.prepProfile.workflow==='hybrid')addTask(item);for(const input of inputs)visit(input.itemId,next);}
 };
 for(const r of selected){if(!r.recorded||!r.inputs.length)gaps.add((n.dishes.find(d=>d.id===r.menuId)?.name??r.menuId)+' · '+r.variant+': ingredient list unfinished');for(const input of r.inputs)visit(input.itemId,new Set());}
 for(const item of n.items)if(item.externalUse||productionExcluded(n,item.id,protectedIds))visit(item.id,new Set());
 for(const p of n.processes)if(p.externalUse)for(const output of p.outputs)visit(output.itemId,new Set());
 for(const source of approved.tasks.values())if(source.external)for(const output of source.outputs)visit(output,new Set());
 const known=[...tasks.values()].filter(task=>task.weeklyMinutes!==null);
 return {recipeIds:new Set(selected.map(r=>r.id)),dishIds:new Set(selected.map(r=>r.menuId)),required,produced,tasks,gaps:[...gaps],bought:[...required].filter(id=>items.get(id)?.kind==='bought').length,prep:[...required].filter(id=>items.get(id)?.kind==='prep').length,knownWeeklyMinutes:known.reduce((sum,task)=>sum+task.weeklyMinutes!,0),knownTasks:known.length,recordedSampleMinutes:[...sampleWork.values()].reduce((sum,minutes)=>sum+minutes,0),recordedSampleContributions:sampleWork.size};
}
export function menuImpact(n:Notebook,selection:ReadonlySet<string>,reviewed:AppliedRecord[]=[],protectedIds?:string[]){
 const baseline=projectMenu(n,undefined,reviewed,protectedIds),current=projectMenu(n,selection,reviewed,protectedIds);
 const compositionGaps=[...baseline.gaps,...current.gaps].filter(g=>/composition|ingredient list|Unknown ingredient|Circular/.test(g));
 const removed=n.items.filter(i=>baseline.required.has(i.id)&&!current.required.has(i.id)),coProduced=removed.filter(i=>current.produced.has(i.id));
 const removable=removed.filter(i=>!current.produced.has(i.id));
 const removedTasks=[...baseline.tasks.values()].filter(t=>!current.tasks.has(t.id));
 const addedTasks=[...current.tasks.values()].filter(t=>!baseline.tasks.has(t.id));
 const workComplete=compositionGaps.length===0&&[...removedTasks,...addedTasks].every(t=>t.weeklyMinutes!==null);
 return {baseline,current,removed:removable,coProduced,removedTasks,addedTasks,compositionComplete:!compositionGaps.length,weeklySavings:workComplete?removedTasks.reduce((sum,t)=>sum+t.weeklyMinutes!,0)-addedTasks.reduce((sum,t)=>sum+t.weeklyMinutes!,0):null,gaps:[...new Set([...baseline.gaps,...current.gaps])]};
}
export function scenarioNotebook(n:Notebook,recipeIds:string[],fingerprint:string){
 if(menuFingerprint(n)!==fingerprint)throw Error('The menu or its source data changed. Recalculate and review the scenario before applying it.');
 const selected=new Set(recipeIds);for(const id of selected){const r=n.recipes.find(r=>r.id===id);if(!r||n.dishes.find(d=>d.id===r.menuId)?.state==='archived')throw Error('A selected variant is unavailable or archived. Review this scenario.');}
 return {...n,dishes:n.dishes.map(d=>selected.size&&n.recipes.some(r=>r.menuId===d.id&&selected.has(r.id))?{...d,state:'ready' as const}:d),recipes:n.recipes.map(r=>({...r,active:selected.has(r.id)}))};
}
export const matchesCatalogName=(item:Item,q:string)=>[item.name,...item.aliases].some(name=>normalizeName(name).includes(normalizeName(q)));

/** Task work appears once. Component rows carry amounts in the referenced item's base unit. */
export function exportProductionCsv(n:Notebook){
 const rows:unknown[][]=[['Record type','Task ID','Task name','Item ID','Item name','Amount per batch','Base unit','Person-minutes per batch','Unattended minutes per batch','Batches per week','External use','Review status','Review source','Method / note']];
 for(const p of n.processes){rows.push(['task',p.id,p.name,'','','','',p.activeMinutes,p.passiveMinutes,p.batchesPerWeek,p.externalUse,p.reviewStatus,p.sourceReviewId,p.method]);for(const [kind,parts] of [['input',p.inputs],['output',p.outputs]] as const)for(const part of parts){const item=n.items.find(i=>i.id===part.itemId);rows.push([kind,p.id,p.name,part.itemId,item?.name??'',part.amount,item?.unit??'','','','','','','',part.note]);}}
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}
