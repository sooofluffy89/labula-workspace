import {prepDraftKey,readPrepDraft,type PrepDraft} from './prep-draft';

// One account-wide writer. A volatile draft retains its lease even when its dialog closes.
type Lease={attached:symbol|null;volatile:boolean;draft?:PrepDraft;release:()=>void};
const leases=new Map<string,Lease>();
const key=(account:string)=>account.toLowerCase();
export const prepLocalEvent='labula-preparation-local-change';
const notify=()=>window.dispatchEvent(new Event(prepLocalEvent));
export function readLocalPreparation(account:string):PrepDraft|null{
 const lease=leases.get(key(account));
 if(lease?.draft)return structuredClone(lease.draft);
 const raw=localStorage.getItem(prepDraftKey(account));return raw?readPrepDraft(raw,account):null;
}
export const volatilePreparation=(account:string)=>leases.get(key(account))?.volatile===true;
export const hasVolatilePreparation=()=>[...leases.values()].some(lease=>lease.volatile);
export function discardVolatilePreparation(account:string){
 const lease=leases.get(key(account));if(!lease?.attached||readLocalPreparation(account)?.pending)throw Error('Resolve the pending save before discarding an unbacked-up draft.');
 lease.draft=undefined;lease.volatile=false;notify();
}
export function writeLocalPreparation(account:string,draft:PrepDraft){
 const lease=leases.get(key(account));if(!lease?.attached)throw Error('Open preparation details in the active editing tab first.');
 lease.draft=structuredClone(draft);lease.volatile=true;
 try{localStorage.setItem(prepDraftKey(account),JSON.stringify(draft));lease.volatile=false;}finally{notify();}
}
export async function acquirePreparation(account:string,signal:AbortSignal):Promise<()=>void>{
 if(signal.aborted)throw new DOMException('Cancelled','AbortError');
 const name=key(account),held=leases.get(name);
 const attach=(lease:Lease)=>{
  const token=Symbol();lease.attached=token;
  const detach=()=>{signal.removeEventListener('abort',detach);if(lease.attached!==token)return;lease.attached=null;if(!lease.volatile){if(leases.get(name)===lease)leases.delete(name);lease.release();}};
  signal.addEventListener('abort',detach,{once:true});return detach;
 };
 if(held&&!held.attached)return attach(held);
 if(!navigator.locks)throw Error('This browser cannot safely coordinate preparation drafts. Use a current browser to edit. Your existing draft has been kept.');
 return new Promise((resolve,reject)=>{
  void navigator.locks.request('labula-preparation-editor:'+name,{mode:'exclusive',signal},async()=>{
   if(signal.aborted){reject(new DOMException('Cancelled','AbortError'));return;}
   let release!:()=>void;const finished=new Promise<void>(r=>{release=r;});
   const lease:Lease={attached:null,volatile:false,release};leases.set(name,lease);
   resolve(attach(lease));await finished;
  }).catch(reject);
 });
}
