/** Protocol and maintenance policy. This header is compatibility, never identity. */
export const WORKSPACE_CLIENT_VERSION=2;
export const WORKSPACE_CLIENT_HEADER='X-Labula-Workspace-Version';
export type WorkspaceRuntimePolicy={write_paused:number;min_client_version:number;revision:number;updated_at:string};
export function workspaceClientVersion(headers?:Headers){const value=headers?.get(WORKSPACE_CLIENT_HEADER);return value&&/^[1-9]\d{0,3}$/.test(value)?Number(value):1;}
export async function readWorkspaceRuntimePolicy(db:D1Database){
 const policy=await db.prepare("SELECT write_paused,min_client_version,revision,updated_at FROM workspace_runtime_policy WHERE id='kitchen'").first<WorkspaceRuntimePolicy>();
 if(!policy||![0,1].includes(policy.write_paused)||!Number.isSafeInteger(policy.min_client_version)||policy.min_client_version<1)throw Error('Workspace runtime policy unavailable.');
 return policy;
}
export function workspacePolicyFailure(code:'workspace_write_paused'|'workspace_update_required'){
 return code==='workspace_write_paused'
  ?{status:503,code,error:'Workspace is temporarily read-only while an update is checked. Your draft and pending actions are kept. Retry after writes resume.'}
  :{status:428,code,error:'Reload Workspace 2.0 before sending this action. Your draft and pending actions are kept; compare them after reloading.'};
}
export function workspaceSqlPolicyFailure(error:unknown){
 const message=error instanceof Error?error.message:String(error);
 return message.includes('workspace_write_paused')?workspacePolicyFailure('workspace_write_paused'):message.includes('workspace_update_required')?workspacePolicyFailure('workspace_update_required'):null;
}
