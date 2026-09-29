import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {getRawDb} from '@/db';
import {canManage,managementUsersSql,RequestError} from './notebook-server';
import {activeMember,eventStatement} from './activity-server';
import {readStock} from './stock-server';
import {readPlanning} from './round-store';
import {readCalendarVersions} from './calendar-server';
import {operationalDay} from './evening';
import {frequencyCommandSchema,nextCheck,type FrequencySettings} from './stock-frequency';
import type {RoundId} from './check-rounds';
// Stock/round changes and published check coverage advance round_state; unrelated chef clicks do not invalidate this read.
const boundarySql="SELECT (SELECT revision FROM round_state WHERE id='kitchen') r,(SELECT revision FROM notebooks WHERE id='kitchen') n,(SELECT coalesce(max(revision),0) FROM operating_calendar_versions) c";
export async function readStockSettings(user:ChatGPTUser){
 if(!await canManage(user))return readStock(user);
 const db=getRawDb();
 for(let attempt=0;attempt<3;attempt++){
  const stock=await readStock(user),before=await db.prepare(boundarySql).first<{r:number;n:number;c:number}>();
  const day=operationalDay(),calendar=await readCalendarVersions(),p=await readPlanning(day);
  const result=await db.batch([db.prepare(boundarySql),db.prepare('SELECT id FROM evening_checks WHERE id=?').bind(day),db.prepare('SELECT catalog_id FROM evening_answers WHERE check_id=? AND superseded_by IS NULL').bind(day),db.prepare("SELECT DISTINCT json_extract(a.value,'$.catalogId') AS item_id,v.check_id AS day FROM evening_versions v JOIN evening_checks c ON c.id=v.check_id AND c.version=v.version,json_each(v.payload,'$.answers') a WHERE v.check_id>? AND json_extract(a.value,'$.value') IS NOT NULL AND json_extract(a.value,'$.supersededBy') IS NULL").bind(day)]);
  const after=result[0].results[0] as typeof before,rows=p.stockRows as {item_id:string;revision:number;group_revision:number;round_revision:number;round_id:RoundId|null}[];
  if(JSON.stringify(before)!==JSON.stringify(after)||before?.r!==p.revision||stock.notebookRevision!==p.notebookRevision||day!==operationalDay()||stock.items.some(i=>{const r=rows.find(r=>r.item_id===i.itemId);return !r||r.revision!==i.revision||r.group_revision!==i.groupRevision;}))continue;
  const settings:FrequencySettings={day,capturedAt:new Date().toISOString(),revision:p.revision,calendarRevision:before!.c,rounds:p.rounds,items:{}};
  for(const item of stock.items){const row=rows.find(r=>r.item_id===item.itemId)!;settings.items[item.itemId]={roundId:row.round_id,roundRevision:row.round_revision,next:nextCheck({item,round:p.rounds.find(r=>r.id===row.round_id),events:p.timeline.filter(e=>e.itemId===item.itemId),calendar,day,lastConfirmed:p.coveredThrough.get(item.itemId)??null,confirmedDays:(result[3].results as {item_id:string;day:string}[]).filter(r=>r.item_id===item.itemId).map(r=>r.day),currentCheck:result[1].results.length?((result[2].results as {catalog_id:string}[]).some(r=>r.catalog_id===item.itemId)?'included':'absent'):null})};}
  return {...stock,settings};
 }
 throw new RequestError('The shared settings changed while loading. Refresh to verify the next checks.',409,'frequency_conflict');
}
export async function frequencyCommand(user:ChatGPTUser,raw:unknown){
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can change check frequency.',403,'role_restricted');
 const member=await activeMember(user),c=frequencyCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c),item=c.changes[0];
 if(c.actorId!==user.userId)throw new RequestError('Return to the account that started this change.',403,'account_changed');
 const replay=async()=>{const old=await db.prepare('SELECT actor_id,request,applied FROM round_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string;applied:number}>();if(!old)return null;if(old.actor_id!==user.userId||old.request!==request)throw new RequestError('This request belongs to another change.',409,'command_mismatch');if(!old.applied)throw Error('Incomplete frequency receipt');return {operationId:c.id};};
 const saved=await replay();if(saved)return saved;
 if(c.day!==operationalDay())throw new RequestError('The operational day changed. Refresh and review the new schedule.',409,'frequency_conflict');
 const now=new Date().toISOString(),round=item.frequency==='off'?null:item.frequency,track=item.track?1:0,args=[c.id,user.userId,request];
 const gate='EXISTS(SELECT 1 FROM round_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const changed='(s.track!=? OR (? IS NOT NULL AND s.round_id IS NOT ?))';
 const receipt=db.prepare(`INSERT INTO round_commands(id,actor_id,request,applied,created_at) SELECT ?,?,?,0,? WHERE EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) AND EXISTS(SELECT 1 FROM round_state WHERE id='kitchen' AND revision=?) AND (SELECT coalesce(max(revision),0) FROM operating_calendar_versions)=? AND EXISTS(SELECT 1 FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND s.included=1 AND s.revision=? AND s.round_revision=?) ON CONFLICT(id) DO NOTHING`).bind(...args,now,user.userId,user.userId,c.planningRevision,c.calendarRevision,item.itemId,item.revision,item.roundRevision);
 const event=eventStatement(user,member.name,c,now,{category:'stock',action:'settings',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:"json_object('included',s.included,'track',s.track,'roundId',s.round_id,'revision',s.revision)",after:"json_object('included',s.included,'track',?,'roundId',coalesce(?,s.round_id),'revision',s.revision+1,'frequency',?)",from:`FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND ${changed} AND ${gate}`,args:[track,round,item.frequency,item.itemId,track,round,round,...args]});
 const update=db.prepare(`UPDATE stock_items AS s SET track=?,round_id=coalesce(?,round_id),revision=revision+1,round_revision=round_revision+1,round_source=?,updated_at=?,updated_by=? WHERE item_id=? AND ${changed} AND ${gate}`).bind(track,round,`owner:${user.userId}`,now,user.userId,item.itemId,track,round,round,...args);
 await db.batch([receipt,event,update,db.prepare(`UPDATE round_commands SET applied=1 WHERE id=? AND ${gate}`).bind(c.id,...args)]);
 const applied=await replay();if(applied)return applied;
 throw new RequestError('This item or the shared schedule changed. Refresh, compare the shared frequency and review your choice again.',409,'frequency_conflict');
}
