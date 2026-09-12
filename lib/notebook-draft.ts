import {z} from 'zod';
import {migrateNotebook,newItem,recipeTitle,validateNotebook,type Notebook,type Item} from './notebook';
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
const envelope=z.object({format:z.literal('labula-notebook-draft'),version:z.literal(1),exportedAt:z.string().max(100),sourceMenu:z.literal('https://www.labula.cz/menu'),actorEmail:z.string().max(400).optional(),notebook,base:z.object({revision:z.number().int().nonnegative(),notebook}).strict().nullable(),recovery:pending,aliasDrafts:z.array(aliasDraftSchema).max(1000).default([])}).strict();
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
  if(draft.recovery.kind==='save'){const local=validateNotebook(JSON.parse(draft.recovery.receipt.localPayload));if(draft.base?.revision!==draft.recovery.receipt.revision||JSON.stringify(draft.notebook)!==JSON.stringify(local))draft.base=null;draft.notebook=local;}
  if(draft.base)serializeNotebook(draft.base.notebook);
  const aliases=new Set<string>();for(const entry of draft.aliasDrafts){if(aliases.has(entry.itemId))throw Error('Repeated alias draft.');aliases.add(entry.itemId);}
  return draft;
 }catch{throw Error('This notebook draft is unsupported or contains invalid data. Your current work is kept.');}
}
export function makeNotebookDraft(data:Notebook,base:NotebookDraft['base'],actorEmail:string,aliasDrafts:AliasDraft[],save:SaveRecovery|null,catalog:CatalogRecovery|null,bulk:BulkRecovery|null):NotebookDraft{
 if([save,catalog,bulk].filter(Boolean).length>1)throw Error('Finish checking the earlier operation before downloading this draft.');
 const file:NotebookDraft={format:'labula-notebook-draft',version:1,exportedAt:new Date().toISOString(),sourceMenu:'https://www.labula.cz/menu',actorEmail,notebook:data,base,recovery:save?{kind:'save',receipt:save}:catalog?{kind:'catalog',receipt:catalog}:bulk?{kind:'bulk',receipt:bulk}:{kind:'none'},aliasDrafts};
 return readNotebookDraft(JSON.stringify(file));
}
export type RestoreDecision='shared'|'draft';
export type RestoreChange={id:string;label:string;shared:string;draft:string;conflict:boolean;decision:RestoreDecision|undefined};
export type RestoreMapping={item:Item;reason:string;canCreate:boolean;currentMatch?:Item};
const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function planNotebookRestore(file:NotebookDraft,shared:Notebook,decisions:Record<string,RestoreDecision>={},mappings:Record<string,string>={}){
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
   if(item.kind!==existing.kind)notices.add(`“${existing.name}” is currently ${existing.kind==='prep'?'Made in-house':'Bought'}. Its current type is retained; use the owner catalog tools to correct it.`);
   if(!same(item.aliases,existing.aliases))notices.add(`Saved alternative names for “${existing.name}” differ. Review them separately in catalog management; they are not overwritten by this restore.`);
   continue;
  }
  const exact=exactItem(shared.items,item.name);
  if(mapping==='skip'){mapped.set(item.id,null);continue;}
  if(mapping&&sharedById.has(mapping)){mapped.set(item.id,mapping);continue;}
  if(mapping?.startsWith('new:')&&!old&&!exact){const fresh=newItem(item.name,item.kind,item.unit);fresh.id=mapping.slice(4);next.items.push(fresh);mapped.set(item.id,fresh.id);notices.add(`New item: ${item.name} (${item.kind==='prep'?'Made in-house':'Bought'}). Saved preparation details are kept in the original file; new catalog entries start with a name and type only.`);continue;}
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
   const include=choose('input:'+current.id+':'+id,recipeTitle(current)+' · '+label,originalIds?originalIds.has(id):undefined,incomingIds.has(id),currentIds.has(id),v=>v?'Listed':'Not listed');
   if(include)wanted.add(id);else wanted.delete(id);
  }
  // Current quantities/notes survive on retained links; restored links start blank.
  dest.inputs=current.inputs.filter(p=>wanted.has(p.itemId));for(const id of wanted)if(!currentIds.has(id))dest.inputs.push({itemId:id,amount:null,note:''});
  const ingredientsChanged=!same(current.inputs,dest.inputs);
  dest.active=choose('active:'+current.id,recipeTitle(current)+' · on the menu',original?.active,imported.active,current.active,v=>v?'Active':'Inactive');
  if(ingredientsChanged){dest.recorded=false;notices.add('Restored ingredient lists are In progress. Confirm Completed after checking the full list.');}
  else dest.recorded=choose('recorded:'+current.id,recipeTitle(current)+' · ingredient list confirmation',original?.recorded,imported.recorded,current.recorded,v=>v?'Completed':'Not confirmed',imported.recorded&&!current.recorded);
  if(!dest.inputs.length)dest.recorded=false;
 }
 let error='';try{validateNotebook(next);validateOrdinaryEdit(shared,next);serializeNotebook(next);}catch(e){error=e instanceof Error?e.message:'Review the selected changes.';}
 const unresolved=changes.filter(c=>c.conflict&&!c.decision).length+unmapped.length;
 return {next,changes,unmapped,notices:[...notices],unresolved,error,changed:!same(next,shared)};
}
export function recoverAliasDrafts(file:NotebookDraft,shared:Notebook):AliasDraft[]{
 const result=new Map(file.aliasDrafts.map(d=>[d.itemId,d]));
 for(const item of file.notebook.items){const current=shared.items.find(i=>i.id===item.id);if(current&&!same(current.aliases,item.aliases)&&!result.has(item.id))result.set(item.id,{itemId:item.id,text:item.aliases.join('\n'),base:file.base?.notebook.items.find(i=>i.id===item.id)?.aliases??current.aliases});}
 return [...result.values()];
}
