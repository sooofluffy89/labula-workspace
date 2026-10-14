import {type Notebook,type Recipe,type RecipeWorkshop} from './notebook';
import {baseInputAmount,measurementText} from './recipe-quantity';
import {menuScope} from './menu-scope';
import type {AppliedRecord} from './review-v2/applied';
import {patchDishVariant} from './dish-workspace';

export function emptyWorkshop():RecipeWorkshop{return {steps:[],beforeMinutes:null,orderMinutes:null,processChecked:false,decisions:[]};}
export function reviewReady(r:Recipe){const w=r.workshop;return !!(r.recorded&&r.inputs.length&&w?.processChecked&&w.steps.length&&w.steps.every(s=>s.text.trim())&&w.decisions.every(d=>d.done));}
export function menuReviewComplete(r:Recipe){return r.reviewStatus==='verified'&&reviewReady(r);}
export function sharedRecipeUses(n:Notebook,itemId:string){return n.recipes.filter(r=>r.active&&n.dishes.some(d=>d.id===r.menuId&&d.state==='ready')&&r.inputs.some(i=>i.itemId===itemId));}
export function recipeQuantityGaps(n:Notebook,r:Recipe){const gaps:string[]=[];if(!r.inputs.length)gaps.push('Ingredient list');if(r.portions===null)gaps.push('Recipe portions');for(const p of r.inputs){const item=n.items.find(i=>i.id===p.itemId);if(p.amount===null)gaps.push('Amount: '+(item?.name??p.itemId));else if(item&&baseInputAmount(p,item)===null)gaps.push('Conversion: '+item.name);}return gaps;}
export function reviewLabel(n:Notebook,r:Recipe){return menuReviewComplete(r)?recipeQuantityGaps(n,r).length?'Recipe checked · quantities pending':'Recipe checked':r.reviewStatus==='needs-review'?'Kitchen test pending':r.reviewStatus==='verified'&&!r.workshop?'List verified · process pending':'To review';}
export function reviewUsage(n:Notebook,records:AppliedRecord[]=[],ready=true){const scope=menuScope(n,ready?records:[]);return {scope,complete:ready&&!scope.gaps.length,forItem:(id:string)=>{const use=scope.usage.get(id),direct=use?.direct??new Set<string>(),indirect=new Set([...(use?.all??[])].filter(id=>!direct.has(id)));return {direct,indirect,all:use?.all??new Set<string>()};}};}
export type ReviewIssue={id:string;kind:'list'|'portions'|'amount'|'conversion'|'process'|'step'|'followup';message:string;blocking:boolean;target:'ingredients'|'portions'|'process'|'decisions';itemId?:string;stepId?:string};
/** Read-only guidance: missing quantities remain optional for a first recipe check. */
export function reviewIssues(n:Notebook,r:Recipe):ReviewIssue[]{
 const issues:ReviewIssue[]=[];
 if(!r.inputs.length)issues.push({id:'ingredients',kind:'list',message:'Add the ingredient list',blocking:true,target:'ingredients'});
 else if(!r.recorded)issues.push({id:'list-check',kind:'list',message:'Check the ingredient list with Wen',blocking:true,target:'ingredients'});
 if(r.portions===null)issues.push({id:'portions',kind:'portions',message:'Record how many portions this recipe makes',blocking:false,target:'portions'});
 for(const part of r.inputs){const item=n.items.find(i=>i.id===part.itemId),name=item?.name??part.itemId;
  if(part.amount===null)issues.push({id:'amount:'+part.itemId,kind:'amount',message:'Record the amount of '+name,blocking:false,target:'ingredients',itemId:part.itemId});
  else if(item&&baseInputAmount(part,item)===null)issues.push({id:'conversion:'+part.itemId,kind:'conversion',message:'Record a conversion for '+name,blocking:false,target:'ingredients',itemId:part.itemId});
 }
 const w=r.workshop,steps=w?.steps??[];
 if(!steps.length)issues.push({id:'process-steps',kind:'process',message:'Add the preparation or service steps',blocking:true,target:'process'});
 else{for(const step of steps.filter(s=>!s.text.trim()))issues.push({id:'step:'+step.id,kind:'step',message:`Describe ${step.phase==='before'?'prep':'service'} step ${steps.filter(s=>s.phase===step.phase).findIndex(s=>s.id===step.id)+1}`,blocking:true,target:'process',stepId:step.id});
  if(!w?.processChecked)issues.push({id:'process-check',kind:'process',message:'Check the process with Wen',blocking:true,target:'process'});
 }
 for(const decision of w?.decisions.filter(d=>!d.done)??[])issues.push({id:'followup:'+decision.id,kind:'followup',message:(decision.kind==='test'?'Kitchen test: ':'Decision: ')+decision.text,blocking:true,target:'decisions'});
 return issues;
}
export function reviewSummary(n:Notebook,r:Recipe):string{
 const issues=reviewIssues(n,r),parts:string[]=[];const count=(kind:ReviewIssue['kind'])=>issues.filter(i=>i.kind===kind).length;
 if(count('amount'))parts.push(`${count('amount')} ${count('amount')===1?'amount':'amounts'} missing`);
 if(count('portions'))parts.push('portions not recorded');
 if(count('conversion'))parts.push(`${count('conversion')} ${count('conversion')===1?'conversion':'conversions'} missing`);
 if(count('list'))parts.push(r.inputs.length?'list not checked':'ingredient list not recorded');
 if(count('step'))parts.push(`${count('step')} ${count('step')===1?'step needs':'steps need'} detail`);
 if(count('process'))parts.push(r.workshop?.steps.length?'process not checked':'process not recorded');
 if(count('followup')){const tests=r.workshop?.decisions.filter(d=>!d.done&&d.kind==='test').length??0;parts.push(tests?`${tests} kitchen ${tests===1?'test':'tests'} open`:`${count('followup')} ${count('followup')===1?'decision':'decisions'} open`);}
 const prefix=menuReviewComplete(r)?'Recipe checked':r.recorded&&r.workshop?.processChecked&&!issues.some(i=>i.blocking)?'Ready to finish':'';
 return [prefix,...parts.slice(0,2),...(parts.length>2?[`+${parts.length-2} more`]:[])].filter(Boolean).join(' · ')||'Ready to finish';
}
export function phaseTimeSummary(workshop:RecipeWorkshop|undefined,phase:'before'|'order'):string{
 const minutes=phase==='before'?workshop?.beforeMinutes:workshop?.orderMinutes,timing=phase==='before'?workshop?.beforeTiming:workshop?.orderTiming;
 const basis=timing?.basis&&timing.basis!=='unknown'?timing.basis:null;
 const parts=[minutes==null?'Time not recorded':`${minutes} min${basis?' / '+basis:''}`];
 if(minutes!=null&&!basis)parts.push('scope not recorded');else if(minutes==null&&basis)parts.push('per '+basis);
 if(timing?.portions!=null)parts.push(`${timing.portions} ${timing.portions===1?'portion':'portions'}`);
 if(timing?.evidence&&timing.evidence!=='unknown')parts.push(timing.evidence);
 return parts.join(' · ');
}
/** Only per-recipe preparation notes change. Catalog and production sources stay authoritative. */
export function applySharedPreparation(n:Notebook,itemId:string,recipeIds:readonly string[],note:string,flagTest=true):Notebook{
 const available=new Set(sharedRecipeUses(n,itemId).map(r=>r.id));
 if(!recipeIds.length||recipeIds.some(id=>!available.has(id))||new Set(recipeIds).size!==recipeIds.length)throw Error('The selected recipes changed. Reopen the comparison before applying it.');
 if(!note.trim()||note.length>6000)throw Error('Enter a preparation note of 1–6,000 characters.');
 const item=n.items.find(i=>i.id===itemId);if(!item)throw Error('This ingredient no longer exists.');
 return recipeIds.reduce((next,id)=>{const r=next.recipes.find(r=>r.id===id)!;if(r.inputs.find(i=>i.itemId===itemId)!.note===note.trim())return next;
  const w=structuredClone(r.workshop??emptyWorkshop());w.processChecked=false;
  if(flagTest&&w.decisions.length>=100)throw Error('Resolve or remove existing decisions before adding another kitchen test.');
  if(flagTest)w.decisions.push({id:crypto.randomUUID(),kind:'test',done:false,text:`Test ${item.name}: ${note.trim()}`.slice(0,6000)});
  const patched=patchDishVariant(next,id,{inputs:r.inputs.map(p=>p.itemId===itemId?{...p,note:note.trim()}:p),workshop:w});
  return {...patched,recipes:patched.recipes.map(r=>r.id===id?{...r,reviewStatus:flagTest?'needs-review':'unverified'}:r)};
 },n);
}
export function exportMenuReview(n:Notebook){const lines=['# LABULA — Menu review','',`Exported ${new Date().toLocaleString('en-GB',{timeZone:'Europe/Prague'})} (Europe/Prague)`,''];for(const d of n.dishes.filter(d=>d.state!=='archived')){lines.push('## '+d.name,'');for(const r of n.recipes.filter(r=>r.menuId===d.id)){lines.push('### '+r.variant,`Review: ${r.reviewStatus} · ${r.active?'On menu':'Off menu'}`,`Recipe portions: ${r.portions??'Unknown'}`,`Check scope: ${reviewLabel(n,r)}`,`List: ${r.recorded?'checked':'pending'} · process: ${r.workshop?.processChecked?'checked':'pending'} · quantity gaps: ${recipeQuantityGaps(n,r).join('; ')||'none'}`,'','Ingredients:');for(const p of r.inputs){const i=n.items.find(i=>i.id===p.itemId);lines.push(`- ${i?.name??p.itemId}: ${i?measurementText(p,i):'Unknown'}${p.note?' — '+p.note:''}`);}for(const [phase,label] of [['before','Before service'],['order','To order']] as const){lines.push('',label+':');for(const s of r.workshop?.steps.filter(s=>s.phase===phase)??[])lines.push('- '+s.text);const time=phase==='before'?r.workshop?.beforeMinutes:r.workshop?.orderMinutes;const timing=phase==='before'?r.workshop?.beforeTiming:r.workshop?.orderTiming;lines.push(`Active time: ${time??'Not recorded'} min · ${timing?.basis??'unknown'} basis · ${timing?.portions??'unknown'} portions · ${timing?.evidence??'unknown'} evidence`);}if(r.notes)lines.push('','Recipe notes: '+r.notes);if(r.reviewNote)lines.push('','Review note: '+r.reviewNote);for(const x of r.workshop?.decisions??[])lines.push(`- [${x.done?'x':' '}] ${x.kind==='test'?'Kitchen test':'Decision'}: ${x.text}`);lines.push('');}}return lines.join('\n');}
