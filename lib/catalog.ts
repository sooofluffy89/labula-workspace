import {ingredientContentChanged,ingredientsReviewed} from './ingredient-review';
import {missingMeasurementMetadata,hasMeasurementMetadata} from './recipe-quantity';
import {menuApplySchema} from './menu-apply';
import {scenarioNotebook} from './production';
import {profileEmpty,equivalentProfiles} from './prep-profile';
import { z } from 'zod';
import {directUsage,compareUsage,type DirectUsage} from './direct-usage';
import {prepareName,preparedScore} from './name-matching';
import { normalizeName,newItem,validateNotebook,dependencyIds,usageMap,safeCsvCell,type Item,type Notebook,type RecipeInput } from './notebook';

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
 if(added){recipe.recorded=false;recipe.ingredientsReviewed=false;recipe.reviewStatus='unverified';if(recipe.workshop)recipe.workshop={...recipe.workshop,processChecked:false};}return validateNotebook(next);
}

const same=(a:unknown,b:unknown)=>JSON.stringify(a)===JSON.stringify(b);
export function validateOrdinaryEdit(before:Notebook,after:Notebook,manage=false){
 if(!same(before.workspaceRecipes,after.workspaceRecipes))throw Error('Workspace 2.0 product recipes changed. Keep your draft and reload; update product composition through its current recipe editor.');
 for(const definition of before.workspaceRecipes??[]){const old=before.items.find(item=>item.id===definition.itemId),next=after.items.find(item=>item.id===definition.itemId);if(old&&next&&['inputs','method','yieldAmount'].some(key=>!same(old[key as keyof Item],next[key as keyof Item])))throw Error('This product now uses its Workspace 2.0 recipe. Keep your draft and update its current ingredients or method in Menu.');}
 if(before.reviewSourceRevision!==after.reviewSourceRevision)throw Error('Approved review sources changed. Download your draft and reload before saving; their revision can only change through Review.');
 if(!same(before.distinctPairs,after.distinctPairs))throw new Error('Use the owner catalog tools to manage different-items decisions.');
 for(const item of before.items){const next=after.items.find(i=>i.id===item.id);if(next)for(const part of item.inputs){const target=next.inputs.find(p=>p.itemId===part.itemId);if(target&&missingMeasurementMetadata(part,target))throw Error('Reload the application to preserve saved ingredient units and conversions.');}if(!next)throw new Error('Use the owner merge tool to remove a catalog item.');
  if(item.unit!==next.unit&&(item.yieldAmount!==null||item.packAmount!==null||item.batchMinimum!==null||item.batchMaximum!==null||item.prepProfile.batch?.output.amount!=null||before.workspaceRecipes?.some(recipe=>recipe.itemId===item.id&&recipe.yieldAmount!==null||recipe.inputs.some(input=>input.itemId===item.id&&input.amount!==null))||before.recipes.some(r=>r.inputs.some(p=>p.itemId===item.id&&p.amount!==null))||before.items.some(i=>i.inputs.some(p=>p.itemId===item.id&&p.amount!==null))||before.processes.some(p=>[...p.inputs,...p.outputs].some(o=>o.itemId===item.id&&o.amount!==null))))throw Error('Saved quantities use the original base unit. Keep it or create a separate product with an explicit conversion.');
  if(!same(item.aliases,next.aliases)||item.kind!==next.kind)throw Error('Use the owner catalog tools to change alternative names or item type.');
  if(!manage){const {name:_,prepProfile:_p,reviewStatus:_r,...protectedBefore}=item,{name:__,prepProfile:__p,reviewStatus:__r,...protectedAfter}=next;if(item.reviewStatus!==next.reviewStatus&&!(item.name!==next.name&&next.reviewStatus==='needs-review'))throw Error('A manager must review catalog verification changes.');if(!same(protectedBefore,protectedAfter))throw Error('Only the item name can be edited here. Use the owner tools for catalog details.');}
 }
 for(const item of after.items.filter(i=>!before.items.some(old=>old.id===i.id))){if(manage){if(item.aliases.length)throw Error('New items must start without alternative names.');}else{const expected=newItem(item.name,item.kind,item.unit);expected.id=item.id;expected.prepProfile=item.prepProfile;if(!same(item,expected))throw Error('New items must start without alternative names or hidden recipe details.');}}
 for(const d of before.dishes)if(!after.dishes.some(x=>x.id===d.id))throw Error('Archive dishes instead of deleting their identity.');
 if(!manage&&(!same(before.dishes,after.dishes)||!same(before.processes,after.processes)||!same(before.scenarios,after.scenarios)))throw Error('Only the owner or a Manager can manage dishes, production and menu scenarios.');
 if(!manage&&before.recipes.length!==after.recipes.length)throw Error('The existing menu recipes must be preserved.');
 for(const recipe of before.recipes){const next=after.recipes.find(r=>r.id===recipe.id);if(!next)throw Error('Archive variants instead of deleting their identity.');if(recipe.menuId!==next.menuId)throw Error('A recipe must retain its dish identity.');if(!manage){const {inputs,active,recorded,ingredientsReviewed:ir,reviewStatus:rs,reviewNote:rn,...rest}=recipe,{inputs:nextInputs,active:na,recorded:nr,ingredientsReviewed:nir,reviewStatus:nrs,reviewNote:nrn,...nextRest}=next;if(!same({...rest,...(recipe.workshop&&!same(inputs,nextInputs)?{workshop:{...recipe.workshop,processChecked:false}}:{})},nextRest))throw Error('Only the ingredient list and its status can be edited here.');for(const part of nextInputs){const previous=inputs.find(p=>p.itemId===part.itemId);if(previous?!same(previous,part):part.amount!==null||part.note!==''||hasMeasurementMetadata(part))throw Error('Existing quantity and note details must be preserved.');}}
  if(recipe.ingredientsReviewed!==undefined&&next.ingredientsReviewed===undefined)throw Error('Reload the application to preserve the ingredient review status.');
  const ingredientChange=ingredientContentChanged(recipe,next,before.items,after.items);
  if(ingredientChange&&ingredientsReviewed(recipe)&&ingredientsReviewed(next))throw Error('Changing reviewed ingredients or portions requires a fresh ingredient review.');
  if(!manage&&(next.ingredientsReviewed===true&&recipe.ingredientsReviewed!==true||ingredientsReviewed(next)&&!ingredientsReviewed(recipe)))throw Error('A Manager must mark ingredients reviewed.');
  for(const part of recipe.inputs){const target=next.inputs.find(p=>p.itemId===part.itemId);if(target&&missingMeasurementMetadata(part,target))throw Error('Reload the application to preserve saved ingredient units and conversions.');}
  if(recipe.workshop&&next.workshop&&(['beforeTiming','orderTiming'] as const).some(key=>recipe.workshop![key]!==undefined&&next.workshop![key]===undefined))throw Error('Reload the application to preserve the recorded time scope.');
  if(recipe.workshop&&!next.workshop)throw Error('This page cannot preserve the menu review. Download your draft and reload the application before saving.');
  if(recipe.workshop&&next.workshop&&recipe.reviewStatus==='verified'&&next.reviewStatus==='verified'&&!same({steps:recipe.workshop.steps,before:recipe.workshop.beforeMinutes,order:recipe.workshop.orderMinutes,beforeTiming:recipe.workshop.beforeTiming,orderTiming:recipe.workshop.orderTiming,notes:recipe.notes},{steps:next.workshop.steps,before:next.workshop.beforeMinutes,order:next.workshop.orderMinutes,beforeTiming:next.workshop.beforeTiming,orderTiming:next.workshop.orderTiming,notes:next.notes}))throw Error('Changing a checked process requires a fresh review.');
  if(recipe.reviewStatus==='verified'&&ingredientChange&&next.reviewStatus==='verified')throw Error('Changing verified ingredients or portions requires a new review.');
 }

 for(const process of before.processes){const next=after.processes.find(p=>p.id===process.id);if(next)for(const part of [...process.inputs,...process.outputs]){const target=[...next.inputs,...next.outputs].find(p=>p.itemId===part.itemId);if(target&&missingMeasurementMetadata(part,target))throw Error('Reload the application to preserve production units.');}}
 if(!same(before.equipment,after.equipment))throw new Error('Existing equipment notes must be preserved.');
}

export function mergePreview(n:Notebook,sourceId:string,targetId:string,profileResolution?:'keep-target',metadataResolution?:'keep-target'){
 const source=n.items.find(i=>i.id===sourceId),target=n.items.find(i=>i.id===targetId);const conflicts:string[]=[];
 if(!source||!target||source===target)return {conflicts:['Choose two different catalog items.'],affected:[],next:null};
 // A manager may explicitly retain the target type/profile; quantity, recipe and cycle guards still apply.
 if(!profileResolution&&source.kind!==target.kind)conflicts.push('Bought ingredients and house-made preparations cannot be merged.');
 if(source.unit!==target.unit)conflicts.push('The saved measurement units differ.');
 const sourceDefinition=n.workspaceRecipes?.find(recipe=>recipe.itemId===sourceId),targetDefinition=n.workspaceRecipes?.find(recipe=>recipe.itemId===targetId);
 if(!metadataResolution&&sourceDefinition&&targetDefinition&&!same({...sourceDefinition,itemId:targetId},targetDefinition))conflicts.push('The products have different Workspace 2.0 recipes. Explicitly choose which product recipe to retain.');
 if(!metadataResolution&&sourceDefinition&&!targetDefinition&&source.kind!==target.kind)conflicts.push('This merge would replace a Workspace 2.0 product recipe with a different product origin. Explicitly choose to retain the target product details; supplier ingredients cannot become a local production recipe.');
 const {id:si,name:sn,aliases:sa,prepProfile:sp,...sm}=source,{id:ti,name:tn,aliases:ta,prepProfile:tp,...tm}=target;
 if(!profileResolution&&!profileEmpty(sp)&&!profileEmpty(tp)&&!equivalentProfiles(sp,tp))conflicts.push('Preparation or storage answers differ. Review both item profiles before merging.');
 if(!metadataResolution&&!same(profileResolution?{...sm,kind:target.kind}:sm,tm))conflicts.push('Saved preparation, quantity, storage or other details differ. Review these records before merging.');
 if(dependencyIds(n,sourceId).has(targetId)||dependencyIds(n,targetId).has(sourceId))conflicts.push('These preparations depend on each other. Merging would create a recipe cycle.');
 const sourceProcess=n.processes.find(p=>p.outputs.some(o=>o.itemId===sourceId)),targetProcess=n.processes.find(p=>p.outputs.some(o=>o.itemId===targetId));if(sourceProcess&&targetProcess)conflicts.push(`Both items are outputs of ${sourceProcess.name}${sourceProcess.id===targetProcess.id?'':' and '+targetProcess.name}. Reconcile their output amounts and producers in Production or Review before merging.`);
 const affected=n.recipes.filter(r=>r.inputs.some(p=>p.itemId===sourceId));
 const rewrite=(inputs:RecipeInput[])=>{const result:RecipeInput[]=[];for(const p of inputs){const mapped=p.itemId===sourceId?{...p,itemId:targetId}:p;const existing=result.find(x=>x.itemId===mapped.itemId);if(existing){if(existing.amount!==null||mapped.amount!==null||existing.note||mapped.note||hasMeasurementMetadata(existing)||hasMeasurementMetadata(mapped))conflicts.push('Both items occur together with saved quantities or notes. They cannot be combined automatically.');}else result.push(mapped);}return result;};
 const next=structuredClone(n);next.items=next.items.filter(i=>i.id!==sourceId).map(i=>i.id===targetId?{...i,externalUse:i.externalUse||source.externalUse,reviewStatus:i.reviewStatus==='verified'?'needs-review':i.reviewStatus,prepProfile:profileResolution?tp:profileEmpty(tp)?sp:tp,aliases:[...new Set([...i.aliases,source.name,...source.aliases].map(x=>x.trim()))]}:i);
 for(const item of next.items)item.inputs=rewrite(item.inputs);for(const r of next.recipes){const changed=r.inputs.some(i=>i.itemId===sourceId);r.inputs=rewrite(r.inputs);if(changed){r.ingredientsReviewed=false;r.reviewStatus='unverified';if(r.workshop)r.workshop={...r.workshop,processChecked:false};}}for(const p of next.processes){const changed=p.inputs.some(i=>i.itemId===sourceId)||p.outputs.some(i=>i.itemId===sourceId);p.inputs=rewrite(p.inputs);p.outputs=p.outputs.map(o=>o.itemId===sourceId?{...o,itemId:targetId}:o);if(changed)p.reviewStatus='unverified';}
 if(next.workspaceRecipes){next.workspaceRecipes=next.workspaceRecipes.filter(recipe=>recipe.itemId!==sourceId);if(sourceDefinition&&!targetDefinition&&!metadataResolution&&source.kind===target.kind)next.workspaceRecipes.push({...sourceDefinition,itemId:targetId});for(const recipe of next.workspaceRecipes)recipe.inputs=rewrite(recipe.inputs);}
 const distinct=new Map<string,[string,string]>();
 for(const pair of next.distinctPairs){const mapped=pair.map(id=>id===sourceId?targetId:id).sort() as [string,string];if(mapped[0]!==mapped[1])distinct.set(pairKey(...mapped),mapped);}
 next.distinctPairs=[...distinct.values()];
 try{validateNotebook(next);}catch(e){conflicts.push(e instanceof Error?e.message:'The resulting catalog is invalid.');}
 return {conflicts:[...new Set(conflicts)],affected,next:conflicts.length?null:next};
}
export const operationSchema=z.discriminatedUnion('kind',[
 menuApplySchema,
 z.object({kind:z.literal('reclassify'),itemId:z.string(),itemKind:z.enum(['bought','prep'])}).strict(),
 z.object({kind:z.literal('aliases'),itemId:z.string(),aliases:z.array(z.string().trim().min(1).max(160)).max(30)}).strict(),
 z.object({kind:z.literal('merge'),sourceId:z.string(),targetId:z.string(),profileResolution:z.literal('keep-target').optional(),metadataResolution:z.literal('keep-target').optional()}).strict(),
 z.object({kind:z.literal('distinct'),a:z.string(),b:z.string(),different:z.boolean()}).strict(),
 z.object({kind:z.literal('undo'),operationId:z.string()}).strict(),
]);
export type CatalogOperation=z.infer<typeof operationSchema>;
export function reclassifyPreview(n:Notebook,itemId:string,kind:Item['kind']){
 const item=n.items.find(i=>i.id===itemId);
 if(!item)return {conflicts:['This item no longer exists.'],affected:[],savedDetails:false};
 const conflicts=kind==='bought'&&(item.inputs.length||n.processes.some(p=>p.outputs.some(o=>o.itemId===itemId)))?['This preparation has a saved recipe. Keep it as Made in-house to preserve that recipe. If the dish uses a bought product instead, add that product as a separate Bought item and replace it in the affected dishes.']:[];
 if(kind!==item.kind&&n.workspaceRecipes?.some(recipe=>recipe.itemId===itemId&&recipe.inputs.length))conflicts.push('This product has saved composition. Bought supplier ingredients and local production ingredients have different meanings. Keep this identity and add the other product separately, or reconcile the composition before changing its origin.');
 const empty=newItem(item.name,item.kind,item.unit);
 const savedDetails=['specification','yieldAmount','activeMinutes','passiveMinutes','frequencyHours','batchMinimum','batchMaximum','method','storage','prepProfile'].some(key=>!same(item[key as keyof Item],empty[key as keyof Item]));
 return {conflicts,affected:n.recipes.filter(r=>r.inputs.some(p=>p.itemId===itemId)),savedDetails};
}
export function applyOperation(n:Notebook,op:Exclude<CatalogOperation,{kind:'undo'}>){if(op.kind==='apply-menu'){if(new Set(op.recipeIds).size!==op.recipeIds.length||new Set(op.changes.map(c=>c.itemId)).size!==op.changes.length)throw Error('Repeated variant or stock change.');return {next:validateNotebook(scenarioNotebook(n,op.recipeIds,op.fingerprint)),summary:'Applied menu scenario and selected stock settings'};}const next=structuredClone(n);let summary='';if(op.kind==='aliases'){const item=next.items.find(i=>i.id===op.itemId);if(!item)throw new Error('Item not found.');item.aliases=op.aliases;summary=`Alternative names updated: ${item.name}`;}
 if(op.kind==='reclassify'){const preview=reclassifyPreview(n,op.itemId,op.itemKind);if(preview.conflicts.length)throw Error(preview.conflicts.join(' '));const item=next.items.find(i=>i.id===op.itemId)!;item.kind=op.itemKind;const definition=next.workspaceRecipes?.find(recipe=>recipe.itemId===item.id);if(definition)definition.kind=op.itemKind==='bought'?'supplier':'local';item.reviewStatus='unverified';for(const r of next.recipes)if(r.inputs.some(p=>p.itemId===item.id)){r.ingredientsReviewed=false;r.reviewStatus='unverified';}summary=`Type corrected: ${item.name} → ${op.itemKind==='prep'?'Made in-house':'Bought'}`;}
 if(op.kind==='merge'){const result=mergePreview(n,op.sourceId,op.targetId,op.profileResolution,op.metadataResolution);if(!result.next)throw new Error(result.conflicts.join(' '));return {next:result.next,summary:`Merged ${n.items.find(i=>i.id===op.sourceId)!.name} into ${n.items.find(i=>i.id===op.targetId)!.name}`};}
 if(op.kind==='distinct'){if(op.a===op.b||[op.a,op.b].some(id=>!n.items.some(i=>i.id===id)))throw new Error('Choose two different catalog items.');next.distinctPairs=next.distinctPairs.filter(p=>pairKey(...p)!==pairKey(op.a,op.b));if(op.different)next.distinctPairs.push([op.a,op.b]);summary=op.different?'Marked two items as different':'Reopened a different-items decision';}
 return {next:validateNotebook(next),summary};}

export function matrixCell(n:Notebook,itemId:string,menuId:string,usage?:ReturnType<typeof usageMap>){const variants=n.recipes.filter(r=>r.active&&r.menuId===menuId);const present=variants.filter(r=>usage?usage.get(itemId)?.recipes.has(r.id):r.inputs.some(p=>p.itemId===itemId));const pending=variants.filter(r=>!r.recorded);return {state:present.length?'used':pending.length?'unknown':'absent',variants,present,pending} as const;}
export const activeDishes=(n:Notebook)=>directUsage(n).dishes;
export function directCount(n:Notebook,itemId:string,index:DirectUsage=directUsage(n)){return index.itemDishes.get(itemId)?.size??0;}
export function matrixItems(n:Notebook,filter:string,index:DirectUsage=directUsage(n)){return [...n.items].filter(i=>{const count=index.itemDishes.get(i.id)?.size??0;return count>0&&(filter==='shared'?count>1:filter==='single'?count===1:true);}).sort((a,b)=>compareUsage(index,a.id,b.id));}
export function exportMatrix(n:Notebook,filter='all',index:DirectUsage=directUsage(n),usage?:ReturnType<typeof usageMap>){const dishes=index.dishes;const rows:unknown[][]=[['Ingredient / preparation','Type','Recorded in menu dishes',...dishes.map(d=>d.name)]];for(const item of matrixItems(n,filter,index))rows.push([item.name,item.kind,directCount(n,item.id,index),...dishes.map(d=>{const c=matrixCell(n,item.id,d.id,usage);return c.state==='used'?'Used':c.state==='unknown'?'Unknown — list unfinished':'Not listed — lists complete';})]);return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');}
