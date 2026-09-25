import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {owner,RequestError} from './notebook-server';
import {teamCommandSchema,type TeamMember,type ActionMeta,type ActivityEvent} from './activity';
import {dateSchema} from './evening';

type MemberRow={id:string;user_id:string|null;email:string;name:string;active:number;revision:number};
export async function ensureMember(user:ChatGPTUser){
 const db=getRawDb();let row=await db.prepare('SELECT * FROM kitchen_team WHERE user_id=?').bind(user.userId).first<MemberRow>();
 if(!row){
  await db.prepare(`INSERT INTO kitchen_team(id,user_id,email,name,active,revision,created_at) VALUES(?,?,?,?,1,0,?)
   ON CONFLICT(email) DO UPDATE SET user_id=excluded.user_id,revision=kitchen_team.revision+1 WHERE kitchen_team.user_id IS NULL`)
   .bind(crypto.randomUUID(),user.userId,user.email.toLowerCase(),user.fullName??user.email,new Date().toISOString()).run();
  row=await db.prepare('SELECT * FROM kitchen_team WHERE user_id=?').bind(user.userId).first<MemberRow>();
 }
 if(!row)throw new RequestError('This email is already linked to another account. Ask the owner to check your team profile.',403);
 return row;
}
export async function activeMember(user:ChatGPTUser){const member=await ensureMember(user);if(!member.active)throw new RequestError('Your Current stock access is paused. Ask the owner to reactivate your team profile. Saved changes stay on this device.',403);return member;}
const memberView=(m:MemberRow,ownerId:string|null):TeamMember=>({id:m.id,userId:m.user_id,email:m.email,name:m.name,active:!!m.active,revision:m.revision,owner:m.user_id===ownerId});
// Management reads must not register visitors or link an unclaimed profile.
export async function readTeamDirectory(user:ChatGPTUser){
 const db=getRawDb(),ownerId=(await db.prepare("SELECT user_id FROM kitchen_owner WHERE id='owner'").first<{user_id:string}>())?.user_id;
 if(!ownerId||ownerId!==user.userId)throw new RequestError('Only the owner can manage the kitchen team.',403);
 const rows=(await db.prepare('SELECT * FROM kitchen_team ORDER BY lower(name),id').all<MemberRow>()).results;
 return {accountId:user.userId,email:user.email,isOwner:true as const,members:rows.map(m=>memberView(m,ownerId))};
}
export async function readTeam(user:ChatGPTUser){
 const self=await ensureMember(user),isOwner=await owner(user),db=getRawDb(),ownerId=(await db.prepare("SELECT user_id FROM kitchen_owner WHERE id='owner'").first<{user_id:string}>())?.user_id??null;
 const members=isOwner?(await db.prepare('SELECT * FROM kitchen_team ORDER BY lower(name),id').all<MemberRow>()).results:[self];
 return {accountId:user.userId,self:memberView(self,ownerId),isOwner,members:members.map(m=>memberView(m,ownerId))};
}

type EventSpec={category:string;action:string;source?:'human'|'system';from:string;args?:unknown[];itemId?:string;itemName?:string;itemKind?:string;checkId?:string;targetDay?:string;before?:string;after?:string};
// SQL expressions come only from server source. Values are always bound parameters.
export function eventStatement(user:ChatGPTUser,name:string,command:{id:string;meta?:ActionMeta},now:string,s:EventSpec){
 const item=s.itemId??'NULL',action=s.action;
 return getRawDb().prepare(`INSERT OR IGNORE INTO kitchen_activity
 (id,command_id,category,action,source,actor_id,actor_email,actor_name,recorded_at,client_at,session_id,sequence,supersedes_command_id,check_id,target_day,item_id,item_name,item_kind,before_value,after_value)
 SELECT ?||':'||coalesce(${item},''),?,?,?,?,?,?,?,?,?,?,?,?,${s.checkId??'NULL'},${s.targetDay??'NULL'},${item},${s.itemName??'NULL'},${s.itemKind??'NULL'},${s.before??'NULL'},${s.after??'NULL'} ${s.from}`)
 .bind(command.id+':'+s.category+':'+action,command.id,s.category,action,s.source??'human',user.userId,user.email,name,now,command.meta?.occurredAt??null,command.meta?.sessionId??null,command.meta?.sequence??null,command.meta?.supersedesCommandId??null,...(s.args??[]));
}
export async function teamCommand(user:ChatGPTUser,raw:unknown){
 if(!await owner(user))throw new RequestError('Only the owner can manage the kitchen team.',403);
 const member=await ensureMember(user),c=teamCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c),now=new Date().toISOString();
 const replay=async()=>{const r=await db.prepare('SELECT actor_id,request FROM team_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string}>();if(!r)return false;if(r.actor_id!==user.userId||r.request!==request)throw new RequestError('This request ID belongs to another change.',409);return true;};
 if(await replay())return {operationId:c.id};
 const id=c.kind==='add'?c.id:c.memberId;
 const gate="EXISTS (SELECT 1 FROM team_commands WHERE id=? AND actor_id=? AND request=?)",args=[c.id,user.userId,request];
 const condition=c.kind==='add'?'NOT EXISTS (SELECT 1 FROM kitchen_team WHERE email=?)':`EXISTS (SELECT 1 FROM kitchen_team WHERE id=? AND revision=? AND (user_id IS NULL OR user_id NOT IN (SELECT user_id FROM kitchen_owner) OR ?=1))`;
 const conditionArgs=c.kind==='add'?[c.email]:[id,c.revision,c.active?1:0];
 const receipt=db.prepare(`INSERT INTO team_commands(id,actor_id,request,created_at) SELECT ?,?,?,? WHERE ${condition} ON CONFLICT(id) DO NOTHING`).bind(...args,now,...conditionArgs);
 const event=eventStatement(user,member.name,c,now,{category:'team',action:c.kind,itemId:'x.id',itemName:'x.name',before:c.kind==='add'?'NULL':"json_object('name',x.name,'active',x.active,'revision',x.revision)",after:'?',from:`FROM ${c.kind==='add'?"(SELECT ? AS id,? AS name)":"kitchen_team"} x WHERE ${c.kind==='add'?'':'x.id=? AND x.revision=? AND '}${gate}`,args:[JSON.stringify(c),...(c.kind==='add'?[id,c.name]:[id,c.revision]),...args]});
 const write=c.kind==='add'?db.prepare(`INSERT INTO kitchen_team(id,email,name,active,revision,created_at) SELECT ?,?,?,1,0,? WHERE ${gate} ON CONFLICT(id) DO NOTHING`).bind(id,c.email,c.name,now,...args):db.prepare(`UPDATE kitchen_team SET name=?,active=?,revision=revision+1 WHERE id=? AND revision=? AND ${gate}`).bind(c.name,c.active?1:0,id,c.revision,...args);
 await db.batch([receipt,event,write]);if(!await replay())throw new RequestError('This profile changed, this email already exists, or the owner would be paused. Refresh and review the team.',409);
 return {operationId:c.id};
}

export async function readActivity(user:ChatGPTUser,q:URLSearchParams){
 await activeMember(user);const isOwner=await owner(user),db=getRawDb();
 const where:string[]=[isOwner?'1':"category!='team'"],args:unknown[]=[];
 if(q.get('export')==='1'&&!isOwner)throw new RequestError('Only the owner can export activity.',403);
 if(q.get('from')&&q.get('to')&&q.get('from')!>q.get('to')!)throw new RequestError('The end date must be on or after the start date.');
 for(const [param,col] of [['check','check_id'],['actor','actor_id'],['item','item_id'],['category','category']] as const){const value=q.get(param);if(value){if(value.length>180)throw new RequestError('Invalid filter.');where.push(col+'=?');args.push(value);}}
 // Saved-date filters are explicitly UTC; check_id and target_day retain operational dates.
 for(const [param,op] of [['from','>='],['to','<=']] as const){const v=q.get(param);if(v){dateSchema.parse(v);where.push(`substr(recorded_at,1,10) ${op} ?`);args.push(v);}}
 const through=q.get('through')??new Date().toISOString();if(!/^\d{4}-\d\d-\d\dT/.test(through)||!Number.isFinite(Date.parse(through)))throw new RequestError('Invalid export boundary.');where.push('recorded_at<=?');args.push(through);
 const rowLimit=q.get('maxRow');if(rowLimit!==null&&(!/^\d+$/.test(rowLimit)||!Number.isSafeInteger(Number(rowLimit))))throw new RequestError('Invalid activity boundary.');
 const throughRow=rowLimit===null?(await db.prepare('SELECT coalesce(max(rowid),0) AS n FROM kitchen_activity').first<{n:number}>())!.n:Number(rowLimit);where.push('rowid<=?');args.push(throughRow);
 const cursor=q.get('cursor');if(cursor){let c;try{c=JSON.parse(cursor);}catch{throw new RequestError('Invalid activity page.');}if(!Array.isArray(c)||c.length!==2||c.some(v=>typeof v!=='string'||v.length>400))throw new RequestError('Invalid activity page.');where.push('(recorded_at<? OR (recorded_at=? AND id<?))');args.push(c[0],c[0],c[1]);}
 const limit=q.get('export')==='1'&&isOwner?500:60;
 const rows=(await db.prepare(`SELECT * FROM kitchen_activity WHERE ${where.join(' AND ')} ORDER BY recorded_at DESC,id DESC LIMIT ?`).bind(...args,limit+1).all<ActivityEvent>()).results;
 const events=rows.slice(0,limit),last=events.at(-1),next=rows.length>limit&&last?JSON.stringify([last.recorded_at,last.id]):null;
 const coverage=await db.prepare('SELECT min(recorded_at) AS first FROM kitchen_activity').first<{first:string|null}>();
 return {events,next,capturedThrough:through,throughRow,coverageFrom:coverage?.first??null,isOwner};
}
