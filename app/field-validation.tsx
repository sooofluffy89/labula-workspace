'use client';
import {createContext,useContext,useId,type ReactNode} from 'react';
import type {PrepFieldIssue} from '@/lib/prep-profile';
const Validation=createContext<{issues:PrepFieldIssue[];prefix:string}>({issues:[],prefix:''});
const fields:Record<string,string>={
 'Usual batch output':'batch.output.amount','Batch output unit':'batch.output.unit','Describe the output unit':'batch.output.unitOther','Usual number of batches':'batch.frequency.times','Batch frequency period':'batch.frequency.period','Total hands-on minutes per batch':'batch.work.minutes','4. How is this batch preparation usually scheduled?':'batch.schedule',
 'How do you use this item?':'workflow','How often do you make the prep ahead?':'frequency','How much hands-on work does it take?':'effort','Any recurring problems?':'issues','Food state':'states','Other food state':'stateOther',Packaging:'pack','Storage method':'mode','Storage temperature':'temperature','Container and other storage conditions':'container','What storage rule do you currently follow?':'source','Product / document reference':'reference','Exact wording and conditions':'ruleText','How is the limit expressed?':'ruleKind',
 'Quality estimate — duration':'quality.value','Quality estimate — unit':'quality.unit','Quality estimate — time starts when':'quality.start','Quality estimate — describe the starting event':'quality.startOther',
 'Duration in the rule — duration':'rule.value','Duration in the rule — unit':'rule.unit','Duration in the rule — time starts when':'rule.start','Duration in the rule — describe the starting event':'rule.startOther',
};
export function FieldValidationProvider({issues,children}:{issues:PrepFieldIssue[];children:ReactNode}){return <Validation.Provider value={{issues,prefix:''}}>{children}</Validation.Provider>;}
export function FieldScope({prefix,children}:{prefix:string;children:ReactNode}){const parent=useContext(Validation);return <Validation.Provider value={{...parent,prefix}}>{children}</Validation.Provider>;}
export function useFieldValidation(label:string){
 const {issues,prefix}=useContext(Validation),id=useId();
 const field=fields[label.replace(/ \([^)]*\)$/,'')]??'';
 const path=[prefix,field].filter(Boolean).join('.');
 const issue=field?issues.find(i=>i.path.join('.')===path||i.path.join('.').startsWith(path+'.')):undefined;
 return {path:field?path:undefined,error:issue?.message,errorId:id,attrs:issue?{'aria-invalid':true as const,'aria-describedby':id}:{}};
}
export function focusInvalidField(root:HTMLElement|null,path:(string|number)[]){
 if(!root)return;const key=path.join('.');
 const field=Array.from(root.querySelectorAll<HTMLElement>('[data-field-path]')).find(e=>e.dataset.fieldPath===key);
 if(!field){root.querySelector<HTMLElement>('[role="alert"]')?.focus();return;}
 let parent=field.parentElement;while(parent){if(parent instanceof HTMLDetailsElement)parent.open=true;parent=parent.parentElement;}
 requestAnimationFrame(()=>{const control=field.matches('input,textarea,select,button')?field:field.querySelector<HTMLElement>('input,textarea,select,button,[role="radio"]');field.scrollIntoView({block:'center',behavior:'instant'});control?.focus({preventScroll:true});});
}
