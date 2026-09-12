import { z } from 'zod';
import { menu } from './menu';

const amount = z.number().finite().positive().max(1e9).nullable();
const nonnegative = z.number().finite().min(0).max(1e9).nullable();
const text = z.string().max(6000);
export const itemNameSchema = z.string().trim().min(1, 'Enter an item name before continuing.').max(160, 'Shorten the item name to 160 characters or fewer. Your text has been kept.');
export const units = ['g', 'ml', 'pcs'] as const;
export const inputSchema = z.object({ itemId:z.string().min(1).max(100), amount, note:text });
export const storageSchema = z.object({
  condition:z.enum(['unknown','chilled','frozen','dry','fresh']), temperatureC:z.number().finite().min(-100).max(100).nullable(),
  container:text, qualityHours:amount, safetyHours:amount, evidence:z.enum(['unknown','estimate','documented']), reference:text,
  cooling:text, afterOpeningHours:amount, thawing:text,
});
export const itemSchema = z.object({
  id:z.string().min(1).max(100), name:itemNameSchema, aliases:z.array(itemNameSchema).max(30), kind:z.enum(['bought','prep']), unit:z.enum(units),
  specification:text, inputs:z.array(inputSchema).max(150), yieldAmount:amount, activeMinutes:nonnegative, passiveMinutes:nonnegative,
  frequencyHours:amount, batchMinimum:amount, batchMaximum:amount, method:text, storage:storageSchema,
});
export const recipeSchema = z.object({ id:z.string().min(1).max(100), menuId:z.string().min(1).max(100), variant:z.string().trim().min(1).max(160),
  portions:amount, inputs:z.array(inputSchema).max(150), notes:text, active:z.boolean(), recorded:z.boolean(), weekdayPortions:nonnegative, busyPortions:nonnegative,
});
export const notebookSchema = z.object({schemaVersion:z.literal(2), distinctPairs:z.array(z.tuple([z.string(),z.string()])).max(5000), items:z.array(itemSchema).max(1000), recipes:z.array(recipeSchema).max(500), equipment:z.object({blastChiller:z.enum(['unknown','yes','no']),notes:text})});
export type RecipeInput = z.infer<typeof inputSchema>;
export type Item = z.infer<typeof itemSchema>;
export type Recipe = z.infer<typeof recipeSchema>;
export type Notebook = z.infer<typeof notebookSchema>;
export const normalizeName = (s:string) => s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim().replace(/\s+/g,' ');
export function validationMessage(error:unknown):string { if(error instanceof z.ZodError)return 'Check the item names and entered values. Names must be 1–160 characters; a recipe can contain up to 150 items and the catalog up to 1,000 items.';return error instanceof Error?error.message:'Please check the recipe details and try again.'; }
export function newItem(name:string,kind:Item['kind']='bought',unit:Item['unit']='g'):Item { return {
 id:crypto.randomUUID(),name:name.trim(),aliases:[],kind,unit,specification:'',inputs:[],yieldAmount:null,activeMinutes:null,passiveMinutes:null,frequencyHours:null,batchMinimum:null,batchMaximum:null,method:'',
 storage:{condition:'unknown',temperatureC:null,container:'',qualityHours:null,safetyHours:null,evidence:'unknown',reference:'',cooling:'',afterOpeningHours:null,thawing:''},
}; }
export function initialNotebook():Notebook { return {schemaVersion:2,distinctPairs:[],items:[],equipment:{blastChiller:'unknown',notes:''},recipes:menu.flatMap(d=>(d.variants??['Standard']).map((variant,i)=>({id:`${d.id}-v${i+1}`,menuId:d.id,variant,portions:null,inputs:[],notes:'',active:true,recorded:false,weekdayPortions:null,busyPortions:null})))}; }
export function completeRecipe(r:Recipe):boolean { return r.inputs.length>0; }
export function hasRecipeQuantities(r:Recipe):boolean { return completeRecipe(r) && r.portions!==null && r.inputs.every(i=>i.amount!==null); }
export function recipeTitle(r:Recipe):string { const dish=menu.find(m=>m.id===r.menuId);return `${dish?.name??r.menuId}${r.variant==='Standard'?'':` · ${r.variant}`}`; }
export function validateNotebook(input:unknown):Notebook {
 const n=notebookSchema.parse(input);const ids=new Set<string>();const names=new Set<string>();
 for(const i of n.items){if(ids.has(i.id))throw new Error('Duplicate item ID.');ids.add(i.id);for(const label of [i.name,...i.aliases]){const name=normalizeName(label);if(!name)throw new Error('Enter an item name.');if(names.has(name))throw new Error(`“${label}” already exists as an item name or alternative name. Use the existing item.`);names.add(name);}
  if(i.kind==='bought' && i.inputs.length)throw new Error('Bought ingredients cannot contain a prep recipe.');
  if(i.batchMinimum!==null&&i.batchMaximum!==null&&i.batchMinimum>i.batchMaximum)throw new Error(`Minimum batch exceeds maximum for ${i.name}.`);
  if(i.storage.evidence==='documented' && (i.storage.safetyHours===null||!i.storage.reference.trim()))throw new Error(`Add a safety limit and its document reference for ${i.name}.`);
 }
 const checkInputs=(inputs:RecipeInput[])=>{const seen=new Set<string>();for(const i of inputs){if(!ids.has(i.itemId))throw new Error('An ingredient no longer exists.');if(seen.has(i.itemId))throw new Error('An ingredient is listed twice in one recipe. Keep one entry for each ingredient.');seen.add(i.itemId);}};
 const rids=new Set<string>();const variantKeys=new Set<string>();
 for(const r of n.recipes){if(!menu.some(d=>d.id===r.menuId))throw new Error('Unknown menu dish.');if(rids.has(r.id))throw new Error('Duplicate recipe ID.');rids.add(r.id);const key=r.menuId+':'+normalizeName(r.variant);if(variantKeys.has(key))throw new Error('That variant already exists for this dish.');variantKeys.add(key);checkInputs(r.inputs);if(r.recorded&&!completeRecipe(r))throw new Error('Add the ingredient list before marking a recipe recorded.');}
 for(const d of menu)if(!n.recipes.some(r=>r.menuId===d.id))throw new Error('Every menu listing must retain at least one recipe.');
 const visiting=new Set<string>(),done=new Set<string>();const byId=new Map(n.items.map(i=>[i.id,i]));
 const visit=(id:string)=>{if(visiting.has(id))throw new Error('A preparation cannot contain itself, directly or through another preparation.');if(done.has(id))return;visiting.add(id);const i=byId.get(id)!;checkInputs(i.inputs);for(const part of i.inputs)visit(part.itemId);visiting.delete(id);done.add(id);};
 for(const i of n.items)visit(i.id);const pairs=new Set<string>();for(const pair of n.distinctPairs){if(pair[0]===pair[1]||pair.some(id=>!ids.has(id)))throw new Error('Invalid different-items decision.');const key=JSON.stringify([...pair].sort());if(pairs.has(key))throw new Error('Duplicate different-items decision.');pairs.add(key);}return n;
}
export function usageMap(n:Notebook){
 const items=new Map(n.items.map(i=>[i.id,i]));
 const usage=new Map(n.items.map(i=>[i.id,{direct:new Set<string>(),all:new Set<string>(),recipes:new Set<string>()}]));
 const walk=(id:string,r:Recipe,direct:boolean,path:Set<string>)=>{if(path.has(id))return;const u=usage.get(id);if(!u)return;u.all.add(r.menuId);u.recipes.add(r.id);if(direct)u.direct.add(r.menuId);const next=new Set(path).add(id);for(const child of items.get(id)?.inputs??[])walk(child.itemId,r,false,next);};
 for(const r of n.recipes.filter(r=>r.active))for(const input of r.inputs)walk(input.itemId,r,true,new Set());return usage;
}
export function dependencyIds(n:Notebook,id:string):Set<string>{const out=new Set<string>();const visit=(key:string)=>{if(out.has(key))return;out.add(key);for(const i of n.items.find(x=>x.id===key)?.inputs??[])visit(i.itemId);};visit(id);return out;}
export function perPortion(n:Notebook,r:Recipe):{amounts:Map<string,number>;missing:string[]}{
 const amounts=new Map<string,number>();const missing=new Set<string>();const items=new Map(n.items.map(i=>[i.id,i]));
 const walk=(part:RecipeInput,multiplier:number,path:Set<string>)=>{const item=items.get(part.itemId);if(!item)return;if(part.amount===null){missing.add(`Amount: ${item.name}`);return;}const demand=part.amount*multiplier;amounts.set(item.id,(amounts.get(item.id)??0)+demand);if(item.kind==='prep'){if(path.has(item.id)){missing.add('Recipe cycle');return;}if(!item.yieldAmount||!item.inputs.length){missing.add(`Prep yield or recipe: ${item.name}`);return;}const next=new Set(path).add(item.id);for(const child of item.inputs)walk(child,demand/item.yieldAmount,next);}};
 if(!r.portions){missing.add('Dish yield');return {amounts,missing:[...missing]};}for(const i of r.inputs)walk(i,1/r.portions,new Set());return {amounts,missing:[...missing]};
}
export function collectionGaps(n:Notebook){const usage=usageMap(n);return {
 recipes:n.recipes.filter(r=>r.active&&!completeRecipe(r)).length,
 preparations:n.items.filter(i=>i.kind==='prep'&&(usage.get(i.id)?.all.size??0)>0&&!i.inputs.length).length,
 storage:planningGaps(n).storage,
};}
export function planningGaps(n:Notebook){const active=n.recipes.filter(r=>r.active);const usage=usageMap(n);const used=n.items.filter(i=>(usage.get(i.id)?.all.size??0)>0);return {
 recipes:active.filter(r=>!hasRecipeQuantities(r)).length,
 yields:used.filter(i=>i.kind==='prep'&&(!i.yieldAmount||!i.inputs.length||i.inputs.some(p=>p.amount===null))).length,
 storage:used.filter(i=>i.storage.evidence!=='documented'||i.storage.safetyHours===null||!i.storage.reference.trim()||i.storage.condition==='unknown'||(i.storage.condition==='chilled'&&(!i.storage.cooling.trim()&&i.kind==='prep'))).length,
 demand:active.filter(r=>r.weekdayPortions===null||r.busyPortions===null).length,
};}
export function safeCsvCell(v:unknown){let s=v===null||v===undefined?'':String(v);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
export function exportCsv(n:Notebook):string{
 const rows:unknown[][]=[['Record type','Dish / prep','Variant','Ingredient','Ingredient type','Active','Quality hours','Safety hours (reported)','Evidence status','Storage','Temperature C','Reference','Notes']];
 const byId=new Map(n.items.map(i=>[i.id,i]));
 for(const r of n.recipes){const title=menu.find(d=>d.id===r.menuId)?.name??r.menuId;for(const part of r.inputs){const i=byId.get(part.itemId)!;rows.push(['dish input',title,r.variant,i.name,i.kind,r.active,'','','','','','',part.note]);}if(!r.inputs.length)rows.push(['empty dish',title,r.variant,'','',r.active,'','','','','','',r.notes]);}
 for(const i of n.items){rows.push(['catalog',i.name,'','',i.kind,'',i.storage.qualityHours,i.storage.safetyHours,i.storage.evidence,i.storage.condition,i.storage.temperatureC,i.storage.reference,i.specification]);for(const part of i.inputs){const child=byId.get(part.itemId)!;rows.push(['prep input',i.name,'',child.name,child.kind,'','','','','','','',part.note]);}}
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}

export function exportDishIngredientsCsv(n:Notebook):string{
 const rows:unknown[][]=[['Dish','Variant','Ingredient / preparation','Item type','Active','Ingredient list confirmed']];
 const byId=new Map(n.items.map(i=>[i.id,i]));
 for(const r of n.recipes){const title=menu.find(d=>d.id===r.menuId)?.name??r.menuId;if(!r.inputs.length)rows.push([title,r.variant,'','',r.active,r.recorded]);for(const part of r.inputs){const item=byId.get(part.itemId)!;rows.push([title,r.variant,item.name,item.kind==='prep'?'House-made preparation':'Bought ingredient',r.active,r.recorded]);}}
 return '\uFEFF'+rows.map(row=>row.map(safeCsvCell).join(',')).join('\r\n');
}

export function migrateNotebook(input:unknown):Notebook {
 const raw=input as Record<string,unknown>;
 if(raw?.schemaVersion===1){return validateNotebook({...raw,schemaVersion:2,distinctPairs:[],items:(raw.items as Record<string,unknown>[]).map(item=>({...item,aliases:[]}))});}
 return validateNotebook(input);
}
