import {ingredientContentChanged,ingredientsReviewed} from './ingredient-review';
import {hasMeasurementMetadata,measurement,measurementText} from './recipe-quantity';
import {prepDraftSchema,type PrepDraft} from './prep-draft';
import {z} from 'zod';
import {migrateNotebook,newItem,recipeTitle,validateNotebook,type Notebook,type Item,type RecipeInput,normalizeName} from './notebook';
import {validateOrdinaryEdit,exactItem} from './catalog';
import {serializeNotebook,utf8Bytes} from './notebook-size';
import {saveRecoverySchema,type SaveRecovery} from './save-recovery';
import {recoverySchema,type BulkRecovery} from './bulk-draft';
import {aliasDraftSchema,catalogRecoverySchema,type AliasDraft,type CatalogRecovery} from './catalog-draft';
export const MAX_NOTEBOOK_DRAFT_BYTES=6_000_000;
const notebook=z.unknown().transform(value=>migrateNotebook(value));
const pending=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('none')}).strict(),
 z.object({kind:z.literal('save'),receipt:saveRecoverySchema}).strict(),
 z.object({kind:z.literal('bulk'),receipt:recoverySchema}).strict(),
 z.object({kind:z.literal('catalog'),receipt:catalogRecoverySchema}).strict(),
]);
const envelope=z.object({format:z.literal('labula-notebook-draft'),version:z.literal(1),exportedAt:z.string().max(100),sourceMenu:z.literal('https://www.labula.cz/menu'),actorEmail:z.string().max(400).optional(),notebook,base:z.object({revision:z.number().int().nonnegative(),notebook}).strict().nullable(),recovery:pending,aliasDrafts:z.array(aliasDraftSchema).max(1000).default([]),profileItemIds:z.array(z.string()).max(1000).optional(),prepDraft:prepDraftSchema.nullable().optional()}).strict();
export type NotebookDraft=z.infer<typeof envelope>;
const legacy=z.object({exportedAt:z.string().max(100),sourceMenu:z.string().max(300),notebook,earlierSave:saveRecoverySchema.nullable().optional()}).strict();
export function readNotebookDraft(content:string):NotebookDraft{
 if(utf8Bytes(content)>MAX_NOTEBOOK_DRAFT_BYTES)throw Error('This notebook draft exceeds the 6 MB file limit. Your current work is kept.');
 let raw:unknown;try{raw=JSON.parse(content,(key,value)=>{if(['__proto__','prototype','constructor'].includes(key))throw Error('Unsupported field.');return value;});}catch{throw Error('Choose a valid Labula notebook draft (.json). Your current work is kept.');}
 if(raw&&typeof raw==='object'&&'format' in raw&&raw.format==='labula-ingredient-draft')throw Error('This is an ingredient list. Open its dish and choose Add multiple ingredients → Restore draft.');
 try{
  let draft:NotebookDraft;
  if(raw&&typeof raw==='object'&&'format' in raw)draft=envelope.parse(raw);
  else{const old=legacy.parse(raw);draft={format:'labula-notebook-draft',version:1,exportedAt:old.exportedAt,sourceMenu:'https://www.labula.cz/menu',notebook:old.notebook,base:null,recovery:old.earlierSave?{kind:'save',receipt:old.earlierSave}:{kind:'none'},aliasDrafts:[]};}
  draft.profileItemIds??=(Number((raw as {notebook?:{schemaVersion?:number;items?:{id:string}[]}}).notebook?.schemaVersion)>=3?draft.notebook.items.map(i=>i.id):[]);
  if(draft.recovery.kind==='save'){const local=migrateNotebook(JSON.parse(draft.recovery.receipt.localPayload));if(draft.base?.revision!==draft.recovery.receipt.revision||JSON.stringify(draft.notebook)!==JSON.stringify(local))draft.base=null;draft.notebook=local;}
  if(draft.base)serializeNotebook(draft.base.notebook);
  const aliases=new Set<string>();for(const entry of draft.aliasDrafts){if(aliases.has(entry.itemId))throw Error('Repeated alias draft.');aliases.add(entry.itemId);}
  return draft;
 }catch{throw Error('This notebook draft is unsupported or contains invalid data. Your current work is kept.');}
}
export function makeNotebookDraft(data:Notebook,base:NotebookDraft['base'],actorEmail:string,aliasDrafts:AliasDraft[],save:SaveRecovery|null,catalog:CatalogRecovery|null,bulk:BulkRecovery|null,prepDraft:PrepDraft|null=null):NotebookDraft{
 if([save,catalog,bulk].filter(Boolean).length>1)throw Error('Finish checking the earlier operation before downloading this draft.');
 const file:NotebookDraft={format:'labula-notebook-draft',version:1,exportedAt:new Date().toISOString(),sourceMenu:'https://www.labula.cz/menu',actorEmail,notebook:data,base,profileItemIds:data.items.map(i=>i.id),prepDraft,recovery:save?{kind:'save',receipt:save}:catalog?{kind:'catalog',receipt:catalog}:bulk?{kind:'bulk',receipt:bulk}:{kind:'none'},aliasDrafts};
 return readNotebookDraft(JSON.stringify(file));
}
export type RestoreDecision='shared'|'draft';
export type RestoreChange={id:string;label:string;shared:string;draft:string;conflict:boolean;decision:RestoreDecision|undefined};
export type RestoreMapping={item:Item;reason:string;canCreate:boolean;currentMatch?:Item};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function planNotebookRestore(file:NotebookDraft,shared:Notebook,decisions:Record<string,RestoreDecision>={},mappings:Record<string,string>={},canManage=false){
 if(canManage)return planManagedNotebookRestore(file,shared,decisions,mappings);
 const next=structuredClone(shared),base=file.base?.notebook,changes:RestoreChange[]=[],unmapped:RestoreMapping[]=[],notices=new Set<string>();
 const sharedById=new Map(shared.items.map(i=>[i.id,i])),baseById=new Map(base?.items.map(i=>[i.id,i])??[]),mapped=new Map<string,string|null>();
 const choose=<T>(id:string,label:string,old:T|undefined,incoming:T,current:T,describe:(value:T)=>string,force=false):T=>{
  if(same(incoming,current)||old!==undefined&&same(incoming,old))return current;
  const conflict=force||old===undefined||!same(current,old),decision=decisions[id]??(conflict?undefined:'draft');
  changes.push({id,label,shared:describe(current),draft:describe(incoming),conflict,decision});
  return decision==='draft'?incoming:current;
 };
 for(const item of file.notebook.items){
  const existing=sharedById.get(item.id),old=baseById.get(item.id),mapping=mappings[item.id];
  if(existing){mapped.set(item.id,item.id);const dest=next.items.find(i=>i.id===item.id)!;dest.name=choose('name:'+item.id,'Name: '+existing.name,old?.name,item.name,existing.name,v=>v);
   if(file.profileItemIds?.includes(item.id))dest.prepProfile=choose('profile:'+item.id,'Preparation & storage: '+existing.name,old?.prepProfile,item.prepProfile,existing.prepProfile,v=>JSON.stringify(v));
   if(item.kind!==existing.kind)notices.add(`“${existing.name}” is currently ${existing.kind==='prep'?'Made in-house':'Bought'}. Its current type is retained; use the owner catalog tools to correct it.`);
   if(!same(item.aliases,existing.aliases))notices.add(`Saved alternative names for “${existing.name}” differ. Review them separately in catalog management; they are not overwritten by this restore.`);
   continue;
  }
  const exact=exactItem(shared.items,item.name);
  if(mapping==='skip'){mapped.set(item.id,null);continue;}
  if(mapping&&sharedById.has(mapping)){mapped.set(item.id,mapping);if(file.profileItemIds?.includes(item.id)){const dest=next.items.find(i=>i.id===mapping)!;dest.prepProfile=choose('mapped-profile:'+item.id,'Preparation & storage: '+dest.name,undefined,item.prepProfile,dest.prepProfile,v=>JSON.stringify(v),true);}continue;}
  if(mapping?.startsWith('new:')&&!old&&!exact){const fresh=newItem(item.name,item.kind,item.unit);fresh.id=mapping.slice(4);if(file.profileItemIds?.includes(item.id))fresh.prepProfile=item.prepProfile;next.items.push(fresh);mapped.set(item.id,fresh.id);notices.add(`New item: ${item.name} (${item.kind==='prep'?'Made in-house':'Bought'}). Preparation and storage answers are included when present. Legacy quantity and recipe details stay in the original file.`);continue;}
  unmapped.push({item,reason:old?'This saved item no longer exists. It may have been merged. Choose its current entry.':exact?'This name now matches an existing item. Confirm which item to use.':'This older file does not identify whether the item was new. Choose an existing item, create a new entry, or skip it.',canCreate:!old&&!exact,currentMatch:exact});mapped.set(item.id,null);
 }
 for(const imported of file.notebook.recipes){
  const current=shared.recipes.find(r=>r.id===imported.id),original=base?.recipes.find(r=>r.id===imported.id),dest=next.recipes.find(r=>r.id===imported.id);
  if(!current||!dest){notices.add('A recipe no longer exists in the current menu and was not recreated.');continue;}
  const incomingIds=new Set(imported.inputs.flatMap(p=>mapped.get(p.itemId)?[mapped.get(p.itemId)!]:[]));
  const currentIds=new Set(current.inputs.map(p=>p.itemId));
  const originalIds=original?new Set(original.inputs.flatMap(p=>sharedById.has(p.itemId)?[p.itemId]:mapped.get(p.itemId)?[mapped.get(p.itemId)!]:[])):undefined;
  const all=new Set([...currentIds,...incomingIds,...(originalIds??[])]),wanted=new Set(currentIds);
  for(const id of all){
   const label=next.items.find(i=>i.id===id)?.name??id;
   const include=choose('input:'+current.id+':'+id,recipeTitle(current,shared)+' · '+label,originalIds?originalIds.has(id):undefined,incomingIds.has(id),currentIds.has(id),v=>v?'Listed':'Not listed');
   if(include)wanted.add(id);else wanted.delete(id);
  }
  // Current quantities/notes survive on retained links; restored links start blank.
  dest.inputs=current.inputs.filter(p=>wanted.has(p.itemId));for(const id of wanted)if(!currentIds.has(id))dest.inputs.push({itemId:id,amount:null,note:''});
  const ingredientsChanged=!same(current.inputs,dest.inputs);
  dest.active=choose('active:'+current.id,recipeTitle(current,shared)+' · on the menu',original?.active,imported.active,current.active,v=>v?'Active':'Inactive');
  if(ingredientsChanged){dest.recorded=false;dest.ingredientsReviewed=false;dest.reviewStatus='unverified';if(dest.workshop)dest.workshop={...dest.workshop,processChecked:false};notices.add('Restored ingredient lists are In progress. Confirm Completed after checking the full list.');}
  else dest.recorded=choose('recorded:'+current.id,recipeTitle(current,shared)+' · ingredient list confirmation',original?.recorded,imported.recorded,current.recorded,v=>v?'Completed':'Not confirmed',imported.recorded&&!current.recorded);
  if(!dest.inputs.length)dest.recorded=false;
  if(!dest.recorded&&dest.ingredientsReviewed)dest.ingredientsReviewed=false;
 }
 if(!same(file.notebook.dishes,shared.dishes)||!same(file.notebook.processes,shared.processes)||!same(file.notebook.scenarios,shared.scenarios))notices.add('Dish details, production and saved scenarios require an owner or Manager restore. They remain in the imported file.');
 let error='';try{validateNotebook(next);validateOrdinaryEdit(shared,next);serializeNotebook(next);}catch(e){error=e instanceof Error?e.message:'Review the selected changes.';}
 const unresolved=changes.filter(c=>c.conflict&&!c.decision).length+unmapped.length;
 return {next,changes,unmapped,unmappedEntities:[] as RestoreEntityMapping[],notices:[...notices],unresolved,error,changed:!same(next,shared)};
}
export type RestoreEntityMapping={key:string;kind:'dish'|'recipe'|'process'|'scenario';name:string;reason:string;canCreate:boolean;options:{id:string;label:string}[]};

/** Full v4 import is reviewed against the editing base, with explicit fresh identities. */
function planManagedNotebookRestore(file:NotebookDraft,shared:Notebook,decisions:Record<string,RestoreDecision>,mappings:Record<string,string>){
 const next=structuredClone(shared),base=file.base?.notebook,changes:RestoreChange[]=[],unmapped:RestoreMapping[]=[],unmappedEntities:RestoreEntityMapping[]=[],notices=new Set<string>(),mappingErrors=new Set<string>();
 const mapped=new Map<string,string|null>();
 const choose=<T>(id:string,label:string,old:T|undefined,incoming:T,current:T,describe:(value:T)=>string=describeValue,force=false):T=>{
  if(same(incoming,current)||old!==undefined&&same(incoming,old))return current;
  const conflict=force||old===undefined||!same(current,old),decision=decisions[id]??(conflict?undefined:'draft');
  changes.push({id,label,shared:describe(current),draft:describe(incoming),conflict,decision});
  return decision==='draft'?structuredClone(incoming):current;
 };
 const sharedItems=new Map(shared.items.map(i=>[i.id,i])),baseItems=new Map(base?.items.map(i=>[i.id,i])??[]);
 for(const item of file.notebook.items){
  const current=sharedItems.get(item.id),old=baseItems.get(item.id),mapping=mappings[item.id],exact=exactItem(shared.items,item.name);
  if(current){mapped.set(item.id,item.id);continue;}
  if(mapping==='skip'){mapped.set(item.id,null);notices.add(`Skipped saved item “${item.name}”. Its details remain in the imported file.`);continue;}
  if(mapping&&sharedItems.has(mapping)){mapped.set(item.id,mapping);continue;}
  const newId=mapping?.startsWith('new:')?mapping.slice(4):'';
  if(newId&&!old&&!exact&&!next.items.some(i=>i.id===newId)&&!baseItems.has(newId)&&!file.notebook.items.some(i=>i.id===newId)){
   const fresh=newItem(item.name,item.kind,item.unit);fresh.id=newId;next.items.push(fresh);mapped.set(item.id,newId);continue;
  }
  unmapped.push({item,reason:old?'This saved item was removed or merged. Map it to its surviving current entry; its retired identity cannot be recreated.':exact?'This name matches a current item. Confirm which entry to use.':'Choose a current entry, create a new identity, or skip this saved item.',canCreate:!old&&!exact,currentMatch:exact});mapped.set(item.id,null);
 }
 const mapParts=(parts:RecipeInput[],label:string):RecipeInput[]=>{
  const result:RecipeInput[]=[],seen=new Set<string>();
  for(const part of parts){const id=mapped.get(part.itemId);if(!id){if(mappings[part.itemId]==='skip')notices.add(`${label}: a skipped ingredient was left out; check the restored composition.`);continue;}
   if(seen.has(id)){mappingErrors.add(`${label}: two saved ingredients map to the same current item. Resolve their mappings instead of combining quantities automatically.`);continue;}seen.add(id);
   const source=file.notebook.items.find(i=>i.id===part.itemId),dest=next.items.find(i=>i.id===id);
   if(part.amount!==null&&source&&dest&&source.unit!==dest.unit)mappingErrors.add(`${label}: ${source.name} uses ${source.unit}, but its selected current entry uses ${dest.unit}. Quantities cannot be restored without an explicit conversion.`);
   result.push({...part,itemId:id});
  }return result;
 };
 const baseParts=(parts:RecipeInput[]|undefined)=>parts?.flatMap(part=>{const id=sharedItems.has(part.itemId)?part.itemId:mapped.get(part.itemId);return id?[{...part,itemId:id}]:[];});
 const mergeParts=(key:string,label:string,incoming:RecipeInput[],current:RecipeInput[],old:RecipeInput[]|undefined):RecipeInput[]=>{
  const result:RecipeInput[]=[];const all=new Set([...current,...incoming,...(old??[])].map(p=>p.itemId));
  for(const id of all){const before=old?.find(p=>p.itemId===id),draft=incoming.find(p=>p.itemId===id),now=current.find(p=>p.itemId===id),name=next.items.find(i=>i.id===id)?.name??id;
   if(!choose('input:'+key+':'+id,label+' · '+name,old?!!before:undefined,!!draft,!!now,v=>v?'Listed':'Not listed'))continue;
   if(!draft){if(now)result.push({...now});continue;}
   const item=next.items.find(i=>i.id===id)!;const explicit=[before,draft,now].some(p=>p&&hasMeasurementMetadata(p));const chosen=explicit?choose('measurement:'+key+':'+id,label+' · '+name+' amount and unit',before?measurement(before,item):undefined,measurement(draft,item),now?measurement(now,item):{amount:null,unit:item.unit,pieceMeaning:'',conversion:null},v=>measurementText({...v,itemId:id,note:''},item)):null;const note=choose('input-note:'+key+':'+id,label+' · '+name+' note',before?.note,draft.note,now?.note??'');const part:RecipeInput=chosen?(now&&same(measurement(now,item),chosen)?{...now,note}:{itemId:id,amount:chosen.amount,note,unit:chosen.unit,pieceMeaning:chosen.pieceMeaning,conversion:chosen.conversion}):{itemId:id,amount:choose('amount:'+key+':'+id,label+' · '+name+' amount',before?.amount,draft.amount,now?.amount??null),note};result.push(part);
  }return result;
 };
 // Restore only after every source ingredient has an explicit identity mapping.
 for(const item of file.notebook.items){const id=mapped.get(item.id);if(!id)continue;const dest=next.items.find(i=>i.id===id)!;const current=sharedItems.get(id),old=id===item.id?baseItems.get(item.id):undefined;
  if(!current){const copy=structuredClone(item);Object.assign(dest,copy,{id,aliases:[],inputs:[],reviewStatus:'unverified'});if(!file.profileItemIds?.includes(item.id))dest.prepProfile=newItem(item.name).prepProfile;notices.add(`Created “${item.name}” with a fresh identity. Saved quantities and production details are included after mapping; verification must be repeated.`);}
  else{
   dest.name=choose('name:'+item.id,'Name: '+current.name,old?.name,item.name,current.name);
   if(file.profileItemIds?.includes(item.id))dest.prepProfile=choose('profile:'+item.id,'Preparation & storage: '+current.name,old?.prepProfile,item.prepProfile,current.prepProfile);
   const fields=['unit','specification','yieldAmount','activeMinutes','passiveMinutes','frequencyHours','batchMinimum','batchMaximum','method','storage','supplier','packLabel','packAmount','externalUse','reviewStatus','reviewNote'] as const;
   for(const field of fields){(dest as unknown as Record<string,unknown>)[field]=choose('item:'+item.id+':'+field,current.name+' · '+restoreFieldLabel(field),old?.[field],item[field],current[field]);}
   if(item.kind!==current.kind)notices.add(`“${current.name}”: its current type is retained. Review the Bought / House-made change in catalog management.`);
  }
  if(item.aliases.length&&!same(item.aliases,current?.aliases??[]))notices.add(`Alternative names for “${item.name}” remain a separate catalog review; they are not overwritten.`);
 }
 for(const item of file.notebook.items){const id=mapped.get(item.id);if(!id)continue;const dest=next.items.find(i=>i.id===id)!,current=sharedItems.get(id),old=id===item.id?baseItems.get(item.id):undefined;
  const incoming=mapParts(item.inputs,item.name+' composition');
  if(dest.kind==='bought'&&incoming.length){notices.add(`“${dest.name}” remains Bought. Its saved preparation composition remains in the file until its type is reviewed.`);continue;}
  dest.inputs=current?mergeParts('item:'+item.id,dest.name+' composition',incoming,current.inputs,baseParts(old?.inputs)):incoming;
  if(current&&!same(current.inputs,dest.inputs))dest.reviewStatus='unverified';
 }
 const domainMap=<T extends {id:string;name:string}>(kind:RestoreEntityMapping['kind'],incoming:T[],current:T[],original:T[]|undefined,options:(item:T)=>{id:string;label:string}[]=()=>current.map(x=>({id:x.id,label:x.name}))):Map<string,string|null>=>{
  const result=new Map<string,string|null>();
  for(const item of incoming){const key=kind+':'+item.id,now=current.find(x=>x.id===item.id),old=original?.find(x=>x.id===item.id),mapping=mappings[key],available=options(item),exact=available.some(x=>normalizeName(x.label)===normalizeName(item.name));
   if(now){result.set(item.id,item.id);continue;}
   if(mapping==='skip'){result.set(item.id,null);notices.add(`Skipped saved ${kind} “${item.name}”. Its data remains in the imported file.`);continue;}
   if(mapping&&available.some(x=>x.id===mapping)){result.set(item.id,mapping);continue;}
   const fresh=mapping?.startsWith('new:')?mapping.slice(4):'';
   if(fresh&&!old&&!exact&&!current.some(x=>x.id===fresh)&&!incoming.some(x=>x.id===fresh)&&!original?.some(x=>x.id===fresh)&&![...result.values()].includes(fresh)){result.set(item.id,fresh);continue;}
   unmappedEntities.push({key,kind,name:item.name,reason:old?'This identity was removed after the editing base. Choose its surviving current entry or skip it.':'Confirm a current entry or create a fresh identity. Saved IDs are never copied blindly.',canCreate:!old&&!exact,options:available});result.set(item.id,null);
  }return result;
 };
 const dishMap=domainMap('dish',file.notebook.dishes,shared.dishes,base?.dishes);
 for(const dish of file.notebook.dishes){const id=dishMap.get(dish.id);if(!id)continue;const current=shared.dishes.find(d=>d.id===id),old=id===dish.id?base?.dishes.find(d=>d.id===dish.id):undefined;let dest=next.dishes.find(d=>d.id===id);
  if(!dest){dest={...structuredClone(dish),id,state:'draft'};next.dishes.push(dest);}
  const initial=current??dest;
  dest.name=choose('dish:'+dish.id+':name','Dish name: '+initial.name,old?.name,dish.name,initial.name);
  dest.category=choose('dish:'+dish.id+':category',dish.name+' · category',old?.category,dish.category,initial.category);
  const restoredNote=choose('dish:'+dish.id+':note',dish.name+' · note',old?.note??(old?'':undefined),dish.note??'',initial.note??'');if(restoredNote||initial.note!==undefined)dest.note=restoredNote;
  dest.state=choose('dish:'+dish.id+':state',dish.name+' · lifecycle',old?.state,dish.state,initial.state);
 }
 const recipeNames=file.notebook.recipes.map(r=>({...r,name:r.variant})),currentRecipeNames=shared.recipes.map(r=>({...r,name:r.variant})),baseRecipeNames=base?.recipes.map(r=>({...r,name:r.variant}));
 const recipeMap=domainMap('recipe',recipeNames,currentRecipeNames,baseRecipeNames,recipe=>currentRecipeNames.filter(r=>r.menuId===dishMap.get(recipe.menuId)).map(r=>({id:r.id,label:r.variant})));
 for(const imported of file.notebook.recipes){const id=recipeMap.get(imported.id),menuId=dishMap.get(imported.menuId);if(!id||!menuId)continue;const current=shared.recipes.find(r=>r.id===id),old=id===imported.id?base?.recipes.find(r=>r.id===imported.id):undefined;
  if(current&&current.menuId!==menuId){mappingErrors.add(`Variant “${imported.variant}” belongs to a different current dish. Map it to a variant under the selected dish.`);continue;}
  const label=(next.dishes.find(d=>d.id===menuId)?.name??menuId)+' · '+imported.variant,incoming=mapParts(imported.inputs,label);let dest=next.recipes.find(r=>r.id===id);
  if(!dest){dest={...structuredClone(imported),id,menuId,inputs:incoming,active:false,recorded:false,ingredientsReviewed:false,reviewStatus:'unverified'};next.recipes.push(dest);notices.add(`${label}: a restored new variant starts unconfirmed and unverified.`);}
  const initial=current??dest;
  for(const field of ['variant','portions','notes','weekdayPortions','busyPortions','reviewNote'] as const)(dest as unknown as Record<string,unknown>)[field]=choose('recipe:'+imported.id+':'+field,label+' · '+restoreFieldLabel(field),old?.[field],imported[field],initial[field]);
  if(imported.workshop)dest.workshop=choose('recipe:'+imported.id+':workshop',label+' · menu review',old?.workshop,imported.workshop,initial.workshop);
  if(current)dest.inputs=mergeParts(imported.id,label,incoming,current.inputs,baseParts(old?.inputs));
  dest.active=choose('active:'+imported.id,label+' · on menu',old?.active,imported.active,initial.active,v=>v?'On menu':'Off menu');
  const ingredientChange=!current||ingredientContentChanged(current,dest,shared.items,next.items);
  if(ingredientChange){dest.recorded=false;dest.ingredientsReviewed=false;dest.reviewStatus='unverified';notices.add(`${label}: restored ingredient or portion changes require a fresh list confirmation and verification.`);}
  else{dest.recorded=choose('recorded:'+imported.id,label+' · ingredient list confirmation',old?.recorded,imported.recorded,current.recorded,v=>v?'Ingredients listed':'Not confirmed',imported.recorded&&!current.recorded);dest.reviewStatus=choose('recipe:'+imported.id+':reviewStatus',label+' · review status',old?.reviewStatus,imported.reviewStatus,current.reviewStatus);}
  if(!ingredientChange&&current){
   if(imported.ingredientsReviewed!==undefined)dest.ingredientsReviewed=choose('recipe:'+imported.id+':ingredientsReviewed',label+' · ingredient review',old?.ingredientsReviewed,imported.ingredientsReviewed,ingredientsReviewed(current),v=>v?'Ingredients reviewed':'To review',imported.ingredientsReviewed&&!ingredientsReviewed(current));
   else if(current.ingredientsReviewed!==undefined)dest.ingredientsReviewed=current.ingredientsReviewed;
   else if(ingredientsReviewed(current)&&dest.reviewStatus!=='verified')dest.ingredientsReviewed=true;
  }
  if(!dest.inputs.length){dest.recorded=false;if(dest.ingredientsReviewed!==undefined)dest.ingredientsReviewed=false;dest.reviewStatus='unverified';}
  if(!dest.recorded&&dest.ingredientsReviewed)dest.ingredientsReviewed=false;
  if(!ingredientChange&&current&&ingredientsReviewed(current)&&dest.ingredientsReviewed===undefined&&!same(dest.workshop,current.workshop))dest.ingredientsReviewed=true;
  if(dest.workshop&&(ingredientChange||!same(dest.workshop,current?.workshop))){dest.workshop={...dest.workshop,processChecked:false};dest.reviewStatus='unverified';}
 }
 const processMap=domainMap('process',file.notebook.processes,shared.processes,base?.processes);
 for(const imported of file.notebook.processes){const id=processMap.get(imported.id);if(!id)continue;const current=shared.processes.find(p=>p.id===id),old=id===imported.id?base?.processes.find(p=>p.id===imported.id):undefined;
  const inputs=mapParts(imported.inputs,imported.name+' inputs'),outputs=mapParts(imported.outputs,imported.name+' outputs');let dest=next.processes.find(p=>p.id===id);
  if(!dest){dest={...structuredClone(imported),id,inputs,outputs,reviewStatus:'unverified',sourceReviewId:null};next.processes.push(dest);}
  else{for(const field of ['name','method','activeMinutes','passiveMinutes','batchesPerWeek','externalUse','reviewStatus','reviewNote'] as const)(dest as unknown as Record<string,unknown>)[field]=choose('process:'+imported.id+':'+field,imported.name+' · '+restoreFieldLabel(field),old?.[field],imported[field],current![field]);dest.inputs=mergeParts('process-input:'+imported.id,imported.name+' inputs',inputs,current!.inputs,baseParts(old?.inputs));dest.outputs=mergeParts('process-output:'+imported.id,imported.name+' outputs',outputs,current!.outputs,baseParts(old?.outputs));if(!same(dest.inputs,current!.inputs)||!same(dest.outputs,current!.outputs))dest.reviewStatus='unverified';}
  if(imported.sourceReviewId!==dest.sourceReviewId)notices.add(`${imported.name}: approved review links are retained from the current workspace; a downloaded file cannot recreate approval provenance.`);
 }
 const scenarioMap=domainMap('scenario',file.notebook.scenarios,shared.scenarios,base?.scenarios);
 for(const imported of file.notebook.scenarios){const id=scenarioMap.get(imported.id);if(!id)continue;const current=shared.scenarios.find(s=>s.id===id),old=id===imported.id?base?.scenarios.find(s=>s.id===imported.id):undefined;
  const recipeIds=[...new Set(imported.recipeIds.flatMap(recipeId=>{const mappedId=recipeMap.get(recipeId);if(mappedId)return [mappedId];if(file.notebook.recipes.some(r=>r.id===recipeId))return [];notices.add(`${imported.name}: an unavailable saved variant remains in this stale scenario and needs review.`);return [recipeId];}))];
  const oldIds=old?.recipeIds.map(id=>shared.recipes.some(r=>r.id===id)?id:recipeMap.get(id)??id);let dest=next.scenarios.find(s=>s.id===id);
  if(!dest){dest={...structuredClone(imported),id,recipeIds,fingerprint:''};next.scenarios.push(dest);}
  else{dest.name=choose('scenario:'+imported.id+':name',imported.name+' · scenario name',old?.name,imported.name,current!.name);dest.recipeIds=choose('scenario:'+imported.id+':variants',imported.name+' · selected variants',oldIds,recipeIds,current!.recipeIds);dest.updatedAt=choose('scenario:'+imported.id+':updatedAt',imported.name+' · last saved',old?.updatedAt,imported.updatedAt,current!.updatedAt);if(!same(dest,current))dest.fingerprint='';}
  if(!same(dest,current))notices.add(`${imported.name}: restored scenario requires recalculation before it can change the live menu.`);
 }
 for(const old of base?.processes??[]){const current=shared.processes.find(p=>p.id===old.id);if(current&&!file.notebook.processes.some(p=>p.id===old.id)&&choose('remove-process:'+old.id,'Remove production process: '+current.name,false,true,false,v=>v?'Remove process':'Keep process',!same(current,old))){next.processes=next.processes.filter(p=>p.id!==old.id);notices.add(`${current.name}: its explicit production process will be removed. Retained per-item preparation details may become the fallback and need review.`);}}
 for(const old of base?.scenarios??[]){const current=shared.scenarios.find(p=>p.id===old.id);if(current&&!file.notebook.scenarios.some(p=>p.id===old.id)&&choose('remove-scenario:'+old.id,'Remove menu scenario: '+current.name,false,true,false,v=>v?'Remove scenario':'Keep scenario',!same(current,old)))next.scenarios=next.scenarios.filter(p=>p.id!==old.id);}
 for(const old of base?.dishes??[])if(!file.notebook.dishes.some(d=>d.id===old.id)&&shared.dishes.some(d=>d.id===old.id))notices.add(`“${old.name}” is absent from the imported file. Its current identity is kept; archive it in Dish recipes if needed.`);
 for(const old of base?.recipes??[])if(!file.notebook.recipes.some(r=>r.id===old.id)&&shared.recipes.some(r=>r.id===old.id))notices.add(`Variant “${old.variant}” is absent from the imported file. Its current identity and history are retained.`);
 if(!same(file.notebook.equipment,shared.equipment))notices.add('Existing equipment notes are retained. The downloaded equipment information remains in the imported file.');
 let error=[...mappingErrors].join(' ');try{validateNotebook(next);validateOrdinaryEdit(shared,next,true);serializeNotebook(next);}catch(e){error=error|| (e instanceof Error?e.message:'Review the selected changes.');}
 const unresolved=changes.filter(c=>c.conflict&&!c.decision).length+unmapped.length+unmappedEntities.length;
 return {next,changes,unmapped,unmappedEntities,notices:[...notices],unresolved,error,changed:!same(next,shared)};
}
const restoreFieldLabel=(field:string)=>({unit:'Base unit',specification:'Product specification',yieldAmount:'Output per batch',activeMinutes:'Active person-minutes',passiveMinutes:'Waiting minutes',frequencyHours:'Production interval (hours)',batchMinimum:'Minimum batch',batchMaximum:'Maximum batch',method:'Method',storage:'Storage',supplier:'Supplier',packLabel:'Pack description',packAmount:'Pack size',externalUse:'Used outside this menu',reviewStatus:'Review status',reviewNote:'Review note',variant:'Variant name',portions:'Recipe portions',notes:'Recipe notes',weekdayPortions:'Weekday portions',busyPortions:'Busy day portions',name:'Name',batchesPerWeek:'Batches per week'}[field]??field);
function describeValue(value:unknown):string{if(value===null)return 'Unknown';if(typeof value==='boolean')return value?'Yes':'No';if(typeof value==='string')return value||'Empty';return JSON.stringify(value);}
export function recoverAliasDrafts(file:NotebookDraft,shared:Notebook,mappings?:Record<string,string>):AliasDraft[]{
 const target=(id:string)=>{if(shared.items.some(i=>i.id===id))return id;const mapping=mappings?.[id];const key=mapping?.startsWith('new:')?mapping.slice(4):mapping;return key&&shared.items.some(i=>i.id===key)?key:undefined;};
 const result=new Map<string,AliasDraft>();
 for(const draft of file.aliasDrafts){const id=target(draft.itemId);if(id){const current=shared.items.find(i=>i.id===id)!;result.set(id,{...draft,itemId:id,...(id!==draft.itemId?{base:current.aliases}:{})});}else if(mappings===undefined)result.set(draft.itemId,draft);}
 for(const item of file.notebook.items){const id=target(item.id),current=shared.items.find(i=>i.id===id);if(current&&!same(current.aliases,item.aliases)&&!result.has(current.id))result.set(current.id,{itemId:current.id,text:item.aliases.join('\n'),base:current.id===item.id?file.base?.notebook.items.find(i=>i.id===item.id)?.aliases??current.aliases:current.aliases});}
 return [...result.values()];
}
