import { z } from 'zod';
import { menu } from './menu';
import {profileSchema,emptyProfile,validateProfile} from './prep-profile';
import {baseInputAmount,inputUnit,measurementText} from './recipe-quantity';
import {ingredientsReviewed} from './ingredient-review';

const amount = z.number().finite().positive().max(1e9).nullable();
const nonnegative = z.number().finite().min(0).max(1e9).nullable();
const text = z.string().max(6000);
export const itemNameSchema = z.string().trim().min(1, 'Enter an item name before continuing.').max(160, 'Shorten the item name to 160 characters or fewer. Your text has been kept.');
export const units = ['g', 'ml', 'pcs'] as const;
export const inputSchema = z.object({ itemId:z.string().min(1).max(100), amount, note:text,unit:z.enum(units).optional(),pieceMeaning:z.string().max(300).optional(),conversion:z.object({from:z.enum(units),to:z.enum(units),factor:z.number().finite().positive().max(1e9)}).nullable().optional() });
export const reviewStatusSchema=z.enum(['unverified','verified','needs-review']);
export const timingSchema=z.object({basis:z.enum(['unknown','batch','portion','order']),portions:amount,evidence:z.enum(['unknown','estimate','measured'])});
export const workshopSchema=z.object({steps:z.array(z.object({id:z.string().min(1).max(100),phase:z.enum(['before','order']),text:z.string().max(6000)})).max(100),beforeMinutes:nonnegative,orderMinutes:nonnegative,beforeTiming:timingSchema.optional(),orderTiming:timingSchema.optional(),processChecked:z.boolean(),decisions:z.array(z.object({id:z.string().min(1).max(100),text:z.string().trim().min(1).max(6000),kind:z.enum(['decision','test']),done:z.boolean()})).max(100)});
export type RecipeWorkshop=z.infer<typeof workshopSchema>;
export const dishSchema=z.object({id:z.string().min(1).max(100),name:itemNameSchema,category:z.enum(['Starters','Main Dishes','Specials']),note:text.optional(),state:z.enum(['draft','ready','archived'])});
export const processSchema=z.object({id:z.string().min(1).max(100),name:itemNameSchema,inputs:z.array(inputSchema).max(150),outputs:z.array(inputSchema).min(1).max(150),method:text,activeMinutes:nonnegative,passiveMinutes:nonnegative,batchesPerWeek:amount,externalUse:z.boolean(),reviewStatus:reviewStatusSchema,reviewNote:text,sourceReviewId:z.string().max(160).nullable()});
export const savedScenarioSchema=z.object({id:z.string().uuid(),name:itemNameSchema,recipeIds:z.array(z.string().min(1).max(100)).max(500),fingerprint:z.string().max(100),updatedAt:z.string().max(100)});
export type Dish=z.infer<typeof dishSchema>;
export type ProductionProcess=z.infer<typeof processSchema>;
export type SavedMenuScenario=z.infer<typeof savedScenarioSchema>;
export const storageSchema = z.object({
  condition:z.enum(['unknown','chilled','frozen','dry','fresh']), temperatureC:z.number().finite().min(-100).max(100).nullable(),
  container:text, qualityHours:amount, safetyHours:amount, evidence:z.enum(['unknown','estimate','documented']), reference:text,
  cooling:text, afterOpeningHours:amount, thawing:text,
});
export const itemSchema = z.object({
  id:z.string().min(1).max(100), name:itemNameSchema, aliases:z.array(itemNameSchema).max(30), kind:z.enum(['bought','prep']), unit:z.enum(units),
  specification:text, inputs:z.array(inputSchema).max(150), yieldAmount:amount, activeMinutes:nonnegative, passiveMinutes:nonnegative,
  frequencyHours:amount, batchMinimum:amount, batchMaximum:amount, method:text, storage:storageSchema, prepProfile:profileSchema,
  supplier:z.string().max(600).default(''),packLabel:z.string().max(200).default(''),packAmount:amount.default(null),externalUse:z.boolean().default(false),reviewStatus:reviewStatusSchema.default('unverified'),reviewNote:text.default(''),
});
export const recipeSchema = z.object({ id:z.string().min(1).max(100), menuId:z.string().min(1).max(100), variant:z.string().trim().min(1).max(160),
  portions:amount, inputs:z.array(inputSchema).max(150), notes:text, active:z.boolean(), recorded:z.boolean(), weekdayPortions:nonnegative, busyPortions:nonnegative,
  reviewStatus:reviewStatusSchema.default('unverified'),reviewNote:text.default(''),
  workshop:workshopSchema.optional(),ingredientsReviewed:z.boolean().optional(),
});
export const notebookSchema = z.object({schemaVersion:z.literal(4),reviewSourceRevision:z.string().max(100).optional(),dishes:z.array(dishSchema).max(500),processes:z.array(processSchema).max(1000),scenarios:z.array(savedScenarioSchema).max(100), distinctPairs:z.array(z.tuple([z.string(),z.string()])).max(5000), items:z.array(itemSchema).max(1000), recipes:z.array(recipeSchema).max(500), equipment:z.object({blastChiller:z.enum(['unknown','yes','no']),notes:text})});
export type RecipeInput = z.infer<typeof inputSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Notebook = z.infer<typeof notebookSchema>;
export const normalizeName = (s:string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function validationMessage(error:unknown):string { if(error instanceof z.ZodError)return 'Check the item names and entered values. Names must be 1–160 characters; a recipe can contain up to 150 items and the catalog up to 1,000 items.';return error instanceof Error?error.message:'Please check the recipe details and try again.'; }
export function newItem(name:string,kind:Item['kind']='bought',unit:Item['unit']='g'):Item { return {
 id:crypto.randomUUID(),name:name.trim(),aliases:[],kind,unit,specification:'',inputs:[],yieldAmount:null,activeMinutes:null,passiveMinutes:null,frequencyHours:null,batchMinimum:null,batchMaximum:null,method:'',
 storage:{condition:'unknown',temperatureC:null,container:'',qualityHours:null,safetyHours:null,evidence:'unknown',reference:'',cooling:'',afterOpeningHours:null,thawing:''},prepProfile:emptyProfile(),supplier:'',packLabel:'',packAmount:null,externalUse:false,reviewStatus:'unverified',reviewNote:'',
}; }
export function initialNotebook():Notebook { return {schemaVersion:4,dishes:menu.map(({variants:_,...d})=>({...d,state:'ready'})),processes:[],scenarios:[],distinctPairs:[],items:[],equipment:{blastChiller:'unknown',notes:''},recipes:menu.flatMap(d=>(d.variants??['Standard']).map((variant,i)=>({id:`${d.id}-v${i+1}`,menuId:d.id,variant,portions:null,inputs:[],notes:'',active:true,recorded:false,weekdayPortions:null,busyPortions:null,reviewStatus:'unverified',reviewNote:''})))}; }
export function completeRecipe(r:Recipe):boolean { return r.inputs.length>0; }
export function hasRecipeQuantities(r:Recipe):boolean { return completeRecipe(r) && r.portions!==null && r.inputs.every(i=>i.amount!==null); }
export function recipeTitle(r:Recipe,n?:Pick<Notebook,'dishes'>):string { const dish=(n?.dishes??menu).find(m=>m.id===r.menuId);return `${dish?.name??r.menuId}${r.variant==='Standard'?'':` · ${r.variant}`}`; }
export function validateNotebook(input:unknown):Notebook {
 const n=notebookSchema.parse(input);const ids=new Set<string>();const names=new Set<string>();
 const dishes=new Map<string,Dish>(),dishNames=new Set<string>();for(const d of n.dishes){if(dishes.has(d.id))throw Error('Duplicate dish ID.');if(dishNames.has(normalizeName(d.name)))throw Error('That dish name already exists.');dishes.set(d.id,d);dishNames.add(normalizeName(d.name));}
 for(const i of n.items){validateProfile(i.prepProfile);if(ids.has(i.id))throw new Error('Duplicate item ID.');ids.add(i.id);for(const label of [i.name,...i.aliases]){const name=normalizeName(label);if(!name)throw new Error('Enter an item name.');if(names.has(name))throw new Error(`“${label}” already exists as an item name or alternative name. Use the existing item.`);names.add(name);}
  if(i.kind==='bought' && i.inputs.length)throw new Error('Bought ingredients cannot contain a prep recipe.');
  if(i.batchMinimum!==null&&i.batchMaximum!==null&&i.batchMinimum>i.batchMaximum)throw new Error(`Minimum batch exceeds maximum for ${i.name}.`);
  if(i.storage.evidence==='documented' && (i.storage.safetyHours===null||!i.storage.reference.trim()))throw new Error(`Add a safety limit and its document reference for ${i.name}.`);
 }
 const checkInputs=(inputs:RecipeInput[])=>{const seen=new Set<string>();for(const i of inputs){if(!ids.has(i.itemId))throw new Error('An ingredient no longer exists.');if(seen.has(i.itemId))throw new Error('An ingredient is listed twice in one recipe. Keep one entry for each ingredient.');seen.add(i.itemId);const item=n.items.find(item=>item.id===i.itemId)!;if(i.conversion&&(i.conversion.from!==inputUnit(i,item)||i.conversion.to!==item.unit||i.conversion.from===i.conversion.to))throw Error('The saved conversion must match this recipe unit and the current catalog base unit.');}};
 const rids=new Set<string>();const variantKeys=new Set<string>();
 for(const r of n.recipes){const d=dishes.get(r.menuId);if(!d)throw new Error('Unknown menu dish.');if(r.active&&d.state!=='ready')throw Error('Only ready dishes may be on the menu.');if(rids.has(r.id))throw new Error('Duplicate recipe ID.');rids.add(r.id);const key=r.menuId+':'+normalizeName(r.variant);if(variantKeys.has(key))throw new Error('That variant already exists for this dish.');variantKeys.add(key);checkInputs(r.inputs);if(r.recorded&&!completeRecipe(r))throw new Error('Add the ingredient list before marking a recipe recorded.');if(r.reviewStatus==='verified'&&(!r.recorded||!r.inputs.length))throw Error('Verify the complete ingredient list first.');}
 for(const r of n.recipes)if(r.ingredientsReviewed&&(!r.recorded||!r.inputs.length))throw Error('Check the complete ingredient list before marking ingredients reviewed.');
 for(const r of n.recipes)if(r.workshop){const w=r.workshop;if(new Set(w.steps.map(s=>s.id)).size!==w.steps.length||new Set(w.decisions.map(s=>s.id)).size!==w.decisions.length)throw Error('Review steps and decisions must retain unique identities.');if(r.reviewStatus==='verified'&&(!w.processChecked||!w.steps.length||w.steps.some(s=>!s.text.trim())||w.decisions.some(s=>!s.done)))throw Error('Check the process and resolve open decisions before finishing this variant.');}
 for(const d of n.dishes)if(!n.recipes.some(r=>r.menuId===d.id))throw new Error('Every menu listing must retain at least one recipe.');
 const processIds=new Set<string>(),producer=new Map<string,ProductionProcess>();for(const p of n.processes){if(processIds.has(p.id))throw Error('Duplicate production process ID.');processIds.add(p.id);checkInputs(p.inputs);checkInputs(p.outputs);for(const o of p.outputs){if(producer.has(o.itemId))throw Error('An item can have only one current production process.');producer.set(o.itemId,p);}if(p.inputs.some(i=>p.outputs.some(o=>o.itemId===i.itemId)))throw Error('A process cannot consume its own output.');}
 const visiting=new Set<string>(),done=new Set<string>();const byId=new Map(n.items.map(i=>[i.id,i]));
 const visit=(id:string)=>{if(visiting.has(id))throw new Error('A preparation cannot contain itself, directly or through another preparation.');if(done.has(id))return;visiting.add(id);const i=byId.get(id)!;checkInputs(i.inputs);for(const part of producer.get(id)?.inputs??i.inputs)visit(part.itemId);visiting.delete(id);done.add(id);};
 const scenarioIds=new Set<string>();for(const s of n.scenarios){if(scenarioIds.has(s.id))throw Error('Duplicate menu scenario ID.');scenarioIds.add(s.id);if(new Set(s.recipeIds).size!==s.recipeIds.length)throw Error('A variant may only be selected once.');}
 for(const i of n.items)visit(i.id);const pairs=new Set<string>();for(const pair of n.distinctPairs){if(pair[0]===pair[1]||pair.some(id=>!ids.has(id)))throw new Error('Invalid different-items decision.');const key=JSON.stringify([...pair].sort());if(pairs.has(key))throw new Error('Duplicate different-items decision.');pairs.add(key);}return n;
}
export function usageMap(n:Notebook,inputsFor?:(id:string)=>ReadonlyArray<{itemId:string}>){
 const items=new Map(n.items.map(i=>[i.id,i]));
 const usage=new Map(n.items.map(i=>[i.id,{direct:new Set<string>(),all:new Set<string>(),recipes:new Set<string>()}]));
 const walk=(id:string,r:Recipe,direct:boolean,path:Set<string>)=>{if(path.has(id))return;const u=usage.get(id);if(!u)return;u.all.add(r.menuId);u.recipes.add(r.id);if(direct)u.direct.add(r.menuId);const next=new Set(path).add(id);for(const child of inputsFor?inputsFor(id):n.processes.find(p=>p.outputs.some(o=>o.itemId===id))?.inputs??items.get(id)?.inputs??[])walk(child.itemId,r,false,next);};
 for(const r of n.recipes.filter(r=>r.active))for(const input of r.inputs)walk(input.itemId,r,true,new Set());return usage;
}
export function dependencyIds(n:Notebook,id:string):Set<string>{const out=new Set<string>();const visit=(key:string)=>{if(out.has(key))return;out.add(key);for(const i of n.processes.find(p=>p.outputs.some(o=>o.itemId===key))?.inputs??n.items.find(x=>x.id===key)?.inputs??[])visit(i.itemId);};visit(id);return out;}
export function perPortion(n:Notebook,r:Recipe):{amounts:Map<string,number>;missing:string[]}{
 const amounts=new Map<string,number>();const missing=new Set<string>();const items=new Map(n.items.map(i=>[i.id,i]));
 const walk=(part:RecipeInput,multiplier:number,path:Set<string>)=>{const item=items.get(part.itemId);if(!item)return;if(part.amount===null){missing.add(`Amount: ${item.name}`);return;}const baseAmount=baseInputAmount(part,item);if(baseAmount===null){missing.add(`Conversion: ${item.name} (${inputUnit(part,item)} → ${item.unit})`);return;}const demand=baseAmount*multiplier;amounts.set(item.id,(amounts.get(item.id)??0)+demand);const process=n.processes.find(p=>p.outputs.some(o=>o.itemId===item.id)),inputs=process?.inputs??item.inputs;if(item.kind==='prep'||inputs.length){if(path.has(item.id)){missing.add('Recipe cycle');return;}if(process&&process.outputs.length>1){missing.add(`Shared output allocation: ${process.name}`);return;}const output=process?.outputs.find(o=>o.itemId===item.id);const yieldAmount=output?baseInputAmount(output,item):item.yieldAmount;if(!yieldAmount||!inputs.length){missing.add(`Prep yield or recipe: ${item.name}`);return;}const next=new Set(path).add(item.id);for(const child of inputs)walk(child,demand/yieldAmount,next);}};
 if(!r.portions){missing.add('Dish yield');return {amounts,missing:[...missing]};}for(const i of r.inputs)walk(i,1/r.portions,new Set());return {amounts,missing:[...missing]};
}
export function collectionGaps(n:Notebook){const usage=usageMap(n);return {
 recipes:n.recipes.filter(r=>r.active&&!completeRecipe(r)).length,
 preparations:n.items.filter(i=>i.kind==='prep'&&(usage.get(i.id)?.all.size??0)>0&&!(n.processes.find(p=>p.outputs.some(o=>o.itemId===i.id))?.inputs??i.inputs).length).length,
 storage:planningGaps(n).storage,
};}
export function planningGaps(n:Notebook){const active=n.recipes.filter(r=>r.active);const usage=usageMap(n);const used=n.items.filter(i=>(usage.get(i.id)?.all.size??0)>0);return {
 recipes:active.filter(r=>!hasRecipeQuantities(r)||perPortion(n,r).missing.length>0).length,
 yields:used.filter(i=>{if(i.kind!=='prep')return false;const p=n.processes.find(p=>p.outputs.some(o=>o.itemId===i.id)),inputs=p?.inputs??i.inputs,output=p?.outputs.find(o=>o.itemId===i.id),yieldAmount=output?baseInputAmount(output,i):i.yieldAmount;return !yieldAmount||!inputs.length||inputs.some(x=>{const item=n.items.find(i=>i.id===x.itemId);return !item||baseInputAmount(x,item)===null;})||!!p&&p.outputs.length>1;}).length,
 storage:used.filter(i=>i.storage.evidence!=='documented'||i.storage.safetyHours===null||!i.storage.reference.trim()||i.storage.condition==='unknown'||(i.storage.condition==='chilled'&&(!i.storage.cooling.trim()&&i.kind==='prep'))).length,
 demand:active.filter(r=>r.weekdayPortions===null||r.busyPortions===null).length,
};}
export function safeCsvCell(v:unknown){let s=v===null||v===undefined?'':String(v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function exportCsv(n:Notebook):string{
 const rows:unknown[][]=[['Record type','Dish / prep','Variant','Ingredient','Ingredient type','Active','Quality hours','Safety hours (reported)','Evidence status','Storage','Temperature C','Reference','Notes']];
 const byId=new Map(n.items.map(i=>[i.id,i]));
 for(const r of n.recipes){const title=n.dishes.find(d=>d.id===r.menuId)?.name??r.menuId;for(const part of r.inputs){const i=byId.get(part.itemId)!;rows.push(['dish input',title,r.variant,i.name,i.kind,r.active,'','','','','','',part.note+' · '+measurementText(part,i)]);}if(!r.inputs.length)rows.push(['empty dish',title,r.variant,'','',r.active,'','','','','','',r.notes]);}
 for(const i of n.items){rows.push(['catalog',i.name,'','',i.kind,'',i.storage.qualityHours,i.storage.safetyHours,i.storage.evidence,i.storage.condition,i.storage.temperatureC,i.storage.reference,i.specification]);for(const part of i.inputs){const child=byId.get(part.itemId)!;rows.push(['prep input',i.name,'',child.name,child.kind,'','','','','','','',part.note+' · '+measurementText(part,child)]);}}
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}

export function exportDishIngredientsCsv(n:Notebook,scope:'all'|'current'='all'):string{
 const rows:unknown[][]=[['Dish','Variant','Ingredient / preparation','Item type','Active','Ingredient list confirmed','Recipe portions','Amount','Entered unit','Piece meaning','Base conversion','Preparation / note']];
 const byId=new Map(n.items.map(i=>[i.id,i]));
 for(const r of n.recipes.filter(r=>scope==='all'||r.active&&n.dishes.some(d=>d.id===r.menuId&&d.state==='ready'))){const title=n.dishes.find(d=>d.id===r.menuId)?.name??r.menuId;if(!r.inputs.length)rows.push([title,r.variant,'','',r.active,r.recorded,r.portions,'','','','','']);for(const part of r.inputs){const item=byId.get(part.itemId)!;rows.push([title,r.variant,item.name,item.kind==='prep'?'House-made preparation':'Bought ingredient',r.active,r.recorded,r.portions,part.amount,inputUnit(part,item),part.pieceMeaning??'',part.conversion?`1 ${part.conversion.from} = ${part.conversion.factor} ${part.conversion.to}`:inputUnit(part,item)!==item.unit?'Not recorded':'Same as catalog',part.note]);}}
 // Keep the existing ingredient columns and append the separate check scope.
 let recipeRow=0;const statuses=n.recipes.filter(r=>scope==='all'||r.active&&n.dishes.some(d=>d.id===r.menuId&&d.state==='ready')).flatMap(r=>Array(Math.max(r.inputs.length,1)).fill(ingredientsReviewed(r)));
 return '\uFEFF'+rows.map((row,index)=>[...row,index===0?'Export scope':scope==='current'?'Current menu':'All items',index===0?'Ingredients reviewed':statuses[recipeRow++]].map(safeCsvCell).join(',')).join('\r\n');
}

/** Deterministic payload migration. Database callers persist this under a revision CAS. */
export function migrateNotebook(input:unknown):Notebook {
 const raw=input as Record<string,unknown>;
 if([1,2,3].includes(Number(raw?.schemaVersion))){
  const version=raw.schemaVersion;
  return validateNotebook({...raw,schemaVersion:4,dishes:menu.map(({variants:_,...d})=>({...d,state:'ready'})),processes:[],scenarios:[],distinctPairs:version===1?[]:raw.distinctPairs,
   items:(raw.items as Record<string,unknown>[]).map(item=>({...item,...(version===1?{aliases:[]}:{}),...(version!==3?{prepProfile:emptyProfile()}:{}),reviewStatus:'unverified',reviewNote:''})),
   recipes:(raw.recipes as Record<string,unknown>[]).map(r=>({...r,reviewStatus:'unverified',reviewNote:''}))});
 }
 return validateNotebook(input);
}
