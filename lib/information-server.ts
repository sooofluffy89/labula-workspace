import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {RequestError,workspaceRole} from './notebook-server';
import {validateNotebook,type Notebook} from './notebook';
import {REVIEW_ID,type ReviewSource} from './data-review';
import {migrate,type Draft,type Authority,values,list,taskHash,activeEntity} from './review-v2/model';
import {productionExcluded} from './review-v2/applied';
import {cases,caseProgress,checkOpen,outputs,productionActive,activeFacts} from './quick-review/model';
import {quickProposal} from './quick-review/proposal';
import {proposal} from './review-v2/proposals';
import {groups} from './review-v2/fields';
import {menu} from './menu';
import {itemVariants,type InformationTarget,type Information,type RelatedReview,type ReviewInformation,type SourceInformation,type StockInformation} from './information';
import {validGroup} from './ingredient-groups';
import type {Round} from './check-rounds';

type ReviewRow={source:string;payload:string;updated_at:string;updated_by:string};
type AuthRow={id:string;kind:Authority['kind'];entity_id:string;fingerprint:string;payload:string;actor_email:string;created_at:string};
async function reviewData(){const row=await getRawDb().prepare('SELECT source,payload,updated_at,updated_by FROM data_reviews WHERE id=?').bind(REVIEW_ID).first<ReviewRow>();if(!row)return null;const source=JSON.parse(row.source) as ReviewSource;return {row,source,draft:migrate(source,JSON.parse(row.payload))};}
function related(d:Draft,s:ReviewSource,itemId:string):RelatedReview[]{
 const q=d.quick;const result:RelatedReview[]=q?cases.filter(c=>c.items.includes(itemId)||q.cases.find(x=>x.id===c.id)?.processIds.some(id=>{const p=q.processes.find(x=>x.id===id);return p&&(p.inputId===itemId||outputs(p).some(o=>o.itemId===itemId));})).map(c=>({id:c.id,name:c.name,status:caseProgress(c.id,q,d,s).label,openChecks:q.checks.filter(t=>q.cases.find(x=>x.id===c.id)?.processIds.includes(t.processId)&&checkOpen(t,q,d,s)).length})):[];
 for(const e of d.entities.filter(e=>!e.archived&&(e.id===itemId||e.sourceId===itemId||e.parentId===itemId||values(e,'STORE-01').item===itemId||list(values(e,'PROC-03'),'outputs').some(o=>o.item===itemId))))if(Object.keys(e.answers).length)result.push({id:e.id,name:e.name,status:'Recorded review · separate from notebook',openChecks:d.tasks.filter(t=>t.targets.some(x=>x.entityId===e.id)&&t.closedHash!==taskHash(d,t)).length});
 return result;
}
async function readReview(id:string):Promise<ReviewInformation>{
 const data=await reviewData();if(!data)throw new RequestError('No saved review is available.',404);const {draft:d,source:s,row}=data,q=d.quick,c=cases.find(c=>c.id===id),e=d.entities.find(e=>e.id===id);
 if(!c&&!e)throw new RequestError('This review record is unavailable.',404);
 const auth=(await getRawDb().prepare('SELECT id,kind,entity_id,fingerprint,payload,actor_email,created_at FROM review_authority WHERE review_id=? ORDER BY created_at DESC').bind(REVIEW_ID).all<AuthRow>()).results;
 const processes=(q&&c?q.processes.filter(p=>q.cases.find(x=>x.id===id)?.processIds.includes(p.id)):[]).map(p=>{
  let fingerprint:string|null=null;try{fingerprint=quickProposal(s,d,['quick:'+p.id]).fingerprint;}catch{/* incomplete answers have no current approvable proposal */}
  const approvals=auth.filter(a=>a.kind==='approval'&&a.entity_id.split(',').includes('quick:'+p.id));
  const current=approvals.find(a=>a.fingerprint===fingerprint),prior=approvals[0],applied=current&&auth.find(a=>a.kind==='applied'&&a.entity_id===current.id);
  const historical=prior&&auth.some(a=>a.kind==='applied'&&a.entity_id===prior.id);
  return {id:p.id,name:p.name||p.kind||'Unnamed task',facts:activeFacts(p,d,s),production:productionActive(p,d,s),checks:q!.checks.filter(t=>t.processId===p.id).map(t=>({...t,open:checkOpen(t,q!,d,s)})),approval:applied?'Applied · approved version matches these answers':current?'Approved · not applied':prior?(historical?'Earlier version applied · current answers not approved':'Earlier approval · answers have changed'):'Not approved · not applied',approvalBy:(current??prior)?.actor_email,approvalAt:(current??prior)?.created_at,outputs:outputs(p).map(o=>({id:o.itemId,name:s.notebook.items.find(i=>i.id===o.itemId)?.name??'Unavailable product'}))};
 });
 let legacyStatus='Not approved · not applied';if(e){const a=auth.find(a=>a.kind==='approval'&&a.entity_id.split(',').includes(e.id));if(a){let matches=false;try{matches=proposal(s,d,a.entity_id.split(','),auth.map(x=>({kind:x.kind,entityId:x.entity_id,fingerprint:x.fingerprint,payload:JSON.parse(x.payload),actor:x.actor_email,at:x.created_at}))).fingerprint===a.fingerprint;}catch{}const applied=auth.some(x=>x.kind==='applied'&&x.entity_id===a.id);legacyStatus=(matches?(applied?'Applied':'Approved · not applied'):(applied?'Earlier version applied · current answers not approved':'Earlier approval · current answers not approved'))+' · '+a.actor_email+' · '+a.created_at;}}
 return {kind:'review',legacyStatus,legacyChecks:e?d.tasks.filter(t=>t.targets.some(x=>x.entityId===e.id)).map(t=>({...t,open:t.closedHash!==taskHash(d,t)})):[],week:q?.week??null,references:Object.fromEntries([...s.notebook.items.map(i=>[i.id,i.name]),...d.entities.map(e=>[e.id,e.name]),...(q?.processes??[]).map(p=>[p.id,p.name||p.kind])]),name:c?.name??e!.name,status:c&&q?caseProgress(id,q,d,s).label:'Recorded review · separate from notebook',updatedAt:row.updated_at,updatedBy:row.updated_by,processes,legacy:e?Object.entries(activeEntity(d,e,s).answers).filter(([,v])=>Object.keys(v).length).map(([key,v])=>({title:groups.find(g=>g.id===key)?.title??key,values:Object.fromEntries(Object.entries(v).map(([k,v])=>[groups.find(g=>g.id===key)?.fields.find(f=>f.key===k)?.label??k,v]))})):[]};
}

export async function readInformation(user:ChatGPTUser,target:InformationTarget):Promise<Information>{
 const db=getRawDb();
 const member=await db.prepare('SELECT active FROM kitchen_team WHERE user_id=? OR email=?').bind(user.userId,user.email.toLowerCase()).first<{active:number}>();
 if(member&&!member.active)throw new RequestError('Your access is paused. Ask the owner to check your profile.',403);
 const role=await workspaceRole(user);if(role==='cook'&&target.kind!=='source')throw new RequestError('Your Cook role includes Evening check and Morning prep only.',403,'role_restricted');
 if(target.kind==='source'){
  // A transactionally consistent read: no roster initialisation or correction command.
  const rs=await db.batch([db.prepare('SELECT version,stage FROM evening_checks WHERE id=?').bind(target.id),db.prepare('SELECT * FROM evening_versions WHERE check_id=? AND version=coalesce(?,(SELECT version FROM evening_checks WHERE id=?))').bind(target.id,target.version??null,target.id)]);
  const current=rs[0].results[0] as {version:number;stage:string}|undefined,row=rs[1].results[0] as {version:number;payload:string;created_at:string;created_by:string}|undefined;
  if(!row||!current)throw new RequestError('This confirmed check version was not recorded or is unavailable.',404);
  const saved=JSON.parse(row.payload) as {targetDay:string;answers:SourceInformation['answers']};
  if(!Array.isArray(saved.answers))throw new RequestError('Answers were not recorded in this historical version.',404);
  if(target.item&&!saved.answers.some(a=>a.itemId===target.item))throw new RequestError('This item is not in the selected confirmed check version.',404);
  return {kind:'source',id:target.id,version:row.version,targetDay:saved.targetDay,confirmedAt:row.created_at,confirmedBy:row.created_by,answers:saved.answers.map(a=>({itemId:a.itemId,catalogId:a.catalogId,name:a.name,kind:a.kind,value:a.value,updatedAt:a.updatedAt,updatedBy:a.updatedBy,supersededBy:a.supersededBy??null,groupId:validGroup(a.groupId),round:a.round??null,instruction:a.instruction??null,feedbackCount:a.feedbackCount??0})),latestVersion:current.version,correcting:current.stage==='draft',item:target.item};
 }
 if(target.kind==='review')return readReview(target.id);
 if(target.kind==='history')throw new RequestError('Use the filtered activity view.');
 const row=await db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'").first<{payload:string;revision:number}>();if(!row)throw new RequestError('The saved notebook is not available.',404);const n:Notebook=validateNotebook(JSON.parse(row.payload));
 if(target.kind==='recipe'){const recipe=n.recipes.find(r=>r.id===target.id);if(!recipe)throw new RequestError('This recipe variant is unavailable.',404);if(target.item&&!recipe.inputs.some(i=>i.itemId===target.item))throw new RequestError('The ingredient is no longer listed in this variant. Return and refresh its usage.',409);return {kind:'recipe',recipe,dish:menu.find(m=>m.id===recipe.menuId)?.name??recipe.menuId,items:n.items.filter(i=>recipe.inputs.some(p=>p.itemId===i.id)),highlight:target.item};}
 if(target.kind==='usage'){const found=itemVariants(n,target.item).find(d=>d.id===target.id);if(!found)throw new RequestError('No recorded use remains in this dish. Refresh the ingredient detail.',404);const variants=found.variants.filter(r=>r.active===(target.active??true));if(!variants.length)throw new RequestError('No matching variant remains in this view. Refresh the ingredient detail.',404);if(variants.length===1){const recipe=variants[0];return {kind:'recipe',dish:found.name,recipe,items:n.items.filter(i=>recipe.inputs.some(p=>p.itemId===i.id)),highlight:target.item};}return {kind:'usage',dish:found.name,item:target.item,variants};}
 const item=n.items.find(i=>i.id===target.id)??null;
 const stock=await db.prepare('SELECT included,track,group_id,round_id FROM stock_items WHERE item_id=?').bind(target.id).first<{included:number;track:number;group_id:string|null;round_id:string|null}>();
 let round:Round|null=null;if(stock?.round_id){const r=await db.prepare('SELECT * FROM check_rounds WHERE id=?').bind(stock.round_id).first<{id:Round['id'];days:string;revision:number;updated_at:string;updated_by:string}>();if(r)round={id:r.id,days:JSON.parse(r.days),revision:r.revision,updatedAt:r.updated_at,updatedBy:r.updated_by};}
 let mergedInto:string|null=null;if(!item){const ops=(await db.prepare("SELECT id,request FROM catalog_operations WHERE retired_id=? AND NOT EXISTS (SELECT 1 FROM catalog_operations u WHERE u.undo_of=catalog_operations.id) ORDER BY after_revision DESC LIMIT 1").bind(target.id).all<{id:string;request:string}>()).results;const op=ops[0]?JSON.parse(ops[0].request):null;if(op?.kind==='merge'&&typeof op.targetId==='string')mergedInto=op.targetId;}
 const rd=await reviewData();const stockInfo:StockInformation|null=stock?{included:!!stock.included,track:!!stock.track,groupId:validGroup(stock.group_id),roundId:stock.round_id,round}:null;
 return {kind:'ingredient',id:target.id,item,uses:item?itemVariants(n,item.id):[],inputs:item?n.items.filter(i=>item.inputs.some(x=>x.itemId===i.id)).map(i=>({id:i.id,name:i.name})):[],related:rd?related(rd.draft,rd.source,target.id):[],stock:stockInfo,excluded:productionExcluded(n,target.id),revision:row.revision,mergedInto};
}
