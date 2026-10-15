import type {ChatGPTUser} from '@/app/chatgpt-auth';
import type {EveningCommand} from './evening';
import {eventStatement} from './activity-server';

export function eveningEvents(user:ChatGPTUser,name:string,c:EveningCommand,now:string,gate:string,args:unknown[],eligible?:string[]){
 const id=c.kind==='start'?c.day:c.checkId;
 const base={category:c.kind==='ready'?'morning':'evening',action:c.kind,checkId:'x.check_id',targetDay:'x.target_day'};
 if(c.kind==='start')return [eventStatement(user,name,c,now,{...base,after:"json_object('targetDay',x.target_day)",from:`FROM (SELECT ? AS check_id,? AS target_day) x WHERE NOT EXISTS (SELECT 1 FROM evening_checks WHERE id=x.check_id) AND ${gate}`,args:[id,c.targetDay,...args]})];
 if(c.kind==='ready'||c.kind==='answer'||c.kind==='resolve'||c.kind==='supersede'){
  const table=c.kind==='ready'?'morning_tasks':'evening_answers';
  const after=c.kind==='ready'?{ready:c.value,revision:c.revision+1}:c.kind==='answer'?{value:c.value,revision:c.revision+1}:c.kind==='resolve'?{catalogId:c.catalogId,value:null,revision:c.revision+1}:{supersededBy:c.targetItemId,value:'have',revision:c.revision+1};
  return [eventStatement(user,name,c,now,{...base,itemId:'x.item_id',itemName:'x.name',itemKind:'x.kind',before:c.kind==='ready'?"json_object('ready',x.ready,'cancelled',x.cancelled,'revision',x.revision,'catalogId',x.catalog_id)":"json_object('value',x.value,'revision',x.revision,'catalogId',x.catalog_id,'supersededBy',x.superseded_by,'round',json(x.round_snapshot))",after:"json_set(?,'$.planVersion',x.plan_version)",from:`FROM (SELECT a.*,k.target_day,k.version AS plan_version FROM ${table} a JOIN evening_checks k ON k.id=a.check_id) x WHERE x.check_id=? AND x.item_id=? AND ${gate}`,args:[JSON.stringify(after),id,c.itemId,...args]})];
 }
 const events=[eventStatement(user,name,c,now,{...base,before:"json_object('stage',x.stage,'version',x.version,'revision',x.revision,'planRevision',x.plan_revision,'targetDay',x.target_day)",after:'?',from:`FROM (SELECT *,id AS check_id FROM evening_checks) x WHERE x.id=? AND ${gate}`,args:[JSON.stringify(c.kind==='dates'?{targetDay:c.targetDay}:c.kind==='add-items'?{addedItemIds:c.itemIds}:c.kind==='correct'?{stage:'draft'}:{stage:'confirmed'}),id,...args]})];
 if(c.kind==='confirm'){
  // Derive from rows inside the SAME transaction, before task mutations.
  for(const action of ['created','reopened','cancelled'] as const){
   const condition=action==='created'?"a.value='missing' AND t.item_id IS NULL":action==='reopened'?"a.value='missing' AND t.item_id IS NOT NULL AND (t.cancelled=1 OR t.catalog_id!=a.catalog_id)":`t.cancelled=0 AND (a.value IS NOT 'missing' OR a.superseded_by IS NOT NULL${eligible?' OR a.catalog_id NOT IN (SELECT value FROM json_each(?))':''})`;
   events.push(eventStatement(user,name,c,now,{category:'morning',action,source:'system',checkId:'x.check_id',targetDay:'x.target_day',itemId:'x.item_id',itemName:'x.name',itemKind:'x.kind',before:"CASE WHEN x.old_item IS NULL THEN NULL ELSE json_object('ready',x.ready,'cancelled',x.cancelled,'catalogId',x.old_catalog,'revision',x.task_revision) END",after:`json_object('ready',${action==='cancelled'?'x.ready':'0'},'cancelled',${action==='cancelled'?1:0},'catalogId',x.catalog_id,'planVersion',x.plan_version+1,'revision',CASE WHEN x.old_item IS NULL THEN 0 ELSE x.task_revision+1 END)`,from:`FROM (SELECT a.*,k.target_day,k.version AS plan_version,t.item_id AS old_item,t.catalog_id AS old_catalog,t.ready,t.cancelled,t.revision AS task_revision FROM evening_answers a JOIN evening_checks k ON k.id=a.check_id LEFT JOIN morning_tasks t ON t.check_id=a.check_id AND t.item_id=a.item_id WHERE ${condition}${eligible&&action!=='cancelled'?' AND a.catalog_id IN (SELECT value FROM json_each(?))':''}) x WHERE x.check_id=? AND ${gate}`,args:[...(eligible?[JSON.stringify(eligible)]:[]),id,...args]}));
  }
 }
 return events;
}
