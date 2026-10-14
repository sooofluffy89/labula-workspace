import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {settingAfter} from './manage-settings';
import {eventStatement} from './activity-server';
import type {MenuApplyOperation} from './menu-apply';

/** All predicates are evaluated by the receipt insert in the SAME D1 batch as menu + settings. */
export const menuSettingsGuard=`NOT EXISTS(SELECT 1 FROM json_each(?) j LEFT JOIN stock_items s ON s.item_id=json_extract(j.value,'$.itemId') LEFT JOIN checking_station_items t ON t.item_id=s.item_id
 WHERE s.item_id IS NULL OR s.revision!=json_extract(j.value,'$.before.revision') OR s.round_revision!=json_extract(j.value,'$.before.roundRevision') OR coalesce(t.revision,0)!=json_extract(j.value,'$.before.stationRevision') OR s.group_revision!=json_extract(j.value,'$.groupRevision')
 OR s.included!=json_extract(j.value,'$.before.included') OR s.track!=json_extract(j.value,'$.before.track') OR s.round_id IS NOT json_extract(j.value,'$.before.roundId') OR t.station_id IS NOT json_extract(j.value,'$.before.stationId')
 OR NOT EXISTS(SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id)
 OR (json_extract(j.value,'$.target.roundId') IS NOT NULL AND NOT EXISTS(SELECT 1 FROM check_rounds WHERE id=json_extract(j.value,'$.target.roundId'))))`;

export function menuSettingsWrites(user:ChatGPTUser,name:string,id:string,op:MenuApplyOperation,request:string,now:string){
 const db=getRawDb(),gate="EXISTS(SELECT 1 FROM catalog_operations WHERE id=? AND actor_id=? AND request=? AND before_revision=(SELECT revision FROM notebooks WHERE id='kitchen'))",args=[id,user.userId,request];
 const writes:ReturnType<typeof db.prepare>[]=[];
 for(const c of op.changes){const after=settingAfter(c.before,c.target),settingsChanged=JSON.stringify(after)!==JSON.stringify(c.before);
  writes.push(eventStatement(user,name,{id},now,{category:'stock',action:'settings',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:"json_set(json(?),'$.groupId',s.group_id)",after:'json(?)',from:`FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.item_id=? AND ${settingsChanged?'1':'s.group_id IS NOT ?'} AND ${gate}`,args:[JSON.stringify(c.before),JSON.stringify({...after,groupId:c.groupId}),c.itemId,...(settingsChanged?[]:[c.groupId]),...args]}));
  if(after.stationRevision!==c.before.stationRevision)writes.push(db.prepare(`INSERT INTO checking_station_items(item_id,station_id,revision,updated_at,updated_by) SELECT ?,?,?,?,? WHERE ${gate} ON CONFLICT(item_id) DO UPDATE SET station_id=excluded.station_id,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by`).bind(c.itemId,after.stationId,after.stationRevision,now,user.userId,...args));
  writes.push(db.prepare(`UPDATE stock_items SET included=?,track=?,revision=?,round_id=?,round_revision=?,round_source=CASE WHEN round_revision!=? THEN ? ELSE round_source END,group_revision=group_revision+CASE WHEN group_id IS NOT ? THEN 1 ELSE 0 END,group_source=CASE WHEN group_id IS NOT ? THEN 'owner' ELSE group_source END,group_updated_at=CASE WHEN group_id IS NOT ? THEN ? ELSE group_updated_at END,group_updated_by=CASE WHEN group_id IS NOT ? THEN ? ELSE group_updated_by END,group_id=?,updated_at=?,updated_by=? WHERE item_id=? AND (revision!=? OR round_revision!=? OR group_id IS NOT ?) AND ${gate}`).bind(Number(after.included),Number(after.track),after.revision,after.roundId,after.roundRevision,after.roundRevision,'owner:'+user.userId,c.groupId,c.groupId,c.groupId,now,c.groupId,user.userId,c.groupId,now,user.userId,c.itemId,after.revision,after.roundRevision,c.groupId,...args));
 }
 return writes;
}
