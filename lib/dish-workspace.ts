import {normalizeName,type Notebook,type Recipe,type RecipeInput} from './notebook';
import type {Category} from './menu';
import {ingredientContentChanged,ingredientsReviewed} from './ingredient-review';

export function dishOnMenu(n:Notebook,id:string){return n.dishes.some(d=>d.id===id&&d.state==='ready')&&n.recipes.some(r=>r.menuId===id&&r.active);}
function named(value:string,label:string){const name=value.trim();if(!name||name.length>160)throw new Error(`Enter a ${label} of 1–160 characters.`);return name;}
export function emptyDishVariant(menuId:string,variant='Standard'):Recipe{return {id:crypto.randomUUID(),menuId,variant:named(variant,'variant name'),portions:null,inputs:[],notes:'',active:false,recorded:false,reviewStatus:'unverified',reviewNote:'',weekdayPortions:null,busyPortions:null};}
export function addDish(n:Notebook,name:string,category:Category,copyId?:string):{notebook:Notebook;id:string}{
 const title=named(name,'dish name');if(n.dishes.some(d=>normalizeName(d.name)===normalizeName(title)))throw new Error('A dish with this name already exists. Choose a different name.');
 const source=copyId?n.dishes.find(d=>d.id===copyId):undefined;if(copyId&&!source)throw new Error('The source dish no longer exists.');
 const id=crypto.randomUUID();const recipes=source?n.recipes.filter(r=>r.menuId===copyId).map(r=>({...r,id:crypto.randomUUID(),menuId:id,inputs:r.inputs.map(p=>({...p})),...(r.workshop?{workshop:{...structuredClone(r.workshop),processChecked:false}}:{}),active:false,recorded:false,ingredientsReviewed:false,reviewStatus:'unverified' as const})):[emptyDishVariant(id)];
 return {id,notebook:{...n,dishes:[...n.dishes,{id,name:title,category,note:source?.note??'',state:'draft'}],recipes:[...n.recipes,...recipes]}};
}
export function updateDish(n:Notebook,id:string,patch:{name?:string;category?:Category;note?:string}):Notebook{
 if(!n.dishes.some(d=>d.id===id))throw new Error('This dish no longer exists.');
 const name=patch.name===undefined?undefined:named(patch.name,'dish name');if(name&&n.dishes.some(d=>d.id!==id&&normalizeName(d.name)===normalizeName(name)))throw new Error('A dish with this name already exists.');
 return {...n,dishes:n.dishes.map(d=>d.id===id?{...d,...patch,...(name?{name}:{})}:d)};
}
export function setDishMenu(n:Notebook,id:string,active:boolean,promoteDraft=false):Notebook{
 const dish=n.dishes.find(d=>d.id===id);if(!dish)throw new Error('This dish no longer exists.');if(dish.state==='archived')throw new Error('Restore this dish before adding it to the menu.');if(active&&dish.state==='draft'&&!promoteDraft)throw new Error('Use Add to menu to activate this draft intentionally.');
 return {...n,dishes:n.dishes.map(d=>d.id===id&&active?{...d,state:'ready'}:d),recipes:n.recipes.map(r=>r.menuId===id?{...r,active}:r)};
}
export function archiveDish(n:Notebook,id:string,archive=true):Notebook{
 if(!n.dishes.some(d=>d.id===id))throw new Error('This dish no longer exists.');
 return {...n,dishes:n.dishes.map(d=>d.id===id?{...d,state:archive?'archived':'ready'}:d),recipes:n.recipes.map(r=>r.menuId===id?{...r,active:false}:r)};
}
export function addDishVariant(n:Notebook,id:string,name:string):Notebook{
 const dish=n.dishes.find(d=>d.id===id);if(!dish||dish.state==='archived')throw new Error('Restore this dish before adding a variant.');const variant=named(name,'variant name');if(n.recipes.some(r=>r.menuId===id&&normalizeName(r.variant)===normalizeName(variant)))throw new Error('That variant already exists for this dish.');return {...n,recipes:[...n.recipes,emptyDishVariant(id,variant)]};
}
export function patchDishVariant(n:Notebook,id:string,patch:Partial<Recipe>):Notebook{
 const recipe=n.recipes.find(r=>r.id===id);if(!recipe)throw new Error('This variant no longer exists.');const dish=n.dishes.find(d=>d.id===recipe.menuId);if(patch.active&&dish?.state!=='ready')throw new Error('Add the dish to the menu before activating a variant.');
 if(patch.variant!==undefined){patch={...patch,variant:named(patch.variant,'variant name')};if(n.recipes.some(r=>r.id!==id&&r.menuId===recipe.menuId&&normalizeName(r.variant)===normalizeName(patch.variant!)))throw new Error('That variant already exists for this dish.');}
 const ingredientsChanged=ingredientContentChanged(recipe,{...recipe,...patch},n.items);
 const processChanged=patch.workshop!==undefined&&JSON.stringify([patch.workshop.steps,patch.workshop.beforeMinutes,patch.workshop.orderMinutes,patch.workshop.beforeTiming,patch.workshop.orderTiming])!==JSON.stringify([recipe.workshop?.steps??[],recipe.workshop?.beforeMinutes??null,recipe.workshop?.orderMinutes??null,recipe.workshop?.beforeTiming,recipe.workshop?.orderTiming])||patch.notes!==undefined&&patch.notes!==recipe.notes;
 const workshop=patch.workshop??recipe.workshop;
 return {...n,recipes:n.recipes.map(r=>r.id===id?{...r,...patch,...(ingredientsChanged?{recorded:false,ingredientsReviewed:false}:patch.recorded===false?{ingredientsReviewed:false}:patch.ingredientsReviewed===undefined&&recipe.ingredientsReviewed===undefined&&ingredientsReviewed(recipe)&&(processChanged||patch.reviewStatus!==undefined&&patch.reviewStatus!==recipe.reviewStatus)?{ingredientsReviewed:true}:{}),...(ingredientsChanged||processChanged?{reviewStatus:'unverified' as const,...(workshop?{workshop:{...workshop,processChecked:false}}:{})}:{})}:r)};
}
export function appendRecipeInputs(inputs:RecipeInput[],ids:readonly string[]):RecipeInput[]{const existing=new Set(inputs.map(p=>p.itemId));const next=[...inputs];for(const itemId of ids)if(!existing.has(itemId)){existing.add(itemId);next.push({itemId,amount:null,note:''});}if(next.length>150)throw new Error('A recipe can contain up to 150 items.');return next;}
export function replaceRecipeInput(inputs:RecipeInput[],source:string,target:string):RecipeInput[]{if(source===target)return inputs;if(!inputs.some(p=>p.itemId===source))throw new Error('The ingredient to replace is no longer in this recipe.');if(inputs.some(p=>p.itemId===target))throw new Error('That ingredient is already in this recipe. Remove or edit its existing entry.');return inputs.map(p=>p.itemId===source?{...p,itemId:target}:p);}
export function restoreRecipeInput(inputs:RecipeInput[],part:RecipeInput,index:number):RecipeInput[]{if(inputs.some(p=>p.itemId===part.itemId))return inputs;const next=[...inputs];next.splice(Math.min(Math.max(index,0),next.length),0,{...part});if(next.length>150)throw new Error('A recipe can contain up to 150 items.');return next;}
