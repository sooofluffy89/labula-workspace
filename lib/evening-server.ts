import {activeMember} from './activity-server';
import {eveningEvents} from './evening-activity';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import type {Notebook} from './notebook';
import {RequestError} from './notebook-server';
import {readStock} from './stock-server';
import {dateSchema,eveningCommandSchema,operationalDay,type CheckSummary,type CheckAnswer,type MorningTask,type EveningSnapshot,type EveningCommand,type EveningSelection} from './evening';
import {validGroup} from './ingredient-groups';

type CheckRow={id:string;target_day:string;plan_day:string|null;stage:'draft'|'confirmed';revision:number;plan_revision:number;version:number;confirmed_at:string|null;confirmed_by:string|null;grouped:number};
type AnswerRow={check_id:string;item_id:string;catalog_id:string;name:string;kind:'bought'|'prep';position:number;value:'have'|'missing'|null;revision:number;updated_at:string;updated_by:string;first_actor:string|null;first_device:string|null;first_sequence:number|null;superseded_by:string|null;group_id:string|null};
type TaskRow=Omit<AnswerRow,'value'|'first_actor'|'first_device'|'first_sequence'|'superseded_by'>&{ready:number;cancelled:number};
type Receipt={id:string;actor_id:string;request:string;result:string;applied:number};
const summary=(r:CheckRow):CheckSummary=>({id:r.id,targetDay:r.target_day,stage:r.stage,revision:r.revision,planRevision:r.plan_revision,version:r.version,confirmedAt:r.confirmed_at,confirmedBy:r.confirmed_by});
const conflict=(message='This check changed. Refresh, review the shared answers and try again.',code='evening_conflict')=>new RequestError(message,409,code);
export async function readEvening(user:ChatGPTUser,selection:EveningSelection={day:operationalDay()}):Promise<EveningSnapshot>{
 const selected='day' in selection?dateSchema.parse(selection.day):dateSchema.parse(selection.morningDay);
 await readStock(user);const db=getRawDb();
 const results=await db.batch([
  db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'"),
  db.prepare('SELECT * FROM evening_checks ORDER BY id DESC'),
  db.prepare('day' in selection?'SELECT * FROM evening_answers WHERE check_id=? ORDER BY position':'SELECT a.* FROM evening_answers a JOIN evening_checks c ON c.id=a.check_id WHERE c.plan_day=? ORDER BY a.position').bind(selected),
  db.prepare('day' in selection?'SELECT * FROM morning_tasks WHERE check_id=? ORDER BY position':'SELECT t.* FROM morning_tasks t JOIN evening_checks c ON c.id=t.check_id WHERE c.plan_day=? ORDER BY t.position').bind(selected),
  db.prepare('SELECT item_id FROM stock_items WHERE included=1 AND track=1'),
 ]);
 const notebook=results[0].results[0] as {payload:string;revision:number},catalog=(JSON.parse(notebook.payload) as Notebook).items.map(i=>({id:i.id,name:i.name,kind:i.kind})),byId=new Map(catalog.map(i=>[i.id,i]));
 const checks=results[1].results as CheckRow[],row=checks.find(c=>'day' in selection?c.id===selected:c.plan_day===selected);
 const answers:CheckAnswer[]=(results[2].results as AnswerRow[]).map(a=>({itemId:a.item_id,catalogId:a.catalog_id,name:a.name,kind:a.kind,position:a.position,value:a.value,revision:a.revision,updatedAt:a.updated_at,updatedBy:a.updated_by,firstActor:a.first_actor,firstDevice:a.first_device,firstSequence:a.first_sequence,supersededBy:a.superseded_by,mappingValid:!!a.superseded_by||byId.get(a.catalog_id)?.kind===a.kind,currentName:byId.get(a.catalog_id)?.name??null,groupId:validGroup(a.group_id)}));
 const tasks:MorningTask[]=(results[3].results as TaskRow[]).map(t=>({itemId:t.item_id,catalogId:t.catalog_id,name:t.name,kind:t.kind,position:t.position,ready:!!t.ready,cancelled:!!t.cancelled,revision:t.revision,updatedAt:t.updated_at,updatedBy:t.updated_by,mappingValid:byId.get(t.catalog_id)?.kind===t.kind,groupId:validGroup(t.group_id)}));
 return {scope:'kitchen',accountId:user.userId,account:user.email,notebookRevision:notebook.revision,catalog,trackedCount:(results[4].results as {item_id:string}[]).filter(s=>byId.has(s.item_id)).length,checks:checks.map(summary),check:row?{...summary(row),answers,tasks,grouped:!!row.grouped}:null};
}

export async function eveningCommand(user:ChatGPTUser,raw:unknown){
 const c:EveningCommand=eveningCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(c.actorId!==user.userId)throw new RequestError('The signed-in account changed. Return to the original account before retrying.',403);
 const replay=async()=>{const r=await db.prepare('SELECT * FROM evening_commands WHERE id=?').bind(c.id).first<Receipt>();if(!r)return null;if(r.actor_id!==user.userId||r.request!==request)throw conflict('This request belongs to a different account or change.','command_mismatch');if(!r.applied)throw Error('Incomplete operation receipt');return {operationId:r.id,...JSON.parse(r.result) as {checkId:string},replayed:true};};
 const prior=await replay();if(prior)return prior;
 const member=await activeMember(user);
 const checkId=c.kind==='start'?c.day:c.checkId;
 const snapshot=await readEvening(user,{day:checkId}),check=snapshot.check,now=new Date().toISOString();
 if(c.kind!=='start'&&!check)throw new RequestError('This kitchen check does not exist.',404);
 if(c.kind==='start'&&c.targetDay<=c.day)throw new RequestError('Morning prep must be after the evening check date.');
 let condition='1',conditionArgs:unknown[]=[];
 const writes:ReturnType<typeof db.prepare>[]=[];
 // applied=0 gates every statement, so concurrent identical retries cannot execute effects twice.
 const gate='EXISTS (SELECT 1 FROM evening_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const args=[c.id,user.userId,request];
 const updateCheck=(set:string,values:unknown[])=>writes.push(db.prepare(`UPDATE evening_checks SET ${set},updated_at=? WHERE id=? AND ${gate}`).bind(...values,now,checkId,...args));
 if(c.kind==='start'){
  condition="EXISTS (SELECT 1 FROM evening_checks WHERE id=?) OR EXISTS (SELECT 1 FROM stock_items s,notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND s.item_id=json_extract(j.value,'$.id') AND s.included=1 AND s.track=1)";conditionArgs=[checkId];
  writes.push(db.prepare(`INSERT INTO evening_checks (id,target_day,stage,revision,plan_revision,version,start_operation,created_at,created_by,updated_at,grouped) SELECT ?,?,'draft',0,0,0,?,?,?,?,1 WHERE ${gate} ON CONFLICT(id) DO NOTHING`).bind(checkId,c.targetDay,c.id,now,user.email,now,...args));
  writes.push(db.prepare(`INSERT INTO evening_answers (check_id,item_id,catalog_id,name,kind,position,value,revision,updated_at,updated_by,group_id)
   SELECT ?,s.item_id,s.item_id,json_extract(j.value,'$.name'),json_extract(j.value,'$.kind'),row_number() OVER (ORDER BY lower(json_extract(j.value,'$.name')),s.item_id)-1,NULL,0,?,?,s.group_id
   FROM stock_items s,notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND s.item_id=json_extract(j.value,'$.id') AND s.included=1 AND s.track=1
   AND EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND start_operation=?) AND ${gate} ON CONFLICT(check_id,item_id) DO NOTHING`).bind(checkId,now,user.email,checkId,c.id,...args));
 }else if(c.kind==='answer'||c.kind==='resolve'){
  condition="EXISTS (SELECT 1 FROM evening_checks c JOIN evening_answers a ON a.check_id=c.id WHERE c.id=? AND c.stage='draft' AND c.version=? AND a.item_id=? AND a.revision=?)";conditionArgs=[checkId,c.generation,c.itemId,c.revision];
  if(c.kind==='answer'){
   condition+=" AND EXISTS (SELECT 1 FROM evening_answers WHERE check_id=? AND item_id=? AND superseded_by IS NULL)";conditionArgs.push(checkId,c.itemId);
   writes.push(db.prepare(`UPDATE evening_answers SET value=?,revision=revision+1,updated_at=?,updated_by=?,
    first_actor=coalesce(first_actor,?),first_device=coalesce(first_device,?),first_sequence=coalesce(first_sequence,?) WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.value,now,user.email,c.value?user.userId:null,c.value?c.deviceId:null,c.value?c.sequence:null,checkId,c.itemId,...args));
  }else{
   const item=snapshot.catalog.find(i=>i.id===c.catalogId),old=check!.answers.find(a=>a.itemId===c.itemId);
   if(!item||!old||item.kind!==old.kind)throw conflict('Choose an existing catalog item of the same type.','mapping_conflict');
   condition+=" AND EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=? AND json_extract(j.value,'$.kind')=?) AND NOT EXISTS (SELECT 1 FROM evening_answers WHERE check_id=? AND item_id!=? AND catalog_id=?)";conditionArgs.push(c.catalogId,old.kind,checkId,c.itemId,c.catalogId);
   writes.push(db.prepare(`UPDATE evening_answers SET catalog_id=?,group_id=(SELECT group_id FROM stock_items WHERE item_id=?),superseded_by=NULL,value=NULL,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.catalogId,c.catalogId,now,user.email,checkId,c.itemId,...args));
  }
  updateCheck('revision=revision+1',[]);
 }else if(c.kind==='supersede'){
  const source=check!.answers.find(a=>a.itemId===c.itemId),target=check!.answers.find(a=>a.itemId===c.targetItemId);
  if(!source||source.mappingValid||!target||target.supersededBy||!target.mappingValid||source.kind!==target.kind)throw conflict('Choose the already listed replacement for the unavailable catalog item.','mapping_conflict');
  condition="EXISTS (SELECT 1 FROM evening_checks c JOIN evening_answers a ON a.check_id=c.id WHERE c.id=? AND c.stage='draft' AND c.version=? AND a.item_id=? AND a.revision=?) AND EXISTS (SELECT 1 FROM notebooks WHERE id='kitchen' AND revision=?) AND EXISTS (SELECT 1 FROM evening_answers WHERE check_id=? AND item_id=? AND revision=? AND superseded_by IS NULL)";
  conditionArgs=[checkId,c.generation,c.itemId,c.revision,c.notebookRevision,checkId,c.targetItemId,target.revision];
  writes.push(db.prepare(`UPDATE evening_answers SET superseded_by=?,value='have',revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.targetItemId,now,user.email,checkId,c.itemId,...args));
  updateCheck('revision=revision+1',[]);
 }else if(c.kind==='dates'){
  if(c.targetDay<=checkId)throw new RequestError('Morning prep must be after the evening check date.');
  condition="EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND revision=? AND version=0 AND stage='draft')";conditionArgs=[checkId,c.revision];
  updateCheck('target_day=?,revision=revision+1',[c.targetDay]);
 }else if(c.kind==='correct'){
  condition="EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND revision=? AND plan_revision=? AND stage='confirmed')";conditionArgs=[checkId,c.revision,c.planRevision];
  updateCheck("stage='draft',revision=revision+1",[]);
 }else if(c.kind==='ready'){
  condition=`EXISTS (SELECT 1 FROM morning_tasks t JOIN evening_checks c ON c.id=t.check_id WHERE c.id=? AND c.version>0 AND t.item_id=? AND t.revision=? AND t.cancelled=0
   AND EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=t.catalog_id AND json_extract(j.value,'$.kind')=t.kind))`;conditionArgs=[checkId,c.itemId,c.revision];
  writes.push(db.prepare(`UPDATE morning_tasks SET ready=?,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.value?1:0,now,user.email,checkId,c.itemId,...args));
  updateCheck('plan_revision=plan_revision+1',[]);
 }else{
  if(check!.answers.length===0||check!.answers.some(a=>!a.value))throw conflict('Check every item before finishing.','incomplete_check');
  if(check!.answers.some(a=>!a.mappingValid))throw conflict('A catalog item changed. Resolve its link before confirming.','mapping_conflict');
  const competing=snapshot.checks.find(s=>s.id!==checkId&&s.version>0&&s.targetDay===check!.targetDay);
  if(competing)throw conflict(`Morning prep for ${check!.targetDay} already comes from the ${competing.id} check. Open that check; choose another morning date for this draft.`,'plan_conflict');
  condition=`EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND revision=? AND plan_revision=? AND stage='draft')
   AND EXISTS (SELECT 1 FROM notebooks WHERE id='kitchen' AND revision=?)
   AND NOT EXISTS (SELECT 1 FROM evening_checks WHERE plan_day=? AND id!=?)
   AND NOT EXISTS (SELECT 1 FROM evening_answers a WHERE a.check_id=? AND (a.value IS NULL OR (a.superseded_by IS NULL AND NOT EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=a.catalog_id AND json_extract(j.value,'$.kind')=a.kind))))`;
  conditionArgs=[checkId,c.revision,c.planRevision,c.notebookRevision,check!.targetDay,checkId,checkId];
  const payload=JSON.stringify({checkId,targetDay:check!.targetDay,answers:check!.answers,priorTasks:check!.tasks,actor:user.email,confirmedAt:now});
  writes.push(db.prepare(`INSERT INTO evening_versions (check_id,version,payload,created_at,created_by) SELECT ?,version+1,?,?,? FROM evening_checks WHERE id=? AND ${gate}`).bind(checkId,payload,now,user.email,checkId,...args));
  // Existing unchanged Missing rows retain Ready and its authorship. Cancelled/re-mapped rows reopen.
  writes.push(db.prepare(`INSERT INTO morning_tasks (check_id,item_id,catalog_id,name,kind,position,ready,cancelled,revision,updated_at,updated_by,group_id)
   SELECT check_id,item_id,catalog_id,name,kind,position,0,0,0,?,?,group_id FROM evening_answers WHERE check_id=? AND value='missing' AND ${gate}
   ON CONFLICT(check_id,item_id) DO UPDATE SET catalog_id=excluded.catalog_id,group_id=excluded.group_id,ready=0,cancelled=0,revision=morning_tasks.revision+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by
   WHERE morning_tasks.cancelled=1 OR morning_tasks.catalog_id!=excluded.catalog_id`).bind(now,user.email,checkId,...args));
  writes.push(db.prepare(`UPDATE morning_tasks SET cancelled=1,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND cancelled=0 AND item_id IN (SELECT item_id FROM evening_answers WHERE check_id=? AND value='have') AND ${gate}`).bind(now,user.email,checkId,checkId,...args));
  updateCheck("stage='confirmed',version=version+1,revision=revision+1,plan_revision=plan_revision+1,plan_day=target_day,confirmed_at=?,confirmed_by=?",[now,user.email]);
 }
 const receipt=db.prepare(`INSERT INTO evening_commands (id,actor_id,request,result,applied,created_at) SELECT ?,?,?,?,0,? WHERE (${condition}) AND EXISTS (SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(c.id,user.userId,request,JSON.stringify({checkId}),now,...conditionArgs,user.userId);
 await db.batch([receipt,...eveningEvents(user,member.name,c,now,gate,args),...writes,db.prepare(`UPDATE evening_commands SET applied=1 WHERE id=? AND actor_id=? AND request=? AND applied=0`).bind(...args)]);
 const saved=await replay();if(saved)return saved;
 if(c.kind==='start')throw conflict('No items selected for checking. Choose items in Manage list.','empty_roster');
 throw conflict(c.kind==='confirm'?'Answers, morning tasks or the catalog changed. Refresh the summary and confirm again.':undefined);
}
