import {normalizeName,type RecipeInput} from './notebook';
import type {WorkspaceMenu,WorkspaceMenuItem,WorkspaceMenuRecipe} from './workspace-menu';
export type CompositionIssue={id:string;itemId?:string;recipeId?:string;message:string;recipeIds:string[];dishIds:string[]};
export type CompositionState={ownConfirmed:boolean;complete:boolean;issues:CompositionIssue[]};
export type CompositionUsage={dishId:string;recipeId:string;direct:boolean;path:string[]};
export function menuComposition(menu:WorkspaceMenu){
 const items=new Map(menu.items.map(item=>[item.id,item])),active=menu.recipes.filter(recipe=>recipe.active&&menu.dishes.some(d=>d.id===recipe.menuId&&d.state==='ready'));
 const usage=new Map<string,CompositionUsage[]>(),parents=new Map<string,string[]>(),states=new Map<string,CompositionState>(),recipes=new Map<string,CompositionState>();
 for(const item of menu.items)if(item.kind==='prep')for(const input of item.composition.inputs){const list=parents.get(input.itemId)??[];if(!list.includes(item.id))list.push(item.id);parents.set(input.itemId,list);}
 const own=(item:WorkspaceMenuItem)=>item.kind==='bought'||!!item.composition.ownConfirmed&&item.composition.inputs.length>0;
 const inspect=(id:string,path:Set<string>):CompositionState=>{
  const item=items.get(id);if(!item)return {ownConfirmed:false,complete:false,issues:[{id:'missing:'+id,itemId:id,message:'An ingredient is no longer available.',recipeIds:[],dishIds:[]}]};
  if(item.kind==='bought')return {ownConfirmed:true,complete:true,issues:[]};
  if(path.has(id))return {ownConfirmed:own(item),complete:false,issues:[{id:'cycle:'+id,itemId:id,message:'Circular composition: '+item.name,recipeIds:[],dishIds:[]}]};
  const cached=states.get(id);if(cached)return cached;
  const issues:CompositionIssue[]=[];
  if(!own(item))issues.push({id:'own:'+id,itemId:id,message:item.name+': '+(!item.composition.inputs.length?'composition not started':'own list needs confirmation'),recipeIds:[],dishIds:[]});
  for(const message of item.composition.gaps)issues.push({id:'source:'+id+':'+message,itemId:id,message:item.name+': '+message,recipeIds:[],dishIds:[]});
  const next=new Set(path).add(id);for(const input of item.composition.inputs)issues.push(...inspect(input.itemId,next).issues);
  const state={ownConfirmed:own(item),complete:issues.length===0,issues:[...new Map(issues.map(issue=>[issue.id,issue])).values()]};states.set(id,state);return state;
 };
 for(const item of menu.items)inspect(item.id,new Set());
 for(const recipe of menu.recipes){
  const issues:CompositionIssue[]=[];if(!recipe.recorded||!recipe.inputs.length)issues.push({id:'recipe:'+recipe.id,recipeId:recipe.id,message:'Own dish list '+(!recipe.inputs.length?'not started':'needs confirmation'),recipeIds:[],dishIds:[]});
  for(const warning of recipe.reviewEvidence?.warnings??[])issues.push({id:'review:'+recipe.id+':'+warning,recipeId:recipe.id,message:warning,recipeIds:[],dishIds:[]});
  for(const input of recipe.inputs)issues.push(...inspect(input.itemId,new Set()).issues);
  recipes.set(recipe.id,{ownConfirmed:recipe.recorded&&recipe.inputs.length>0,complete:issues.length===0,issues:[...new Map(issues.map(issue=>[issue.id,issue])).values()]});
  const reached=new Set<string>();const walk=(id:string,path:string[])=>{if(reached.has(id)){const use=usage.get(id)?.find(use=>use.recipeId===recipe.id);if(use){if(!path.length)use.direct=true;else if(!use.path.length)use.path=path;}return;}reached.add(id);const item=items.get(id);if(!item)return;const uses=usage.get(id)??[];uses.push({dishId:recipe.menuId,recipeId:recipe.id,direct:path.length===0,path});usage.set(id,uses);if(item.kind==='prep')for(const input of item.composition.inputs)walk(input.itemId,[...path,id]);};
  for(const input of recipe.inputs)walk(input.itemId,[]);
 }
 const activeIds=new Set(active.map(recipe=>recipe.id)),issues=new Map<string,CompositionIssue>();
 for(const recipe of active)for(const issue of recipes.get(recipe.id)!.issues){const shared=issues.get(issue.id)??{...issue,recipeIds:[],dishIds:[]};if(!shared.recipeIds.includes(recipe.id))shared.recipeIds.push(recipe.id);if(!shared.dishIds.includes(recipe.menuId))shared.dishIds.push(recipe.menuId);issues.set(issue.id,shared);}
 const currentUses=(id:string)=>(usage.get(id)??[]).filter(use=>activeIds.has(use.recipeId));
 const houseToCheck=menu.items.filter(item=>item.kind==='prep'&&currentUses(item.id).length&&!states.get(item.id)?.ownConfirmed);
 return {items,states,recipes,usage,parents,active,activeIds,currentUses,houseToCheck,complete:active.filter(recipe=>recipes.get(recipe.id)?.complete).length,ownToCheck:active.filter(recipe=>!recipes.get(recipe.id)?.ownConfirmed).length,issues:[...issues.values()].sort((a,b)=>b.recipeIds.length-a.recipeIds.length||a.message.localeCompare(b.message)),referenceIssues:[...issues.values()].filter(issue=>!issue.id.startsWith('own:')&&!issue.id.startsWith('recipe:'))};
}
export type MenuComposition=ReturnType<typeof menuComposition>;
export function compositionMatches(menu:WorkspaceMenu,recipe:WorkspaceMenuRecipe,query:string){
 const q=normalizeName(query);if(!q)return true;const dish=menu.dishes.find(d=>d.id===recipe.menuId);if(normalizeName([dish?.name,recipe.variant,dish?.note].join(' ')).includes(q))return true;
 const byId=new Map(menu.items.map(item=>[item.id,item])),seen=new Set<string>();const visit=(id:string):boolean=>{if(seen.has(id))return false;seen.add(id);const item=byId.get(id);return !!item&&(normalizeName([item.name,...item.aliases].join(' ')).includes(q)||item.kind==='prep'&&item.composition.inputs.some(input=>visit(input.itemId)));};return recipe.inputs.some(input=>visit(input.itemId));
}
export function compositionStateLabel(state:CompositionState|undefined,inputs:RecipeInput[]){return state?.complete?'Complete':!inputs.length?'Not started':!state?.ownConfirmed?'Needs confirmation':'Needs attention';}

export function compositionMatchPaths(menu:WorkspaceMenu,recipe:WorkspaceMenuRecipe,query:string){
 const q=normalizeName(query);if(!q)return [];const items=new Map(menu.items.map(item=>[item.id,item])),matches:string[]=[],visited=new Set<string>();
 const walk=(id:string,path:string[],seen:Set<string>)=>{if(visited.has(id))return;visited.add(id);const item=items.get(id);if(!item)return;const names=[...path,item.name];if(normalizeName([item.name,...item.aliases].join(' ')).includes(q))matches.push(names.join(' → '));if(item.kind==='prep')for(const input of item.composition.inputs)walk(input.itemId,names,new Set(seen).add(id));};
 for(const input of recipe.inputs)walk(input.itemId,[],new Set());return [...new Set(matches)];
}
