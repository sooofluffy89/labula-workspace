import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {canManage,managementUsersSql,RequestError} from './notebook-server';
import {activeMember,eventStatement} from './activity-server';
import {readStock} from './stock-server';
import {readRoundConfiguration} from './round-store';
import {manageCommandSchema,settingAfter,type SettingValue,type ManageSnapshot,type ManageReceipt} from './manage-settings';
import type {RoundId} from './check-rounds';

export async function readManageSettings(user:ChatGPTUser):Promise<ManageSnapshot>{
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can manage items.',403,'role_restricted');
 for(let attempt=0;attempt<3;attempt++){
  const stock=await readStock(user),p=await readRoundConfiguration();
  const rows=p.stockRows as {item_id:string;included:number;track:number;revision:number;group_revision:number;round_id:RoundId|null;round_revision:number}[];
  if(stock.notebookRevision!==p.notebookRevision||stock.items.some(i=>{const r=rows.find(r=>r.item_id===i.itemId);return !r||r.revision!==i.revision||r.group_revision!==i.groupRevision;}))continue;
  const configuration:Record<string,SettingValue>={};for(const i of stock.items){const r=rows.find(r=>r.item_id===i.itemId)!;configuration[i.itemId]={included:i.included,track:i.track,revision:i.revision,roundId:r.round_id,roundRevision:r.round_revision,stationId:i.stationId??null,stationRevision:i.stationRevision??0};}
  return {...stock,manageSettings:1,rounds:p.rounds,configuration};
 }
 throw new RequestError('The shared list changed while loading. Retry to load the latest settings.',409,'settings_conflict');
}

export async function manageSettingsCommand(user:ChatGPTUser,raw:unknown){
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can manage items.',403,'role_restricted');
 const member=await activeMember(user),c=manageCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(c.actorId!==user.userId)throw new RequestError('Return to the account that started this change.',403,'account_changed');
 // Reuse the existing immutable stock receipt table; no new table or migration is needed.
 const replay=async()=>{const r=await db.prepare('SELECT actor_id,request,result FROM stock_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string;result:string}>();if(!r)return null;if(r.actor_id!==user.userId||r.request!==request)throw new RequestError('This request ID belongs to another change.',409,'command_mismatch');return JSON.parse(r.result) as ManageReceipt;};
 const prior=await replay();if(prior)return prior;
 const after=settingAfter(c.before,c.target),now=new Date().toISOString(),args=[c.id,user.userId,request],result:ManageReceipt={operationId:c.id,itemId:c.itemId,before:c.before,after};
 const gate='EXISTS(SELECT 1 FROM stock_commands WHERE id=? AND actor_id=? AND request=?)';
 const receipt=db.prepare(`INSERT INTO stock_commands(id,actor_id,request,result,created_at)
 SELECT ?,?,?,?,? WHERE EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1)
 AND EXISTS(SELECT 1 FROM stock_items s LEFT JOIN checking_station_items t ON t.item_id=s.item_id,notebooks n,json_each(n.payload,'$.items') i
 WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND s.revision=? AND s.round_revision=? AND coalesce(t.revision,0)=?
 AND s.included=? AND s.track=? AND s.round_id IS ? AND t.station_id IS ?)
 AND (? IS NULL OR EXISTS(SELECT 1 FROM check_rounds WHERE id=?)) ON CONFLICT(id) DO NOTHING`).bind(...args,JSON.stringify(result),now,user.userId,user.userId,c.itemId,c.before.revision,c.before.roundRevision,c.before.stationRevision,Number(c.before.included),Number(c.before.track),c.before.roundId,c.before.stationId,c.target.roundId,c.target.roundId);
 const changed=JSON.stringify(c.before)!==JSON.stringify(after);
 const writes:ReturnType<typeof db.prepare>[]=[];
 if(changed)writes.push(eventStatement(user,member.name,c,now,{category:'stock',action:'settings',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:'json(?)',after:'json(?)',from:`FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND ${gate}`,args:[JSON.stringify(c.before),JSON.stringify(after),c.itemId,...args]}));
 // Station changes and activation share the same atomic transaction; assignment is optional.
 if(after.stationRevision!==c.before.stationRevision)writes.push(db.prepare(`INSERT INTO checking_station_items(item_id,station_id,revision,updated_at,updated_by) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(item_id) DO UPDATE SET station_id=excluded.station_id,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(c.itemId,c.target.stationId,after.stationRevision,now,user.userId,...args));
 if(after.revision!==c.before.revision||after.roundRevision!==c.before.roundRevision)writes.push(db.prepare(`UPDATE stock_items SET included=?,track=?,round_id=?,revision=?,round_revision=?,round_source=?,updated_at=?,updated_by=? WHERE item_id=? AND ${gate}`).bind(Number(after.included),Number(after.track),after.roundId,after.revision,after.roundRevision,`owner:${user.userId}`,now,user.userId,c.itemId,...args));
 await db.batch([receipt,...writes]);const saved=await replay();if(saved)return saved;
 throw new RequestError('Shared settings changed. Your choice is kept here. Refresh and compare before applying it again.',409,'settings_conflict');
}
