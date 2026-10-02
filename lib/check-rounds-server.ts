import {readCalendarVersions} from './calendar-server';
import {calendarVersion} from './operating-calendar';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {RequestError,canManage,managementUsersSql} from './notebook-server';
import {readStock} from './stock-server';
import {activeMember,eventStatement} from './activity-server';
import {readPlanning} from './round-store';
import {operationalDay} from './evening';
import {roundCommandSchema,type RoundsSnapshot,type RoundId} from './check-rounds';
async function requireOwner(user:ChatGPTUser){if(!await canManage(user))throw new RequestError('Only the owner or a Manager can manage check rounds.',403,'role_restricted');}
export async function readRounds(user:ChatGPTUser):Promise<RoundsSnapshot>{
 await requireOwner(user);
 for(let attempt=0;attempt<3;attempt++){
  const stock=await readStock(user),p=await readPlanning(operationalDay());
  const rows=p.stockRows as {item_id:string;round_id:RoundId|null;revision:number;group_revision:number}[];
  if(p.notebookRevision!==stock.notebookRevision||stock.items.some(i=>{const r=rows.find(r=>r.item_id===i.itemId);return !r||r.revision!==i.revision||r.group_revision!==i.groupRevision;}))continue;
  return {calendar:await readCalendarVersions(),accountId:user.userId,account:user.email,revision:p.revision,activatedAt:p.activatedAt,rounds:p.rounds,items:stock.items.map(i=>({...i,roundId:rows.find(r=>r.item_id===i.itemId)?.round_id??null}))};
 }
 throw new RequestError('The shared list is changing. Retry loading the latest settings.',409,'round_conflict');
}
export async function roundCommand(user:ChatGPTUser,raw:unknown){
 await requireOwner(user);const c=roundCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(c.actorId!==user.userId)throw new RequestError('The signed-in account changed. Return to the original account to retry.',403,'account_changed');
 const replay=async()=>{const r=await db.prepare('SELECT * FROM round_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string;applied:number}>();if(!r)return null;if(r.actor_id!==user.userId||r.request!==request)throw new RequestError('This request ID belongs to another change.',409,'command_mismatch');if(!r.applied)throw Error('Incomplete round receipt');return {operationId:c.id,replayed:true};};
 const prior=await replay();if(prior)return prior;
 const member=await activeMember(user);await readStock(user);const now=new Date().toISOString(),calendar=await readCalendarVersions(),config=calendarVersion(operationalDay(),calendar)?.config;
 if(c.kind==='days'&&c.roundId!=='daily'&&config&&c.days.some(d=>!config.openDays.includes(d)))throw new RequestError('Choose distinct open weekdays. Closed weekdays need an operating calendar change first.',409,'closed_round_day');
 let condition='(SELECT coalesce(max(revision),0) FROM operating_calendar_versions)=?';const extra:unknown[]=[Math.max(0,...calendar.map(v=>v.revision))];
 if(c.kind==='members'){
  condition+=` AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN stock_items s ON s.item_id=j.value WHERE s.item_id IS NULL OR NOT EXISTS(SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id))`;
  extra.push(JSON.stringify(c.itemIds));
 }
 if(c.kind==='track'){
  condition+=` AND EXISTS(SELECT 1 FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND s.included=1 AND s.revision=?)`;
  extra.push(c.itemId,c.itemRevision);
 }
 const args=[c.id,user.userId,request],gate='EXISTS(SELECT 1 FROM round_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const receipt=db.prepare(`INSERT INTO round_commands(id,actor_id,request,applied,created_at) SELECT ?,?,?,0,? WHERE EXISTS(SELECT 1 FROM round_state WHERE id='kitchen' AND revision=?) AND EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) AND ${condition} ON CONFLICT(id) DO NOTHING`).bind(...args,now,c.revision,user.userId,user.userId,...extra);
 const writes:ReturnType<typeof db.prepare>[]=[];
 if(c.kind==='days'){
  writes.push(eventStatement(user,member.name,c,now,{category:'stock',action:'round-days',before:"json_object('roundId',r.id,'days',json(r.days),'revision',r.revision)",after:"json_object('roundId',r.id,'days',json(?),'revision',r.revision+1)",from:`FROM check_rounds r WHERE r.id=? AND ${gate}`,args:[JSON.stringify(c.days),c.roundId,...args]}));
  writes.push(db.prepare(`UPDATE check_rounds SET days=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND ${gate}`).bind(JSON.stringify([...c.days].sort()),now,user.userId,c.roundId,...args));
 }else if(c.kind==='track'){
  const track=c.track?1:0;
  writes.push(eventStatement(user,member.name,c,now,{category:'stock',action:'settings',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:"json_object('included',s.included,'track',s.track,'roundId',s.round_id,'revision',s.revision)",after:"json_object('included',s.included,'track',?,'roundId',s.round_id,'revision',s.revision+1)",from:`FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND s.track!=? AND ${gate}`,args:[track,c.itemId,track,...args]}));
  writes.push(db.prepare(`UPDATE stock_items SET track=?,round_revision=round_revision+1,round_source=?,revision=revision+1,updated_at=?,updated_by=? WHERE item_id=? AND track!=? AND ${gate}`).bind(track,`owner:${user.userId}`,now,user.userId,c.itemId,track,...args));
 }else{
  writes.push(eventStatement(user,member.name,c,now,{category:'stock',action:'round-membership',itemId:'s.item_id',before:"json_object('roundId',s.round_id,'days',json(coalesce((SELECT days FROM check_rounds WHERE id=s.round_id),'[]')))",after:"json_object('roundId',?,'days',json(coalesce((SELECT days FROM check_rounds WHERE id=?),'[]')))",from:`FROM stock_items s WHERE item_id IN(SELECT value FROM json_each(?)) AND ${gate}`,args:[c.roundId,c.roundId,JSON.stringify(c.itemIds),...args]}));
  writes.push(db.prepare(`UPDATE stock_items SET round_revision=round_revision+1,round_id=?,round_source=? WHERE item_id IN(SELECT value FROM json_each(?)) AND ${gate}`).bind(c.roundId,`owner:${user.userId}`,JSON.stringify(c.itemIds),...args));
 }
 await db.batch([receipt,...writes,db.prepare(`UPDATE round_commands SET applied=1 WHERE id=? AND ${gate}`).bind(c.id,...args)]);
 if(await replay())return {operationId:c.id,replayed:false};
 throw new RequestError('The list or schedule changed. Refresh and review the item in Manage list.',409,'round_conflict');
}
