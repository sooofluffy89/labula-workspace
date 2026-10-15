import type {Notebook,ProductionProcess} from './notebook';
import {approvedProduction} from './approved-production';
import {productionExcluded,productionOutputReferences} from './review-v2/applied';
import {same,values,type Entity} from './review-v2/model';
import type {Proposal} from './review-v2/proposals';

export type ProductionHandoff={
 processes:ProductionProcess[];
 outputIds:string[];
 outputNames:{id:string;name:string}[];
 conflicts:string[];
};

/** Capture only tasks wholly replaced by this exact approved production scope. */
export function productionHandoff(n:Notebook,p:Proposal,dependencies:Entity[]=[],protectedIds?:string[]):ProductionHandoff{
 const entities=new Map([...dependencies,...p.entities].map(e=>[e.id,e])),scope=new Set<string>(),partial=new Set<string>(),conflicts:string[]=[];
 const records=p.entities.map(entity=>({entity,dependencies,readiness:p.readiness,effective:'',notebookRevision:0,approvalId:'',staleDependencies:false}));
 const resolveItem=approvedProduction(n,records).resolveItem;
 const resolve=(ref:string,seen=new Set<string>()):string[]=>{
  if(seen.has(ref))return [];seen.add(ref);
  const e=entities.get(ref),ids=[ref,e?.sourceId,resolveItem(ref)].filter((id):id is string=>!!id&&n.items.some(item=>item.id===id)),alias=values(e,'ITEM-01').alias;
  return [...new Set([...ids,...(typeof alias==='string'?resolve(alias,seen):[])])];
 };
 for(const e of p.entities){
  const refs=productionOutputReferences(e,entities);
  const quick=values(e,'QUICK-01').facts as Record<string,unknown>|undefined;
  const process=e.kind==='process'?e:entities.get(String(values(e,e.kind==='run'?'RUN-01':'OPS-01').process??e.parentId));
  const limited=quick?quick.coverage!=='Whole named task'||quick.kind==='A later step using an existing preparation':values(process,'PROC-01').practice!=='Current practice'||values(process,'PROC-01').relationship!=='Main method'||values(process,'PROC-05').scope!=='All products and work here are in scope'||e.kind==='run'&&values(e,'RUN-01').scope!=='Whole process';
  for(const ref of refs)for(const id of resolve(ref)){scope.add(id);if(limited)partial.add(id);}
 }
 for(const definition of n.workspaceRecipes??[])if(scope.has(definition.itemId))conflicts.push((n.items.find(item=>item.id===definition.itemId)?.name??definition.itemId)+': this product is now edited in Workspace 2.0. Its saved Review evidence is historical; update the product recipe in Menu. Your Review draft is retained.');
 const processes=n.processes.filter(process=>process.outputs.some(output=>scope.has(output.itemId))).map(process=>structuredClone(process));
 for(const process of processes){
  const outside=process.outputs.filter(output=>!scope.has(output.itemId)).map(output=>n.items.find(item=>item.id===output.itemId)?.name??output.itemId);
  if(outside.length)conflicts.push(process.name+': this task also produces '+outside.join(', ')+'. Review all its outputs together before replacing the task; no part of it will be discarded.');
  if(process.outputs.some(output=>partial.has(output.itemId)))conflicts.push(process.name+': this approval covers only a partial or alternative production scope. Reconcile the whole task in detailed Review before replacing it.');
  if(process.sourceReviewId)conflicts.push(process.name+': the current task is already linked to an approved source. Reconcile that source before replacing this task.');
  if(process.outputs.some(output=>productionExcluded(n,output.itemId,protectedIds)))conflicts.push(process.name+': shared or excluded production cannot be replaced by this review.');
  if(process.externalUse&&process.outputs.some(output=>!n.items.find(item=>item.id===output.itemId)?.externalUse))conflicts.push(process.name+': this task is used outside the menu. Record that use on its appropriate output items and reconcile the whole scope before replacing the task.');
 }
 const outputIds=[...scope].sort();
 return {processes:processes.sort((a,b)=>a.id.localeCompare(b.id)),outputIds,outputNames:outputIds.map(id=>({id,name:n.items.find(item=>item.id===id)?.name??id})),conflicts};
}

/** Missing old snapshots are compatible only when there is no task to retire. */
export function productionHandoffMatches(approved:unknown,current:ProductionHandoff):boolean{
 return !current.conflicts.length&&(approved===undefined?current.processes.length===0:same(approved,current));
}

/** The Review transaction archives these exact tasks in catalog_operations.before_payload. */
export function applyProductionHandoff(projected:Notebook,handoff:ProductionHandoff):void{
 const ids=new Set(handoff.processes.map(process=>process.id));
 projected.processes=projected.processes.filter(process=>!ids.has(process.id));
}
