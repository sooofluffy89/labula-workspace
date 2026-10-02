import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {canManage,managementUsersSql,RequestError} from './notebook-server';
import {activeMember,eventStatement} from './activity-server';
import {stationCommandSchema} from './checking-stations';

export async function stationCommand(user:ChatGPTUser,raw:unknown){
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can assign checking stations.',403,'role_restricted');
 const member=await activeMember(user),c=stationCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(c.actorId!==user.userId)throw new RequestError('Return to the account that started this change.',403,'account_changed');
 const replay=async()=>{const prior=await db.prepare('SELECT actor_id,request,applied FROM checking_station_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string;applied:number}>();if(!prior)return null;if(prior.actor_id!==user.userId||prior.request!==request)throw new RequestError('This request belongs to another change.',409,'command_mismatch');if(!prior.applied)throw Error('Incomplete station receipt');return {operationId:c.id};};
 const prior=await replay();if(prior)return prior;
 const args=[c.id,user.userId,request],now=new Date().toISOString(),changes=JSON.stringify(c.changes);
 const gate='EXISTS(SELECT 1 FROM checking_station_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const changed="t.station_id IS NOT json_extract(j.value,'$.stationId')";
 const receipt=db.prepare(`INSERT INTO checking_station_commands(id,actor_id,request,applied,created_at)
 SELECT ?,?,?,0,? WHERE EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1)
 AND NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN stock_items s ON s.item_id=json_extract(j.value,'$.itemId') LEFT JOIN checking_station_items t ON t.item_id=s.item_id
 WHERE s.item_id IS NULL OR (s.track=1 AND t.station_id IS NOT NULL AND json_extract(j.value,'$.stationId') IS NULL) OR coalesce(t.revision,0)!=json_extract(j.value,'$.revision') OR NOT EXISTS(SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id))
 ON CONFLICT(id) DO NOTHING`).bind(...args,now,user.userId,user.userId,changes);
 const from=`FROM json_each(?) j JOIN stock_items s ON s.item_id=json_extract(j.value,'$.itemId') LEFT JOIN checking_station_items t ON t.item_id=s.item_id,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND ${changed} AND ${gate}`;
 const event=eventStatement(user,member.name,c,now,{category:'stock',action:'station',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:"json_object('stationId',t.station_id,'revision',coalesce(t.revision,0))",after:"json_object('stationId',json_extract(j.value,'$.stationId'),'revision',coalesce(t.revision,0)+1)",from,args:[changes,...args]});
 const update=db.prepare(`INSERT INTO checking_station_items(item_id,station_id,revision,updated_at,updated_by)
 SELECT s.item_id,json_extract(j.value,'$.stationId'),coalesce(t.revision,0)+1,?,? FROM json_each(?) j JOIN stock_items s ON s.item_id=json_extract(j.value,'$.itemId') LEFT JOIN checking_station_items t ON t.item_id=s.item_id
 WHERE ${changed} AND ${gate} ON CONFLICT(item_id) DO UPDATE SET station_id=excluded.station_id,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(now,user.userId,changes,...args);
 await db.batch([receipt,event,update,db.prepare(`UPDATE checking_station_commands SET applied=1 WHERE id=? AND ${gate}`).bind(c.id,...args)]);
 const saved=await replay();if(saved)return saved;
 throw new RequestError('A selected item changed or an active item would lose its required station. Refresh and review all shared stations before saving again.',409,'station_conflict');
}
