import {z} from 'zod';
import {bulkCommandSchema,draftRowSchema,reconcileDraft,resolveDraft,type DraftRow} from './bulk';
import {normalizeName,recipeTitle,validationMessage,type Notebook} from './notebook';
import {validKeptNames} from './bulk-input';
import {validKeptPairs} from './bulk-review';
import {saveRecoverySchema,type SaveRecovery} from './save-recovery';

export const MAX_DRAFT_BYTES=5000000;
export const MAX_ORDINARY_DRAFT_BYTES=750000;
export const recoverySchema=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative(),command:bulkCommandSchema}).strict();
export type BulkRecovery=z.infer<typeof recoverySchema>;
const snapshotSchema=z.object({id:z.string().min(1).max(100),name:z.string().min(1).max(160),kind:z.enum(['bought','prep'])}).strict();
const rowsSchema=z.array(draftRowSchema).max(150);
const intentSchema=z.object({key:z.string().min(1).max(160),itemId:z.string().min(1).max(100).nullable(),name:z.string().min(1).max(160),kind:z.enum(['bought','prep'])}).strict();
const envelopeSchema=z.object({format:z.literal('labula-ingredient-draft'),version:z.literal(1),recipeId:z.string().min(1).max(100),recipeLabel:z.string().min(1).max(400),text:z.string().max(MAX_ORDINARY_DRAFT_BYTES),rows:rowsSchema,keptNames:z.array(z.string().max(160)).max(150).default([]),keptPairs:z.array(z.string().max(1500)).max(1000),needsReview:z.array(z.string().max(160)).max(150),catalog:z.array(snapshotSchema).max(1000),intents:z.array(intentSchema).max(150).optional(),save:z.discriminatedUnion('state',[z.object({state:z.literal('unsubmitted')}).strict(),z.object({state:z.literal('unverified')}).strict(),z.object({state:z.literal('pending'),recovery:recoverySchema}).strict()]),priorSave:saveRecoverySchema.optional()}).strict().refine(file=>!file.priorSave||file.save.state!=='pending',{message:'An ingredient draft cannot contain two pending saves.'});
export type IngredientDraft=z.infer<typeof envelopeSchema>;
const legacySchema=z.object({recipeId:z.string().min(1).max(100),text:z.string().max(MAX_ORDINARY_DRAFT_BYTES),rows:rowsSchema}).strict();
function validateRows(rows:DraftRow[]){const keys=new Set<string>();let count=0;for(const r of rows){if(r.key!==normalizeName(r.name)||keys.has(r.key))throw Error('This file contains inconsistent ingredient names.');keys.add(r.key);count+=r.occurrences;}if(count>150)throw Error('A draft can contain up to 150 lines.');}
export function readIngredientDraft(content:string):IngredientDraft{
 const bytes=new TextEncoder().encode(content).length;
 if(bytes>MAX_DRAFT_BYTES)throw Error('This file is too large. Choose a Labula ingredient draft smaller than 5 MB.');
 // The larger allowance is only for files carrying two serialized notebooks.
 // Normal and legacy ingredient drafts retain their existing size limit.
 let raw:unknown;try{raw=JSON.parse(content);}catch{if(bytes>MAX_ORDINARY_DRAFT_BYTES)throw Error('This file is too large. Choose a Labula ingredient draft smaller than 750 KB.');throw Error('This file could not be read. Choose a Labula ingredient draft (.json).');}
 if(bytes>MAX_ORDINARY_DRAFT_BYTES&&!(raw&&typeof raw==='object'&&'priorSave' in raw))throw Error('This file is too large. Choose a Labula ingredient draft smaller than 750 KB.');
 let file:IngredientDraft;try{if(raw&&typeof raw==='object'&&!('format' in raw)){const old=legacySchema.parse(raw);file={...old,format:'labula-ingredient-draft',version:1,recipeLabel:'Older ingredient list',keptNames:[],keptPairs:[],needsReview:[],catalog:[],save:{state:'unverified'}};}else file=envelopeSchema.parse(raw);}catch{throw Error('This is not a supported Labula ingredient draft. Your current list has been kept.');}
 if(!file.priorSave&&bytes>MAX_ORDINARY_DRAFT_BYTES)throw Error('This file is too large. Choose a Labula ingredient draft smaller than 750 KB.');
 const ordinary={...file};delete ordinary.priorSave;
 if(new TextEncoder().encode(file.text).length>MAX_ORDINARY_DRAFT_BYTES||new TextEncoder().encode(JSON.stringify(ordinary)).length>MAX_ORDINARY_DRAFT_BYTES)throw Error('The ingredient list in this file is too large.');
 validateRows(file.rows);
 if(file.save.state==='pending'){validateRows(file.save.recovery.command.rows);if(file.save.recovery.command.recipeId!==file.recipeId)throw Error('The saved request belongs to a different dish.');}
 return file;
}
export function makeIngredientDraft(n:Notebook,recipeId:string,text:string,rows:DraftRow[],keptPairs:string[],needsReview:string[],recovery:BulkRecovery|null,unverified=false,keptNames:string[]=[],priorSave:SaveRecovery|null=null):IngredientDraft{
 const recipe=n.recipes.find(r=>r.id===recipeId);if(!recipe)throw Error('This dish no longer exists.');
 const ids=new Set(rows.flatMap(r=>r.target?.type==='item'?[r.target.id]:[]));
 const resolve=resolveDraft(rows,n.items).resolve;const intents:NonNullable<IngredientDraft['intents']>=[];for(const row of rows){try{const value=resolve(row);intents.push({key:row.key,itemId:value.itemId,name:value.name,kind:value.kind});}catch{}}
 const file:IngredientDraft={intents,format:'labula-ingredient-draft',version:1,recipeId,recipeLabel:recipeTitle(recipe),text,rows,keptNames:validKeptNames(text,keptNames),keptPairs:validKeptPairs(keptPairs,rows,n.items),needsReview,catalog:n.items.filter(i=>ids.has(i.id)).map(({id,name,kind})=>({id,name,kind})),save:recovery?{state:'pending',recovery}:unverified?{state:'unverified'}:{state:'unsubmitted'},...(priorSave?{priorSave}:{})};
 return readIngredientDraft(JSON.stringify(file));
}
export function restoreIngredientDraft(file:IngredientDraft,n:Notebook,recipeId:string){
 const recipe=n.recipes.find(r=>r.id===file.recipeId);if(file.recipeId!==recipeId)throw Error(`This list belongs to ${recipe?recipeTitle(recipe):file.recipeLabel}. Open that dish, then choose Restore draft.`);
 if(!recipe)throw Error('The dish for this draft no longer exists.');
 if(file.save.state==='pending')return {rows:structuredClone(file.save.recovery.command.rows),needsReview:[],keptNames:[],keptPairs:[],text:file.text};
 let rows:DraftRow[];try{rows=file.text.trim()?reconcileDraft(file.text,file.rows,n.items):[];}catch(e){return {rows:structuredClone(file.rows),needsReview:file.needsReview,keptNames:validKeptNames(file.text,file.keptNames),keptPairs:validKeptPairs(file.keptPairs,file.rows,n.items),text:file.text,inputError:validationMessage(e)};}
 const resolve=resolveDraft(rows,n.items).resolve;
 const changed=new Set(file.needsReview),old=new Map(file.catalog.map(i=>[i.id,i]));
 for(const row of rows){try{const result=resolve(row),intent=file.intents?.find(i=>i.key===row.key),prior=result.itemId?old.get(result.itemId):undefined;
  if(intent){if(intent.itemId!==result.itemId||intent.name!==result.name||intent.kind!==result.kind)changed.add(row.key);}
  else if(result.itemId){if(!prior||prior.name!==result.name||prior.kind!==result.kind||row.kind!==result.kind||row.target?.type!=='item'||row.target.id!==result.itemId)changed.add(row.key);}
 }catch{changed.add(row.key);}}
 return {rows,keptNames:validKeptNames(file.text,file.keptNames),keptPairs:validKeptPairs(file.keptPairs,rows,n.items),needsReview:[...changed].filter(key=>rows.some(r=>r.key===key)),text:file.text};
}
