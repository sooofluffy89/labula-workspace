import {AsyncLocalStorage} from 'node:async_hooks';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {workspaceSqlPolicyFailure} from './workspace-runtime-policy';
export type AccessScope='operations'|'workspace'|'management';
export type AccessContext={user:ChatGPTUser;scope:AccessScope;role:'owner'|'manager'|'cook'|'legacy';clientVersion?:number};
export const accessContext=new AsyncLocalStorage<AccessContext>();
export class RequestError extends Error {constructor(message:string,public status=400,public code?:string){super(message);}}
// One additional SQL barrier within the EXISTING transaction, never a serial
// per-item HTTP authorization. Failure rolls back receipts, audits and writes.
export function accessBarrierSql(){return 'INSERT INTO access_write_guards(id,user_id,scope,client_version) VALUES(?,?,?,?)';}
const requestDatabases=new WeakMap<AccessContext,WeakMap<object,D1Database>>();
export function guardDatabase(raw:D1Database,context:AccessContext):D1Database{
 let cache=requestDatabases.get(context);if(!cache){cache=new WeakMap();requestDatabases.set(context,cache);}const cached=cache.get(raw);if(cached)return cached;
 const originals=new WeakMap<object,D1PreparedStatement>();
 const execute=async(statements:D1PreparedStatement[],guard:boolean)=>{
  const actual=statements.map(s=>originals.get(s)??s);if(!guard)return raw.batch(actual);
  const id=crypto.randomUUID();
  try {const results=await raw.batch([raw.prepare(accessBarrierSql()).bind(id,context.user.userId,context.scope,context.clientVersion??1),...actual,raw.prepare('DELETE FROM access_write_guards WHERE id=?').bind(id)]);return results.slice(1,-1);}
  catch(e){const policy=workspaceSqlPolicyFailure(e);if(policy)throw new RequestError(policy.error,policy.status,policy.code);if(e instanceof Error&&e.message.includes('access_revoked'))throw new RequestError('Your access or role changed. Your local work is kept. Ask the owner to restore access.',403,'access_revoked');throw e;}
 };
 const writes=new WeakSet<object>();
 const prepare=(sql:string):D1PreparedStatement=>{
  const wrap=(statement:D1PreparedStatement):D1PreparedStatement=>{
   const mutation=!/^\s*(SELECT|EXPLAIN)\b/i.test(sql);
   const result=new Proxy(statement,{get(target,key){
    if(key==='bind')return (...args:unknown[])=>wrap(target.bind(...args));
    if(key==='run'&&mutation)return async()=> (await execute([result],true))[0];
    if((key==='all'||key==='first'||key==='raw')&&mutation)throw new RequestError('A mutation must use its transactional write path.',500);
    const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;
   }});originals.set(result,statement);if(mutation)writes.add(result);return result;
  };return wrap(raw.prepare(sql));
 };
 const guarded=new Proxy(raw,{get(target,key){if(key==='prepare')return prepare;if(key==='batch')return (ss:D1PreparedStatement[])=>execute(ss,ss.some(s=>writes.has(s)));if(key==='exec')return ()=>{throw new RequestError('Unscoped SQL execution is not permitted in application requests.',500);};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}});cache.set(raw,guarded);return guarded;
}
