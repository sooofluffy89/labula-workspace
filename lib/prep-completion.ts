import {documentedSource,effortBasis,prepAhead,relevantProblems,type PrepProfile,type PrepTime} from './prep-profile';
import {compareUsage,directUsage} from './direct-usage';
import type {Notebook} from './notebook';

export type PrepStep='preparation'|'storage';
export type MissingAnswer={step:PrepStep;label:string;setupId?:string;setupNumber?:number};
/** Coverage of applicable questions, never a safety assessment. Reads saved or draft values without altering them. */
export function profileCompletion(p:PrepProfile){
 const missing:MissingAnswer[]=[];
 const prep=(label:string)=>missing.push({step:'preparation',label});
 if(!p.workflow)prep('how this item is used');
 if(prepAhead(p.workflow)&&!p.frequency)prep('preparation frequency');
 if(effortBasis(p.workflow)&&!p.effort)prep('hands-on work');
 if(!p.problems)prep('recurring problems');
 else if(p.problems==='yes'&&!p.issues.some(i=>relevantProblems(p.workflow).some(o=>o[0]===i)))prep('specific recurring problems');
 if(!p.storage.length)missing.push({step:'storage',label:'storage setup'});
 p.storage.forEach((s,i)=>{
  const add=(label:string)=>missing.push({step:'storage',label,setupId:s.id,setupNumber:i+1});
  const time=(t:PrepTime,label:string)=>{
   if(t.unknown)return;
   if(t.value===null||!Number.isFinite(t.value)||t.value<=0)add(label+' duration');
   if(!['hours','days'].includes(t.unit))add(label+' unit');
   if(!t.start)add(label+' starting event');
   else if(t.start==='other'&&!t.startOther.trim())add(label+' starting event details');
  };
  if(!s.states.length)add('food state');
  if(s.states.includes('other')&&!s.stateOther.trim())add('other food state details');
  if(!s.pack)add('packaging');
  if(!s.mode)add('storage method');
  if(s.mode==='immediate')return;
  if(s.mode==='other'&&!s.container.trim())add('other storage method details');
  time(s.quality,'quality estimate');
  if(!s.source)add('storage rule source');
  if(documentedSource(s.source)){
   if(!s.reference.trim())add('product / document reference');
   if(!s.ruleText.trim())add('rule wording and conditions');
   if(!s.ruleKind)add('rule format');
   if(s.ruleKind==='duration')time(s.rule,'rule');
  }
 });
 return {complete:missing.length===0,missing,firstStep:missing[0]?.step??'preparation' as PrepStep};
}
export function preparationProgress(notebook:Notebook){
 const usage=directUsage(notebook);
 const items=notebook.items.filter(i=>usage.itemDishes.has(i.id)).sort((a,b)=>compareUsage(usage,a.id,b.id)).map(item=>({item,count:usage.itemDishes.get(item.id)!.size,...profileCompletion(item.prepProfile)}));
 const remaining=items.filter(i=>!i.complete);
 return {items,remaining,total:items.length,filled:items.length-remaining.length};
}
export function missingAnswerText(missing:MissingAnswer[]){
 return missing.map(m=>`${m.setupNumber?`Storage setup ${m.setupNumber}: `:''}${m.label}`).join('; ');
}
