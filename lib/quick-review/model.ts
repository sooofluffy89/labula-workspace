import {digest,stamp} from './stamp';
import type {ReviewSource} from '../data-review';
import {excluded,entity,decimal,same,dateValid,today,type Draft} from '../review-v2/model';
import {quickSchema,type Quick,type QuickProcess,type QuickOutput,type QuickCheck} from './schema';
export type CaseDefinition={id:string;name:string;items:string[];help:string};
export const cases:CaseDefinition[]=[
 {id:'garlic',name:'Minced garlic',items:['review-fixture-garlic-1'],help:'Which work belongs to one full batch, and which is a small top-up? Include peeling only if done here.'},
 {id:'base',name:'Beef base & sauce boxes',items:['review-fixture-base-1','review-fixture-base-2','review-fixture-base-3','review-fixture-base-4','review-fixture-base-5'],help:'A mixed base, a set of boxes, or separate jobs? Count total boxes once. Do not multiply a pack description by a number.'},
 {id:'beef',name:'Beef cubes & beef broth',items:['review-fixture-beef-1','review-fixture-beef-2'],help:'Separate cooking from later cutting, portioning or reheating. Shared shank production stays outside this review.'},
 {id:'rice',name:'Rice',items:['review-fixture-rice-1'],help:'Cookers, batches, or filled pots? Clarify the cooked state; storage needs checking before a larger reserve.'},
 {id:'noodles',name:'Fermented noodles',items:['review-fixture-noodles-1'],help:'Making, fermenting, cooking or portioning noodles? A day total is not one batch.'},
 {id:'pork',name:'Minced pork',items:['review-fixture-pork-1'],help:'Do we currently buy minced meat or mince it here? Separate that from cooking. Describe total bags, not a future buying plan.'},
 {id:'coriander',name:'Coriander',items:['review-fixture-coriander-1'],help:'Washing, drying and cutting may happen at different times. A quality estimate is not a safe storage rule.'},
 {id:'brown',name:'Brown sauce',items:['review-fixture-brown-1'],help:'Is it still used today? A plan to remove it is different from having stopped using it.'},
];
export const caseItemIds=(s:ReviewSource,id:string)=>s.quickCaseItems?.[id]??cases.find(c=>c.id===id)?.items??[];
export const emptyQuick=():Quick=>({version:1,week:{days:'',unknown:false},cases:cases.map(c=>({id:c.id,processIds:[],deferred:false})),processes:[],checks:[],position:{caseId:'garlic',processId:'',step:0,view:'cases'},offers:{},approval:{effective:'',reason:'',evidence:''}});
export const emptyOutput=(itemId=''):QuickOutput=>({id:crypto.randomUUID(),itemId,stage:'',status:'',amount:'',unit:'',pack:'',content:'',contentUnit:'',meaning:''});
export const emptyProcess=():QuickProcess=>({id:crypto.randomUUID(),name:'',kind:'',inputId:'',separation:'',sharedScope:'',outputs:[],workStatus:'',minutes:'',crewMode:'',people:'',coverage:'',countedIn:'',fullStatus:'',full:'',topupStatus:'',topups:'',trigger:'',emergency:false,triggerOther:'',limits:[],limitBasis:'',limitOther:'',context:''});
export function itemName(d:Draft,s:ReviewSource,id:string){return entity(d,id)?.name??s.notebook.items.find(i=>i.id===id)?.name??'Unavailable product';}
export const outputs=(p:QuickProcess)=>p.outputs.filter(o=>!o.detached);
export function toggleOutput(p:QuickProcess,itemId:string,selected:boolean){
 const existing=p.outputs.filter(o=>o.itemId===itemId);if(selected&&!existing.length)p.outputs.push(emptyOutput(itemId));
 else for(const o of existing)o.detached=!selected;
}
export const countedTarget=(p:QuickProcess)=>p.workStatus!=='check'&&p.coverage==='Already counted in another task'?p.countedIn:'';
export const linked=(q:Quick,p:QuickProcess)=>q.cases.some(c=>c.processIds.includes(p.id));
export function isWork(p:QuickProcess){return ['A separate preparation','Made together with other items','A later step using an existing preparation'].includes(p.kind);}
export function outside(p:QuickProcess,d:Draft,s:ReviewSource){return outputs(p).some(o=>excluded(d,o.itemId,s))||p.sharedScope==='Includes shared work outside this review'||p.kind==='A later step using an existing preparation'&&!!p.inputId&&excluded(d,p.inputId,s)&&!(p.kind==='A later step using an existing preparation'&&p.sharedScope==='All this work is local and separate'&&p.separation.trim());}
export function productionActive(p:QuickProcess,d:Draft,s:ReviewSource){return isWork(p)&&!outside(p,d,s)&&p.sharedScope==='All this work is local and separate';}
function includedWorkKnown(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource){
 const seen=new Set([p.id]);let parent=q.processes.find(x=>x.id===countedTarget(p));
 while(parent){if(seen.has(parent.id)||!linked(q,parent)||!productionActive(parent,d,s))return false;seen.add(parent.id);if(countedTarget(parent)){parent=q.processes.find(x=>x.id===countedTarget(parent!));continue;}return parent.workStatus==='estimate'&&parent.coverage==='Whole named task'&&decimal(parent.minutes)!==null&&decimal(parent.minutes)!>=0&&!!parent.crewMode&&(parent.crewMode!=='Constant crew'||decimal(parent.people)!==null&&decimal(parent.people)!>=1&&Number.isInteger(decimal(parent.people)));}return false;
}
export type Gap={topic:string;message:string;unknown:boolean};
export function gaps(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource):Gap[]{
 const g:Gap[]=[];const add=(topic:string,message:string,unknown=false)=>g.push({topic,message,unknown});
 if(!p.kind){add('scope','Choose what work happens here.');return g;}
 if(p.kind==='I need to check'){add('scope','Identify the actual local work and whether outputs share one preparation.',true);return g;}
 if(!outputs(p).length||outputs(p).some(o=>!s.notebook.items.some(i=>i.id===o.itemId)))add('scope','Choose the existing products this answer describes.');
 if(!isWork(p))return g;
 if(!p.name.trim())add('scope','Name the actual task, for example cutting and packing cooked meat.');
 if(!p.sharedScope)add('scope','Clarify whether this task includes work outside this review.');
 if(p.sharedScope==='I need to check')add('scope','Check the boundary of this work before estimating its batch and time.',true);
 if(p.kind==='Made together with other items'&&new Set(outputs(p).map(o=>o.itemId)).size<2)add('scope','Select at least two actual outputs of the same preparation.');
 if(p.kind==='A later step using an existing preparation'&&!s.notebook.items.some(i=>i.id===p.inputId))add('scope','Choose the existing preparation used by this later step.');
 if(p.kind==='A later step using an existing preparation'&&!p.separation.trim())add('scope','Describe how this later task is separate from making its input.');
 if(p.kind==='A later step using an existing preparation'&&outputs(p).some(o=>o.itemId===p.inputId)&&!p.separation.trim())add('scope','Explain the change of physical state; do not link a product to itself without a later step.');
 if(!productionActive(p,d,s))return g;
 if(p.kind==='A later step using an existing preparation'){
  if(!p.inputTask||p.inputTask==='unknown')add('scope','Identify the preceding task, or confirm that its preparation is not recorded in this review.',true);
  else if(p.inputTask!=='outside'){const parent=q.processes.find(x=>x.id===p.inputTask&&linked(q,x));if(!parent||!outputs(parent).some(o=>o.id===p.inputOutput&&o.itemId===p.inputId))add('scope','The selected preceding output is no longer available. Choose the actual input again.',true);}
 }

 for(const o of outputs(p)){const topic='output:'+o.id;if(o.status!=='check'&&!o.stage.trim())add(topic,'Describe the usable state of '+itemName(d,s,o.itemId)+'.');if(o.status==='check')add(topic,'Weigh or measure the usable '+itemName(d,s,o.itemId)+' from one normal batch.',true);else if(o.status!=='estimate'||decimal(o.amount)===null||decimal(o.amount)!<=0||!o.unit)add(topic,'Enter the usable output amount and unit, or choose I need to check.');if(o.status==='estimate'&&['packs','portions'].includes(o.unit)){if(!(o.unit==='packs'?o.pack:o.meaning).trim())add(topic,'Describe this '+(o.unit==='packs'?'pack':'portion')+' so the count has an exact meaning.');if(!o.content||!o.contentUnit)add(topic,'Measure the net content of one normal '+(o.unit==='packs'?'pack':'portion')+'; its count is not weight.',true);else if(decimal(o.content)===null||decimal(o.content)!<=0)add(topic,'Enter a positive net content or leave it for weighing.');}}
 if(p.workStatus==='check')add('work','Measure active work for one normal batch, including setup, packing and cleanup, and record how many people worked.',true);
 else if(p.coverage!=='Already counted in another task'&&(p.workStatus!=='estimate'||decimal(p.minutes)===null||decimal(p.minutes)!<0||!p.crewMode||(p.crewMode==='Constant crew'&&(decimal(p.people)===null||decimal(p.people)!<1||!Number.isInteger(decimal(p.people))))))add('work','Enter active minutes and crew, or choose Needs measuring.');
 if(p.workStatus!=='check'){
  if(!p.coverage)add('work','Clarify which parts the active time includes.');
  else if(p.coverage==='Already counted in another task'){
   const parent=q.processes.find(x=>x.id===p.countedIn&&x.id!==p.id&&linked(q,x));
   if(!parent||!includedWorkKnown(p,q,d,s))add('work','Identify the active local task that includes this work and confirm its complete work scope.',true);
  }else if(p.coverage!=='Whole named task')add('work','Measure the missing parts of the named task.',true);
 }

 for(const [topic,status,value] of [['frequency',p.fullStatus,p.full],['topups',p.topupStatus,p.topups]]){if(status==='check')add(topic,'Count '+(topic==='frequency'?'full batches':'small top-ups')+' in a usual operating week.',true);else if(status!=='estimate'||decimal(value)===null||decimal(value)!<0)add(topic,'Enter '+(topic==='frequency'?'full batches':'top-ups')+' per usual week, including 0 if none, or choose I need to check.');}
 if(!p.trigger)add('trigger','Choose what usually starts the next batch.');if(p.trigger==='Not sure')add('trigger','Observe what triggers the next full batch or emergency top-up.',true);if(p.trigger==='Something else'&&!p.triggerOther.trim())add('trigger','Describe the other trigger.');
 if(!p.limits.length)add('limits','Choose what prevents less frequent preparation.');if(p.limits.includes('Other')&&!p.limitOther.trim())add('limits','Describe the other limit.');if(p.limits.some(x=>['Not sure','Storage or cooling limits are not confirmed','No known limit, not tested'].includes(x)))add('limits','Check the exact product state, storage/cooling rule and practical limit before testing a larger reserve.',true);if(p.limits.length&&!p.limitBasis)add('limits','Say whether the limit was observed or is an assumption.');if(p.limitBasis==='I need to check')add('limits','Observe or verify the reported limit.',true);
 return g;
}
export function activeFacts(p:QuickProcess,d:Draft,s:ReviewSource){const scope={id:p.id,name:p.name,kind:p.kind,inputId:p.inputId,separation:p.separation,sharedScope:p.sharedScope,products:outputs(p).map(o=>({id:o.id,itemId:o.itemId})),context:p.context};return productionActive(p,d,s)?{...p,outputs:outputs(p)}:scope;}
export function processHash(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource){const parent=q.processes.find(x=>x.id===p.countedIn);return JSON.stringify({facts:activeFacts(p,d,s),week:q.week,...(parent?{countedIn:activeFacts(parent,d,s)}:{})});}
function normalizedFacts(f:Record<string,unknown>){
 const p=f as unknown as QuickProcess;
 const scope={id:p.id,name:p.name,kind:p.kind,inputId:p.kind==='A later step using an existing preparation'?p.inputId:'',inputTask:p.kind==='A later step using an existing preparation'?p.inputTask??'':'',inputOutput:p.kind==='A later step using an existing preparation'?p.inputOutput??'':'',separation:p.kind==='A later step using an existing preparation'?p.separation:'',sharedScope:p.sharedScope,products:(Array.isArray(f.products)?f.products:outputs(p).map(o=>({id:o.id,itemId:o.itemId})))};
 if(!Array.isArray(f.outputs))return scope;
 return {...scope,outputs:outputs(p).map(o=>({id:o.id,itemId:o.itemId,stage:o.stage,status:o.status,...(o.status==='check'?{}:{amount:o.amount,unit:o.unit,...(['packs','portions'].includes(o.unit)?{description:o.unit==='packs'?o.pack:o.meaning,content:o.content,contentUnit:o.contentUnit}:{})})})),workStatus:p.workStatus,...(p.workStatus==='check'?{}:{coverage:p.coverage,...(p.coverage==='Already counted in another task'?{countedIn:p.countedIn}:{minutes:p.minutes,crewMode:p.crewMode,people:p.crewMode==='Constant crew'?p.people:''})}),fullStatus:p.fullStatus,full:p.fullStatus==='check'?'':p.full,topupStatus:p.topupStatus,topups:p.topupStatus==='check'?'':p.topups,trigger:p.trigger,triggerOther:p.trigger==='Something else'?p.triggerOther:'',emergency:p.emergency,limits:[...p.limits].sort(),limitBasis:p.limitBasis,limitOther:p.limits.includes('Other')?p.limitOther:''};
}
function caseTask(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource){
 const facts=normalizedFacts(activeFacts(p,d,s)),work=countedTarget(p)?checkDependencies(p,q,d,s,'work'):undefined;
 const parent=p.kind==='A later step using an existing preparation'?q.processes.find(x=>x.id===p.inputTask&&linked(q,x)):undefined;
 const input=parent?{id:parent.id,kind:parent.kind,scope:parent.sharedScope,output:outputs(parent).find(o=>o.id===p.inputOutput)}:undefined;
 return {facts,...(work?{work}:{}),...(input?{input}:{})};
}
function caseValues(id:string,q:Quick,d:Draft,s:ReviewSource){return q.cases.find(c=>c.id===id)?.processIds.map(pid=>{const p=q.processes.find(x=>x.id===pid);return p?caseTask(p,q,d,s):null;});}
export function caseHash(id:string,q:Quick,d:Draft,s:ReviewSource){return stamp('case',caseValues(id,q,d,s));}
function caseValid(saved:string|undefined,id:string,q:Quick,d:Draft,s:ReviewSource){
 if(!saved)return false;if(saved.startsWith('qr2:'))return saved===caseHash(id,q,d,s);
 try{const old=JSON.parse(saved);if(!Array.isArray(old))return false;const records=old.map(v=>v?JSON.parse(v):null),historical={...q,processes:records.flatMap(v=>v?[v.facts,...(v.countedIn?[v.countedIn]:[])]:[])};
 const values=records.map(v=>v?Array.isArray(v.facts.outputs)?caseTask(v.facts,historical,d,s):{facts:normalizedFacts(v.facts)}:null);
 return stamp('case',values)===caseHash(id,q,d,s);}catch{return false;}
}
export function caseGaps(id:string,q:Quick,d:Draft,s:ReviewSource):Gap[]{const c=q.cases.find(x=>x.id===id),ps=q.processes.filter(p=>c?.processIds.includes(p.id)),missing=caseItemIds(s,id).filter(item=>s.notebook.items.some(i=>i.id===item)&&!ps.some(p=>outputs(p).some(o=>o.itemId===item)));return [...ps.flatMap(p=>gaps(p,q,d,s)),...missing.map(item=>({topic:'scope',message:'Describe the work for '+itemName(d,s,item)+', link the task that covers it, or explicitly mark it as unknown/no local prep.',unknown:false}))];}
export function caseProgress(id:string,q:Quick,d:Draft,s:ReviewSource){const c=q.cases.find(x=>x.id===id);const ps=q.processes.filter(p=>c?.processIds.includes(p.id));const all=caseGaps(id,q,d,s);const finished=caseValid(c?.finished,id,q,d,s)&&ps.length>0&&!all.some(x=>!x.unknown);const checking=all.some(x=>x.unknown)||q.checks.some(t=>ps.some(p=>p.id===t.processId)&&checkOpen(t,q,d,s));return {finished,unknown:checking,label:finished?(checking?'Answers complete · needs checking':'Answers complete'):ps.some(p=>p.kind||p.name||p.sharedScope||p.context)?'In progress':'Not started',needsReview:!!c?.finished&&!finished};}
function checkDependencies(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource,topic:string):unknown{
 const f=normalizedFacts(activeFacts(p,d,s)) as Record<string,unknown>;
 const upstream=p.kind==='A later step using an existing preparation'?q.processes.find(x=>x.id===p.inputTask&&linked(q,x)):undefined;
 const scope={id:p.id,kind:p.kind,scope:p.sharedScope,...(upstream?{inputState:outputs(upstream).find(o=>o.id===p.inputOutput),inputScope:upstream.sharedScope}:{}),input:f.inputId,inputTask:f.inputTask,inputOutput:f.inputOutput,separation:f.separation,active:productionActive(p,d,s)};
 const output=(f.outputs as Record<string,unknown>[]|undefined)?.find(o=>'output:'+o.id===topic);
 if(topic.startsWith('output:'))return {scope,output};
 if(topic==='scope')return {scope,products:f.products};
 const batch=(f.outputs as Record<string,unknown>[]|undefined);
 if(topic==='work'){
  const chain=[];const seen=new Set<string>([p.id]);let parent=q.processes.find(x=>x.id===countedTarget(p));
  while(parent&&!seen.has(parent.id)){seen.add(parent.id);const facts=normalizedFacts(activeFacts(parent,d,s));chain.push({id:parent.id,active:linked(q,parent)&&productionActive(parent,d,s),kind:facts.kind,scope:facts.sharedScope,outputs:'outputs' in facts?facts.outputs:undefined,workStatus:'workStatus' in facts?facts.workStatus:undefined,coverage:'coverage' in facts?facts.coverage:undefined,minutes:'minutes' in facts?facts.minutes:undefined,crew:'crewMode' in facts?facts.crewMode:undefined,people:'people' in facts?facts.people:undefined,countedIn:countedTarget(parent)});parent=q.processes.find(x=>x.id===countedTarget(parent!));}
  return {scope,batch,name:p.name,workStatus:f.workStatus,coverage:f.coverage,minutes:f.minutes,crew:f.crewMode,people:f.people,countedIn:f.countedIn,chain};
 }
 if(topic==='frequency')return {scope,batch,status:f.fullStatus,value:f.full};
 if(topic==='topups')return {scope,batch,status:f.topupStatus,value:f.topups};
 if(topic==='trigger')return {scope,trigger:f.trigger,other:f.triggerOther,emergency:f.emergency};
 return {scope,batch,limits:f.limits,basis:f.limitBasis,other:f.limitOther};
}
export function checkHash(t:QuickCheck,q:Quick,d:Draft,s:ReviewSource){const p=q.processes.find(x=>x.id===t.processId);return stamp('check',{dependencies:p?checkDependencies(p,q,d,s,t.topic):null,result:t.result,evidence:t.evidence,by:t.performedBy,on:t.performedOn});}
function validCheck(t:QuickCheck,q:Quick,d:Draft,s:ReviewSource){
 if(!t.closedHash)return false;if(t.closedHash.startsWith('qr2:'))return t.closedHash===checkHash(t,q,d,s);
 const p=q.processes.find(x=>x.id===t.processId);
 if(t.closedHash.startsWith('qr1:sha256:'))return t.closedHash==='qr1:sha256:'+digest(JSON.stringify({process:p?processHash(p,q,d,s):null,result:t.result,evidence:t.evidence,by:t.performedBy,on:t.performedOn}));
 try{const old=JSON.parse(t.closedHash),saved=JSON.parse(old.process);if(!Array.isArray(saved.facts.outputs))return t.closedHash===JSON.stringify({process:p?processHash(p,q,d,s):null,result:t.result,evidence:t.evidence,by:t.performedBy,on:t.performedOn});const historical={...q,processes:[saved.facts,...(saved.countedIn?[saved.countedIn]:[])]};return checkHash({...t,result:old.result,evidence:old.evidence,performedBy:old.by,performedOn:old.on},historical,d,s)===checkHash(t,q,d,s);}catch{return false;}
}
export function gapOrigin(p:QuickProcess,topic:string):'draft-gap'|'explicit'{
 const explicit=topic.startsWith('output:')?outputs(p).some(o=>'output:'+o.id===topic&&o.status==='check'):topic==='scope'?p.kind==='I need to check'||p.sharedScope==='I need to check'||p.inputTask==='unknown':topic==='work'?p.workStatus==='check'||p.countedIn==='unknown'||['Some parts missing','Not sure'].includes(p.coverage):topic==='frequency'?p.fullStatus==='check':topic==='topups'?p.topupStatus==='check':true;
 return explicit?'explicit':'draft-gap';
}
export function syncChecks(q:Quick,d:Draft,s:ReviewSource):Quick{const next=structuredClone(q);for(const p of next.processes)if(linked(next,p))for(const g of gaps(p,next,d,s).filter(g=>g.unknown)){const id=p.id+':'+g.topic,existing=next.checks.find(t=>t.id===id),origin=gapOrigin(p,g.topic);if(existing){if(existing.origin==='draft-gap'&&origin==='explicit')existing.origin='explicit';}else next.checks.push({id,processId:p.id,topic:g.topic,origin,method:g.message,owner:'',due:'',result:'',evidence:'',performedBy:'',performedOn:''});}return next;}
export function checkRelevant(t:QuickCheck,q:Quick,d:Draft,s:ReviewSource){const p=q.processes.find(x=>x.id===t.processId);return !!p&&linked(q,p)&&(t.topic==='scope'||productionActive(p,d,s))&&(!t.topic.startsWith('output:')||outputs(p).some(o=>'output:'+o.id===t.topic));}
export function checkUnneeded(t:QuickCheck,q:Quick,d:Draft,s:ReviewSource){const p=q.processes.find(x=>x.id===t.processId);return t.origin==='draft-gap'&&!t.owner&&!t.due&&!t.result&&!t.evidence&&!t.performedBy&&!t.performedOn&&!t.closedHash&&!!p&&!gaps(p,q,d,s).some(g=>g.topic===t.topic&&g.unknown);}
export function checkOpen(t:QuickCheck,q:Quick,d:Draft,s:ReviewSource){return checkRelevant(t,q,d,s)&&!checkUnneeded(t,q,d,s)&&t.withdrawn?.hash!==checkHash(t,q,d,s)&&!validCheck(t,q,d,s);}
export function withdrawQuickCheck(d:Draft,id:string,s:ReviewSource,reason:string,by:string){const q=d.quick,t=q?.checks.find(t=>t.id===id);if(!q||!t||!reason.trim()||reason.length>2000)throw Error('Give a specific reason for withdrawing this check.');const p=q.processes.find(x=>x.id===t.processId);if(p&&checkRelevant(t,q,d,s)&&gaps(p,q,d,s).some(g=>g.topic===t.topic))throw Error('This answer still needs clarification. Correct its scope or resolve the check first.');t.withdrawn={hash:checkHash(t,q,d,s),reason,by,at:new Date().toISOString()};}
export function quickProgress(d:Draft,s:ReviewSource){const q=d.quick??emptyQuick(),answered=q.cases.filter(c=>caseProgress(c.id,q,d,s).finished).length;const checks=q.checks.filter(t=>checkOpen(t,q,d,s));return {answered,total:8,remaining:8-answered,openChecks:checks.length,proposed:checks.filter(t=>!t.owner.trim()||!dateValid(t.due)||!t.method.trim()).length,assigned:checks.filter(t=>t.owner.trim()&&dateValid(t.due)&&t.method.trim()).length};}
export function weeklyWork(p:QuickProcess,q:Quick,d:Draft,s:ReviewSource){const errors=gaps(p,q,d,s);const blocking=errors.some(g=>['scope','work','frequency'].includes(g.topic));if(!productionActive(p,d,s)||blocking||p.workStatus!=='estimate'||p.coverage!=='Whole named task'||p.fullStatus!=='estimate')return null;const minutes=decimal(p.minutes)!*(p.crewMode==='Constant crew'?decimal(p.people)!:1);return {minutes:minutes*decimal(p.full)!,incomplete:p.topupStatus!=='estimate'||decimal(p.topups)!>0,basis:'Estimate, not measured'};}
export function validateQuick(next:Draft,current:Draft,s:ReviewSource,isOwner:boolean){
 if(current.quick&&!next.quick)throw Error('Keep the short review and its history when recovering older answers.');if(!next.quick)return;
 const q=quickSchema.parse(next.quick);if(!q.week.unknown&&q.week.days&&(decimal(q.week.days)===null||decimal(q.week.days)!<1||decimal(q.week.days)!>7||!Number.isInteger(decimal(q.week.days))))throw Error('Use 1–7 operating days or choose I need to check.');if(!same(q.cases.map(c=>c.id).sort(),cases.map(c=>c.id).sort()))throw Error('Keep the eight configured cases.');
 const unique=(ids:string[])=>new Set(ids).size===ids.length;if(!unique(q.processes.map(p=>p.id))||!unique(q.checks.map(t=>t.id)))throw Error('Duplicate task or check identity.');
 for(const c of q.cases){if(!unique(c.processIds)||c.processIds.some(id=>!q.processes.some(p=>p.id===id)))throw Error('Choose an existing task for each case.');if(c.finished&&c.finished!==current.quick?.cases.find(x=>x.id===c.id)?.finished&&(c.finished!==caseHash(c.id,q,next,s)||!c.processIds.length||caseGaps(c.id,q,next,s).some(g=>!g.unknown)))throw Error('Complete the relevant questions or explicitly mark them for checking before finishing this case.');}
 for(const old of current.quick?.processes??[]){const updated=q.processes.find(p=>p.id===old.id);if(!updated)throw Error('Keep previous tasks; detach them from a case instead of deleting their answers.');for(const o of old.outputs)if(!updated.outputs.some(x=>x.id===o.id&&x.itemId===o.itemId))throw Error('Keep previous outputs; deselect them without deleting their answers.');}
 for(const p of q.processes){if(!unique(p.outputs.map(o=>o.id)))throw Error('Duplicate output identity.');if(p.limits.some(x=>x==='Not sure'||x==='No known limit, not tested')&&p.limits.length>1)throw Error('Choose a known limit or uncertainty, not both.');if(linked(q,p)&&productionActive(p,next,s)&&countedTarget(p)){const seen=new Set([p.id]);let at:QuickProcess|undefined=p;while(at&&linked(q,at)&&productionActive(at,next,s)&&countedTarget(at)){if(seen.has(at.countedIn))throw Error('Work cannot be counted in a circular chain of tasks.');seen.add(at.countedIn);at=q.processes.find(x=>x.id===at!.countedIn);}}
  // Old inactive answers stay in history. New excluded production answers are rejected, not silently erased.
  const old=current.quick?.processes.find(x=>x.id===p.id);if(!productionActive(p,next,s)){const inactive=(x:QuickProcess)=>({outputs:x.outputs.map(o=>({id:o.id,status:o.status,amount:o.amount,unit:o.unit,pack:o.pack,content:o.content,contentUnit:o.contentUnit,meaning:o.meaning,stage:o.stage})).filter(o=>o.status||o.amount||o.unit||o.pack||o.content||o.contentUnit||o.meaning||o.stage),workStatus:x.workStatus,minutes:x.minutes,crewMode:x.crewMode,people:x.people,coverage:x.coverage,countedIn:x.countedIn,fullStatus:x.fullStatus,full:x.full,topupStatus:x.topupStatus,topups:x.topups,trigger:x.trigger,emergency:x.emergency,triggerOther:x.triggerOther,limits:x.limits,limitBasis:x.limitBasis,limitOther:x.limitOther});const currentFacts=inactive(p),oldFacts=inactive(old??emptyProcess());const allowed=currentFacts.outputs.every(o=>oldFacts.outputs.some(x=>same(x,o)))&&Object.entries(currentFacts).filter(([k])=>k!=='outputs').every(([k,v])=>same(v,oldFacts[k as keyof typeof oldFacts])||v===''||v===false||Array.isArray(v)&&v.length===0);if(!allowed)throw Error('Production answers are outside this task’s confirmed local scope. Keep the old answers and clarify the scope first.');}}
 // Later work may reuse a product in a new physical state, but separate tasks cannot form a production cycle.
 const visit=(p:QuickProcess,path:Set<string>)=>{if(path.has(p.id))throw Error('Later preparations cannot form a circular production chain.');const nextPath=new Set(path).add(p.id);if(p.kind==='A later step using an existing preparation'&&productionActive(p,next,s)){if(p.inputTask===p.id)throw Error('A task cannot use its own output as the preceding task.');const parent=q.processes.find(x=>x.id===p.inputTask&&linked(q,x));if(parent&&productionActive(parent,next,s))visit(parent,nextPath);}};for(const p of q.processes.filter(p=>linked(q,p)))visit(p,new Set());
 for(const id of Object.keys(current.quick?.offers??{}))if(!q.offers[id])throw Error('Keep previous source decisions when recovering answers.');
 for(const old of current.quick?.checks??[])if(!q.checks.some(t=>t.id===old.id))throw Error('Keep existing checks and their history.');
 for(const p of q.processes.filter(p=>linked(q,p)))for(const g of gaps(p,q,next,s).filter(g=>g.unknown))if(!q.checks.some(t=>t.processId===p.id&&t.topic===g.topic))throw Error('Keep a specific check proposal for each explicit unknown.');
 for(const t of q.checks){const old=current.quick?.checks.find(x=>x.id===t.id);if(!q.processes.some(p=>p.id===t.processId))throw Error('A check needs its existing task.');if(!checkRelevant(t,q,next,s)&&!same(t,old))throw Error('This production check is outside the active scope; its historical answers are preserved.');if(!old&&!['scope','work','frequency','topups','trigger','limits'].includes(t.topic)&&!q.processes.find(p=>p.id===t.processId)?.outputs.some(o=>'output:'+o.id===t.topic))throw Error('Choose a real quick-review field for this check.');if(!same(t.withdrawn,old?.withdrawn))throw Error('Use the owner’s explicit check withdrawal action.');if(old&&t.origin!==old.origin&&!(old.origin==='draft-gap'&&t.origin==='explicit'&&gapOrigin(q.processes.find(p=>p.id===t.processId)!,t.topic)==='explicit'))throw Error('Keep the original check origin.');if(!old&&t.origin==='draft-gap'&&gapOrigin(q.processes.find(p=>p.id===t.processId)!,t.topic)==='explicit')throw Error('An explicit unknown is not a temporary draft.');if(t.closedHash!==old?.closedHash)throw Error('Use the explicit check completion action.');if(old&&(t.processId!==old.processId||t.topic!==old.topic))throw Error('Keep the original check target.');if(!isOwner&&(!same([t.owner,t.due],[old?.owner??'',old?.due??''])||old&&!same(t.method,old.method)))throw Error('The owner assigns and changes the check plan.');}
 if(!isOwner&&!same(q.approval,current.quick?.approval??emptyQuick().approval))throw Error('Only the owner may prepare approval.');
}
export function closeQuickCheck(d:Draft,id:string,s:ReviewSource){const q=d.quick,t=q?.checks.find(x=>x.id===id);if(!q||!t)throw Error('Check not found.');if(!checkRelevant(t,q,d,s))throw Error('This check is outside the current scope. Its history is preserved.');const p=q.processes.find(x=>x.id===t.processId)!;if(!t.owner.trim()||!dateValid(t.due)||!t.method.trim()||!t.result.trim()||!t.evidence.trim()||!t.performedBy.trim()||!dateValid(t.performedOn)||t.performedOn>today())throw Error('Record the assignment, result, evidence, person and actual date first.');if(gaps(p,q,d,s).some(g=>g.topic===t.topic))throw Error('Correct the linked answer before closing this check. It still needs clarification.');t.closedHash=checkHash(t,q,d,s);}
