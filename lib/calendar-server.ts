import {requireWriteScope} from '@/lib/protected-api';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {owner,RequestError,canManage,managementUsersSql} from './notebook-server';
import {activeMember} from './activity-server';
import {operationalDay,shiftDay} from './evening';
import {calendarCommandSchema,calendarConfigSchema,defaultCalendar,isOpenDay,nextOpenDay,type CalendarVersion,type CalendarSnapshot} from './operating-calendar';

export function calendarVersionsFromRows(rows:{revision:number;effective_day:string;payload:string;created_at:string;created_by:string}[]):CalendarVersion[]{return rows.map(v=>({revision:v.revision,effectiveDay:v.effective_day,config:calendarConfigSchema.parse(JSON.parse(v.payload)),createdAt:v.created_at,createdBy:v.created_by}));}
export async function readCalendarVersions():Promise<CalendarVersion[]>{return calendarVersionsFromRows((await getRawDb().prepare('SELECT * FROM operating_calendar_versions ORDER BY revision').all<{revision:number;effective_day:string;payload:string;created_at:string;created_by:string}>()).results);}
export async function readOperationalAccess(user:ChatGPTUser){const row=await getRawDb().prepare('SELECT active FROM kitchen_team WHERE user_id=? OR email=? ORDER BY CASE WHEN user_id=? THEN 0 ELSE 1 END LIMIT 1').bind(user.userId,user.email.toLowerCase(),user.userId).first<{active:number}>();if(row&&!row.active)throw new RequestError('Your Current stock access is paused. Ask the owner to reactivate your profile.',403);}
export async function readCalendar(user:ChatGPTUser):Promise<CalendarSnapshot>{await readOperationalAccess(user);const versions=await readCalendarVersions(),isOwner=await owner(user),manage=await canManage(user);if(manage)requireWriteScope('management');return {versions,revision:Math.max(0,...versions.map(v=>v.revision)),accountId:user.userId,account:user.email,isOwner,canManage:manage,...(manage?{impacts:(await getRawDb().prepare('SELECT id,target_day AS targetDay,stage FROM evening_checks WHERE target_day>=? ORDER BY target_day').bind(operationalDay()).all<{id:string;targetDay:string;stage:string}>()).results}:{})};}
export async function calendarCommand(user:ChatGPTUser,raw:unknown){
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can manage the operating calendar.',403);
 const c=calendarCommandSchema.parse(raw);if(c.actorId!==user.userId)throw new RequestError('The signed-in account changed.',403);
 await activeMember(user);const db=getRawDb(),request=JSON.stringify(c);
 const replay=async()=>{const p=await db.prepare('SELECT actor_id,request FROM operating_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string}>();if(!p)return false;if(p.actor_id!==user.userId||p.request!==request)throw new RequestError('This operation ID belongs to another change.',409);return true;};
 if(await replay())return {operationId:c.id,replayed:true};
 const versions=await readCalendarVersions(),revision=Math.max(0,...versions.map(v=>v.revision)),today=operationalDay();
 if(c.kind==='initialize'&&versions.length)throw new RequestError('The operating calendar already exists. Refresh to see its settings.',409);
 if(c.kind==='configure'&&(c.revision!==revision||c.effectiveDay<shiftDay(today,1)))throw new RequestError('Choose an effective day from tomorrow onward and refresh the latest settings. Existing days are preserved.',409);
 const effective=c.kind==='initialize'?today:c.effectiveDay,config=c.kind==='initialize'?defaultCalendar():c.config;
 if(versions.some(v=>v.effectiveDay>effective))throw new RequestError('A later calendar change is already scheduled. Choose that date or a later one to keep the schedule explicit.',409);
 const next={revision:revision+1,effectiveDay:effective,config,createdAt:new Date().toISOString(),createdBy:user.userId};
 const candidate=[...versions,next];nextOpenDay(effective,candidate);for(const e of config.exceptions)if(e.day>=effective)nextOpenDay(e.day,candidate);
 const gate='EXISTS(SELECT 1 FROM operating_commands WHERE id=? AND actor_id=? AND request=?)';const args=[c.id,user.userId,request];
 const r=await db.batch([
  db.prepare(`INSERT INTO operating_commands(id,actor_id,request,created_at) SELECT ?,?,?,? WHERE (SELECT coalesce(max(revision),0) FROM operating_calendar_versions)=? AND EXISTS(SELECT 1 FROM ${managementUsersSql} WHERE user_id=?) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(...args,next.createdAt,revision,user.userId,user.userId),
  db.prepare(`INSERT INTO operating_calendar_versions(revision,effective_day,payload,created_at,created_by,operation_id) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(revision) DO NOTHING`).bind(next.revision,effective,JSON.stringify(config),next.createdAt,next.createdBy,c.id,...args),
 ]);
 if(!r[0].meta.changes&&!await replay())throw new RequestError('The calendar changed. Refresh and review before saving.',409);
 return {operationId:c.id,replayed:false};
}
export function validateTarget(day:string,target:string,versions:CalendarVersion[],clientRevision?:number){
 if(!versions.length||day<versions[0].effectiveDay)return;
 const revision=Math.max(...versions.map(v=>v.revision));
 if(clientRevision!==revision)throw new RequestError('The operating calendar changed or this page is older. Refresh and review the morning date before starting.',409,'calendar_changed');
 if(!isOpenDay(day,versions))throw new RequestError('The kitchen is closed on this check date. Choose an open evening or ask the owner to add an exception.',409,'closed_day');
 if(!isOpenDay(target,versions))throw new RequestError('The kitchen is closed on this morning date. Choose an open morning or ask the owner to add an exception.',409,'closed_day');
}
