import { z } from 'zod';
import { menu } from './menu';
import {prepareName,preparedScore} from './name-matching';
import { normalizeName,newItem,validateNotebook,dependencyIds,safeCsvCell,type Item,type Notebook,type RecipeInput } from './notebook';

export const namesOf=(i:Item)=>[i.name,...i.aliases];
export const exactItem=(items:Item[],name:string)=>items.find(i=>namesOf(i).some(n=>normalizeName(n)===normalizeName(name)));
export const pairKey=(a:string,b:string)=>JSON.stringify([a,b].sort());
export const isDistinct=(n:Notebook,a:string,b:string)=>n.distinctPairs.some(p=>pairKey(...p)===pairKey(a,b));
function distance(a:string,b:string){let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];}
export function similarity(a:string,b:string){a=normalizeName(a);b=normalizeName(b);if(a===b)return 1;if(!a||!b)return 0;const score=1-distance(a,b)/Math.max(a.length,b.length);const at=a.split(/\s+/),bt=b.split(/\s+/);const overlap=at.filter(t=>bt.includes(t)).length/Math.max(at.length,bt.length);return Math.max(score,overlap*.9);}
export function suggestions(items:Item[],name:string,exclude?:string){return items.filter(i=>i.id!==exclude).map(item=>({item,score:Math.max(...namesOf(item).map(n=>similarity(n,name)))})).filter(x=>x.score>=.7).sort((a,b)=>b.score-a.score||a.item.name.localeCompare(b.item.name)).slice(0,4);}
export type CatalogItem=Pick<Item,'id'|'name'|'aliases'|'kind'>;
export function duplicatePairs<T extends CatalogItem>(n:{items:T[];distinctPairs:[string,string][]}){
 const found:{a:T;b:T;score:number}[]=[];
 const labels=n.items.map(i=>[i.name,...i.aliases].map(name=>prepareName(normalizeName(name))));
 const distinct=new Set(n.distinctPairs.map(p=>pairKey(...p)));
 for(let i=0;i<n.items.length;i++)for(let j=i+1;j<n.items.length;j++){
  const a=n.items[i],b=n.items[j];if(a.kind!==b.kind||distinct.has(pairKey(a.id,b.id)))continue;
  let score=0;
  outer:for(const x of labels[i])for(const y of labels[j]){score=preparedScore(x,y,score);if(score===1)break outer;}
  if(score>=.7)found.push({a,b,score});
 }
 return found.sort((a,b)=>b.score-a.score);
}

export type BulkRow={name:string;targetId:string|null;kind:Item['kind'];skip:boolean};
export function parseBulk(text:string,items:Item[]):BulkRow[]{const lines=text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);if(!lines.length)throw new Error('Enter one ingredient per line.');if(lines.length>150)throw new Error('Add up to 150 lines at a time. Nothing has been removed from your list.');return lines.map(name=>{if(name.length>160)throw new Error(`Shorten this name to 160 characters: ${name.slice(0,40)}…`);const match=exactItem(items,name);return {name,targetId:match?.id??null,kind:match?.kind??'bought',skip:false};});}
export function applyBulk(n:Notebook,recipeId:string,rows:BulkRow[]):Notebook{
 const next=structuredClone(n),recipe=next.recipes.find(r=>r.id===recipeId);if(!recipe)throw new Error('That recipe no longer exists.');const linked=new Set(recipe.inputs.map(p=>p.itemId));let added=0;
 for(const row of rows){if(row.skip)continue;let item=row.targetId?next.items.find(i=>i.id===row.targetId):exactItem(next.items,row.name);if(row.targetId&&!item)throw new Error('An item changed. Reopen the ingredient preview.');if(!item){item=newItem(row.name,row.kind);next.items.push(item);}if(!linked.has(item.id)){recipe.inputs.push({itemId:item.id,amount:null,note:''});linked.add(item.id);added++;}}
 if(added)recipe.recorded=false;return validateNotebook(next);
}

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validateOrdinaryEdit(before:Notebook,after:Notebook){
 if(!same(before.distinctPairs,after.distinctPairs))throw new Error('Use the owner catalog tools to manage different-items decisions.');
 for(const item of before.items){const next=after.items.find(i=>i.id===item.id);if(!next)throw new Error('Use the owner merge tool to remove a catalog item.');const {name:_,...protectedBefore}=item,{name:__,...protectedAfter}=next;if(!same(protectedBefore,protectedAfter))throw new Error('Only the item name can be edited here. Use the owner tools to manage alternative names.');}
 for(const item of after.items.filter(i=>!before.items.some(old=>old.id===i.id))){const expected=newItem(item.name,item.kind,item.unit);expected.id=item.id;if(!same(item,expected))throw new Error('New items must start without alternative names or hidden recipe details.');}
 if(before.recipes.length!==after.recipes.length)throw new Error('The existing menu recipes must be preserved.');
 for(const recipe of before.recipes){const next=after.recipes.find(r=>r.id===recipe.id);if(!next)throw new Error('The existing menu recipes must be preserved.');const {inputs,active,recorded,...rest}=recipe,{inputs:nextInputs,active:na,recorded:nr,...nextRest}=next;if(!same(rest,nextRest))throw new Error('Only the ingredient list and its status can be edited here.');for(const part of nextInputs){const previous=inputs.find(p=>p.itemId===part.itemId);if(previous?!same(previous,part):part.amount!==null||part.note!=='')throw new Error('Existing quantity and note details must be preserved.');}}
 if(!same(before.equipment,after.equipment))throw new Error('Existing equipment notes must be preserved.');
}

export function mergePreview(n:Notebook,sourceId:string,targetId:string){
 const source=n.items.find(i=>i.id===sourceId),target=n.items.find(i=>i.id===targetId);const conflicts:string[]=[];
 if(!source||!target||source===target)return {conflicts:['Choose two different catalog items.'],affected:[],next:null};
 if(source.kind!==target.kind)conflicts.push('Bought ingredients and house-made preparations cannot be merged.');
 if(source.unit!==target.unit)conflicts.push('The saved measurement units differ.');
 const {id:si,name:sn,aliases:sa,...sm}=source,{id:ti,name:tn,aliases:ta,...tm}=target;
 if(!same(sm,tm))conflicts.push('Saved preparation, quantity, storage or other details differ. Review these records before merging.');
 if(dependencyIds(n,sourceId).has(targetId)||dependencyIds(n,targetId).has(sourceId))conflicts.push('These preparations depend on each other. Merging would create a recipe cycle.');
 const affected=n.recipes.filter(r=>r.inputs.some(p=>p.itemId===sourceId));
 const rewrite=(inputs:RecipeInput[])=>{const result:RecipeInput[]=[];for(const p of inputs){const mapped=p.itemId===sourceId?{...p,itemId:targetId}:p;const existing=result.find(x=>x.itemId===mapped.itemId);if(existing){if(existing.amount!==null||mapped.amount!==null||existing.note||mapped.note)conflicts.push('Both items occur together with saved quantities or notes. They cannot be combined automatically.');}else result.push(mapped);}return result;};
 const next=structuredClone(n);next.items=next.items.filter(i=>i.id!==sourceId).map(i=>i.id===targetId?{...i,aliases:[...new Set([...i.aliases,source.name,...source.aliases].map(x=>x.trim()))]}:i);
 for(const item of next.items)item.inputs=rewrite(item.inputs);for(const r of next.recipes)r.inputs=rewrite(r.inputs);
 const distinct=new Map<string,[string,string]>();
 for(const pair of next.distinctPairs){const mapped=pair.map(id=>id===sourceId?targetId:id).sort() as [string,string];if(mapped[0]!==mapped[1])distinct.set(pairKey(...mapped),mapped);}
 next.distinctPairs=[...distinct.values()];
 try{validateNotebook(next);}catch(e){conflicts.push(e instanceof Error?e.message:'The resulting catalog is invalid.');}
 return {conflicts:[...new Set(conflicts)],affected,next:conflicts.length?null:next};
}
export const operationSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('reclassify'),itemId:z.string(),itemKind:z.enum(['bought','prep'])}).strict(),
 z.object({kind:z.literal('aliases'),itemId:z.string(),aliases:z.array(z.string().trim().min(1).max(160)).max(30)}).strict(),
 z.object({kind:z.literal('merge'),sourceId:z.string(),targetId:z.string()}).strict(),
 z.object({kind:z.literal('distinct'),a:z.string(),b:z.string(),different:z.boolean()}).strict(),
 z.object({kind:z.literal('undo'),operationId:z.string()}).strict(),
]);
export type CatalogOperation=z.infer<typeof operationSchema>;
export function reclassifyPreview(n:Notebook,itemId:string,kind:Item['kind']){
 const item=n.items.find(i=>i.id===itemId);
 if(!item)return {conflicts:['This item no longer exists.'],affected:[],savedDetails:false};
 const conflicts=kind==='bought'&&item.inputs.length?['This preparation has a saved recipe. Keep it as Made in-house to preserve that recipe. If the dish uses a bought product instead, add that product as a separate Bought item and replace it in the affected dishes.']:[];
 const empty=newItem(item.name,item.kind,item.unit);
 const savedDetails=['specification','yieldAmount','activeMinutes','passiveMinutes','frequencyHours','batchMinimum','batchMaximum','method','storage'].some(key=>!same(item[key as keyof Item],empty[key as keyof Item]));
 return {conflicts,affected:n.recipes.filter(r=>r.inputs.some(p=>p.itemId===itemId)),savedDetails};
}
export function applyOperation(n:Notebook,op:Exclude<CatalogOperation,{kind:'undo'}>){const next=structuredClone(n);let summary='';if(op.kind==='aliases'){const item=next.items.find(i=>i.id===op.itemId);if(!item)throw new Error('Item not found.');item.aliases=op.aliases;summary=`Alternative names updated: ${item.name}`;}
 if(op.kind==='reclassify'){const preview=reclassifyPreview(n,op.itemId,op.itemKind);if(preview.conflicts.length)throw Error(preview.conflicts.join(' '));const item=next.items.find(i=>i.id===op.itemId)!;item.kind=op.itemKind;summary=`Type corrected: ${item.name} → ${op.itemKind==='prep'?'Made in-house':'Bought'}`;}
 if(op.kind==='merge'){const result=mergePreview(n,op.sourceId,op.targetId);if(!result.next)throw new Error(result.conflicts.join(' '));return {next:result.next,summary:`Merged ${n.items.find(i=>i.id===op.sourceId)!.name} into ${n.items.find(i=>i.id===op.targetId)!.name}`};}
 if(op.kind==='distinct'){if(op.a===op.b||[op.a,op.b].some(id=>!n.items.some(i=>i.id===id)))throw new Error('Choose two different catalog items.');next.distinctPairs=next.distinctPairs.filter(p=>pairKey(...p)!==pairKey(op.a,op.b));if(op.different)next.distinctPairs.push([op.a,op.b]);summary=op.different?'Marked two items as different':'Reopened a different-items decision';}
 return {next:validateNotebook(next),summary};}

export function matrixCell(n:Notebook,itemId:string,menuId:string){const variants=n.recipes.filter(r=>r.active&&r.menuId===menuId);const present=variants.filter(r=>r.inputs.some(p=>p.itemId===itemId));const pending=variants.filter(r=>!r.recorded);return {state:present.length?'used':pending.length?'unknown':'absent',variants,present,pending} as const;}
export const activeDishes=(n:Notebook)=>menu.filter(d=>n.recipes.some(r=>r.menuId===d.id&&r.active));
export function directCount(n:Notebook,itemId:string){return activeDishes(n).filter(d=>matrixCell(n,itemId,d.id).state==='used').length;}
export function matrixItems(n:Notebook,filter:string){return [...n.items].filter(i=>{const count=directCount(n,i.id);return filter==='shared'?count>1:filter==='single'?count===1:true;}).sort((a,b)=>directCount(n,b.id)-directCount(n,a.id)||a.name.localeCompare(b.name));}
export function exportMatrix(n:Notebook,filter='all'){const dishes=activeDishes(n);const rows:unknown[][]=[['Ingredient / preparation','Type','Recorded in menu dishes',...dishes.map(d=>d.name)]];for(const item of matrixItems(n,filter))rows.push([item.name,item.kind,directCount(n,item.id),...dishes.map(d=>{const c=matrixCell(n,item.id,d.id);return c.state==='used'?'Used':c.state==='unknown'?'Unknown — list unfinished':'Not listed — lists complete';})]);return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');}
