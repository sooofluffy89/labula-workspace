import type {Notebook,RecipeInput} from './notebook';
export type RecipeInputRemoval={recipeId:string;part:RecipeInput;index:number;after:string;recorded:boolean};
export function removeRecipeInput(notebook:Notebook,recipeId:string,itemId:string):{notebook:Notebook;ticket?:RecipeInputRemoval}{
 const recipe=notebook.recipes.find(r=>r.id===recipeId),index=recipe?.inputs.findIndex(p=>p.itemId===itemId)??-1;
 if(!recipe||index<0)return {notebook};
 const next={...recipe,inputs:recipe.inputs.filter(p=>p.itemId!==itemId),recorded:false};
 return {notebook:{...notebook,recipes:notebook.recipes.map(r=>r.id===recipeId?next:r)},ticket:{recipeId,part:structuredClone(recipe.inputs[index]),index,after:JSON.stringify(next),recorded:recipe.recorded}};
}
export function restoreRecipeInput(notebook:Notebook,ticket:RecipeInputRemoval):{notebook:Notebook;restored:boolean}{
 const recipe=notebook.recipes.find(r=>r.id===ticket.recipeId);
 if(!recipe||!notebook.items.some(i=>i.id===ticket.part.itemId)||recipe.inputs.some(p=>p.itemId===ticket.part.itemId))return {notebook,restored:false};
 const inputs=[...recipe.inputs];inputs.splice(Math.min(ticket.index,inputs.length),0,ticket.part);
 const next={...recipe,inputs,recorded:JSON.stringify(recipe)===ticket.after?ticket.recorded:recipe.recorded};
 return {notebook:{...notebook,recipes:notebook.recipes.map(r=>r.id===ticket.recipeId?next:r)},restored:true};
}
