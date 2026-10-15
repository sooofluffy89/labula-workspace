import {instructionSnapshotSql,noteColumns} from './prep-notes-server';
import {initialSyncCursor,syncMetadataSql} from './evening-sync-server';
import {readCalendarVersions,validateTarget} from './calendar-server';
import {readPlanning} from './round-store';
import {activeMember} from './activity-server';
import {eveningEvents} from './evening-activity';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {RequestError} from './notebook-server';
import {initializeStock} from './stock-server';
import {dateSchema,eveningCommandSchema,operationalDay,type CheckSummary,type CheckAnswer,type MorningTask,type EveningSnapshot,type EveningCommand,type EveningSelection} from './evening';
import {stationIdSchema} from './checking-stations';
import {latestMenuSourceSql} from './menu-scope-server';
import {scopeSource,type MenuScopeSource} from './menu-scope';
import {validGroup} from './ingredient-groups';

export type CheckRow={calendar_revision:number|null;id:string;target_day:string;plan_day:string|null;stage:'draft'|'confirmed';revision:number;plan_revision:number;version:number;confirmed_at:string|null;confirmed_by:string|null;grouped:number;rounds_version:number};
export type AnswerRow={station_snapshot?:string|null;instruction_snapshot?:string|null;feedback_count?:number;check_id:string;item_id:string;catalog_id:string;name:string;kind:'bought'|'prep';position:number;value:'have'|'missing'|null;revision:number;updated_at:string;updated_by:string;first_actor:string|null;first_device:string|null;first_sequence:number|null;superseded_by:string|null;group_id:string|null;round_snapshot:string|null};
export type TaskRow=Omit<AnswerRow,'value'|'first_actor'|'first_device'|'first_sequence'|'superseded_by'>&{ready:number;cancelled:number};
type Receipt={id:string;actor_id:string;request:string;result:string;applied:number};
export const summary=(r:CheckRow):CheckSummary=>({calendarRevision:r.calendar_revision,roundsVersion:r.rounds_version,id:r.id,targetDay:r.target_day,stage:r.stage,revision:r.revision,planRevision:r.plan_revision,version:r.version,confirmedAt:r.confirmed_at,confirmedBy:r.confirmed_by});
const conflict=(message='This check changed. Refresh, review the shared answers and try again.',code='evening_conflict')=>new RequestError(message,409,code);
export async function readEvening(user:ChatGPTUser,selection:EveningSelection={day:operationalDay()}):Promise<EveningSnapshot>{
 return (await readEveningContext(user,selection)).snapshot;
}
// A committed receipt remains recoverable by its original actor even when the
// collaborator is paused. This path never bootstraps or writes business data.
export async function readEveningReceipt(user:ChatGPTUser,operationId:string):Promise<EveningSnapshot>{
 const receipt=await getRawDb().prepare('SELECT result FROM evening_commands WHERE id=? AND actor_id=? AND applied=1').bind(operationId,user.userId).first<{result:string}>();
 if(!receipt)throw new RequestError('This saved operation is not available to this account.',403);
 const result=JSON.parse(receipt.result) as {checkId:string};
 return (await readEveningContext(user,{day:result.checkId},false)).snapshot;
}
async function readEveningContext(user:ChatGPTUser,selection:EveningSelection,initialize=true){
 const selected='day' in selection?dateSchema.parse(selection.day):dateSchema.parse(selection.morningDay);
 if(initialize)await initializeStock(user);const db=getRawDb();
 // Planning, catalog, calendar, selected rows and the sync high water share one
 // transaction. Reuse those inputs only within this read/command; writes still CAS.
 const planning=await readPlanning(selected,[
  db.prepare('SELECT * FROM evening_checks ORDER BY id DESC'),
  db.prepare('day' in selection?`SELECT ${noteColumns('a')} FROM evening_answers a WHERE check_id=? ORDER BY position`:`SELECT ${noteColumns('a')} FROM evening_answers a JOIN evening_checks c ON c.id=a.check_id WHERE c.plan_day=? ORDER BY a.position`).bind(selected),
  db.prepare('day' in selection?`SELECT ${noteColumns('a')} FROM morning_tasks a WHERE check_id=? ORDER BY position`:`SELECT ${noteColumns('a')} FROM morning_tasks a JOIN evening_checks c ON c.id=a.check_id WHERE c.plan_day=? ORDER BY a.position`).bind(selected),
  db.prepare('SELECT check_id,catalog_id,superseded_by FROM evening_answers'),
  db.prepare(syncMetadataSql),
 ]);
 const results=planning.extraResults,catalog=planning.notebook.items.map(i=>({id:i.id,name:i.name,kind:i.kind})),byId=new Map(catalog.map(i=>[i.id,i]));
 const checks=results[0].results as CheckRow[],row=checks.find(c=>'day' in selection?c.id===selected:c.plan_day===selected);
 const answers=(results[1].results as AnswerRow[]).map(a=>answerView(a,byId,row?.stage==='draft'?planning.scope:undefined));
 const tasks=(results[2].results as TaskRow[]).map(t=>taskView(t,byId,row&&row.target_day>=operationalDay()?planning.scope:undefined));
 const calendar=planning.calendar;
 const summaries=checks.map(c=>{const base=summary(c);if(c.stage==='draft'&&c.version===0){const originals=(results[3].results as AnswerRow[]).filter(a=>a.check_id===c.id&&!a.superseded_by);if(originals.length&&originals.every(a=>(planning.coverage.get(a.catalog_id)??'')>c.id))base.coveredBy=originals.map(a=>planning.coverage.get(a.catalog_id)!).sort().at(-1)!;}return base;});
 const snapshot:EveningSnapshot={menuGaps:planning.scope.gaps,prepNotes:1,sync:{version:1,cursor:initialSyncCursor(user,selection,results[4].results[0] as {through:number;notebook:number;rounds:number;calendar:number})},calendar:{versions:calendar,revision:Math.max(0,...calendar.map(v=>v.revision)),accountId:user.userId,isOwner:false},planning:{day:selected,revision:planning.revision,dueCount:planning.due.length,rounds:planning.rounds,items:planning.items},scope:'kitchen',accountId:user.userId,account:user.email,notebookRevision:planning.notebookRevision,catalog,trackedCount:planning.items.length,checks:summaries,check:row?{...summaries.find(s=>s.id===row.id)!,answers,tasks,grouped:!!row.grouped}:null};
 return {snapshot,planning};
}

export async function eveningCommand(user:ChatGPTUser,raw:unknown){
 const c:EveningCommand=eveningCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(c.actorId!==user.userId)throw new RequestError('The signed-in account changed. Return to the original account before retrying.',403);
 const replay=async()=>{const r=await db.prepare('SELECT * FROM evening_commands WHERE id=?').bind(c.id).first<Receipt>();if(!r)return null;if(r.actor_id!==user.userId||r.request!==request)throw conflict('This request belongs to a different account or change.','command_mismatch');if(!r.applied)throw Error('Incomplete operation receipt');return {operationId:r.id,...JSON.parse(r.result) as {checkId:string;publication?:import('./evening').PublicationReceipt},replayed:true};};
 const prior=await replay();if(prior)return prior;
 const member=await activeMember(user);
 const checkId=c.kind==='start'?c.day:c.checkId;
 const context=c.kind==='confirm'?null:await readEveningContext(user,{day:checkId});
 const snapshot=context?.snapshot??await readConfirmation(user,checkId),check=snapshot.check,now=new Date().toISOString();
 if(c.kind!=='start'&&!check)throw new RequestError('This kitchen check does not exist.',404);
 if((c.kind==='start'&&!check)||c.kind==='dates')validateTarget(checkId,c.targetDay,context?.planning.calendar??await readCalendarVersions(),c.calendarRevision);
 if(c.kind==='start'&&c.targetDay<=c.day)throw new RequestError('Morning prep must be after the evening check date.');
 let condition='1',conditionArgs:unknown[]=[];
 const writes:ReturnType<typeof db.prepare>[]=[];
 // applied=0 gates every statement, so concurrent identical retries cannot execute effects twice.
 const gate='EXISTS (SELECT 1 FROM evening_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const args=[c.id,user.userId,request];
 const updateCheck=(set:string,values:unknown[])=>writes.push(db.prepare(`UPDATE evening_checks SET ${set},updated_at=? WHERE id=? AND ${gate}`).bind(...values,now,checkId,...args));
 if(c.kind==='start'||c.kind==='add-items'){
  const planning=context!.planning,extraIds=c.kind==='start'?c.extraItemIds??[]:c.itemIds;
  if(new Set(extraIds).size!==extraIds.length||extraIds.some(id=>!planning.items.some(i=>i.itemId===id)))throw conflict('Choose currently tracked items from the shared list.','invalid_extra_items');
  const existing=new Set(check?.answers.filter(a=>!a.supersededBy).map(a=>a.catalogId)??[]);
  const roster=(c.kind==='start'?planning.items.filter(i=>i.round.firstDue||extraIds.includes(i.itemId)):planning.items.filter(i=>extraIds.includes(i.itemId)&&!existing.has(i.itemId))).map((i,index)=>({...i,position:(c.kind==='start'?0:Math.max(-1,...check!.answers.map(a=>a.position))+1)+index,round:planning.legacy?null:{...i.round,reason:extraIds.includes(i.itemId)&&(!i.round.firstDue||c.kind==='add-items')?'extra':i.round.reason}}));
  condition="EXISTS(SELECT 1 FROM round_state WHERE id='kitchen' AND revision=?) AND EXISTS(SELECT 1 FROM notebooks WHERE id='kitchen' AND revision=?)";conditionArgs=[planning.revision,planning.notebookRevision];
  if(c.kind==='start'){
   condition+=" AND (EXISTS(SELECT 1 FROM evening_checks WHERE id=?) OR ? > 0)";conditionArgs.push(checkId,roster.length);
   writes.push(db.prepare(`INSERT INTO evening_checks(id,target_day,stage,revision,plan_revision,version,start_operation,created_at,created_by,updated_at,grouped,rounds_version,calendar_revision) SELECT ?,?,'draft',0,0,0,?,?,?,?,1,?,? WHERE ${gate} ON CONFLICT(id) DO NOTHING`).bind(checkId,c.targetDay,c.id,now,user.email,now,planning.legacy?0:1,c.calendarRevision??null,...args));
  }else{
   condition+=" AND EXISTS(SELECT 1 FROM evening_checks WHERE id=? AND stage='draft' AND revision=?)";conditionArgs.push(checkId,c.revision);
   updateCheck('revision=revision+1',[]);
  }
  writes.push(db.prepare(`INSERT INTO evening_answers(check_id,item_id,catalog_id,name,kind,position,value,revision,updated_at,updated_by,group_id,round_snapshot,instruction_snapshot,station_snapshot)
   SELECT ?,json_extract(j.value,'$.itemId'),json_extract(j.value,'$.itemId'),json_extract(j.value,'$.name'),json_extract(j.value,'$.kind'),json_extract(j.value,'$.position'),NULL,0,?,?,json_extract(j.value,'$.groupId'),json_extract(j.value,'$.round'),${instructionSnapshotSql("json_extract(j.value,'$.itemId')")},(SELECT json_object('stationId',t.station_id,'revision',coalesce(t.revision,0)) FROM (SELECT 1) base LEFT JOIN checking_station_items t ON t.item_id=json_extract(j.value,'$.itemId')) FROM json_each(?) j
   WHERE ${c.kind==='start'?'EXISTS(SELECT 1 FROM evening_checks WHERE id=? AND start_operation=?) AND ':''}${gate} ON CONFLICT(check_id,item_id) DO NOTHING`).bind(checkId,now,user.email,JSON.stringify(roster),...(c.kind==='start'?[checkId,c.id]:[]),...args));
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
   writes.push(db.prepare(`UPDATE evening_answers SET instruction_snapshot=${instructionSnapshotSql('?')},catalog_id=?,group_id=(SELECT group_id FROM stock_items WHERE item_id=?),round_snapshot=NULL,superseded_by=NULL,value=NULL,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.catalogId,c.catalogId,c.catalogId,c.catalogId,c.catalogId,now,user.email,checkId,c.itemId,...args));
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
  updateCheck('target_day=?,calendar_revision=?,revision=revision+1',[c.targetDay,c.calendarRevision??null]);
 }else if(c.kind==='correct'){
  condition="EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND revision=? AND plan_revision=? AND stage='confirmed')";conditionArgs=[checkId,c.revision,c.planRevision];
  updateCheck("stage='draft',revision=revision+1",[]);
 }else if(c.kind==='ready'){
  condition=`EXISTS (SELECT 1 FROM morning_tasks t JOIN evening_checks c ON c.id=t.check_id WHERE c.id=? AND c.version>0 AND t.item_id=? AND t.revision=? AND t.cancelled=0
   AND EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=t.catalog_id AND json_extract(j.value,'$.kind')=t.kind))`;conditionArgs=[checkId,c.itemId,c.revision];
  writes.push(db.prepare(`UPDATE morning_tasks SET ready=?,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.value?1:0,now,user.email,checkId,c.itemId,...args));
  updateCheck('plan_revision=plan_revision+1',[]);
 }else{
  if(check!.answers.length===0||check!.answers.some(a=>!a.suspended&&!a.value))throw conflict('Check every item before finishing.','incomplete_check');
  if(check!.answers.some(a=>!a.suspended&&!a.mappingValid))throw conflict('A catalog item changed. Resolve its link before confirming.','mapping_conflict');
  const competing=snapshot.checks.find(s=>s.id!==checkId&&s.version>0&&s.targetDay===check!.targetDay);
  if(competing)throw conflict(`Morning prep for ${check!.targetDay} already comes from the ${competing.id} check. Open that check; choose another morning date for this draft.`,'plan_conflict');
  condition=`EXISTS (SELECT 1 FROM evening_checks WHERE id=? AND revision=? AND plan_revision=? AND stage='draft')
   AND EXISTS (SELECT 1 FROM notebooks WHERE id='kitchen' AND revision=?)
   AND NOT EXISTS (SELECT 1 FROM evening_checks WHERE plan_day=? AND id!=?)
   AND NOT EXISTS (SELECT 1 FROM evening_answers a WHERE a.check_id=? AND a.catalog_id IN (SELECT value FROM json_each(?)) AND (a.value IS NULL OR (a.superseded_by IS NULL AND NOT EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=a.catalog_id AND json_extract(j.value,'$.kind')=a.kind))))`;
  conditionArgs=[checkId,c.revision,c.planRevision,c.notebookRevision,check!.targetDay,checkId,checkId,JSON.stringify(snapshot.catalog.filter(i=>!check!.answers.find(a=>a.catalogId===i.id)?.suspended).map(i=>i.id))];
  const payload=JSON.stringify({calendarRevision:check!.calendarRevision??null,checkId,targetDay:check!.targetDay,answers:check!.answers,priorTasks:check!.tasks,actor:user.email,confirmedAt:now});
  writes.push(db.prepare(`INSERT INTO evening_versions (check_id,version,payload,created_at,created_by) SELECT ?,version+1,?,?,? FROM evening_checks WHERE id=? AND ${gate}`).bind(checkId,payload,now,user.email,checkId,...args));
  // Existing unchanged Missing rows retain Ready and its authorship. Cancelled/re-mapped rows reopen.
  writes.push(db.prepare(`INSERT INTO morning_tasks (check_id,item_id,catalog_id,name,kind,position,ready,cancelled,revision,updated_at,updated_by,group_id,instruction_snapshot)
   SELECT check_id,item_id,catalog_id,name,kind,position,0,0,0,?,?,group_id,instruction_snapshot FROM evening_answers WHERE check_id=? AND value='missing' AND catalog_id IN (SELECT value FROM json_each(?)) AND ${gate}
   ON CONFLICT(check_id,item_id) DO UPDATE SET catalog_id=excluded.catalog_id,instruction_snapshot=excluded.instruction_snapshot,group_id=excluded.group_id,ready=0,cancelled=0,revision=morning_tasks.revision+1,updated_at=excluded.updated_at,updated_by=excluded.updated_by
   WHERE morning_tasks.cancelled=1 OR morning_tasks.catalog_id!=excluded.catalog_id`).bind(now,user.email,checkId,JSON.stringify(check!.answers.filter(a=>!a.suspended).map(a=>a.catalogId)),...args));
  writes.push(db.prepare(`UPDATE morning_tasks SET cancelled=1,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND cancelled=0 AND item_id IN (SELECT item_id FROM evening_answers WHERE check_id=? AND value='have' AND catalog_id IN (SELECT value FROM json_each(?))) AND ${gate}`).bind(now,user.email,checkId,checkId,JSON.stringify(check!.answers.filter(a=>!a.suspended).map(a=>a.catalogId)),...args));
  writes.push(db.prepare(`UPDATE round_state SET revision=revision+1 WHERE id='kitchen' AND ${gate}`).bind(...args));
  updateCheck("stage='confirmed',version=version+1,revision=revision+1,plan_revision=plan_revision+1,plan_day=target_day,confirmed_at=?,confirmed_by=?",[now,user.email]);
 }
 if((c.kind==='start'&&!check)||c.kind==='dates'){if(snapshot.calendar?.versions.length&&checkId>=snapshot.calendar.versions[0].effectiveDay){condition+=' AND (SELECT max(revision) FROM operating_calendar_versions)=?';conditionArgs.push(c.calendarRevision);}}
 const receipt=db.prepare(`INSERT INTO evening_commands (id,actor_id,request,result,applied,created_at) SELECT ?,?,?,?,0,? WHERE (${condition}) AND EXISTS (SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(c.id,user.userId,request,JSON.stringify({checkId,...(c.kind==='confirm'?{publication:{protocol:1,actorId:user.userId,checkId,targetDay:check!.targetDay,version:check!.version+1,revision:check!.revision+1,planRevision:check!.planRevision+1,confirmedAt:now,confirmedBy:user.email}}:{})}),now,...conditionArgs,user.userId);
 const results=await db.batch([receipt,...eveningEvents(user,member.name,c,now,gate,args,c.kind==='confirm'?check!.answers.filter(a=>!a.suspended).map(a=>a.catalogId):undefined),...writes,db.prepare(`UPDATE evening_commands SET applied=1 WHERE id=? AND actor_id=? AND request=? AND applied=0`).bind(...args),
  ...(c.kind==='confirm'?[db.prepare('SELECT * FROM evening_checks WHERE id=?').bind(checkId),db.prepare(`SELECT ${noteColumns('a')} FROM morning_tasks a WHERE check_id=? ORDER BY position`).bind(checkId)]:[]),
 ]);
 const saved=await replay();if(saved){
  if(c.kind==='confirm'&&saved.publication&&results[0].meta.changes){
   const row=results.at(-2)!.results[0] as CheckRow,byId=new Map(snapshot.catalog.map(i=>[i.id,i]));
   return {...saved,plan:{check:{...summary(row),grouped:!!row.grouped},tasks:(results.at(-1)!.results as TaskRow[]).map(t=>({...taskView(t,byId),...(snapshot.check?.tasks.find(old=>old.catalogId===t.catalog_id)?.suspended?{suspended:true,menuScope:'inactive' as const}:{})}))}};
  }
  return saved;
 }
 if(c.kind==='start')throw conflict('No items selected for checking. Choose items in Manage list.','empty_roster');
 throw conflict(c.kind==='confirm'?'Answers, morning tasks or the catalog changed. Refresh the summary and confirm again.':undefined);
}

export function answerView(a:AnswerRow,byId?:Map<string,{name:string;kind:string}>,scope?:ReturnType<typeof scopeSource>):CheckAnswer{return {...(scope?{suspended:scope.usage.has(a.catalog_id)&&!scope.operational.has(a.catalog_id),menuScope:scope.state(a.catalog_id)}:{}),...(a.station_snapshot?{stationId:stationIdSchema.parse(JSON.parse(a.station_snapshot).stationId)}:{}),instruction:a.instruction_snapshot?JSON.parse(a.instruction_snapshot):null,feedbackCount:a.feedback_count??0,itemId:a.item_id,catalogId:a.catalog_id,name:a.name,kind:a.kind,position:a.position,value:a.value,revision:a.revision,updatedAt:a.updated_at,updatedBy:a.updated_by,firstActor:a.first_actor,firstDevice:a.first_device,firstSequence:a.first_sequence,supersededBy:a.superseded_by,mappingValid:!!a.superseded_by||!byId||byId.get(a.catalog_id)?.kind===a.kind,currentName:byId?.get(a.catalog_id)?.name??null,groupId:validGroup(a.group_id),round:a.round_snapshot?JSON.parse(a.round_snapshot):null};}
export function taskView(t:TaskRow,byId?:Map<string,{name:string;kind:string}>,scope?:ReturnType<typeof scopeSource>):MorningTask{return {...(scope?{suspended:scope.usage.has(t.catalog_id)&&!scope.operational.has(t.catalog_id),menuScope:scope.state(t.catalog_id)}:{}),instruction:t.instruction_snapshot?JSON.parse(t.instruction_snapshot):null,feedbackCount:t.feedback_count??0,itemId:t.item_id,catalogId:t.catalog_id,name:t.name,kind:t.kind,position:t.position,ready:!!t.ready,cancelled:!!t.cancelled,revision:t.revision,updatedAt:t.updated_at,updatedBy:t.updated_by,mappingValid:!byId||byId.get(t.catalog_id)?.kind===t.kind,groupId:validGroup(t.group_id)};}

// Confirmation needs the selected answers/tasks, catalog links and competing target,
// not bootstrap, all historical answers, round coverage or preparation profiles.
export async function readConfirmation(user:ChatGPTUser,day:string):Promise<EveningSnapshot>{
 day=dateSchema.parse(day);const db=getRawDb(),r=await db.batch([
  db.prepare("SELECT revision,(SELECT json_group_array(json_object('id',json_extract(j.value,'$.id'),'name',json_extract(j.value,'$.name'),'kind',json_extract(j.value,'$.kind'))) FROM json_each(n.payload,'$.items') j) AS catalog FROM notebooks n WHERE id='kitchen'"),
  db.prepare('SELECT * FROM evening_checks WHERE id=? OR plan_day=(SELECT target_day FROM evening_checks WHERE id=?)').bind(day,day),
  db.prepare(`SELECT ${noteColumns('a')} FROM evening_answers a WHERE check_id=? ORDER BY position`).bind(day),
  db.prepare(`SELECT ${noteColumns('a')} FROM morning_tasks a WHERE check_id=? ORDER BY position`).bind(day),db.prepare(latestMenuSourceSql),
 ]);
 const scope=r[4].results[0]?scopeSource(r[4].results[0] as MenuScopeSource):undefined;
 const n=r[0].results[0] as {revision:number;catalog:string},rows=r[1].results as CheckRow[],row=rows.find(c=>c.id===day),catalog=JSON.parse(n.catalog) as EveningSnapshot['catalog'],byId=new Map(catalog.map(i=>[i.id,i]));
 return {scope:'kitchen',accountId:user.userId,account:user.email,notebookRevision:n.revision,catalog,trackedCount:0,checks:rows.map(summary),check:row?{...summary(row),grouped:!!row.grouped,answers:(r[2].results as AnswerRow[]).map(a=>answerView(a,byId,row.stage==='draft'?scope:undefined)),tasks:(r[3].results as TaskRow[]).map(t=>taskView(t,byId,row.target_day>=operationalDay()?scope:undefined))}:null};
}
