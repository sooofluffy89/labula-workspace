// Components expose volatile work, never a save/Finish action. The common
// sign-out dialog first keeps a verified account-bound device copy. Restoration
// is explicit through the existing draft import, never auto-submitted.
export type SignOutWork={label:string;value:unknown;safe:boolean};
const sources=new Map<symbol,()=>SignOutWork|null>();
export function registerSignOutWork(read:()=>SignOutWork|null){const id=Symbol();sources.set(id,read);return ()=>{sources.delete(id);};}
export function readSignOutWork(){return [...sources.values()].map(read=>read()).filter((x):x is SignOutWork=>!!x);}
export function preserveSignOutWork(accountId:string,work:SignOutWork[],storage:Storage){const key='labula-signout-drafts:'+accountId;const text=JSON.stringify({format:'labula-signout-drafts',version:1,accountId,createdAt:new Date().toISOString(),work});storage.setItem(key,text);if(storage.getItem(key)!==text)throw Error('This device could not keep your draft. Stay signed in and download the draft before leaving.');return key;}
