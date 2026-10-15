import {noteColumns} from './prep-notes-server';
import {z} from 'zod';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {RequestError} from './notebook-server';
import {latestMenuSourceSql} from './menu-scope-server';
import {scopeSource,type MenuScopeSource} from './menu-scope';
import {eveningCommandSchema,selectionQuery,dateSchema,operationalDay,type EveningSelection} from './evening';
import {eveningEvents} from './evening-activity';
import {answerView,taskView,summary,type CheckRow,type AnswerRow,type TaskRow} from './evening-server';
import {EVENING_BATCH_LIMIT,type SyncCursor,type EveningDelta,type EveningBatchReply,type BatchResult} from './evening-sync';

// No bootstrap or permission cache on the sync/write hot path.
export async function syncMember(user:ChatGPTUser){
 const m=await getRawDb().prepare('SELECT name,active FROM kitchen_team WHERE user_id=?').bind(user.userId).first<{name:string;active:number}>();
 if(!m?.active)throw new RequestError('Your access is unavailable or paused. Sign in again or ask the owner. Saved changes stay on this device.',403);
 return m;
}
export const syncMetadataSql="SELECT coalesce((SELECT max(rowid) FROM kitchen_activity),0) AS through,(SELECT revision FROM notebooks WHERE id='kitchen') AS notebook,coalesce((SELECT revision FROM round_state WHERE id='kitchen'),0) AS rounds,coalesce((SELECT max(revision) FROM operating_calendar_versions),0) AS calendar";
type Metadata={through:number;notebook:number;rounds:number;calendar:number};
export function initialSyncCursor(user:ChatGPTUser,selection:EveningSelection,m:Metadata){return JSON.stringify({v:1,accountId:user.userId,scope:selectionQuery(selection),after:m.through,through:null,notebook:m.notebook,rounds:m.rounds,calendar:m.calendar} satisfies SyncCursor);}
const cursorSchema=z.object({v:z.literal(1),accountId:z.string(),scope:z.string(),after:z.number().int().nonnegative(),through:z.number().int().nonnegative().nullable(),notebook:z.number().int().nonnegative(),rounds:z.number().int().nonnegative(),calendar:z.number().int().nonnegative()});
const pageSize=128;
export async function readEveningDelta(user:ChatGPTUser,selection:EveningSelection,raw:string):Promise<EveningDelta>{
 await syncMember(user);
 if(raw.length>2048)throw new RequestError('Invalid sync cursor. Reload the shared check.');
 let cursor:SyncCursor;try{cursor=cursorSchema.parse(JSON.parse(raw));}catch{throw new RequestError('Invalid sync cursor. Reload the shared check.');}
 if(cursor.accountId!==user.userId||cursor.scope!==selectionQuery(selection))throw new RequestError('The sync account or date changed. Reload the shared check.',409);
 const selected=dateSchema.parse('day' in selection?selection.day:selection.morningDay),db=getRawDb();
 const checkWhere='day' in selection?'id=?':'plan_day=?';
 const bound=cursor.through??Number.MAX_SAFE_INTEGER;
 const eventsSql=`SELECT rowid AS seq,check_id,item_id,action,category FROM kitchen_activity WHERE rowid>? AND rowid<=? ORDER BY rowid LIMIT ${pageSize}`;
 const ids=`SELECT item_id FROM (${eventsSql}) WHERE check_id=a.check_id AND item_id=a.item_id`;
 // D1 batch is one consistent transaction. Rows and captured high water cannot race.
 const r=await db.batch([
  db.prepare(syncMetadataSql),db.prepare(`SELECT * FROM evening_checks WHERE ${checkWhere}`).bind(selected),
  db.prepare(eventsSql).bind(cursor.after,bound),
  db.prepare(`SELECT ${noteColumns('a')},1 AS mapping_valid,NULL AS current_name FROM evening_answers a WHERE a.check_id=(SELECT id FROM evening_checks WHERE ${checkWhere}) AND a.item_id IN (${ids}) ORDER BY a.position`).bind(selected,cursor.after,bound),
  db.prepare(`SELECT ${noteColumns('a')},1 AS mapping_valid FROM morning_tasks a WHERE a.check_id=(SELECT id FROM evening_checks WHERE ${checkWhere}) AND a.item_id IN (${ids}) ORDER BY a.position`).bind(selected,cursor.after,bound),db.prepare(latestMenuSourceSql),
 ]);
 const scope=r[5].results[0]?scopeSource(r[5].results[0] as MenuScopeSource):undefined;
 const meta=r[0].results[0] as Metadata,row=r[1].results[0] as CheckRow|undefined,events=r[2].results as {seq:number;check_id:string;item_id:string|null;action:string;category:string}[];
 const through=cursor.through??meta.through,last=events.at(-1)?.seq??through,pageMore=events.length===pageSize&&last<through;
 // A header is current within this transaction, while a page can still be
 // bounded by an earlier transaction. Exhausting that horizon is not final:
 // old clients must also continue until the header's changes have arrived.
 const more=pageMore||through<meta.through;
 const reset=cursor.after>meta.through||cursor.notebook!==meta.notebook||cursor.rounds!==meta.rounds||cursor.calendar!==meta.calendar||events.some(e=>!['answer','ready','prep-feedback','prep-instruction'].includes(e.action));
 const next={...cursor,after:pageMore?last:through,through:pageMore?through:null};
 // Catalog changes force a complete read; unchanged catalog means existing mapping/name data stay valid.
 return {accountId:user.userId,account:user.email,cursor:JSON.stringify(next),reset,more,...(!reset&&!more?{verifiedThrough:meta.through}:{}),check:row?summary(row):null,answers:(r[3].results as AnswerRow[]).map(a=>answerView(a,undefined,row?.stage==='draft'?scope:undefined)),tasks:(r[4].results as TaskRow[]).map(t=>taskView(t,undefined,row&&row.target_day>=operationalDay()?scope:undefined))};
}

export async function eveningBatch(user:ChatGPTUser,raw:unknown):Promise<EveningBatchReply>{
 const input=z.object({commands:z.array(eveningCommandSchema).min(1).max(EVENING_BATCH_LIMIT)}).parse(raw);
 if(input.commands.some(c=>c.kind!=='answer'&&c.kind!=='ready'))throw new RequestError('Only item changes can be sent together.');
 const commands=input.commands as Extract<typeof input.commands[number],{kind:'answer'|'ready'}>[];
 if(commands.some(c=>c.actorId!==user.userId))throw new RequestError('The signed-in account changed. Return to the original account.',403);
 if(new Set(commands.map(c=>c.id)).size!==commands.length)throw new RequestError('Each change needs a distinct operation ID.');
 if(new Set(commands.map(c=>c.checkId)).size!==1)throw new RequestError('A batch must belong to one check.');
 const member=await syncMember(user),db=getRawDb(),statements:ReturnType<typeof db.prepare>[]=[],reads:number[]=[],priorByItem=new Map<string,typeof commands>();
 for(const c of commands){
  const request=JSON.stringify(c),now=new Date().toISOString(),args=[c.id,user.userId,request];
  const prior=priorByItem.get(c.kind+':'+c.checkId+':'+c.itemId)??[];
  const dependencies=prior.length?' AND NOT EXISTS (SELECT 1 FROM json_each(?) p WHERE NOT EXISTS (SELECT 1 FROM evening_commands e WHERE e.id=json_extract(p.value,\'$.id\') AND e.actor_id=? AND e.request=json_extract(p.value,\'$.request\') AND e.applied=1))':'';
  const depArgs=prior.length?[JSON.stringify(prior.map(x=>({id:x.id,request:JSON.stringify(x)}))),user.userId]:[];
  const gate='EXISTS (SELECT 1 FROM evening_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
  const table=c.kind==='answer'?'evening_answers':'morning_tasks';
  const condition=c.kind==='answer'?"c.stage='draft' AND c.version=? AND a.superseded_by IS NULL AND a.value IS NOT ?":"c.version>0 AND a.cancelled=0 AND a.ready!=? AND EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=a.catalog_id AND json_extract(j.value,'$.kind')=a.kind)";
  statements.push(db.prepare(`INSERT INTO evening_commands(id,actor_id,request,result,applied,created_at) SELECT ?,?,?,?,0,? WHERE EXISTS(SELECT 1 FROM ${table} a JOIN evening_checks c ON c.id=a.check_id WHERE c.id=? AND a.item_id=? AND a.revision=? AND ${condition}) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ${dependencies} ON CONFLICT(id) DO NOTHING`).bind(...args,JSON.stringify({checkId:c.checkId}),now,c.checkId,c.itemId,c.revision,...(c.kind==='answer'?[c.generation,c.value]:[c.value?1:0]),user.userId,...depArgs));
  // Same-value stale requests conflict; they never create fake authorship or extra transitions.
  statements.push(...eveningEvents(user,member.name,c,now,gate,args));
  if(c.kind==='answer')statements.push(db.prepare(`UPDATE evening_answers SET value=?,revision=revision+1,updated_at=?,updated_by=?,first_actor=coalesce(first_actor,?),first_device=coalesce(first_device,?),first_sequence=coalesce(first_sequence,?) WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.value,now,user.email,c.value?user.userId:null,c.value?c.deviceId:null,c.value?c.sequence:null,c.checkId,c.itemId,...args));
  else statements.push(db.prepare(`UPDATE morning_tasks SET ready=?,revision=revision+1,updated_at=?,updated_by=? WHERE check_id=? AND item_id=? AND ${gate}`).bind(c.value?1:0,now,user.email,c.checkId,c.itemId,...args));
  statements.push(db.prepare(`UPDATE evening_checks SET ${c.kind==='answer'?'revision':'plan_revision'}=${c.kind==='answer'?'revision':'plan_revision'}+1,updated_at=? WHERE id=? AND ${gate}`).bind(now,c.checkId,...args));
  statements.push(db.prepare('UPDATE evening_commands SET applied=1 WHERE id=? AND actor_id=? AND request=? AND applied=0').bind(...args));
  reads.push(statements.length);statements.push(db.prepare('SELECT id,actor_id,request,result,applied FROM evening_commands WHERE id=?').bind(c.id));
  priorByItem.set(c.kind+':'+c.checkId+':'+c.itemId,[...prior,c]);
 }
 const changesIndex=statements.length,checkId=commands[0].checkId,itemIds=JSON.stringify(commands.map(c=>c.itemId));
 statements.push(db.prepare('SELECT * FROM evening_checks WHERE id=?').bind(checkId),db.prepare(`SELECT ${noteColumns('a')} FROM evening_answers a WHERE check_id=? AND item_id IN (SELECT value FROM json_each(?))`).bind(checkId,itemIds),db.prepare(`SELECT ${noteColumns('a')} FROM morning_tasks a WHERE check_id=? AND item_id IN (SELECT value FROM json_each(?))`).bind(checkId,itemIds),db.prepare(latestMenuSourceSql));
 // A technical failure rolls back the whole D1 transaction. Logical CAS failures are per command.
 const r=await db.batch(statements),blocked=new Set<string>();
 const results:BatchResult[]=commands.map((c,i)=>{
  const receipt=r[reads[i]].results[0] as {actor_id:string;request:string;applied:number}|undefined,key=c.kind+':'+c.checkId+':'+c.itemId;
  if(receipt?.applied&&receipt.actor_id===user.userId&&receipt.request===JSON.stringify(c))return {operationId:c.id,checkId:c.checkId,status:'saved',revision:c.revision+1};
  const dependent=blocked.has(key);blocked.add(key);
  return {operationId:c.id,checkId:c.checkId,status:dependent?'blocked':'conflict',error:receipt?'This operation ID belongs to a different change.':'This item changed. Review the shared result before choosing what to keep.'};
 });
 const scope=r[changesIndex+3].results[0]?scopeSource(r[changesIndex+3].results[0] as MenuScopeSource):undefined,row=r[changesIndex].results[0] as CheckRow|undefined;
 return {accountId:user.userId,account:user.email,results,changes:{check:r[changesIndex].results[0]?summary(r[changesIndex].results[0] as CheckRow):null,answers:(r[changesIndex+1].results as AnswerRow[]).map(a=>answerView(a,undefined,row?.stage==='draft'?scope:undefined)),tasks:(r[changesIndex+2].results as TaskRow[]).map(t=>taskView(t,undefined,row&&row.target_day>=operationalDay()?scope:undefined))}};
}
