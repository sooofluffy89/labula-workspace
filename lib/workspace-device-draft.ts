import {readNotebookDraft,type NotebookDraft} from './notebook-draft';
export const workspaceDraftPrefix=(account:string)=>'labula-workspace2-device-draft:'+encodeURIComponent(account.toLowerCase())+':';
export type DeviceNotebookDraft={key:string;draft:NotebookDraft;raw:string;reviewed?:boolean};
type DraftStorage=Pick<Storage,'length'|'key'|'getItem'>;
export function scanDeviceNotebookDrafts(storage:DraftStorage,account:string){
 const prefix=workspaceDraftPrefix(account),entries:DeviceNotebookDraft[]=[],issues:{key:string;message:string}[]=[];
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(prefix))continue;
  const raw=storage.getItem(key);if(!raw)continue;
  try{const draft=readNotebookDraft(raw);
   if(draft.actorEmail?.toLowerCase()!==account.toLowerCase())throw Error('A device draft does not match this account. It has been kept without opening it.');
   entries.push({key,draft,raw});
  }catch(error){issues.push({key,message:error instanceof Error?error.message:'A device draft could not be opened. Its original copy has been kept.'});}
 }
 return {drafts:entries.sort((a,b)=>b.draft.exportedAt.localeCompare(a.draft.exportedAt)),issues};
}
export function readDeviceNotebookDrafts(storage:DraftStorage,account:string):DeviceNotebookDraft[]{
 const result=scanDeviceNotebookDrafts(storage,account);if(result.issues.length)throw Error(result.issues[0].message);return result.drafts;
}
const reviewKey=(key:string)=>'labula-workspace2-reviewed-copy:'+key;
async function fingerprint(raw:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw));return Array.from(new Uint8Array(bytes),value=>value.toString(16).padStart(2,'0')).join('');}
/** Acknowledging a snapshot never deletes another tab's live source key. */
export async function acknowledgeDeviceNotebookDraft(storage:Pick<Storage,'setItem'>,copy:DeviceNotebookDraft){storage.setItem(reviewKey(copy.key),await fingerprint(copy.raw));}
export async function readReviewedDeviceNotebookDrafts(storage:DraftStorage,account:string){
 const result=scanDeviceNotebookDrafts(storage,account);
 return {...result,drafts:await Promise.all(result.drafts.map(async copy=>({...copy,reviewed:storage.getItem(reviewKey(copy.key))===await fingerprint(copy.raw)})))};
}
