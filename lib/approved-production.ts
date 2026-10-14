import {normalizeName,type Notebook,type RecipeInput} from './notebook';
import {labour,list,same,str,values,type Entity,type Draft} from './review-v2/model';
import type {AppliedRecord} from './review-v2/applied';

type Node={entity:Entity;record:AppliedRecord;direct:boolean;ambiguous:boolean};
export type ApprovedProductionTask={id:string;entityId:string;name:string;outputs:string[];inputs:string[];compositionComplete:boolean;gaps:string[];weeklyMinutes:number|null;workApplicable:boolean;external:boolean;verified:boolean;sampleWork:{id:string;personMinutes:number}[]};
/** Top-level reapprovals take precedence over older snapshots embedded in samples. */
function approvedNodes(records:AppliedRecord[]){
 const nodes=new Map<string,Node>();
 const ordered=[...records].sort((a,b)=>(a.notebookRevision??0)-(b.notebookRevision??0));
 for(const record of ordered)for(const entity of record.dependencies??[]){const old=nodes.get(entity.id);if(!old)nodes.set(entity.id,{entity,record,direct:false,ambiguous:false});else if(!same(old.entity,entity))nodes.set(entity.id,{entity,record,direct:false,ambiguous:true});}
 for(const record of ordered)nodes.set(record.entity.id,{entity:record.entity,record,direct:true,ambiguous:false});
 return nodes;
}
function itemResolver(n:Notebook,nodes:Map<string,Node>){
 const catalog=new Map(n.items.map(item=>[item.id,item]));
 const exactNames=new Map<string,string>();for(const item of n.items)for(const label of [item.name,...item.aliases])exactNames.set(normalizeName(label),item.id);
 const resolve=(reference:unknown,seen=new Set<string>()):string|undefined=>{
  if(typeof reference!=='string'||!reference||seen.has(reference))return;const path=new Set(seen).add(reference),entry=nodes.get(reference)?.entity;
  const identity=values(entry,'ITEM-01');if(identity.identity==='Another name for an existing item'&&typeof identity.alias==='string')return resolve(identity.alias,path);
  if(entry?.sourceId&&catalog.has(entry.sourceId))return entry.sourceId;
  if(catalog.has(reference))return reference;
  if(entry?.sourceId&&entry.sourceId!==reference){const mapped=resolve(entry.sourceId,path);if(mapped)return mapped;}
  // An exact retained catalog alias is an identity decision, never a fuzzy name guess.
  if(entry){const candidates=new Set([entry.name,str(identity,'name')].filter(Boolean).flatMap(name=>{const id=exactNames.get(normalizeName(name));return id?[id]:[];}));if(candidates.size===1)return [...candidates][0];}
 };
 return resolve;
}
export function resolveApprovedItem(n:Notebook,records:AppliedRecord[],reference:unknown){return itemResolver(n,approvedNodes(records))(reference);}

/** Approved records supply composition; a partial source never falls back to a competing local recipe. */
export function approvedProduction(n:Notebook,records:AppliedRecord[]){
 const nodes=approvedNodes(records),resolveItem=itemResolver(n,nodes),byItem=new Map<string,ApprovedProductionTask[]>(),tasks=new Map<string,ApprovedProductionTask>(),held=new Set<string>(),globalGaps:string[]=[];
 for(const node of nodes.values()){
  const {entity,record}=node;if(entity.kind!=='process')continue;
  const quick=values(entity,'QUICK-01'),facts=quick.facts&&typeof quick.facts==='object'&&!Array.isArray(quick.facts)?quick.facts as Record<string,unknown>:undefined;
  const outputRows=facts?(Array.isArray(facts.outputs)?facts.outputs:Array.isArray(facts.products)?facts.products:[]):list(values(entity,'PROC-03'),'outputs').filter(row=>row.type!=='Discarded material');
  if(!outputRows.length)continue;
  const gaps:string[]=[],outputs:string[]=[],inputs:string[]=[];
  const addGap=(message:string)=>{if(!gaps.includes(message))gaps.push(message);};
  for(const raw of outputRows){if(!raw||typeof raw!=='object')continue;const row=raw as Record<string,unknown>,id=resolveItem(row.itemId??row.item);if(id){if(!outputs.includes(id))outputs.push(id);}else addGap('Approved composition contains an output whose current catalog identity is unresolved');}
  if(!outputs.length){globalGaps.push(entity.name+': approved composition outputs have unresolved current catalog identities');continue;}
  const workApplicable=facts?!['Received ready to use, no local prep','No longer used here'].includes(String(facts.kind)):values(entity,'PROC-01').relationship!=='No work is done here';
  let complete=false,external=false;
  if(facts){
   addGap('Approved quick review records scope and work, but its complete input composition is not recorded');
   external=facts.sharedScope==='Includes shared work outside this review';
   // A specifically named later input is real evidence, but is not a complete recipe.
   if(facts.kind==='A later step using an existing preparation'&&facts.inputId){const id=resolveItem(facts.inputId);if(id)inputs.push(id);else addGap('Approved composition references an unavailable preceding preparation');}
  }else{
   const definition=values(entity,'PROC-01'),composition=values(entity,'PROC-02'),coverage=values(entity,'PROC-03'),relation=values(entity,'PROC-04'),scope=values(entity,'PROC-05');
   const rows=list(composition,'inputs');
   for(const row of rows){const id=resolveItem(row.item);if(!id){addGap('Approved composition contains an input whose current catalog identity is unresolved');continue;}
    if(outputs.includes(id)){
     // A bought product can retain its inventory identity across an explicitly named local step.
     if(n.items.find(item=>item.id===id)?.kind==='bought'&&row.origin==='New ingredient')continue;
     addGap('Approved composition links the same catalog product across stages or an earlier batch; its source needs review');continue;
    }
    if(!inputs.includes(id))inputs.push(id);if(row.origin==='Earlier batch')addGap('Approved composition uses an earlier batch whose composition reference is not established');
   }
   const readiness=record.readiness?.find(state=>state.dimension==='Process composition')??(!node.direct&&record.entity.kind==='run'?record.readiness?.find(state=>state.dimension==='Labour per recorded run'):undefined);
   const ready=!!readiness&&['Ready with stated scope','Usable estimate'].includes(readiness.status)&&!readiness.gaps.length;
   complete=ready&&Object.hasOwn(composition,'inputs')&&rows.length>0&&coverage.complete==='All outputs identified'&&definition.practice==='Current practice'&&definition.relationship==='Main method'&&relation.relationship==='One process creates these outputs'&&relation.together==='Always together with this method'&&scope.scope==='All products and work here are in scope';
   if(!complete)addGap('Approved composition source requires reconciliation in Review: confirm the complete current method and all inputs/outputs');
   external=scope.scope==='Some outputs or shared work are outside this review'||definition.relationship==='Outside production review';
   if(external){complete=false;addGap('Approved composition includes shared work outside this review; its local boundary is not complete');}
  }
  if(node.ambiguous){complete=false;addGap('Approved composition has conflicting process versions in its saved dependencies');}
  if(record.staleDependencies){complete=false;addGap('Approved composition dependencies changed after application; review the current source');}
  if(gaps.length)complete=false;
  const task:ApprovedProductionTask={id:'review:'+entity.id,entityId:entity.id,name:entity.name,outputs,inputs,compositionComplete:complete,gaps,weeklyMinutes:null,workApplicable,external,verified:false,sampleWork:[]};
  // A usual week is not derived from a recorded sample or a daily count.
  // Quick work is an estimate with incomplete composition, so it cannot establish menu savings.
  tasks.set(task.id,task);for(const output of outputs){held.add(output);const current=byItem.get(output)??[];current.push(task);byItem.set(output,current);}
 }
 // Actual run contributions remain samples. Shared contributions are identified once across outputs/tasks.
 for(const record of records){if(record.entity.kind!=='run')continue;const processId=str(values(record.entity,'RUN-01'),'process')||record.entity.parentId,task=processId?tasks.get('review:'+processId):undefined;if(!task||!task.workApplicable)continue;
  const snapshot=record.dependencies.find(entity=>entity.id===processId),current=processId?nodes.get(processId)?.entity:undefined;
  if(record.staleDependencies||snapshot&&current&&!same(snapshot,current))continue;
  const state=record.readiness?.find(state=>state.dimension==='Labour per recorded run');if(!state||!['Ready with stated scope','Usable estimate'].includes(state.status)||state.gaps.length)continue;
  const entities=[...nodes.values()].map(node=>node.entity);let result:ReturnType<typeof labour>;try{result=labour(record.entity,{entities} as Draft);}catch{continue;}if(result.missing)continue;
  for(const contribution of result.contributions)if(!task.sampleWork.some(part=>part.id===contribution.id))task.sampleWork.push({id:contribution.id,personMinutes:contribution.personMinutes});
 }
 return {byItem,tasks,held,resolveItem,gaps:globalGaps,sourceUnavailable:!!n.reviewSourceRevision&&!records.length};
}

export function approvedProductionFor(n:Notebook,records:AppliedRecord[],id:string):ApprovedProductionTask|null{
 const graph=approvedProduction(n,records),key=graph.resolveItem(id)??id,tasks=graph.byItem.get(key)??[];if(!tasks.length)return null;if(tasks.length===1)return tasks[0];return {id:'review-conflict:'+key,entityId:tasks.map(task=>task.entityId).join(','),name:n.items.find(item=>item.id===key)?.name??key,outputs:[...new Set(tasks.flatMap(task=>task.outputs))],inputs:[...new Set(tasks.flatMap(task=>task.inputs))],compositionComplete:false,gaps:['Approved composition has several current producers; select the exact source and method in Review',...new Set(tasks.flatMap(task=>task.gaps))],weeklyMinutes:null,workApplicable:tasks.some(task=>task.workApplicable),external:tasks.some(task=>task.external),verified:false,sampleWork:[]};
}

/** Current dependency links only. A Review sample never lends quantities to a different batch. */
export function currentProductionInputs(n:Notebook,graph:ReturnType<typeof approvedProduction>,id:string):RecipeInput[]{
 const key=graph.resolveItem(id)??id,sources=graph.byItem.get(key)??[];
 if(sources.length)return [...new Set(sources.flatMap(source=>source.inputs))].map(itemId=>({itemId,amount:null,note:'Approved Review source'}));
 const process=n.processes.find(process=>process.outputs.some(output=>output.itemId===key)),item=n.items.find(item=>item.id===key);
 if(graph.sourceUnavailable&&(item?.kind==='prep'||process))return [];
 if(graph.held.has(key)||process?.sourceReviewId)return [];
 return process?.inputs??item?.inputs??[];
}
