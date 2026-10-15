import {patchDishVariant} from './dish-workspace';
import type {Notebook,RecipeInput} from './notebook';
export type RecipeInputRemoval={recipeId:string;part:RecipeInput;index:number;after:string;recorded:boolean;ingredientsReviewed?:boolean;reviewStatus:Notebook['recipes'][number]['reviewStatus'];workshop?:Notebook['recipes'][number]['workshop']};
export function removeRecipeInput(notebook:Notebook,recipeId:string,itemId:string):{notebook:Notebook;ticket?:RecipeInputRemoval}{
 const recipe=notebook.recipes.find(r=>r.id===recipeId),index=recipe?.inputs.findIndex(p=>p.itemId===itemId)??-1;
 if(!recipe||index<0)return {notebook};
 const changed=patchDishVariant(notebook,recipeId,{inputs:recipe.inputs.filter(p=>p.itemId!==itemId)});const next=changed.recipes.find(r=>r.id===recipeId)!;
 return {notebook:{...notebook,recipes:notebook.recipes.map(r=>r.id===recipeId?next:r)},ticket:{recipeId,part:structuredClone(recipe.inputs[index]),index,after:JSON.stringify(next),recorded:recipe.recorded,ingredientsReviewed:recipe.ingredientsReviewed,reviewStatus:recipe.reviewStatus,workshop:structuredClone(recipe.workshop)}};
}
export function restoreRecipeInput(notebook:Notebook,ticket:RecipeInputRemoval):{notebook:Notebook;restored:boolean}{
 const recipe=notebook.recipes.find(r=>r.id===ticket.recipeId);
 if(!recipe||!notebook.items.some(i=>i.id===ticket.part.itemId)||recipe.inputs.some(p=>p.itemId===ticket.part.itemId))return {notebook,restored:false};
 const inputs=[...recipe.inputs];inputs.splice(Math.min(ticket.index,inputs.length),0,ticket.part);
 const next={...recipe,inputs,...(JSON.stringify(recipe)===ticket.after?{recorded:ticket.recorded,ingredientsReviewed:ticket.ingredientsReviewed,reviewStatus:ticket.reviewStatus,workshop:ticket.workshop}:{})};
 if(next.ingredientsReviewed===undefined)delete next.ingredientsReviewed;if(next.workshop===undefined)delete next.workshop;
 return {notebook:{...notebook,recipes:notebook.recipes.map(r=>r.id===ticket.recipeId?next:r)},restored:true};
}
