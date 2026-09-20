import type {Draft} from './model';

type StoragePort=Pick<Storage,'getItem'|'setItem'>;
// This device-local intent is not a receipt by itself. The shared saved import
// entry proves that the accepted merge was committed. Keep the original copy.
async function intentKey(raw:string,userId:string,campaign:string){
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([userId,campaign,raw])));
 return 'labula-recovery-resolution:'+Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
export async function rememberRecoveryMerge(storage:StoragePort,raw:string,userId:string,campaign:string,archiveId:string){
 storage.setItem(await intentKey(raw,userId,campaign),JSON.stringify({version:1,archiveId,userId,campaign}));
}
export async function recoveryWasSaved(storage:StoragePort,raw:string,userId:string,campaign:string,shared:Draft|undefined){
 if(!shared)return false;
 const text=storage.getItem(await intentKey(raw,userId,campaign));if(!text)return false;
 try{const intent=JSON.parse(text);return intent.version===1&&intent.userId===userId&&intent.campaign===campaign&&typeof intent.archiveId==='string'&&shared.imports.some(i=>i.id===intent.archiveId);}catch{return false;}
}
