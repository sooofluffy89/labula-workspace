import {z} from 'zod';
import {compositionFingerprint,recipeCompositionConfirmed} from './composition-fingerprint';
import {approvedProduction,currentProductionInputs} from './approved-production';
import {inputSchema,validateNotebook,type Dish,type Item,type Notebook,type Recipe,type RecipeInput,type WorkspaceRecipeDefinition} from './notebook';
import {list,values,str,decimal,type Entity} from './review-v2/model';
import type {AppliedRecord} from './review-v2/applied';
import {baseInputAmount} from './recipe-quantity';
import type {PrepProfile,StorageSetup} from './prep-profile';
import {menuScope} from './menu-scope';

export type WorkspaceComposition={
 source:'workspace'|'review'|'process'|'legacy'|'supplier'|'unavailable';
 status:'recorded'|'incomplete'|'not-recorded';inputs:RecipeInput[];gaps:string[];
 sourceLabel:string;token:string;reference:string;ownConfirmed?:boolean;gapCodes?:('composition_missing'|'source_review'|'cycle')[];
};
export type WorkspaceSharedBatch={id:string;name:string;inputs:RecipeInput[];outputIds:string[];method:string};
export type WorkspaceUse={dishId:string;name:string;recipeIds:string[];direct:boolean};
export type WorkspaceMenuItem=Pick<Item,'id'|'name'|'aliases'|'kind'|'unit'|'specification'|'storage'> & {
 method:string;yieldAmount:number|null;composition:WorkspaceComposition;sharedBatch:WorkspaceSharedBatch|null;usedIn:WorkspaceUse[];
 storageSetups:StorageSetup[];storageSource:string;workflow:PrepProfile['workflow'];preparationNote:string;
};
export type WorkspaceDish=Pick<Dish,'id'|'name'|'category'|'note'|'state'>;
export type WorkspaceDishEvidence={label:string;effective:string;warnings:string[];choiceRules:string[];components:{itemId:string|null;name:string;use:string;group:string;quantity:string}[]};
export type WorkspaceMenuRecipe=Pick<Recipe,'id'|'menuId'|'variant'|'portions'|'inputs'|'notes'|'active'|'recorded'> & {method:string;reviewEvidence?:WorkspaceDishEvidence};
export type WorkspaceMenu={revision:number;updatedAt:string;accountId:string;canEdit:boolean;canOrdinaryEdit:boolean;dishes:WorkspaceDish[];recipes:WorkspaceMenuRecipe[];items:WorkspaceMenuItem[]};
export type WorkspaceMenuContext={revision:number;updatedAt:string;accountId:string;role:'owner'|'manager'|'cook'|'legacy';canManage?:boolean;operationalItemIds?:readonly string[]};

// A deterministic evidence token is an optimistic-concurrency hint, not an authorization secret.
export function workspaceSourceToken(value:unknown){const text=JSON.stringify(value);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;}
function latestEntities(records:AppliedRecord[]){const result=new Map<string,Entity>();const ordered=[...records].sort((a,b)=>a.notebookRevision-b.notebookRevision);for(const record of ordered)for(const entity of record.dependencies)result.set(entity.id,entity);for(const record of ordered)result.set(record.entity.id,record.entity);return result;}
function menuSources(n:Notebook,records:AppliedRecord[]){return {graph:approvedProduction(n,records),entities:latestEntities(records),items:new Map(n.items.map(item=>[item.id,item])),processes:new Map(n.processes.flatMap(process=>process.outputs.map(output=>[output.itemId,process] as const))),definitions:new Map((n.workspaceRecipes??[]).map(definition=>[definition.itemId,definition]))};}
function sourceState(n:Notebook,records:AppliedRecord[],itemId:string,cache=menuSources(n,records)){
 const item=cache.items.get(itemId);if(!item)throw Error('This ingredient no longer exists.');
 const {graph,entities}=cache,sources=graph.byItem.get(itemId)??[],process=cache.processes.get(itemId),definition=cache.definitions.get(itemId);
 const unavailable=graph.sourceUnavailable&&(item.kind==='prep'||!!process)||!sources.length&&!!process?.sourceReviewId;
 const evidence={itemId,kind:item.kind,definition,legacy:{inputs:item.inputs,method:item.method,yieldAmount:item.yieldAmount},process,sources:sources.map(s=>({task:s,entity:entities.get(s.entityId)})),unavailable};
 return {item,graph,sources,process,definition,entities,unavailable,token:workspaceSourceToken(evidence)};
}
function supplierSource(state:ReturnType<typeof sourceState>){
 const {item,entities,graph}=state;
 const sources=[...entities.values()].filter(entity=>entity.kind==='item'&&graph.resolveItem(entity.id)===item.id).flatMap(entity=>list(values(entity,'ITEM-02'),'sources')).filter(row=>row.practice==='Current practice'&&row.route!=='Made in this kitchen');
 if(!sources.length)return null;
 if(sources.length!==1)return {inputs:[],gaps:['Several current supplier sources are recorded. Confirm the exact product composition.'],reference:''};
 const source=sources[0],rows=list(source,'components'),inputs:RecipeInput[]=[],gaps:string[]=[];
 for(const row of rows){const id=graph.resolveItem(row.item);if(!id){gaps.push('A supplier ingredient has an unresolved catalog identity.');continue;}if(!inputs.some(input=>input.itemId===id))inputs.push({itemId:id,amount:null,note:'Supplier composition'});}
 if(source.composition!=='Documented components'||source.complete!=='Complete documented list')gaps.push(source.composition==='One base ingredient'?'The supplier identifies this as one base ingredient.':'Supplier composition is not completely recorded.');
 return {inputs,gaps,reference:typeof source.specification==='string'?source.specification:''};
}
/** Product composition is deliberately separate from inputs needed by a shared production batch. */
export function workspaceComposition(n:Notebook,records:AppliedRecord[],itemId:string):WorkspaceComposition{
 return compositionFromState(sourceState(n,records,itemId));
}
function compositionFromState(state:ReturnType<typeof sourceState>):WorkspaceComposition{
 const {item,graph,sources,process,definition,entities,token}=state,itemId=item.id;
 if(definition)return {source:definition.kind==='supplier'?'supplier':'workspace',status:definition.inputs.length?'recorded':'not-recorded',inputs:structuredClone(definition.inputs),gaps:definition.inputs.length?[]:[definition.kind==='supplier'?'Supplier composition not recorded.':'Product composition not recorded.'],gapCodes:definition.inputs.length?[]:['composition_missing'],sourceLabel:definition.kind==='supplier'?'Supplier ingredients · Workspace 2.0':'Product recipe · Workspace 2.0',token,reference:definition.reference};
 if(item.kind==='bought'){
  const supplier=supplierSource(state);
  return {source:'supplier',status:supplier?.inputs.length?(supplier.gaps.length?'incomplete':'recorded'):'not-recorded',inputs:supplier?.inputs??[],gaps:supplier?.gaps??['Supplier composition not recorded.'],sourceLabel:'Supplier ingredients',token,reference:supplier?.reference??''};
 }
 if(sources.length){
  const gaps=[...new Set(sources.flatMap(s=>s.gaps))],inputs:RecipeInput[]=[];
  if(sources.length>1)gaps.unshift('Several approved methods exist. Product composition needs an explicit choice.');
  for(const source of sources){
   const entity=entities.get(source.entityId),rows=list(values(entity,'PROC-02'),'inputs'),outputs=list(values(entity,'PROC-03'),'outputs');
   const ownOutputs=new Set(outputs.filter(row=>graph.resolveItem(row.item)===itemId).map(row=>row.id));
   for(const row of rows){
    const id=graph.resolveItem(row.item);if(!id||id===itemId)continue;
    const retained=row.retained==='All usable outputs'||row.retained==='Only selected outputs'&&list(row,'retainedIn').some(retained=>ownOutputs.has(retained.output));
    if(row.retained==='Does not remain in a usable output'||row.retained==='Only selected outputs'&&!retained)continue;
    if(!retained){gaps.push('Product composition not confirmed: a batch input has no confirmed product allocation.');continue;}
    if(!inputs.some(input=>input.itemId===id))inputs.push({itemId:id,amount:null,note:'Approved product composition; batch quantities not established'});
   }
  }
  if(!inputs.length)gaps.push('Product composition not confirmed. Add the ingredients in this product; shared batch inputs stay separate.');
  return {source:'review',status:gaps.length?'incomplete':'recorded',inputs,gaps:[...new Set(gaps)],sourceLabel:sources.map(s=>s.name).join(' / '),token,reference:'Approved Review evidence retained'};
 }
 if(state.unavailable)return {source:'unavailable',status:'incomplete',inputs:[],gaps:['The authoritative approved source is unavailable. The superseded recipe is not shown as current.'],sourceLabel:'Approved source unavailable',token,reference:''};
 if(process){const shared=process.outputs.length>1;return {source:'process',status:shared?'incomplete':process.inputs.length?'recorded':'not-recorded',inputs:shared?[]:structuredClone(process.inputs),gaps:shared?['Product composition not confirmed. Shared batch inputs are shown separately.']:process.inputs.length?[]:['Product composition not recorded.'],gapCodes:shared?['source_review']:process.inputs.length?[]:['composition_missing'],sourceLabel:process.name,token,reference:''};}
 return {source:'legacy',status:item.inputs.length?'recorded':'not-recorded',inputs:structuredClone(item.inputs),gaps:item.inputs.length?[]:['Product composition not recorded.'],gapCodes:item.inputs.length?[]:['composition_missing'],sourceLabel:'Existing recipe',token,reference:''};
}
function sharedBatch(state:ReturnType<typeof sourceState>):WorkspaceSharedBatch|null{
 const {sources,process,entities}=state;
 if(sources.length){const outputIds=[...new Set(sources.flatMap(s=>s.outputs))],inputIds=[...new Set(sources.flatMap(s=>s.inputs))];return {id:sources.map(s=>s.id).join(','),name:sources.map(s=>s.name).join(' / '),inputs:inputIds.map(itemId=>({itemId,amount:null,note:'Production dependency; quantities not established'})),outputIds,method:sources.map(s=>{const definition=values(entities.get(s.entityId),'PROC-01');return typeof definition.conditions==='string'?definition.conditions:'';}).filter(Boolean).join('\n')};}
 if(state.unavailable)return null;
 return process?{id:process.id,name:process.name,inputs:structuredClone(process.inputs),outputIds:process.outputs.map(o=>o.itemId),method:process.method}:null;
}
export const productCompositionFingerprint=compositionFingerprint;
function itemProjection(n:Notebook,records:AppliedRecord[],item:Item,cache:ReturnType<typeof menuSources>):WorkspaceMenuItem{
 const state=sourceState(n,records,item.id,cache),batch=sharedBatch(state),output=state.process?.outputs.find(o=>o.itemId===item.id),composition=compositionFromState(state);
 composition.ownConfirmed=item.kind==='prep'&&!!state.definition?.compositionCheck&&composition.status==='recorded'&&state.definition.compositionCheck.fingerprint===productCompositionFingerprint(item.kind,composition.inputs,n.items);
 const method=state.definition?.method??(batch?batch.method:state.unavailable?'':item.method);
 const yieldAmount=state.definition?state.definition.yieldAmount:state.sources.length||state.unavailable?null:output?baseInputAmount(output,item):item.yieldAmount;
 return {id:item.id,name:item.name,aliases:[...item.aliases],kind:item.kind,unit:item.unit,specification:item.specification,storage:structuredClone(item.storage),storageSetups:structuredClone(item.prepProfile.storage),storageSource:'Preparation & storage answers',workflow:item.prepProfile.workflow,preparationNote:item.prepProfile.note,method,yieldAmount,composition,sharedBatch:batch,usedIn:[]};
}
function dishEvidence(recipe:Recipe,records:AppliedRecord[],cache:ReturnType<typeof menuSources>):WorkspaceDishEvidence|undefined{
 const record=[...records].filter(record=>record.entity.kind==='dish'&&(record.entity.sourceId===recipe.id||record.entity.id==='dish:'+recipe.id)).sort((a,b)=>b.notebookRevision-a.notebookRevision)[0];if(!record)return;
 const entity=record.entity,rows=list(values(entity,'DISH-01'),'components'),groups=list(values(entity,'DISH-02'),'groups'),portions=list(values(entity,'DISH-03'),'portions');if(!rows.length&&!groups.length)return;
 const components=rows.map(row=>{const itemId=cache.graph.resolveItem(row.item)??null,item=itemId?cache.items.get(itemId):undefined,quantity=portions.find(portion=>portion.component===row.id),amount=quantity?.known==='Known quantity'?decimal(quantity.amount):null;
  return {itemId,name:item?.name??cache.entities.get(String(row.item))?.name??'Unresolved ingredient',use:str(row,'use')||'Use not confirmed',group:str(groups.find(group=>group.id===row.group),'name'),quantity:amount===null?'Amount not recorded':`${amount} ${str(quantity,'unit')} per served portion${str(quantity,'mode')?' · '+str(quantity,'mode'):''}${str(quantity,'meaning')?' · '+str(quantity,'meaning'):''}`};});
 const warnings:string[]=[];
 if(rows.some(row=>!['Always included','Not used','Included only inside another preparation'].includes(str(row,'use'))))warnings.push('Recorded recipe choices are not a simultaneous ingredient list. Compare the retained options below before treating this saved recipe as complete.');
 if(values(entity,'DISH-05').complete!=='Complete as shown'||record.staleDependencies)warnings.push('The retained Review composition is incomplete or its dependencies changed. It is evidence for reconciliation, not a newly confirmed recipe.');
 if(components.some(component=>!component.itemId))warnings.push('A recorded component needs its current catalog identity.');
 const expected=components.filter(component=>component.use==='Always included').map(component=>component.itemId).sort(),actual=recipe.inputs.map(input=>input.itemId).sort();if(!warnings.length&&JSON.stringify(expected)!==JSON.stringify(actual))warnings.push('The saved recipe differs from retained Review facts. Neither source has been silently substituted for the other.');
 const choiceRules=groups.map(group=>{const rule=str(group,'rule'),count=decimal(group.count),combination=rule==='A specific named combination'?list(group,'combinations').map(combo=>str(combo,'name')+': '+list(combo,'parts').map(part=>{const index=rows.findIndex(row=>row.id===part.component);return `${decimal(part.count)??'?'} × ${components[index]?.name??'Unresolved component'}`;}).join(', ')).join('; '):'',variant=rule==='Depends on a named variant'?cache.entities.get(str(group,'variant'))?.name??'Variant not resolved':'';return [str(group,'name'),rule,...(['Choose exactly N','Choose up to N'].includes(rule)?[count===null?'Count not recorded':String(count)]:[]),combination,variant,str(group,'repeats')?'Repeated choice: '+str(group,'repeats'):''].filter(Boolean).join(' · ');});
 return {label:'Retained applied Review facts',effective:record.effective,warnings,choiceRules,components};
}
/** An allowlist projection: never serialize the Notebook or approved records to a Cook. */
export function workspaceMenu(n:Notebook,records:AppliedRecord[],context:WorkspaceMenuContext):WorkspaceMenu{
 const cook=context.role==='cook',recipes=n.recipes.filter(recipe=>!cook||recipe.active&&n.dishes.some(d=>d.id===recipe.menuId&&d.state==='ready'));
 const cache=menuSources(n,records),projected=new Map(n.items.map(item=>[item.id,itemProjection(n,records,item,cache)])),evidence=new Map(recipes.map(recipe=>[recipe.id,dishEvidence(recipe,records,cache)]));
 const reached=new Set<string>(),walked=new Map<string,Set<string>>();
 const walk=(id:string,recipe:Recipe,direct:boolean,path:Set<string>)=>{
  const item=projected.get(id);if(!item)return;reached.add(id);
  const use=item.usedIn.find(use=>use.dishId===recipe.menuId);if(use){use.direct||=direct;if(!use.recipeIds.includes(recipe.id))use.recipeIds.push(recipe.id);}else item.usedIn.push({dishId:recipe.menuId,name:n.dishes.find(d=>d.id===recipe.menuId)?.name??recipe.menuId,recipeIds:[recipe.id],direct});
  if(path.has(id)){if(!item.composition.gaps.includes('A circular product reference needs correction.')){item.composition.gaps.push('A circular product reference needs correction.');item.composition.gapCodes=[...(item.composition.gapCodes??item.composition.gaps.slice(0,-1).map(()=>'source_review' as const)),'cycle'];}item.composition.status='incomplete';return;}
  const seen=walked.get(recipe.id)??new Set<string>();if(seen.has(id))return;seen.add(id);walked.set(recipe.id,seen);
  if(item.kind==='prep')for(const part of item.composition.inputs)walk(part.itemId,recipe,false,new Set(path).add(id));
 };
 for(const recipe of recipes)for(const part of recipe.inputs)walk(part.itemId,recipe,true,new Set());
 if(cook)for(const recipe of recipes)for(const component of evidence.get(recipe.id)?.components??[])if(component.itemId&&component.use!=='Not used')reached.add(component.itemId);
 // A Cook may inspect necessary production instructions without receiving unrelated catalog records.
 if(cook){for(const id of context.operationalItemIds??[])if(projected.has(id))reached.add(id);const queue=[...reached];for(let index=0;index<queue.length;index++){const item=projected.get(queue[index]);for(const id of [...(item?.composition.inputs??[]).map(i=>i.itemId),...(item?.sharedBatch?.inputs??[]).map(i=>i.itemId),...(item?.sharedBatch?.outputIds??[])])if(!reached.has(id)&&projected.has(id)){reached.add(id);queue.push(id);}}}
 const canEdit=!cook&&(context.role==='owner'||context.role==='manager')&&context.canManage!==false;
 return {revision:context.revision,updatedAt:context.updatedAt,accountId:context.accountId,canEdit,canOrdinaryEdit:canEdit||context.role==='legacy',
  dishes:n.dishes.filter(d=>!cook||recipes.some(r=>r.menuId===d.id)).map(d=>({id:d.id,name:d.name,category:d.category,...(d.note!==undefined?{note:d.note}:{}),state:d.state})),
  recipes:recipes.map(r=>({id:r.id,menuId:r.menuId,variant:r.variant,portions:r.portions,inputs:structuredClone(r.inputs),notes:r.notes,active:r.active,recorded:recipeCompositionConfirmed(r,n.items),method:(r.workshop?.steps??[]).map(step=>`${step.phase==='before'?'Preparation':'To order'}: ${step.text}`).join('\n'),...(evidence.get(r.id)?{reviewEvidence:evidence.get(r.id)}:{})})),
  items:[...projected.values()].filter(item=>!cook||reached.has(item.id))};
}

export const workspaceMenuCommandSchema=z.object({operationId:z.string().uuid(),itemId:z.string().min(1).max(100),baseToken:z.string().min(1).max(100),inputs:z.array(inputSchema).max(150),method:z.string().max(6000),yieldAmount:z.number().finite().positive().max(1e9).nullable(),reference:z.string().max(6000),listConfirmed:z.boolean().optional(),confirmed:z.literal(true)}).strict();
export type WorkspaceMenuCommand=z.infer<typeof workspaceMenuCommandSchema>;
export const workspaceMenuPreviewSchema=z.object({recipeIds:z.array(z.string().min(1).max(100)).max(500),dishStates:z.array(z.object({id:z.string().min(1).max(100),state:z.enum(['draft','ready','archived'])}).strict()).max(500).optional()}).strict();
export type WorkspaceMenuPreviewRequest=z.infer<typeof workspaceMenuPreviewSchema>;
export function proposedWorkspaceMenu(n:Notebook,request:WorkspaceMenuPreviewRequest){
 if(new Set(request.recipeIds).size!==request.recipeIds.length||request.recipeIds.some(id=>!n.recipes.some(recipe=>recipe.id===id)))throw Error('Select existing recipe variants once each.');
 if(new Set((request.dishStates??[]).map(dish=>dish.id)).size!==(request.dishStates??[]).length||(request.dishStates??[]).some(dish=>!n.dishes.some(current=>current.id===dish.id)))throw Error('A menu listing changed. Reopen its preview.');
 const next=structuredClone(n),active=new Set(request.recipeIds);for(const recipe of next.recipes)recipe.active=active.has(recipe.id);for(const dish of request.dishStates??[])next.dishes.find(current=>current.id===dish.id)!.state=dish.state;return validateNotebook(next);
}
export function workspaceMenuImpact(n:Notebook,records:AppliedRecord[],request:WorkspaceMenuPreviewRequest){
 const next=proposedWorkspaceMenu(n,request),before=menuScope(n,records),after=menuScope(next,records),items=new Map(n.items.map(item=>[item.id,{id:item.id,name:item.name}]));
 const named=(ids:Iterable<string>)=>[...ids].flatMap(id=>items.has(id)?[items.get(id)!]:[]).sort((a,b)=>a.name.localeCompare(b.name));
 const changedUses=(id:string)=>JSON.stringify([...(before.usage.get(id)?.recipes??[])].sort())!==JSON.stringify([...(after.usage.get(id)?.recipes??[])].sort());
 return {added:named([...after.operational].filter(id=>!before.operational.has(id))),removed:named([...before.operational].filter(id=>!after.operational.has(id))),leftMenu:named([...before.menu].filter(id=>!after.menu.has(id))),retainedShared:named([...before.menu].filter(id=>after.menu.has(id)&&changedUses(id))),external:named([...after.outside].filter(id=>before.menu.has(id)&&!after.menu.has(id))),gaps:after.gaps,compositionComplete:after.gaps.length===0,effective:'Future checks; published plans stay unchanged',sourceToken:workspaceSourceToken({n,records})};
}
/** Explicit reconciliation affects this product only; previous evidence remains in the saved notebook and audit. */
export function applyWorkspaceMenuCommand(n:Notebook,records:AppliedRecord[],command:WorkspaceMenuCommand,revision:number,updatedAt:string):Notebook{
 const current=workspaceComposition(n,records,command.itemId),item=n.items.find(item=>item.id===command.itemId)!;
 if(current.token!==command.baseToken)throw Error('This product recipe changed. Keep your draft, load its current source and compare it before saving.');
 if(current.source==='unavailable')throw Error('The authoritative source could not be loaded. Retry before replacing its recipe.');
 if(item.kind==='bought'&&command.inputs.length&&!command.reference.trim())throw Error('Add the supplier label or document reference for these ingredients.');
 const definition:WorkspaceRecipeDefinition={itemId:item.id,kind:item.kind==='bought'?'supplier':'local',inputs:structuredClone(command.inputs),method:command.method,yieldAmount:command.yieldAmount,reference:command.reference,revision,updatedAt,source:current.source,sourceLabel:current.sourceLabel,sourceToken:current.token};
 const prior=n.workspaceRecipes?.find(recipe=>recipe.itemId===item.id);if(command.listConfirmed===undefined&&prior?.compositionCheck&&prior.compositionCheck.fingerprint===productCompositionFingerprint(item.kind,definition.inputs,n.items))definition.compositionCheck=prior.compositionCheck;
 if(command.listConfirmed){if(item.kind!=='prep'||!definition.inputs.length)throw Error('Only a nonempty house-made composition can be confirmed.');definition.compositionCheck={fingerprint:productCompositionFingerprint(item.kind,definition.inputs,n.items),checkedAt:updatedAt};}
 const next=structuredClone(n);next.workspaceRecipes=[...(next.workspaceRecipes??[]).filter(recipe=>recipe.itemId!==item.id),definition];
 // Check the effective approved tree as well as the local schema; no depth cap hides a cycle.
 const view=workspaceMenu(next,records,{revision,updatedAt,accountId:'validation',role:'owner'}),byId=new Map(view.items.map(item=>[item.id,item]));
 const visiting=new Set<string>(),done=new Set<string>();const visit=(id:string)=>{if(visiting.has(id))throw Error('A product cannot contain itself, directly or through another product.');if(done.has(id))return;const product=byId.get(id);if(!product)throw Error('An ingredient no longer exists.');visiting.add(id);for(const input of product.composition.inputs)visit(input.itemId);visiting.delete(id);done.add(id);};for(const product of view.items)visit(product.id);
 const graph=approvedProduction(next,records);visiting.clear();done.clear();const visitProduction=(id:string)=>{if(visiting.has(id))throw Error('These product ingredients would create a circular production dependency.');if(done.has(id))return;if(!byId.has(id))throw Error('A production ingredient no longer exists.');visiting.add(id);for(const input of currentProductionInputs(next,graph,id))visitProduction(input.itemId);visiting.delete(id);done.add(id);};for(const product of view.items)visitProduction(product.id);
 return validateNotebook(next);
}
