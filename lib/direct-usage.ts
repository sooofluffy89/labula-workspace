import {menu} from './menu';
import type {Item,Notebook,RecipeInput} from './notebook';

export const directUsageNote='Counts show listed direct use. Unfinished lists and unlisted preparation contents may hide further use.';
export type DirectUsage={dishes:typeof menu;items:Map<string,Item>;dishItems:Map<string,Set<string>>;itemDishes:Map<string,Set<string>>;bought:number;prep:number};
/** A dish is the union of direct inputs in its active variants, regardless of completion. */
export function directUsage(notebook:Notebook,selection?:ReadonlySet<string>):DirectUsage{
 const items=new Map(notebook.items.map(i=>[i.id,i]));const dishItems=new Map<string,Set<string>>();
 for(const r of notebook.recipes){if(!r.active||(selection&&!selection.has(r.menuId)))continue;let ids=dishItems.get(r.menuId);if(!ids){ids=new Set();dishItems.set(r.menuId,ids);}for(const p of r.inputs)if(items.has(p.itemId))ids.add(p.itemId);}
 const dishes=menu.filter(d=>dishItems.has(d.id));const itemDishes=new Map<string,Set<string>>();
 for(const d of dishes)for(const id of dishItems.get(d.id)!){let ids=itemDishes.get(id);if(!ids){ids=new Set();itemDishes.set(id,ids);}ids.add(d.id);}
 let bought=0,prep=0;for(const id of itemDishes.keys()){if(items.get(id)!.kind==='prep')prep++;else bought++;}
 return {dishes,items,dishItems,itemDishes,bought,prep};
}
export function compareUsage(index:DirectUsage,a:string,b:string){return (index.itemDishes.get(b)?.size??0)-(index.itemDishes.get(a)?.size??0)||(index.items.get(a)?.name??a).localeCompare(index.items.get(b)?.name??b,'en')||a.localeCompare(b);}
export function ingredientGroups(index:DirectUsage,menuId:string,inputs:RecipeInput[]){
 const shared:RecipeInput[]=[],only:RecipeInput[]=[],other:RecipeInput[]=[];
 for(const input of inputs){const dishes=index.itemDishes.get(input.itemId);(dishes&&dishes.size>=2?shared:dishes?.size===1&&dishes.has(menuId)?only:other).push(input);}
 for(const group of [shared,only,other])group.sort((a,b)=>compareUsage(index,a.itemId,b.itemId));return {shared,only,other};
}
export function removeInput(inputs:RecipeInput[],id:string){return inputs.filter(p=>p.itemId!==id);}
export function droppedItems(baseline:DirectUsage,scenario:DirectUsage){return [...baseline.itemDishes.keys()].filter(id=>!scenario.itemDishes.has(id)).map(id=>baseline.items.get(id)!).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.id.localeCompare(b.id));}
export function dedicatedPreparations(index:DirectUsage){return index.dishes.map(dish=>{const preparations=[...index.dishItems.get(dish.id)!].map(id=>index.items.get(id)!).filter(i=>i.kind==='prep');const dedicated=preparations.filter(i=>index.itemDishes.get(i.id)?.size===1).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.id.localeCompare(b.id));return {dish,total:preparations.length,dedicated};}).sort((a,b)=>b.dedicated.length-a.dedicated.length||a.dish.name.localeCompare(b.dish.name,'en'));}
export type MenuScenario={selected:string[];known:string[]}|null;
export function scenarioSelection(baseline:DirectUsage,scenario:MenuScenario){const active=new Set(baseline.dishes.map(d=>d.id));return new Set(scenario?scenario.selected.filter(id=>active.has(id)):active);}
export function scenarioNotice(baseline:DirectUsage,scenario:MenuScenario){return !!scenario&&baseline.dishes.some(d=>!scenario.known.includes(d.id));}
