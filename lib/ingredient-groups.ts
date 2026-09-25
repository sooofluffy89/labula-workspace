import {z} from 'zod';

export const ingredientGroups=[
 {id:'vegetables',label:'Vegetables, herbs & mushrooms'},
 {id:'pickles',label:'Pickled & fermented vegetables'},
 {id:'meat',label:'Meat & meat preparations'},
 {id:'eggs-tofu',label:'Eggs & tofu'},
 {id:'starches',label:'Noodles, rice, dough & pulses'},
 {id:'broths',label:'Broths & bases'},
 {id:'sauces',label:'Sauces, pastes & dips'},
 {id:'oils',label:'Oils & fats'},
 {id:'seasoning',label:'Seasonings, starches & toppings'},
] as const;
export type IngredientGroupId=(typeof ingredientGroups)[number]['id'];
export const groupIdSchema=z.enum(ingredientGroups.map(g=>g.id) as [IngredientGroupId,...IngredientGroupId[]]).nullable();
export const groupCommandSchema=z.object({id:z.string().uuid(),itemId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),groupId:groupIdSchema}).strict();
export type GroupCommand=z.infer<typeof groupCommandSchema>;
export function validGroup(id:string|null|undefined):IngredientGroupId|null{return ingredientGroups.find(g=>g.id===id)?.id??null;}
export function groupLabel(id:string|null|undefined){return ingredientGroups.find(g=>g.id===id)?.label??'Needs grouping';}
export function groupRows<T extends {groupId:string|null}>(rows:readonly T[]){
 const groups=new Map<string|null,T[]>();
 for(const row of rows){const key=validGroup(row.groupId),group=groups.get(key)??[];group.push(row);groups.set(key,group);}
 return [...ingredientGroups.map(g=>g.id),null].filter(id=>groups.has(id)).map(id=>({id,label:groupLabel(id),rows:groups.get(id)!}));
}
