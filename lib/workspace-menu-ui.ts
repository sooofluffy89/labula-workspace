import {newItem,normalizeName,safeCsvCell,validateNotebook,type Notebook,type RecipeInput,type Item,type Dish} from './notebook';
import {addDish,addDishVariant,patchDishVariant,updateDish} from './dish-workspace';
import type {WorkspaceMenu} from './workspace-menu';

export type MenuSelection={view:'dishes'|'house-made'|'ingredients';dishId?:string;variantId?:string;itemId?:string;itemPath?:string[];query?:string;kind?:'all'|'bought'|'prep';scope?:'current'|'all'|'off'|'archived';checkedOnly?:boolean};
export function menuItemSelection(current:MenuSelection,id:string):MenuSelection{return {...current,itemId:id,itemPath:current.itemId&&current.itemId!==id?[...(current.itemPath??[]),current.itemId]:current.itemPath};}
export function menuParentSelection(current:MenuSelection):MenuSelection{const parent=current.itemPath?.at(-1);if(parent)return {...current,itemId:parent,itemPath:current.itemPath!.length>1?current.itemPath!.slice(0,-1):undefined};if(current.itemId&&current.dishId)return {...current,itemId:undefined,itemPath:undefined};return {...current,itemId:undefined,itemPath:undefined,dishId:undefined,variantId:undefined};}
export function menuDishes(menu:WorkspaceMenu,selection:MenuSelection){
 const scope=selection.scope??'current',query=normalizeName(selection.query??'');
 return menu.dishes.filter(d=>{
  const recipes=menu.recipes.filter(r=>r.menuId===d.id),active=d.state==='ready'&&recipes.some(r=>r.active);
  return (scope==='archived'?d.state==='archived':scope==='all'?d.state!=='archived':scope==='off'?d.state!=='archived'&&!active:active)&&normalizeName([d.name,d.note??'',...recipes.map(r=>r.variant)].join(' ')).includes(query);
 });
}
export function menuItems(menu:WorkspaceMenu,selection:MenuSelection,checkedIds?:Set<string>){
 const active=new Set(menu.recipes.filter(r=>r.active&&menu.dishes.some(d=>d.id===r.menuId&&d.state==='ready')).map(r=>r.id));
 const query=normalizeName(selection.query??''),scope=selection.scope??'current';
 return menu.items.filter(item=>{
  const used=item.usedIn.some(u=>u.recipeIds.some(id=>active.has(id)));
  return (selection.view!=='house-made'||item.kind==='prep')&&(!selection.kind||selection.kind==='all'||item.kind===selection.kind)&&(scope==='all'||scope==='current'&&used||scope==='off'&&!used)&&(!selection.checkedOnly||checkedIds?.has(item.id))&&normalizeName([item.name,...item.aliases].join(' ')).includes(query);
 }).sort((a,b)=>a.name.localeCompare(b.name,'en'));
}
export function recipeBasis(portions:number|null){return portions===null?'Full recipe · portions not recorded':portions===1?'Per portion':`For ${portions} portions`;}
export function itemBasis(amount:number|null,unit:string){return amount===null?'Full batch · yield not recorded':`For a ${amount} ${unit} batch`;}
export function menuViewCsv(menu:WorkspaceMenu,selection:MenuSelection,checkedIds?:Set<string>){
 const rows:unknown[][]=[];
 if(selection.view!=='dishes'){
  rows.push(['Item','Origin','Base unit','Dish use','Batch yield','Composition source']);
  for(const item of menuItems(menu,selection,checkedIds))rows.push([item.name,item.kind==='prep'?'House-made':'Bought',item.unit,item.usedIn.map(u=>u.name).join('; '),item.yieldAmount,item.composition.sourceLabel]);
 }else{
  rows.push(['Dish','Variant','On menu','Recipe portions','Ingredient','Amount','Entered unit','Piece meaning','Conversion','Note']);
  for(const dish of menuDishes(menu,selection))for(const recipe of menu.recipes.filter(r=>r.menuId===dish.id&&((selection.scope??'current')!=='current'||r.active))){if(!recipe.inputs.length)rows.push([dish.name,recipe.variant,recipe.active,recipe.portions,'','','','','','Composition not recorded']);for(const input of recipe.inputs){const item=menu.items.find(i=>i.id===input.itemId);rows.push([dish.name,recipe.variant,recipe.active,recipe.portions,item?.name??input.itemId,input.amount,input.unit??item?.unit??'',input.pieceMeaning??'',input.conversion?`1 ${input.conversion.from} = ${input.conversion.factor} ${input.conversion.to}`:'',input.note]);}}
 }
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}
export function formatMenuAmount(part:RecipeInput,item?:{unit:string}){return part.amount===null?'Amount not recorded':`${part.amount} ${part.unit??item?.unit??''}`.trim();}
export function parseOptionalAmount(value:string,label='Amount'):number|null{
 if(!value.trim())return null;
 const amount=Number(value.trim().replace(',','.'));
 if(!Number.isFinite(amount)||amount<=0||amount>1e9)throw Error(`${label}: enter a number greater than zero, or leave it blank if unknown.`);
 return amount;
}
export type InputDraft=Omit<RecipeInput,'amount'>&{amount:string};
export const draftInputs=(inputs:RecipeInput[]):InputDraft[]=>inputs.map(p=>({...p,amount:p.amount===null?'':String(p.amount)}));
export const readInputs=(inputs:InputDraft[]):RecipeInput[]=>inputs.map((p,index)=>({...p,amount:parseOptionalAmount(p.amount,`Ingredient ${index+1} amount`)}));
export function dishEditBase(n:Notebook,dishId:string,recipeId:string){
 const dish=n.dishes.find(d=>d.id===dishId),recipe=n.recipes.find(r=>r.id===recipeId&&r.menuId===dishId);
 if(!dish||!recipe)throw Error('This dish or variant is no longer available. Your draft is kept.');
 return {name:dish.name,category:dish.category,note:dish.note??'',variant:recipe.variant,portions:recipe.portions,inputs:recipe.inputs,notes:recipe.notes,steps:structuredClone(recipe.workshop?.steps??[])};
}
export type DishEditBase=ReturnType<typeof dishEditBase>;
export type DishEditDraft=Omit<DishEditBase,'portions'|'inputs'>&{portions:string;inputs:InputDraft[]};
export function saveDishEdit(n:Notebook,dishId:string,recipeId:string,base:DishEditBase,draft:DishEditDraft,canManage=true){
 if(JSON.stringify(dishEditBase(n,dishId,recipeId))!==JSON.stringify(base))throw Error('This dish changed while you were editing. Your draft is kept. Compare the current recipe before saving.');
 if(!canManage)return patchDishVariant(n,recipeId,{inputs:readInputs(draft.inputs)});
 const recipe=n.recipes.find(r=>r.id===recipeId)!;
 const workshop=JSON.stringify(draft.steps)!==JSON.stringify(base.steps)?{...(recipe.workshop??{beforeMinutes:null,orderMinutes:null,processChecked:false,decisions:[]}),steps:draft.steps}:recipe.workshop;
 return patchDishVariant(updateDish(n,dishId,{name:draft.name,category:draft.category,note:draft.note}),recipeId,{variant:draft.variant,portions:parseOptionalAmount(draft.portions,'Recipe portions'),inputs:readInputs(draft.inputs),notes:draft.notes,...(workshop?{workshop}:{})});
}

export type MenuCreation={kind:'item';id:string;name:string;itemKind:Item['kind'];unit:Item['unit']}|{kind:'dish';id:string;name:string;category:Dish['category']}|{kind:'variant';id:string;name:string;dishId:string};
export function menuCreationExists(n:Notebook,kind:MenuCreation['kind'],id:string){return (kind==='item'?n.items:kind==='dish'?n.dishes:n.recipes).some(record=>record.id===id);}
/** The identity belongs to the durable form, including the first standard variant of a dish. */
export function prepareMenuCreation(n:Notebook,creation:MenuCreation):Notebook{
 if(menuCreationExists(n,creation.kind,creation.id))return n;
 if(creation.kind==='item')return validateNotebook({...n,items:[...n.items,{...newItem(creation.name,creation.itemKind,creation.unit),id:creation.id}]});
 if(creation.kind==='dish'){
  const added=addDish(n,creation.name,creation.category);
  return validateNotebook({...added.notebook,dishes:added.notebook.dishes.map(d=>d.id===added.id?{...d,id:creation.id}:d),recipes:added.notebook.recipes.map(r=>r.menuId===added.id?{...r,id:`${creation.id}-standard`,menuId:creation.id}:r)});
 }
 const added=addDishVariant(n,creation.dishId,creation.name),newId=added.recipes.at(-1)!.id;
 return validateNotebook({...added,recipes:added.recipes.map(r=>r.id===newId?{...r,id:creation.id}:r)});
}
/** Persist intent before any notebook mutation; never mistake a local close failure for a failed creation. */
export async function commitMenuCreation(options:{id:string;submittedId:string;prepare:()=>Notebook;persistIntent:(id:string)=>boolean;apply:(transform:(current:Notebook)=>Notebook)=>void;hasCurrent:(id:string)=>boolean;flush:()=>Promise<boolean>;hasSaved:(id:string)=>boolean;closeDraft:()=>boolean}){
 const id=options.submittedId||options.id;
 if(options.submittedId){if(!options.hasCurrent(id))throw Error('This earlier request needs recovery. Open Settings → Data & backup and review the saved notebook draft before retrying. This form is kept.');}
 else{
  const next=options.prepare();if(!options.persistIntent(id))throw Error('The creation was not started because its recovery draft could not be stored. Free browser space and retry.');
  let reachedMutation=false;
  try{options.apply(()=>{reachedMutation=true;return next;});}
  catch(error){
   // useNotebook checks its locks before invoking this transform. Only that
   // known rejection can release intent; a possibly applied change stays protected.
   if(!reachedMutation&&!options.persistIntent(''))throw Error('The notebook did not start this creation, but its local request marker could not be reset. Your text and stable identity are kept. Download this draft before freeing browser storage.');
   throw error;
  }
 }
 if(!await options.flush())throw Error('The save is not confirmed. Keep this draft and retry the original save.');
 if(!options.hasSaved(id))throw Error('The earlier creation is not confirmed. Recover the notebook draft from Settings → Data & backup. This form is kept.');
 return {id,draftClosed:options.closeDraft()};
}
