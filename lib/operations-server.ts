import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {owner,RequestError,workspaceRole,canManage,managementUsersSql} from './notebook-server';
import {activeMember} from './activity-server';
import {readCalendarVersions,readOperationalAccess} from './calendar-server';
import {dateSchema,operationalDay,calendarDay,shiftDay,type CheckAnswer,type MorningTask} from './evening';
import {calendarVersion,deadlineAt,isOpenDay,nextOpenDay,openDaysBack,previousOpenDay} from './operating-calendar';
import {calendarObligation,type Timeline} from './check-rounds';
import {measureDay,outcomeCommandSchema,summarizeDays,type HistoryBundle,type HistoryEvent,type PublishedCheck,type Outcome,type DayMeasure,type OperationsFilters,type OperationsPage,jsonState} from './operations';
import {csvCell} from './activity';

async function archiveAccess(user:ChatGPTUser,analytics=false){await readOperationalAccess(user);if(await workspaceRole(user)==='cook')throw new RequestError('Your Cook role includes operational check details only.',403);if(analytics&&!await canManage(user))throw new RequestError('Only the owner or a Manager can view Operations overview.',403);}
const answer=(a:Record<string,unknown>)=>({itemId:a.item_id,catalogId:a.catalog_id,name:a.name,kind:a.kind,value:a.value,position:a.position,revision:a.revision,updatedAt:a.updated_at,updatedBy:a.updated_by,groupId:a.group_id,round:a.round_snapshot?JSON.parse(String(a.round_snapshot)):null,supersededBy:a.superseded_by} as CheckAnswer);
function bounded<T>(rows:T[],what:string){if(rows.length>100000)throw new RequestError(`This ${what} is too large. Choose a shorter date range. No partial results were returned.`,413);return rows;}
async function loadBundles(from:string,to:string,asOf:string,checkId?:string):Promise<HistoryBundle[]>{
 const db=getRawDb();
 // Date edits are reconstructed at the same immutable boundary as the versions.
 const historicalTarget="coalesce((SELECT json_extract(e.after_value,'$.targetDay') FROM kitchen_activity e WHERE e.check_id=c.id AND e.action IN ('start','dates') AND e.recorded_at<=? ORDER BY e.recorded_at DESC,e.rowid DESC LIMIT 1),c.target_day)";
 const where=checkId?'c.id=?':'saved_target>=? AND saved_target<=?',args=checkId?[checkId]:[from,to];
 const checks=(await db.prepare(`SELECT *,${historicalTarget} AS saved_target FROM evening_checks c WHERE ${where} AND c.created_at<=? ORDER BY saved_target DESC,c.id DESC LIMIT 2001`).bind(asOf,...args,asOf).all<HistoryBundle['check']&{saved_target:string}>()).results;
 if(checks.length>2000)throw new RequestError('Choose a shorter history date range.',413);
 if(!checks.length)return [];const ids=JSON.stringify(checks.map(c=>c.id));
 const rows=await db.batch([
  db.prepare('SELECT * FROM evening_answers WHERE check_id IN(SELECT value FROM json_each(?)) ORDER BY position').bind(ids),
  db.prepare('SELECT * FROM morning_tasks WHERE check_id IN(SELECT value FROM json_each(?)) ORDER BY position').bind(ids),
  db.prepare('SELECT * FROM evening_versions WHERE check_id IN(SELECT value FROM json_each(?)) AND created_at<=? ORDER BY version').bind(ids,asOf),
  db.prepare('SELECT rowid AS seq,* FROM kitchen_activity WHERE check_id IN(SELECT value FROM json_each(?)) AND recorded_at<=? ORDER BY recorded_at,rowid LIMIT 100001').bind(ids,asOf),
  db.prepare('SELECT * FROM operating_outcomes WHERE check_id IN(SELECT value FROM json_each(?)) AND created_at<=? ORDER BY created_at,rowid LIMIT 100001').bind(ids,asOf),
 ]);
 const events=bounded(rows[3].results as HistoryEvent[],'history'),outcomes=bounded(rows[4].results as Outcome[],'outcome history');
 return checks.map(c=>{
  const versions=(rows[2].results as {check_id:string;version:number;payload:string;created_at:string;created_by:string}[]).filter(v=>v.check_id===c.id).map(v=>({...v,payload:JSON.parse(v.payload)} as PublishedCheck));
  const ev=events.filter(e=>e.check_id===c.id),latest=versions.at(-1),lastState=ev.filter(e=>e.category==='evening'&&['confirm','correct'].includes(e.action)).at(-1);
  const tasks:MorningTask[]=(latest?.payload.answers.filter(a=>a.value==='missing'&&!a.supersededBy)??[]).map(a=>{
   const prior=latest!.payload.priorTasks?.find(t=>t.itemId===a.itemId&&!t.cancelled&&t.catalogId===a.catalogId);
   let t:MorningTask={itemId:a.itemId,catalogId:a.catalogId,name:a.name,kind:a.kind,position:a.position,ready:prior?.ready??false,cancelled:false,revision:prior?.revision??0,updatedAt:prior?.ready?prior.updatedAt:latest!.created_at,updatedBy:prior?.ready?prior.updatedBy:latest!.created_by,mappingValid:true,groupId:a.groupId??null};
   for(const e of ev.filter(e=>e.category==='morning'&&e.action==='ready'&&e.item_id===a.itemId)){const after=jsonState(e.after_value);if(e.recorded_at<latest!.created_at||typeof after.planVersion==='number'&&after.planVersion<latest!.version||e.recorded_at===latest!.created_at&&after.planVersion===undefined)continue;if(typeof after.ready==='boolean')t={...t,ready:after.ready,updatedAt:e.recorded_at,updatedBy:e.actor_name,revision:Number(after.revision??t.revision)};}
   const stored=(rows[1].results as Record<string,unknown>[]).find(r=>r.check_id===c.id&&r.item_id===a.itemId&&r.catalog_id===a.catalogId);if(stored&&c.version===latest?.version&&String(stored.updated_at)<=asOf&&Number(stored.revision)>t.revision)t={...t,ready:!!stored.ready,cancelled:!!stored.cancelled,revision:Number(stored.revision),updatedAt:String(stored.updated_at),updatedBy:String(stored.updated_by)};
   return t;
  });
  const answers=(rows[0].results as Record<string,unknown>[]).filter(a=>a.check_id===c.id).map(answer).map(a=>{if(!a.updatedAt||a.updatedAt<=asOf)return a;const old=latest?.payload.answers.find(x=>x.itemId===a.itemId);let restored={...a,...old,value:old?.value??null,updatedAt:old?.updatedAt??'',updatedBy:old?.updatedBy??''};for(const e of ev.filter(e=>e.item_id===a.itemId&&e.category==='evening'&&e.action==='answer'&&(!latest||e.recorded_at>latest.created_at))){const state=jsonState(e.after_value);if(state.value==='have'||state.value==='missing')restored={...restored,value:state.value,updatedAt:e.recorded_at,updatedBy:e.actor_name};}return restored;});
  return {check:{...c,target_day:c.saved_target,version:latest?.version??0,stage:lastState?.action==='correct'?'draft':latest?'confirmed':'draft',confirmed_at:latest?.created_at??null,confirmed_by:latest?.created_by??null},answers,tasks,versions,events:ev,outcomes:outcomes.filter(o=>o.check_id===c.id)};
 });
}
export async function readHistoryDetail(user:ChatGPTUser,id:string,asOf=new Date().toISOString()){
 await archiveAccess(user);dateSchema.parse(id);const bundle=(await loadBundles(id,id,asOf,id))[0];if(!bundle)throw new RequestError('This check was not recorded.',404);
 const calendar=await readCalendarVersions();return {accountId:user.userId,isOwner:await owner(user),canManage:await canManage(user),bundle,measure:measureDay(bundle,calendar,asOf),capturedThrough:asOf};
}
function parseFilters(q:URLSearchParams,defaults:{from:string;to:string}):OperationsFilters{
 const from=dateSchema.parse(q.get('from')||defaults.from),to=dateSchema.parse(q.get('to')||defaults.to);
 if(from>to||Date.parse(to)-Date.parse(from)>366*86400000)throw new RequestError('Choose a date range up to one year, with the end after the start.');
 const f={from,to,search:q.get('search')??'',actor:q.get('actor')??'',type:q.get('type')??'',group:q.get('group')??'',round:q.get('round')??'',status:q.get('status')??'',stage:q.get('stage')??'',phase:q.get('phase')??'',item:q.get('item')??''};
 if(Object.values(f).some(v=>v.length>180))throw new RequestError('This filter is too long.');return f;
}
async function expectedDays(calendar:Awaited<ReturnType<typeof readCalendarVersions>>,from:string,to:string,asOf:string,bundles:HistoryBundle[]):Promise<DayMeasure[]>{
 if(!calendar.length)return [];const db=getRawDb();
 const timelineRows=(await db.prepare('SELECT * FROM round_timeline WHERE recorded_at<=? ORDER BY seq LIMIT 100001').bind(asOf).all<{seq:number;item_id:string;round_id:string|null;days:string;schedule_revision:number;active:number;recorded_at:string;source:string}>()).results;
 bounded(timelineRows,'round timeline');
 const timelines=timelineRows.map(e=>({seq:e.seq,itemId:e.item_id,roundId:e.round_id,days:JSON.parse(e.days),scheduleRevision:e.schedule_revision,active:!!e.active,recordedAt:e.recorded_at,source:e.source} as Timeline));
 const coverage=(await db.prepare("SELECT v.check_id,v.created_at,json_extract(a.value,'$.catalogId') AS item_id FROM evening_versions v,json_each(v.payload,'$.answers') a WHERE v.created_at<=? AND json_extract(a.value,'$.value') IS NOT NULL AND json_extract(a.value,'$.supersededBy') IS NULL AND v.version=(SELECT max(x.version) FROM evening_versions x WHERE x.check_id=v.check_id AND x.created_at<=?) ORDER BY v.check_id").bind(asOf,asOf).all<{check_id:string;created_at:string;item_id:string}>()).results;
 bounded(coverage,'confirmed coverage');
 const ids=[...new Set(timelines.map(t=>t.itemId))],out:DayMeasure[]=[];
 for(let day=from;day&&day<=to;day=shiftDay(day,1)){
  if(!isOpenDay(day,calendar)||bundles.some(b=>b.check.target_day===day))continue;
  const evening=previousOpenDay(day,calendar);if(!calendarVersion(evening,calendar)||evening<calendar[0].effectiveDay)continue;
  const end=deadlineAt(evening,'evening',calendar)??asOf;
  const due=ids.some(id=>{const events=timelines.filter(t=>t.itemId===id&&t.recordedAt<=end&&operationalDay(new Date(t.recordedAt))<=evening);if(!events.at(-1)?.active)return false;const covered=coverage.filter(c=>c.item_id===id&&c.check_id<evening&&c.created_at<=end).at(-1)?.check_id??null;return !!calendarObligation(events,evening,covered,calendar);});
  if(!due)continue;
  const ed=deadlineAt(evening,'evening',calendar),md=deadlineAt(day,'morning',calendar);
  out.push({id:evening,targetDay:day,stage:'expected',version:0,startedAt:null,startedBy:null,firstAnswerAt:null,lastAnswerAt:null,confirmedAt:null,confirmedBy:null,firstReadyAt:null,lastReadyAt:null,eveningDeadline:ed,morningDeadline:md,handover:!ed?'unknown':ed>asOf?'pending':'not-confirmed',readiness:!md?'unknown':md>asOf?'pending':'no-plan',tasks:[],currentTasks:0,currentReady:0,changes:0,addedAfter:0,removedAfter:0,coverageFrom:calendar[0].createdAt,reason:'An evening check was due; no check for this morning was recorded.'});
 }
 return out;
}
export async function readOperations(user:ChatGPTUser,q:URLSearchParams):Promise<OperationsPage>{
 const analytics=q.get('mode')==='overview',exporting=q.get('export')==='1';await archiveAccess(user,analytics||exporting);
 const asOf=q.get('through')??new Date().toISOString();if(!zDateTime(asOf)||Date.parse(asOf)>Date.now()+1000)throw new RequestError('Invalid history boundary.');
 const allCalendar=await readCalendarVersions(),calendar=allCalendar.filter(v=>v.createdAt<=asOf),defaults=openDaysBack(q.get('period')==='30'?30:7,calendar,new Date(asOf));if(!analytics)defaults.to=nextOpenDay(calendarDay(new Date(asOf)),calendar);const f=parseFilters(q,defaults);
 const offset=Number(q.get('offset')??0);if(!Number.isSafeInteger(offset)||offset<0||offset>10000)throw new RequestError('Invalid page.');
 const bundles=await loadBundles(f.from,f.to,asOf);
 const visible=analytics?bundles.filter(b=>{const same=bundles.filter(x=>x.check.target_day===b.check.target_day);const confirmed=same.filter(x=>x.versions.length);const source=(confirmed.length?confirmed:same).sort((a,c)=>(c.versions.at(-1)?.created_at??c.check.created_at).localeCompare(a.versions.at(-1)?.created_at??a.check.created_at)||c.check.id.localeCompare(a.check.id))[0];return b===source;}):bundles;
 let days=visible.map(b=>measureDay(b,calendar,asOf));
 if(analytics)days.push(...await expectedDays(calendar,f.from,f.to,asOf,bundles));
 const notebook=await getRawDb().prepare("SELECT payload FROM notebooks WHERE id='kitchen'").first<{payload:string}>();
 const items=notebook?(JSON.parse(notebook.payload) as {items:{id:string;name:string;aliases?:string[]}[]}).items:[];
 const groups=(await getRawDb().prepare('SELECT item_id,group_id FROM stock_items').all<{item_id:string;group_id:string|null}>()).results;
 const mergeRows=bounded((await getRawDb().prepare("SELECT retired_id,request FROM catalog_operations o WHERE retired_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catalog_operations u WHERE u.undo_of=o.id) ORDER BY after_revision DESC LIMIT 100001").all<{retired_id:string;request:string}>()).results,'catalog history');
 const successor=(id:string)=>{const visited=new Set<string>();let current=id;while(!visited.has(current)){visited.add(current);const row=mergeRows.find(r=>r.retired_id===current);const target=row?jsonState(row.request).targetId:null;if(typeof target!=='string')break;current=target;}return current;};
 const lower=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();const query=lower(f.search.trim());
 days=days.flatMap(d=>{
  const bundle=bundles.find(b=>b.check.id===d.id),itemMatch=(t:{catalogId:string;name:string;kind:string;groupId:string|null;roundId:string|null})=>(!f.item||t.catalogId===f.item)&&(!query||lower([t.name,items.find(i=>i.id===successor(t.catalogId))?.name??'',...(items.find(i=>i.id===successor(t.catalogId))?.aliases??[])].join(' ')).includes(query))&&(!f.type||t.kind===f.type)&&(!f.group||(t.groupId??'none')===f.group)&&(!f.round||t.roundId===f.round);
  if((f.actor||f.phase)&&!bundle?.events.some(e=>(!f.actor||e.actor_id===f.actor)&&(!f.phase||e.category===f.phase))&&!bundle?.outcomes.some(o=>(!f.actor||o.actor_id===f.actor)&&(!f.phase||f.phase==='outcome')))return [];
  if(f.stage&&d.stage!==f.stage)return [];
  const filteringItems=!!(query||f.item||f.type||f.group||f.round);
  const tasks=filteringItems?d.tasks.filter(itemMatch):d.tasks;
  const anyAnswer=bundle?.answers.some(a=>itemMatch({catalogId:a.catalogId,name:a.name,kind:a.kind,groupId:a.groupId??null,roundId:a.round?.roundId??null}));
  if(filteringItems&&!tasks.length&&!anyAnswer)return [];
  if(f.status&&f.status!==d.handover&&f.status!==d.readiness&&!tasks.some(t=>t.status===f.status||f.status==='reported-missed'&&t.outcome&&['late','not_prepared'].includes(t.outcome.outcome)))return [];
  return [{...d,tasks}];
 }).sort((a,b)=>b.targetDay.localeCompare(a.targetDay)||b.id.localeCompare(a.id));
 const recurring=new Map<string,OperationsPage['recurring'][number]>();for(const d of days)for(const t of d.tasks){let r=recurring.get(t.catalogId);if(!r){r={id:t.catalogId,name:t.name,kind:t.kind,groupIds:[],currentGroupId:groups.find(g=>g.item_id===successor(t.catalogId))?.group_id??null,currentName:items.find(i=>i.id===successor(t.catalogId))?.name??null,mergedInto:successor(t.catalogId)!==t.catalogId?successor(t.catalogId):null,count:0,evaluable:0,onTime:0,missing:0,missed:0,changes:0};recurring.set(t.catalogId,r);}r.count++;if(!r.groupIds.includes(t.groupId))r.groupIds.push(t.groupId);if(['on-time','late-recorded','not-recorded'].includes(t.status)){r.evaluable++;if(t.status==='on-time')r.onTime++;else r.missing++;}if(t.outcome&&['late','not_prepared'].includes(t.outcome.outcome))r.missed++;if(t.addedAfterDeadline||t.removedAfterDeadline)r.changes++;}
 const isOwner=await owner(user),manage=await canManage(user),people=manage?(await getRawDb().prepare('SELECT user_id AS id,name FROM kitchen_team WHERE user_id IS NOT NULL ORDER BY name').all<{id:string;name:string}>()).results:[];
 const limit=exporting?10000:20;return {accountId:user.userId,account:user.email,isOwner,canManage:manage,capturedThrough:asOf,next:offset+limit<days.length?String(offset+limit):null,days:days.slice(offset,offset+limit),summary:summarizeDays(days),recurring:[...recurring.values()].sort((a,b)=>b.missed-a.missed||b.missing-a.missing||a.name.localeCompare(b.name)),calendar,people,total:days.length,range:{from:f.from,to:f.to},...(exporting?{sources:bundles.filter(b=>days.some(d=>d.id===b.check.id))}:{})};
}
function zDateTime(s:string){return /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z$/.test(s)&&Number.isFinite(Date.parse(s));}
export async function outcomeCommand(user:ChatGPTUser,raw:unknown){
 const c=outcomeCommandSchema.parse(raw);if(c.actorId!==user.userId)throw new RequestError('The signed-in account changed.',403);const member=await activeMember(user);if(!await canManage(user))throw new RequestError('Only the owner or a Manager can clarify historical outcomes.',403);
 const db=getRawDb(),request=JSON.stringify(c),now=new Date().toISOString();
 const replay=async()=>{const old=await db.prepare('SELECT * FROM operating_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string}>();if(!old)return false;if(old.actor_id!==user.userId||old.request!==request)throw new RequestError('That operation belongs to another change.',409);return true;};if(await replay())return {operationId:c.id,replayed:true};
 const detail=await readHistoryDetail(user,c.checkId,now),task=detail.measure.tasks.find(t=>t.itemId===c.itemId&&t.sourceVersion===c.version);
 if(!task||!['late-recorded','not-recorded'].includes(task.status))throw new RequestError('Only a recorded deadline exception can be clarified. Refresh this task.',409);
 if(c.reportedReadyAt&&(c.outcome!=='late'||c.reportedReadyAt>now))throw new RequestError('A reported time must be in the past and is only used for Prepared late.');
 const args=[c.id,user.userId,request],gate='EXISTS(SELECT 1 FROM operating_commands WHERE id=? AND actor_id=? AND request=?)';
 const r=await db.batch([
  db.prepare(`INSERT INTO operating_commands(id,actor_id,request,created_at) SELECT ?,?,?,? WHERE (SELECT id FROM operating_outcomes WHERE check_id=? AND item_id=? AND version=? ORDER BY rowid DESC LIMIT 1) IS ? AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) AND EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) ON CONFLICT(id) DO NOTHING`).bind(...args,now,c.checkId,c.itemId,c.version,c.supersedesId,user.userId,user.userId),
  db.prepare(`INSERT INTO operating_outcomes(id,check_id,item_id,version,outcome,note,reported_ready_at,supersedes_id,actor_id,actor_name,created_at) SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE ${gate} ON CONFLICT(id) DO NOTHING`).bind(c.id,c.checkId,c.itemId,c.version,c.outcome,c.note,c.reportedReadyAt,c.supersedesId,user.userId,member.name,now,...args),
 ]);
 if(!r[0].meta.changes&&!await replay())throw new RequestError('Another explanation was saved. Refresh and review it before replacing it.',409);
 return {operationId:c.id,replayed:false};
}
export function operationsCsv(page:OperationsPage){const rows:unknown[][]=[['Captured through UTC',page.capturedThrough],['Definition','Ready recorded by deadline uses server time; reported outcomes do not rewrite it. Tapped time is unverified.'],['Evening check','Morning date','Check deadline UTC','Morning deadline UTC','Check status','Item ID','Item','Type','Source version','Readiness at deadline','Last saved Ready UTC','Reported outcome','Reported by','Report saved UTC']];for(const d of page.days){if(!d.tasks.length)rows.push([d.id,d.targetDay,d.eveningDeadline,d.morningDeadline,d.handover,'','','','',d.readiness]);for(const t of d.tasks)rows.push([d.id,d.targetDay,d.eveningDeadline,d.morningDeadline,d.handover,t.catalogId,t.name,t.kind,t.sourceVersion,t.status,t.lastReadyAt,t.outcome?.outcome,t.outcome?.actor_name,t.outcome?.created_at]);}rows.push([],['Source actions for matching checks; all actors retained to preserve context'],['Event ID','Operation ID','Check ID','Morning date','Item ID','Historic name','Phase','Action','Actor ID','Actor name','Saved UTC','Tapped UTC (unverified)','Session','Sequence','Before','After']);for(const b of page.sources??[])for(const e of b.events)rows.push([e.id,e.command_id,e.check_id,e.target_day,e.item_id,e.item_name,e.category,e.action,e.actor_id,e.actor_name,e.recorded_at,e.client_at,e.session_id,e.sequence,e.before_value,e.after_value]);return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');}
