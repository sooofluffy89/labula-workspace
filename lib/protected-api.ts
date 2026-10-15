import {getChatGPTUser} from '@/app/chatgpt-auth';
import {accessContext,RequestError,type AccessScope} from './access-context';
import {accessRole} from './team-access-server';
// All exported API handlers use this boundary. Route files also retain their
// narrower domain checks. Async-local scope is isolated across concurrent users.
export function protectedApi<T extends unknown[]>(scope:AccessScope,handler:(...args:T)=>Promise<Response>){
 return async(...args:T):Promise<Response>=>{
  try{
   const user=await getChatGPTUser();if(!user)throw new RequestError('Sign in to access the kitchen.',401,'sign_in_required');
   const request=args[0];const expected=request instanceof Request?request.headers.get('X-Labula-Account-Id'):null;
   if(expected&&expected!==user.userId)throw new RequestError('The signed-in account changed. Return to the original account; your unsent work is kept.',403,'account_changed');
   const role=await accessRole(user,scope);
   return await accessContext.run({user,role,scope},async()=>{
    const response=await handler(...args);
    // Do not release a private response after access was revoked during a read.
    await accessRole(user,accessContext.getStore()!.scope,false);
    response.headers.set('X-Labula-Account-Id',user.userId);response.headers.set('Cache-Control','private, no-store');response.headers.set('Vary','Cookie');return response;
   });
  }catch(e){const known=e instanceof RequestError;return Response.json({error:known?e.message:'Could not verify access. Your local work is kept. Retry safely.',code:known?e.code:'access_check_failed'},{status:known?e.status:503,headers:{'Cache-Control':'private, no-store','Vary':'Cookie'}});}
 };
}
export function requireWriteScope(scope:AccessScope){const context=accessContext.getStore();if(context&&['operations','workspace','management'].indexOf(scope)>['operations','workspace','management'].indexOf(context.scope))context.scope=scope;}
