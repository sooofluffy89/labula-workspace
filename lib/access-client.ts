export const accessLostEvent='labula:access-lost';
export const accessDraftEvent='labula:access-draft';
export const accessDraftAvailableEvent='labula:access-draft-available';
let accountId:string|undefined;
let blocked=false;
let epoch=0;
export const accessBlockedKey=(id:string)=>'labula.access-blocked.v1.'+encodeURIComponent(id);
export function configureClientAccess(id?:string){accountId=id;blocked=false;epoch++;}
export class AccessLostError extends Error {constructor(message='Access changed. Your unsent work stays with the original account. Recheck access before continuing.'){super(message);this.name='AccessLostError';}}
function loseAccess(message:string){blocked=true;if(accountId&&typeof window!=='undefined'){try{window.localStorage?.setItem(accessBlockedKey(accountId),'1');}catch{/* The mounted access boundary still stops requests if storage is unavailable. */}}if(typeof window!=='undefined'&&typeof CustomEvent!=='undefined')window.dispatchEvent(new CustomEvent(accessLostEvent,{detail:message}));}
// An expected ID is a consistency check, never proof of login or permission.
// The platform identity and database allowlist remain authoritative on the server.
export async function accessFetch(input:string,init:RequestInit={}){
 if(blocked)throw new AccessLostError();
 const expected=accountId,requestEpoch=epoch;const headers=new Headers(init.headers);headers.set(WORKSPACE_CLIENT_HEADER,String(WORKSPACE_CLIENT_VERSION));if(expected)headers.set('X-Labula-Account-Id',expected);init={...init,headers};
 const response=await fetch(input,init);
 if(requestEpoch!==epoch)throw new AccessLostError();
 if(expected&&response.headers.get('X-Labula-Account-Id')&&response.headers.get('X-Labula-Account-Id')!==expected){loseAccess('The signed-in account changed. Your unsent work is kept for the original account.');throw new AccessLostError();}
 if(expected&&(response.status===401||response.status===403)){const copy=await response.clone().json().catch(()=>null) as {code?:string;error?:string}|null;if(requestEpoch!==epoch)throw new AccessLostError();if(response.status===401||['access_not_granted','access_revoked','access_not_linked','role_restricted','account_changed','identity_conflict'].includes(copy?.code??''))loseAccess(copy?.error??'Access changed. Your local work is kept.');}
 return response;
}
import {WORKSPACE_CLIENT_HEADER,WORKSPACE_CLIENT_VERSION} from './workspace-runtime-policy';
