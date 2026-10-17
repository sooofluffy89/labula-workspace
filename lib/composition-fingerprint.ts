import type {RecipeInput,Item,Recipe} from './notebook';
/** Content evidence excludes labels and child recipes; those have their own confirmations. */
export function compositionFingerprint(kind:string,inputs:readonly RecipeInput[],items:readonly Pick<Item,'id'|'unit'|'kind'>[],portions?:number|null){
 const content={kind,...(portions!==undefined?{portions}:{}),inputs:inputs.map(input=>{const item=items.find(item=>item.id===input.itemId);return {id:input.itemId,kind:item?.kind??'missing',amount:input.amount,unit:input.unit??item?.unit??null,note:input.note,pieceMeaning:input.pieceMeaning??'',conversion:input.conversion??null};}).sort((a,b)=>a.id.localeCompare(b.id))};
 const text=JSON.stringify(content);let a=2166136261,b=5381;for(let i=0;i<text.length;i++){a=Math.imul(a^text.charCodeAt(i),16777619);b=Math.imul(b,33)^text.charCodeAt(i);}return `${(a>>>0).toString(16)}-${(b>>>0).toString(16)}`;
}
export function recipeCompositionConfirmed(recipe:Pick<Recipe,'recorded'|'inputs'|'portions'|'compositionCheck'>,items:readonly Pick<Item,'id'|'unit'|'kind'>[]){return recipe.recorded&&recipe.inputs.length>0&&(!recipe.compositionCheck||recipe.compositionCheck.fingerprint===compositionFingerprint('dish',recipe.inputs,items,recipe.portions));}
