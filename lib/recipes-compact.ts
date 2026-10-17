import {normalizeName,type Notebook} from './notebook';
import {patchDishVariant} from './dish-workspace';
import type {WorkspaceMenu,WorkspaceMenuRecipe} from './workspace-menu';

export type ListState='empty'|'progress'|'confirmed'|'inactive';
export type RecipeFilters={query:string;scope:'current'|'all'|'off'|'archived';category:string;state:'all'|ListState};
export type RecipeRow={recipe:WorkspaceMenuRecipe;dish:WorkspaceMenu['dishes'][number];state:ListState;houseMade:number};
export const listLabels:Record<ListState,string>={empty:'Empty',progress:'In progress',confirmed:'List confirmed',inactive:'Inactive'};
export function compactRecipeRows(menu:WorkspaceMenu):RecipeRow[]{
 const items=new Map(menu.items.map(item=>[item.id,item]));
 return menu.dishes.flatMap(dish=>menu.recipes.filter(recipe=>recipe.menuId===dish.id).map(recipe=>({recipe,dish,
  state:(dish.state!=='ready'||!recipe.active?'inactive':!recipe.inputs.length?'empty':recipe.recorded?'confirmed':'progress') as ListState,
  houseMade:recipe.inputs.filter(part=>items.get(part.itemId)?.kind==='prep').length,
 })));
}
export function filterRecipeRows(rows:RecipeRow[],filters:RecipeFilters,menu:WorkspaceMenu):RecipeRow[]{
 const query=normalizeName(filters.query),items=new Map(menu.items.map(item=>[item.id,item]));
 return rows.filter(({recipe,dish,state})=>{
  const active=state!=='inactive';
  const scope=filters.scope==='archived'?dish.state==='archived':dish.state!=='archived'&&(filters.scope==='all'||filters.scope==='current'&&active||filters.scope==='off'&&!active);
  const names=[dish.name,recipe.variant,...recipe.inputs.flatMap(part=>{const item=items.get(part.itemId);return item?[item.name,...item.aliases]:[];})];
  return scope&&(filters.category==='all'||dish.category===filters.category)&&(filters.state==='all'||state===filters.state)&&normalizeName(names.join(' ')).includes(query);
 });
}
export function toggleRecipeSelection(selected:readonly string[],ids:readonly string[],checked:boolean){return checked?[...new Set([...selected,...ids])]:selected.filter(id=>!ids.includes(id));}
export type RecipeBulkAction='on'|'off'|'reopen';
export type RecipeBulkPreview={action:RecipeBulkAction;ids:string[];revision:number;base:string;rows:{id:string;dish:string;variant:string;before:string;after:string;changed:boolean}[];activeDishesBefore:number;activeDishesAfter:number;leavingDishes:string[]};
function activeDishes(n:Notebook){return n.dishes.filter(dish=>dish.state==='ready'&&n.recipes.some(recipe=>recipe.menuId===dish.id&&recipe.active));}
export function buildRecipePreview(n:Notebook,ids:readonly string[],action:RecipeBulkAction,revision:number):RecipeBulkPreview{
 const unique=[...new Set(ids)];if(!unique.length)throw Error('Select at least one recipe variant.');
 let next=n;
 const rows=unique.map(id=>{
  const recipe=n.recipes.find(recipe=>recipe.id===id),dish=n.dishes.find(dish=>dish.id===recipe?.menuId);
  if(!recipe||!dish)throw Error('A selected variant is unavailable. Review the selection before continuing.');
  if(action==='on'&&dish.state!=='ready')throw Error(`“${dish.name}” is ${dish.state}. Use its existing Add to menu or Restore action first.`);
  const before=action==='reopen'?(recipe.recorded?'List confirmed':'List open'):(recipe.active?'On menu':'Off menu');
  const after=action==='reopen'?'List open':action==='on'?'On menu':'Off menu';
  if(before!==after)next=patchDishVariant(next,id,action==='reopen'?{recorded:false}:{active:action==='on'});
  return {id,dish:dish.name,variant:recipe.variant,before,after,changed:before!==after};
 });
 const before=activeDishes(n),after=activeDishes(next);
 return {action,ids:unique,revision,base:JSON.stringify(n),rows,activeDishesBefore:before.length,activeDishesAfter:after.length,leavingDishes:before.filter(dish=>!after.some(other=>other.id===dish.id)).map(dish=>dish.name)};
}
export function applyRecipePreview(n:Notebook,preview:RecipeBulkPreview,revision:number):Notebook{
 if(revision!==preview.revision||JSON.stringify(n)!==preview.base)throw Error('The notebook changed after this preview. Refresh the preview before applying it.');
 return preview.rows.filter(row=>row.changed).reduce((current,row)=>patchDishVariant(current,row.id,preview.action==='reopen'?{recorded:false}:{active:preview.action==='on'}),n);
}
