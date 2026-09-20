import type {ReviewSource} from '../data-review';
import {same,decimal,type Draft,type Entity,type Readiness} from '../review-v2/model';
import type {Proposal,Patch} from '../review-v2/proposals';
import {emptyBatch} from '../batch-profile';
import {activeFacts,processHash,gaps,productionActive,caseProgress,checkOpen} from './model';
import type {Values} from '../review-v2/fields';

export function quickProposal(source:ReviewSource,d:Draft,ids:string[]):Proposal{
 const q=d.quick;if(!q||ids.length!==1)throw Error('Preview one existing short-review task at a time.');
 const p=q.processes.find(p=>'quick:'+p.id===ids[0]);if(!p)throw Error('The selected short-review task is unavailable.');
 const related=q.cases.filter(c=>c.processIds.includes(p.id));if(!related.length||related.some(c=>!caseProgress(c.id,q,d,source).finished))throw Error('Finish the related case answers first. Unknown answers can remain named checks.');
 const errors=gaps(p,q,d,source);if(errors.some(g=>!g.unknown))throw Error('Complete the missing answers before previewing this correction.');
 const facts=activeFacts(p,d,source),entity:Entity={id:'quick:'+p.id,kind:'process',name:p.name||p.kind,parentId:undefined,archived:false,answers:{'QUICK-01':{facts,week:q.week,basis:'Chef estimate — limited quick review'} as unknown as Values},confirmations:{}},patches:Patch[]=[],warnings:string[]=[];
 const output=p.outputs[0],old=source.notebook.items.find(i=>i.id===output?.itemId);
 // The old batch profile describes ONE whole usual preparation, with a single cook and no separate top-up count.
 // Only this strictly compatible subset can replace it. Shared output and partial work stay in their process record.
 const note=((old?.prepProfile?.batch?.note??'')+'\nQuick review scope: '+p.name+'; output state: '+(output?.stage??'')+'. One person, whole named task; usual-week estimate.').trim();
 const checks=q.checks.filter(t=>t.processId===p.id),openChecks=checks.some(t=>checkOpen(t,q,d,source));
 const eligible=!openChecks&&note.length<=2000&&productionActive(p,d,source)&&p.kind==='A separate preparation'&&p.outputs.length===1&&p.sharedScope==='All this work is local and separate'&&!errors.length&&p.crewMode==='One person'&&p.coverage==='Whole named task'&&p.topupStatus==='estimate'&&decimal(p.topups)===0&&(decimal(p.full)??0)>0&&(decimal(p.minutes)??0)>0&&output.status==='estimate'&&['kg','g','l','ml','pieces'].includes(output.unit)&&old?.prepProfile&&['ahead','hybrid'].includes(old.prepProfile.workflow??'')&&!q.processes.some(other=>other.id!==p.id&&other.outputs.some(o=>o.itemId===output.itemId)&&q.cases.some(c=>c.processIds.includes(other.id)));
 if(eligible&&old?.prepProfile){const profile=structuredClone(old.prepProfile),batch=profile.batch??emptyBatch();profile.batch={...batch,basis:'estimate',output:{amount:Number(output.amount.replace(',','.')),unit:output.unit as 'kg'|'g'|'l'|'ml'|'pieces',unitOther:'',unknown:false},frequency:{times:Number(p.full.replace(',','.')),period:'week',unknown:false},work:{minutes:Number(p.minutes.replace(',','.')),unknown:false},schedule:p.emergency?'mixed':p.trigger==='A planned prep list'?'planned':p.trigger==='Not sure'?'unknown':'unplanned',note};if(!same(old.prepProfile,profile))patches.push({kind:'item',id:old.id,field:'prepProfile',before:old.prepProfile,after:profile,label:old.name+' · usual batch estimate (other preparation fields preserved)'});}
 warnings.push('This stores a limited process record, not a complete recipe, measured run or approved storage rule.');
 if(!patches.length)warnings.push('No flat Recipe Notebook field can be changed safely from this task. Applying stores only the approved process record; existing recipe and batch fields remain unchanged.');
 if(openChecks||errors.some(g=>g.unknown))warnings.push('Unresolved checks remain open. Applying this limited record does not verify those values.');
 const readiness:Readiness[]=[{dimension:'Quick routine estimate',status:errors.length?'Partial — named gaps':productionActive(p,d,source)?'Usable estimate':'Not applicable',gaps:errors.map(g=>({entityId:entity.id,group:'QUICK-01',path:[g.topic],message:g.message,hard:!g.unknown})),scope:entity.name+' · only this stated task',estimates:productionActive(p,d,source)?1:0}];
 const fingerprint=JSON.stringify({quick:1,process:processHash(p,q,d,source),checks,patches});
 return {entities:[entity],patches,warnings,readiness,fingerprint,quick:{version:1}};
}
