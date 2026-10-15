import {getChatGPTUser} from '@/app/chatgpt-auth';
import {getRawDb} from '@/db';
import {RequestError} from './access-context';
import {accessRole} from './team-access-server';
import {readWorkspaceRuntimePolicy} from './workspace-runtime-policy';

export type MaintenanceCommand={operationId:string;expectedRevision:number;action:'pause'|'resume'};
export type MaintenanceReceipt={operation_id:string;actor_id:string;request:string;action:'pause'|'resume';expected_revision:number;prior_write_paused:number;prior_min_client_version:number;write_paused:number;min_client_version:number;revision:number;recorded_at:string};
export function parseMaintenanceCommand(value:unknown):MaintenanceCommand{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new RequestError('Invalid maintenance action.');
 const v=value as Record<string,unknown>;
 if(Object.keys(v).sort().join(',')!=='action,expectedRevision,operationId'||typeof v.operationId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v.operationId)||!Number.isSafeInteger(v.expectedRevision)||(v.expectedRevision as number)<0||!['pause','resume'].includes(v.action as string))throw new RequestError('Supply a valid action, operation ID and current revision.');
 return {operationId:v.operationId,expectedRevision:v.expectedRevision as number,action:v.action as 'pause'|'resume'};
}

// This dedicated boundary permits only the two release-policy transitions.
// It deliberately does not create an accessContext or bypass for business APIs.
export async function workspaceMaintenance(request:Request){
 try{
  const user=await getChatGPTUser();if(!user)throw new RequestError('Sign in to access maintenance.',401,'sign_in_required');
  if(request.headers.get('X-Labula-Account-Id')&&request.headers.get('X-Labula-Account-Id')!==user.userId)throw new RequestError('The signed-in account changed.',403,'account_changed');
  if(await accessRole(user,'management',false)!=='owner')throw new RequestError('Only the existing Owner can control maintenance.',403,'role_restricted');
  const db=getRawDb();
  const respond=async(receipt?:MaintenanceReceipt)=>{
   const policy=await readWorkspaceRuntimePolicy(db),audit=await db.prepare('SELECT * FROM workspace_runtime_policy_commands ORDER BY revision DESC LIMIT 50').all<MaintenanceReceipt>();
   if(await accessRole(user,'management',false)!=='owner')throw new RequestError('Owner access changed.',403,'access_revoked');
   return Response.json({accountId:user.userId,policy,audit:audit.results,...(receipt?{receipt}:{})},{headers:{'Cache-Control':'private, no-store','Vary':'Cookie','X-Labula-Account-Id':user.userId}});
  };
  if(request.method==='GET')return await respond();
  if(request.method!=='POST')throw new RequestError('Method not allowed.',405);
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new RequestError('Request origin is not allowed.',403,'origin_restricted');
  if(request.headers.get('X-Labula-Account-Id')!==user.userId)throw new RequestError('Confirm the signed-in account before changing maintenance.',403,'account_changed');
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json'||Number(request.headers.get('content-length')??0)>2048)throw new RequestError('A small JSON maintenance action is required.');
  const text=await request.text();if(text.length>2048)throw new RequestError('Maintenance action is too large.');
  let input:unknown;try{input=JSON.parse(text);}catch{throw new RequestError('Invalid maintenance JSON.');}
  const command=parseMaintenanceCommand(input),fingerprint=JSON.stringify(command);
  const receipt=()=>db.prepare('SELECT * FROM workspace_runtime_policy_commands WHERE operation_id=?').bind(command.operationId).first<MaintenanceReceipt>();
  const validate=(existing:MaintenanceReceipt)=>{if(existing.actor_id!==user.userId||existing.request!==fingerprint)throw new RequestError('This operation ID belongs to a different maintenance action.',409,'operation_conflict');return existing;};
  const existing=await receipt();if(existing)return await respond(validate(existing));
  const policy=await readWorkspaceRuntimePolicy(db);
  if(policy.revision!==command.expectedRevision)throw new RequestError('Maintenance changed. Refresh and review the current policy.',409,'revision_conflict');
  if((command.action==='pause')===!!policy.write_paused)throw new RequestError('This policy is already in the requested state. Refresh before choosing another action.',409,'state_conflict');
  if(command.action==='resume'&&policy.min_client_version>2)throw new RequestError('A newer client policy is installed. This maintenance version cannot lower it or resume writes.',409,'future_client_policy');
  const paused=command.action==='pause'?1:0,minimum=command.action==='resume'?2:policy.min_client_version;
  try{
   // The insert trigger rechecks owner membership, revision and exact transition,
   // then updates policy in the same SQLite statement/transaction as its audit.
   await db.prepare('INSERT INTO workspace_runtime_policy_commands(operation_id,actor_id,request,action,expected_revision,prior_write_paused,prior_min_client_version,write_paused,min_client_version,revision,recorded_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)').bind(command.operationId,user.userId,fingerprint,command.action,command.expectedRevision,policy.write_paused,policy.min_client_version,paused,minimum,command.expectedRevision+1,new Date().toISOString()).run();
  }catch(error){
   const raced=await receipt();if(raced)return await respond(validate(raced));
   const message=error instanceof Error?error.message:String(error);
   if(message.includes('maintenance_access_revoked'))throw new RequestError('Owner access changed. The action was not applied.',403,'access_revoked');
   if(message.includes('maintenance_revision_conflict'))throw new RequestError('Maintenance changed. Refresh and review the current policy.',409,'revision_conflict');
   if(message.includes('maintenance_invalid_transition'))throw new RequestError('Maintenance state changed. Refresh before choosing another action.',409,'state_conflict');
   throw error;
  }
  const saved=await receipt();if(!saved)throw Error('Maintenance receipt unavailable.');return await respond(validate(saved));
 }catch(error){const known=error instanceof RequestError;return Response.json({error:known?error.message:'Could not verify maintenance. Keep the pending action and retry safely.',code:known?error.code:'maintenance_unavailable'},{status:known?error.status:503,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}
}
