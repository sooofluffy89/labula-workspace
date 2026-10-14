import type {Item,Recipe,Notebook} from './notebook';
import {measurement} from './recipe-quantity';

/** A scoped ingredient check never grants process or whole-recipe verification. */
export function ingredientsReviewed(recipe:Recipe):boolean {
 return !!(recipe.recorded&&recipe.inputs.length&&(recipe.ingredientsReviewed??recipe.reviewStatus==='verified'));
}

/** Compare meaning, rather than object key order or explicit legacy defaults. */
export function ingredientContentChanged(before:Recipe,after:Recipe,items:readonly Item[],afterItems:readonly Item[]=items):boolean {
 const parts=(r:Recipe,catalog:readonly Item[])=>r.inputs.map(part=>{
  const item=catalog.find(i=>i.id===part.itemId),m=item?measurement(part,item):null;
  return [part.itemId,m?[m.amount,m.unit,m.pieceMeaning,m.conversion?[m.conversion.from,m.conversion.to,m.conversion.factor]:null]:part,part.note];
 }).sort((a,b)=>String(a[0]).localeCompare(String(b[0])));
 return before.portions!==after.portions||JSON.stringify(parts(before,items))!==JSON.stringify(parts(after,afterItems));
}

/** Apply a catalog edit together with checks invalidated by a changed implicit unit. */
export function withIngredientCatalog(notebook:Notebook,items:Item[]):Notebook {
 return {...notebook,items,recipes:notebook.recipes.map(recipe=>ingredientContentChanged(recipe,recipe,notebook.items,items)?{
  ...recipe,recorded:false,ingredientsReviewed:false,reviewStatus:'unverified' as const,
  ...(recipe.workshop?{workshop:{...recipe.workshop,processChecked:false}}:{}),
 }:recipe)};
}
