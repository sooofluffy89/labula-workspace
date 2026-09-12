import {z} from 'zod';
import {normalizeName,newItem,validateNotebook,type Notebook,type Item} from './notebook';
import {namesOf} from './catalog';
import {serializeNotebook} from './notebook-size';
import {matchingScore} from './name-matching';

const targetSchema=z.discriminatedUnion('type',[
 z.object({type:z.literal('item'),id:z.string().min(1).max(100)}).strict(),
 z.object({type:z.literal('row'),key:z.string().min(1).max(160)}).strict(),
]);
export const draftRowSchema=z.object({key:z.string().min(1).max(160),name:z.string().trim().min(1).max(160),occurrences:z.number().int().min(1).max(150),target:targetSchema.nullable(),kind:z.enum(['bought','prep']),skip:z.boolean(),separate:z.boolean()}).strict();
export type DraftRow=z.infer<typeof draftRowSchema>;
export const bulkCommandSchema=z.object({recipeId:z.string().min(1).max(100),rows:z.array(draftRowSchema).min(1).max(150)}).strict();
export type BulkCommand=z.infer<typeof bulkCommandSchema>;
export function nameIndex(items:Item[]){const index=new Map<string,Item>();for(const item of items)for(const name of namesOf(item))index.set(normalizeName(name),item);return index;}
export function reconcileDraft(text:string,previous:DraftRow[],items:Item[]):DraftRow[]{
 const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
 if(!lines.length)throw Error('Enter one ingredient per line.');
 if(lines.length>150)throw Error('Add up to 150 lines at a time. Your full text has been kept.');
 const prior=new Map(previous.map(r=>[r.key,r])),index=nameIndex(items),result=new Map<string,DraftRow>();
 for(const name of lines){if(name.length>160)throw Error(`Shorten this name to 160 characters: ${name.slice(0,40)}…`);const key=normalizeName(name);if(!key)throw Error('Enter an ingredient name.');const existing=result.get(key);if(existing){existing.occurrences++;continue;}const old=prior.get(key),match=index.get(key);result.set(key,old?{...old,name,occurrences:1}:{key,name,occurrences:1,target:match?{type:'item',id:match.id}:null,kind:match?.kind??'bought',skip:false,separate:false});}
 return [...result.values()];
}
export type ResolvedRow={name:string;kind:Item['kind'];itemId:string|null;key:string};
export function resolveDraft(rows:DraftRow[],items:Item[]){
 const byKey=new Map(rows.map(r=>[r.key,r])),index=nameIndex(items),byId=new Map(items.map(i=>[i.id,i])),resolved=new Map<string,ResolvedRow>();
 const resolve=(row:DraftRow,path=new Set<string>()):ResolvedRow=>{
  if(resolved.has(row.key))return resolved.get(row.key)!;
  if(path.has(row.key))throw Error('These matches point to each other. Keep one item separate, then review the matches.');
  const exact=index.get(normalizeName(row.name));let value:ResolvedRow;
  if(exact){if(row.target&&(row.target.type!=='item'||row.target.id!==exact.id))throw Error(`The catalog match for “${row.name}” changed. Review this item again.`);value={key:exact.id,name:exact.name,kind:exact.kind,itemId:exact.id};}
  else if(row.target?.type==='item'){const item=byId.get(row.target.id);if(!item)throw Error(`The match for “${row.name}” no longer exists. Review this item again.`);value={key:item.id,name:item.name,kind:item.kind,itemId:item.id};}
  else if(row.target?.type==='row'){const target=byKey.get(row.target.key);if(!target||target.skip)throw Error(`The selected match for “${row.name}” was removed or excluded. Choose another match or keep it separate.`);value=resolve(target,new Set([...path,row.key]));}
  else value={key:'new:'+row.key,name:row.name,kind:row.kind,itemId:null};
  resolved.set(row.key,value);return value;
 };
 return {resolve,index};
}
export function planBulk(n:Notebook,command:BulkCommand){
 const {recipeId,rows}=bulkCommandSchema.parse(command),keys=new Set<string>();let lines=0;
 for(const row of rows){if(row.key!==normalizeName(row.name)||keys.has(row.key))throw Error('Review the list again: repeated names must share one decision.');keys.add(row.key);lines+=row.occurrences;}
 if(lines>150)throw Error('Add up to 150 lines at a time.');
 const recipe=n.recipes.find(r=>r.id===recipeId);if(!recipe)throw Error('That recipe no longer exists.');
 const {resolve}=resolveDraft(rows,n.items),linked=new Set(recipe.inputs.map(p=>p.itemId)),unique=new Map<string,ResolvedRow>();
 for(const row of rows)if(!row.skip){const item=resolve(row);if(!item.itemId||!linked.has(item.itemId))unique.set(item.key,item);}
 const additions=[...unique.values()];
 if(recipe.inputs.length+additions.length>150)throw Error(`This recipe already has ${recipe.inputs.length} items. It can contain up to 150; exclude some new items.`);
 if(n.items.length+additions.filter(i=>!i.itemId).length>1000)throw Error('The catalog can contain up to 1,000 items. Reuse existing items or shorten this list.');
 return {additions,count:additions.length};
}
export function applyBulkCommand(n:Notebook,command:BulkCommand){
 const plan=planBulk(n,command),next=structuredClone(n),recipe=next.recipes.find(r=>r.id===command.recipeId)!;
 for(const addition of plan.additions){let id=addition.itemId;if(!id){const item=newItem(addition.name,addition.kind);next.items.push(item);id=item.id;}recipe.inputs.push({itemId:id,amount:null,note:''});}
 if(plan.count)recipe.recorded=false;
 const result=validateNotebook(next);serializeNotebook(result);return result;
}

export type BulkSuggestion={target:NonNullable<DraftRow['target']>;name:string;score:number};
export function draftSuggestions(items:Item[],rows:Pick<DraftRow,'key'|'name'>[]){
 const catalog=items.map(item=>({item,labels:namesOf(item).map(normalizeName)}));const result=new Map<string,BulkSuggestion[]>();
 for(const row of rows){const candidates:BulkSuggestion[]=[];for(const {item,labels} of catalog){const score=Math.max(...labels.map(label=>matchingScore(row.key,label)));if(score>=.7)candidates.push({target:{type:'item',id:item.id},name:item.name,score});}for(const other of rows)if(other.key!==row.key){const score=matchingScore(row.key,other.key);if(score>=.7)candidates.push({target:{type:'row',key:other.key},name:other.name,score});}result.set(row.key,candidates.sort((a,b)=>b.score-a.score||a.name.localeCompare(b.name)).slice(0,6));}
 return result;
}
