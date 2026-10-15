import {approvedProduction,currentProductionInputs} from './approved-production';
import {usageMap,type Notebook} from './notebook';
import type {AppliedRecord} from './review-v2/applied';
import {menu as originalMenu} from './menu';

export type MenuScopeState='menu'|'outside'|'uncertain'|'inactive';
/** Shared by catalog, preparation queues, exports and saved operational planning. */
export function menuScope(n:Notebook,records:AppliedRecord[]=[]){
 const graph=approvedProduction(n,records),active=n.recipes.filter(r=>r.active&&n.dishes.some(d=>d.id===r.menuId&&d.state==='ready'));
 const current={...n,recipes:active},inputsFor=(id:string)=>currentProductionInputs(n,graph,id);
 const usage=usageMap(current,inputsFor),menu=new Set(n.items.filter(i=>usage.get(i.id)?.all.size).map(i=>i.id)),outside=new Set<string>(),gaps=new Set<string>();
 const byId=new Map(n.items.map(i=>[i.id,i]));
 const walk=(id:string,target:Set<string>,path=new Set<string>())=>{
  if(path.has(id)){gaps.add('Circular preparation dependency');return;}
  const item=byId.get(id);if(!item){gaps.add('An input has an unresolved catalog identity');return;}if(target.has(id))return;target.add(id);
  const sources=graph.byItem.get(id)??[],process=n.processes.find(p=>p.outputs.some(o=>o.itemId===id)),inputs=inputsFor(id);
  const product=n.workspaceRecipes?.find(recipe=>recipe.itemId===id&&recipe.kind==='local');
  if(product&&!product.inputs.length)gaps.add(item.name+': product composition is not recorded');
  if(sources.length){for(const source of sources)if(!product||source.outputs.length>1||!source.compositionComplete||source.external)for(const gap of source.gaps)gaps.add(source.name+': '+gap);}
  else if(graph.sourceUnavailable&&(item.kind==='prep'||process)||process?.sourceReviewId||graph.held.has(id))gaps.add(item.name+': current approved composition is unavailable');
  else if(item.kind==='prep'&&!inputs.length)gaps.add(item.name+': preparation composition is not recorded');
  for(const input of inputs)walk(input.itemId,target,new Set(path).add(id));
 };
 // Walk a separate set so every reachable composition source is checked once.
 const checked=new Set<string>();for(const recipe of active){if(!recipe.recorded||!recipe.inputs.length)gaps.add((n.dishes.find(d=>d.id===recipe.menuId)?.name??recipe.menuId)+': ingredient list is unfinished');for(const input of recipe.inputs)walk(input.itemId,checked);}
 for(const item of n.items)if(item.externalUse)walk(item.id,outside);
 for(const process of n.processes)if(process.externalUse)for(const output of process.outputs)walk(output.itemId,outside);
 for(const task of graph.tasks.values())if(task.external)for(const output of task.outputs)walk(output,outside);
 // Missing composition cannot establish that a previously tracked ingredient is dispensable.
 const uncertain=new Set(gaps.size?n.items.filter(i=>!menu.has(i.id)&&!outside.has(i.id)).map(i=>i.id):[]);
 const operational=new Set([...menu,...outside,...uncertain]);
 const state=(id:string):MenuScopeState=>menu.has(id)?'menu':outside.has(id)?'outside':uncertain.has(id)?'uncertain':'inactive';
 return {menu,outside,uncertain,operational,usage,graph,gaps:[...gaps],state};
}
export const menuScopeLabel=(state:MenuScopeState)=>({menu:'Current menu',outside:'Needed outside menu',uncertain:'Menu scope needs review',inactive:'Paused — outside current menu'})[state];
export function menuUsage(n:Notebook,records:AppliedRecord[]=[]){
 const scope=menuScope(n,records),items=new Map(n.items.map(i=>[i.id,i])),itemDishes=new Map([...scope.usage].filter(([,u])=>u.all.size).map(([id,u])=>[id,u.all]));
 const dishes=n.dishes.filter(d=>d.state==='ready'&&n.recipes.some(r=>r.active&&r.menuId===d.id)),dishItems=new Map(dishes.map(d=>[d.id,new Set([...itemDishes].filter(([,ids])=>ids.has(d.id)).map(([id])=>id))]));
 return {dishes,items,itemDishes,dishItems,bought:[...scope.menu].filter(id=>items.get(id)?.kind==='bought').length,prep:[...scope.menu].filter(id=>items.get(id)?.kind==='prep').length};
}
export type MenuScopeSource={seq:number;notebook_revision:number;notebook_payload:string;review_payload:string;recorded_at:string;actor:string};
export function scopeSource(row:MenuScopeSource){
 const n=JSON.parse(row.notebook_payload) as Notebook;
 // The activation snapshot can precede the existing v1–v3 notebook migration.
 // Reuse that migration's original dish identities; missing recipe evidence remains unknown.
 if(!Array.isArray(n.dishes))n.dishes=originalMenu.map(({variants:_,...dish})=>({...dish,state:'ready'}));
 if(!Array.isArray(n.processes))n.processes=[];
 if(!Array.isArray(n.recipes))n.recipes=[{id:'unrecorded-source',menuId:n.dishes[0].id,variant:'Unrecorded source',active:true,recorded:false,inputs:[],reviewStatus:'unverified',reviewNote:'',portions:null,notes:'',weekdayPortions:null,busyPortions:null}];
 return menuScope(n,JSON.parse(row.review_payload) as AppliedRecord[]);
}
