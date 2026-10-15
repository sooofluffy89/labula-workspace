import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {accessContext,RequestError,type AccessScope} from './access-context';
import {readWorkspaceRuntimePolicy,workspacePolicyFailure} from './workspace-runtime-policy';
export type AccessMember={id:string;user_id:string|null;email:string;name:string;active:number;access_role:string;revision:number;access_enabled:number;last_sign_in_at:string|null;is_owner?:number};
export async function permittedMember(user:ChatGPTUser,link=true):Promise<AccessMember>{
 const db=getRawDb();
 let row=await db.prepare(`SELECT t.*,EXISTS(SELECT 1 FROM kitchen_owner o WHERE o.id='owner' AND o.user_id=t.user_id) AS is_owner FROM kitchen_team t WHERE user_id=? OR (user_id IS NULL AND lower(email)=?) ORDER BY CASE WHEN user_id=? THEN 0 ELSE 1 END LIMIT 1`).bind(user.userId,user.email.trim().toLowerCase(),user.userId).first<AccessMember>();
 if(!row?.access_enabled)throw new RequestError('Access not granted. Your local work is kept. Ask the owner to allow your ChatGPT sign-in email.',403,'access_not_granted');
 if(!row.user_id){
  if(!link)throw new RequestError('Sign in to link your allowed account.',403,'access_not_linked');
  if((await readWorkspaceRuntimePolicy(db)).write_paused){const failure=workspacePolicyFailure('workspace_write_paused');throw new RequestError(failure.error,failure.status,failure.code);}
  const now=new Date().toISOString(),id=crypto.randomUUID();
  // The link is an authorization bootstrap, performed without a request write
  // context: the SQL itself requires the exact pre-authorized, unclaimed email.
  await db.batch([
   db.prepare(`INSERT INTO kitchen_activity(id,command_id,category,action,source,actor_id,actor_email,actor_name,recorded_at,item_id,item_name,before_value,after_value) SELECT ?,?,'team','link','system',?,?,?,?,id,name,json_object('userId',user_id),json_object('userId',?,'email',email) FROM kitchen_team WHERE id=? AND user_id IS NULL AND access_enabled=1 AND lower(email)=? AND NOT EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=?)`).bind(id,id,user.userId,user.email,row.name,now,user.userId,row.id,user.email.trim().toLowerCase(),user.userId),
   db.prepare(`UPDATE kitchen_team SET user_id=?,name=CASE WHEN name=email THEN ? ELSE name END,revision=revision+1,last_sign_in_at=? WHERE id=? AND user_id IS NULL AND access_enabled=1 AND EXISTS(SELECT 1 FROM kitchen_activity WHERE id=?)`).bind(user.userId,user.fullName?.trim()||row.name,now,row.id,id),
  ]);
  row=await db.prepare("SELECT t.*,EXISTS(SELECT 1 FROM kitchen_owner o WHERE o.id='owner' AND o.user_id=t.user_id) AS is_owner FROM kitchen_team t WHERE id=?").bind(row.id).first<AccessMember>();
  if(!row?.access_enabled||row.user_id!==user.userId)throw new RequestError('This email is linked to another account. Ask the owner to check it.',403,'identity_conflict');
 }
 return row;
}
export async function accessRole(user:ChatGPTUser,scope:AccessScope='operations',link=true){
 const m=await permittedMember(user,link);
 if(!m.is_owner&&!['manager','cook','legacy'].includes(m.access_role))throw new RequestError('Could not verify this account role. Ask the owner to check it.',403,'role_restricted');
 const role=m.is_owner?'owner':m.access_role==='manager'?'manager':m.access_role==='cook'?'cook':'legacy';
 if(scope==='workspace'&&(role==='cook'||role==='manager'&&!m.active))throw new RequestError('Your role includes Evening check and Morning prep only, or workspace access is paused. Your drafts are kept.',403,'role_restricted');
 if(scope==='management'&&(role!=='owner'&&(role!=='manager'||!m.active)))throw new RequestError('Only the owner or an active Manager can perform this action.',403,'role_restricted');
 return role;
}
export async function recordSignIn(user:ChatGPTUser){
 // Explicit top-level/session visit, never the operational polling loop.
 await getRawDb().prepare("UPDATE kitchen_team SET last_sign_in_at=? WHERE user_id=? AND access_enabled=1 AND EXISTS(SELECT 1 FROM workspace_runtime_policy WHERE id='kitchen' AND write_paused=0)").bind(new Date().toISOString(),user.userId).run();
}
export function currentAccessUser(){return accessContext.getStore()?.user;}
