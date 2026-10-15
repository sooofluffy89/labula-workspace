import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accessContext,RequestError,type AccessScope} from './access-context';
import {accessRole} from './team-access-server';
import {getRawDb} from '@/db';
import {readWorkspaceRuntimePolicy,workspaceClientVersion,workspacePolicyFailure,workspaceSqlPolicyFailure} from './workspace-runtime-policy';
// All exported API handlers use this boundary. Route files also retain their
// narrower domain checks. Async-local scope is isolated across concurrent users.
export function protectedApi<T extends unknown[]>(scope:AccessScope,handler:(...args:T)=>Promise<Response>){
 return async(...args:T):Promise<Response>=>{
  try{
   const user=await getChatGPTUser();if(!user)throw new RequestError('Sign in to access the kitchen.',401,'sign_in_required');
   const request=args[0];const expected=request instanceof Request?request.headers.get('X-Labula-Account-Id'):null;
   if(expected&&expected!==user.userId)throw new RequestError('The signed-in account changed. Return to the original account; your unsent work is kept.',403,'account_changed');
   const role=await accessRole(user,scope);
   const clientVersion=workspaceClientVersion(request instanceof Request?request.headers:undefined);
   if(request instanceof Request&&!['GET','HEAD','OPTIONS'].includes(request.method)){
    if(request.headers.get('origin')!==new URL(request.url).origin)throw new RequestError('Request origin is not allowed.',403);
    const policy=await readWorkspaceRuntimePolicy(getRawDb());
    const failure=policy.write_paused?workspacePolicyFailure('workspace_write_paused'):clientVersion<policy.min_client_version?workspacePolicyFailure('workspace_update_required'):null;
    if(failure)throw new RequestError(failure.error,failure.status,failure.code);
   }
   return await accessContext.run({user,role,scope,clientVersion},async()=>{
    const response=await handler(...args);
    // Do not release a private response after access was revoked during a read.
    await accessRole(user,accessContext.getStore()!.scope,false);
    response.headers.set('X-Labula-Account-Id',user.userId);response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return response;
   });
  }catch(e){const policy=workspaceSqlPolicyFailure(e),known=e instanceof RequestError;return Response.json({error:policy?.error??(known?e.message:'Could not verify access. Your local work is kept. Retry safely.'),code:policy?.code??(known?e.code:'access_check_failed')},{status:policy?.status??(known?e.status:503),headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}
 };
}
export function requireWriteScope(scope:AccessScope){const context=accessContext.getStore();if(context&&['operations','workspace','management'].indexOf(scope)>['operations','workspace','management'].indexOf(context.scope))context.scope=scope;}
