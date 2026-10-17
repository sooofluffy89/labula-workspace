import {normalizeName,type RecipeInput} from './notebook';
import {workspaceSourceToken,type WorkspaceMenu,type WorkspaceMenuItem,type WorkspaceMenuRecipe} from './workspace-menu';
export type CompositionIssueKind='composition_missing'|'own_list_unchecked'|'missing_reference'|'cycle'|'source_review';
export type CompositionIssue={id:string;kind:CompositionIssueKind;itemId?:string;recipeId?:string;repairItemId?:string;repairRecipeId?:string;path?:string[];message:string;recipeIds:string[];dishIds:string[]};
export type CompositionState={ownConfirmed:boolean;complete:boolean;issues:CompositionIssue[];componentCount:number;dataIssueCount:number;missingCount:number;uncheckedCount:number};
export type CompositionUsage={dishId:string;recipeId:string;direct:boolean;path:string[]};
const dataProblem=(issue:CompositionIssue)=>['missing_reference','cycle','source_review'].includes(issue.kind);
const unique=(issues:CompositionIssue[])=>[...new Map(issues.map(issue=>[issue.id,issue])).values()];
function state(ownConfirmed:boolean,issues:CompositionIssue[],owner?:string):CompositionState{
 const all=unique(issues),components=new Set(all.filter(i=>i.itemId&&i.itemId!==owner&&['composition_missing','own_list_unchecked'].includes(i.kind)).map(i=>i.itemId));
 return {ownConfirmed,complete:all.length===0,issues:all,componentCount:components.size,dataIssueCount:all.filter(dataProblem).length,missingCount:all.filter(i=>i.kind==='composition_missing').length,uncheckedCount:all.filter(i=>i.kind==='own_list_unchecked').length};
}
export function menuComposition(menu:WorkspaceMenu){
 const items=new Map(menu.items.map(item=>[item.id,item])),active=menu.recipes.filter(recipe=>recipe.active&&menu.dishes.some(d=>d.id===recipe.menuId&&d.state==='ready'));
 const usage=new Map<string,CompositionUsage[]>(),parents=new Map<string,string[]>(),states=new Map<string,CompositionState>(),recipes=new Map<string,CompositionState>();
 for(const item of menu.items)if(item.kind==='prep')for(const input of item.composition.inputs){const list=parents.get(input.itemId)??[];if(!list.includes(item.id))list.push(item.id);parents.set(input.itemId,list);}
 const own=(item:WorkspaceMenuItem)=>item.kind==='bought'||!!item.composition.ownConfirmed&&item.composition.inputs.length>0;
 const inspect=(id:string,path:string[],parent?:{itemId?:string;recipeId?:string}):CompositionState=>{
  const item=items.get(id);if(!item)return state(false,[{id:'missing:'+id,kind:'missing_reference',itemId:id,repairItemId:parent?.itemId,repairRecipeId:parent?.recipeId,message:'A component is no longer available. Replace or remove it in its parent list.',recipeIds:[],dishIds:[]}]);
  if(item.kind==='bought')return state(true,[]);
  if(path.includes(id)){const cycle=path.slice(path.indexOf(id)),key=[...cycle].sort().join(':');return state(own(item),[{id:'cycle:'+key,kind:'cycle',itemId:id,repairItemId:cycle[0],path:[...cycle,id],message:'Circular composition: '+[...cycle,id].map(key=>items.get(key)?.name??key).join(' → '),recipeIds:[],dishIds:[]}],id);}
  const cached=states.get(id);if(cached&&!cached.issues.some(i=>i.kind==='cycle'))return cached;
  const issues:CompositionIssue[]=[];
  if(!own(item)&&item.composition.source!=='unavailable')issues.push({id:'own:'+id,kind:item.composition.inputs.length?'own_list_unchecked':'composition_missing',itemId:id,repairItemId:id,message:item.name+': '+(item.composition.inputs.length?'own list to check':'composition missing'),recipeIds:[],dishIds:[]});
  item.composition.gaps.forEach((message,index)=>{const code=item.composition.gapCodes?.[index]??'source_review';if(code==='cycle'||code==='composition_missing'&&!item.composition.inputs.length)return;issues.push({id:'source:'+id+':'+workspaceSourceToken({code,message}),kind:'source_review',itemId:id,repairItemId:id,message:item.name+': '+message,recipeIds:[],dishIds:[]});});
  for(const input of item.composition.inputs)issues.push(...inspect(input.itemId,[...path,id],{itemId:id}).issues);
  const result=state(own(item),issues,id);if(!result.issues.some(i=>i.kind==='cycle'))states.set(id,result);return result;
 };
 for(const item of menu.items)states.set(item.id,inspect(item.id,[]));
 for(const recipe of menu.recipes){
  const issues:CompositionIssue[]=[];if(!recipe.recorded||!recipe.inputs.length)issues.push({id:'recipe:'+recipe.id,kind:recipe.inputs.length?'own_list_unchecked':'composition_missing',recipeId:recipe.id,repairRecipeId:recipe.id,message:!recipe.inputs.length?'Dish composition missing':'Own dish list to check',recipeIds:[],dishIds:[]});
  for(const warning of recipe.reviewEvidence?.warnings??[])issues.push({id:'review:'+recipe.id+':'+workspaceSourceToken(warning),kind:'source_review',recipeId:recipe.id,repairRecipeId:recipe.id,message:warning,recipeIds:[],dishIds:[]});
  for(const input of recipe.inputs)issues.push(...inspect(input.itemId,[],{recipeId:recipe.id}).issues);
  recipes.set(recipe.id,state(recipe.recorded&&recipe.inputs.length>0,issues));
  const reached=new Set<string>();const walk=(id:string,path:string[])=>{if(reached.has(id)){const use=usage.get(id)?.find(use=>use.recipeId===recipe.id);if(use){if(!path.length)use.direct=true;else if(!use.path.length)use.path=path;}return;}reached.add(id);const item=items.get(id);if(!item)return;const uses=usage.get(id)??[];uses.push({dishId:recipe.menuId,recipeId:recipe.id,direct:path.length===0,path});usage.set(id,uses);if(item.kind==='prep')for(const input of item.composition.inputs)walk(input.itemId,[...path,id]);};
  for(const input of recipe.inputs)walk(input.itemId,[]);
 }
 const activeIds=new Set(active.map(recipe=>recipe.id)),issues=new Map<string,CompositionIssue>();
 for(const recipe of active)for(const issue of recipes.get(recipe.id)!.issues){const shared=issues.get(issue.id)??{...issue,recipeIds:[],dishIds:[]};if(!shared.recipeIds.includes(recipe.id))shared.recipeIds.push(recipe.id);if(!shared.dishIds.includes(recipe.menuId))shared.dishIds.push(recipe.menuId);issues.set(issue.id,shared);}
 const currentUses=(id:string)=>(usage.get(id)??[]).filter(use=>activeIds.has(use.recipeId));
 const house=menu.items.filter(item=>item.kind==='prep'&&currentUses(item.id).length),houseToCheck=house.filter(item=>!states.get(item.id)?.ownConfirmed);
 const sorted=[...issues.values()].sort((a,b)=>b.recipeIds.length-a.recipeIds.length||Number(dataProblem(b))-Number(dataProblem(a))||a.message.localeCompare(b.message));
 const repairQueue=[...house].filter(item=>!states.get(item.id)?.complete).sort((a,b)=>currentUses(b.id).length-currentUses(a.id).length||a.name.localeCompare(b.name));
 return {items,states,recipes,usage,parents,active,activeIds,currentUses,house,houseToCheck,repairQueue,houseChecked:house.length-houseToCheck.length,houseMissing:house.filter(i=>!i.composition.inputs.length&&i.composition.source!=='unavailable').length,houseUnchecked:houseToCheck.filter(i=>i.composition.inputs.length).length,complete:active.filter(recipe=>recipes.get(recipe.id)?.complete).length,ownToCheck:active.filter(recipe=>!recipes.get(recipe.id)?.ownConfirmed).length,issues:sorted,referenceIssues:sorted.filter(dataProblem)};
}
export type MenuComposition=ReturnType<typeof menuComposition>;
export function compositionMatches(menu:WorkspaceMenu,recipe:WorkspaceMenuRecipe,query:string){
 const q=normalizeName(query);if(!q)return true;const dish=menu.dishes.find(d=>d.id===recipe.menuId);if(normalizeName([dish?.name,recipe.variant,dish?.note].join(' ')).includes(q))return true;
 const byId=new Map(menu.items.map(item=>[item.id,item])),seen=new Set<string>();const visit=(id:string):boolean=>{if(seen.has(id))return false;seen.add(id);const item=byId.get(id);return !!item&&(normalizeName([item.name,...item.aliases].join(' ')).includes(q)||item.kind==='prep'&&item.composition.inputs.some(input=>visit(input.itemId)));};return recipe.inputs.some(input=>visit(input.itemId));
}
export function compositionStateLabel(state:CompositionState|undefined,inputs:RecipeInput[]){return state?.dataIssueCount?`${state.dataIssueCount} data ${state.dataIssueCount===1?'issue':'issues'}`:state?.complete?'Complete':!inputs.length?'Composition missing':!state?.ownConfirmed?'Own list to check':state.componentCount?`${state.componentCount} ${state.componentCount===1?'component':'components'} to complete`:'Own list to check';}
export function compositionSummary(state:CompositionState|undefined,inputs:RecipeInput[]){if(!state)return '';return [!inputs.length?'Composition missing':state.ownConfirmed?'Own list checked':'Own list to check',state.componentCount?`${state.componentCount} house-made ${state.componentCount===1?'component needs':'components need'} completion`:'',state.dataIssueCount?`${state.dataIssueCount} data ${state.dataIssueCount===1?'issue':'issues'}`:''].filter(Boolean).join(' · ');}
export function compositionMatchPaths(menu:WorkspaceMenu,recipe:WorkspaceMenuRecipe,query:string){
 const q=normalizeName(query);if(!q)return [];const items=new Map(menu.items.map(item=>[item.id,item])),matches:string[]=[],visited=new Set<string>();
 const walk=(id:string,path:string[])=>{if(visited.has(id))return;visited.add(id);const item=items.get(id);if(!item)return;const names=[...path,item.name];if(normalizeName([item.name,...item.aliases].join(' ')).includes(q))matches.push(names.join(' → '));if(item.kind==='prep')for(const input of item.composition.inputs)walk(input.itemId,names);};
 for(const input of recipe.inputs)walk(input.itemId,[]);return [...new Set(matches)];
}
