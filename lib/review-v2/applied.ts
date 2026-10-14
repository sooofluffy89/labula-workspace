import type {Entity,Readiness} from './model';
import {list,values,labour,fingerprint,type Authority,type Draft,excludedIds,excludedNames} from './model';
import {normalizeName,type Notebook} from '../notebook';
export type AppliedRecord={entity:Entity;readiness:Readiness[];dependencies:Entity[];effective:string;notebookRevision:number;approvalId:string;staleDependencies:boolean};
/** References describe authority, not completeness. Inactive Quick scope has products, never outputs. */
export function productionOutputReferences(e:Entity,entities:Map<string,Entity>):string[]{
 const quick=values(e,'QUICK-01').facts;
 if(quick&&typeof quick==='object'&&!Array.isArray(quick)){
  const outputs=(quick as Record<string,unknown>).outputs;
  return Array.isArray(outputs)?outputs.flatMap(output=>output&&typeof output==='object'&&typeof output.itemId==='string'?[output.itemId]:[]):[];
 }
 const process=e.kind==='process'?e:['run','operations'].includes(e.kind)?entities.get(String(values(e,e.kind==='run'?'RUN-01':'OPS-01').process??e.parentId)):undefined;
 return list(values(process,'PROC-03'),'outputs').flatMap(output=>typeof output.item==='string'?[output.item]:[]);
}
export function appliedProductionItems(records:AppliedRecord[]){const ids=new Set<string>(),entities=new Map<string,Entity>();for(const r of records)for(const e of r.dependencies)entities.set(e.id,e);for(const r of records)entities.set(r.entity.id,r.entity);const hold=(id:string,seen=new Set<string>())=>{if(seen.has(id))return;seen.add(id);ids.add(id);const e=entities.get(id);if(e?.sourceId)ids.add(e.sourceId);const target=values(e,'ITEM-01').alias;if(typeof target==='string')hold(target,seen);};for(const record of records)for(const id of productionOutputReferences(record.entity,entities))hold(id);return ids;}
export function productionExcluded(n:Notebook,id:string,protectedIds=excludedIds){const i=n.items.find(x=>x.id===id);return protectedIds.includes(id)||!!i&&[i.name,...i.aliases].some(name=>excludedNames.includes(normalizeName(name)));}
export function recordedWork(record:AppliedRecord){const d={entities:[...record.dependencies.filter(x=>x.id!==record.entity.id),record.entity]} as Draft;return labour(record.entity,d);}

export function storageAuthorityChanged(record:AppliedRecord,authorities:Authority[]){const entities=[...record.dependencies.filter(x=>x.id!==record.entity.id),record.entity],d={entities} as Draft;return entities.filter(e=>e.kind==='storage').some(e=>{const latest=authorities.find(a=>a.kind==='storage'&&a.entityId===e.id);return !!latest&&(latest.fingerprint!==fingerprint(d,e)||!['Checked and applicable','Applicable only with listed conditions','Confirmed: no storage interval for this state'].includes(String((latest.payload as {result?:string})?.result)));});}
