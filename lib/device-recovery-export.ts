// Storage values are retained verbatim. This is a download, never a restore or
// a command reader: malformed JSON must remain available for later inspection.
export type RecoveryStorage = Pick<Storage, 'length' | 'key' | 'getItem'>;
export type RecoveryAccount = {accountId:string; email:string};
type Ownership = 'account-id-key' | 'email-key' | 'account-id-metadata' | 'unattributed';
type Match = {namespace:string; ownership:Ownership};
export type DeviceRecoveryEntry = Match & {storage:'localStorage'|'sessionStorage'; key:string; raw:string};

function workspaceFormNamespace(key:string,account:RecoveryAccount):Match|null {
 for(const identity of new Set([account.accountId,account.email,account.email.toLowerCase()])){
  const prefix='labula.workspace2.form.v1.'+encodeURIComponent(identity)+'.';
  if(!key.startsWith(prefix))continue;
  const suffix=key.slice(prefix.length);
  // encodeURIComponent leaves dots in IDs and emails. An arbitrary prefix
  // match could include account.extra; require a known actual form ID too.
  const alias=suffix==='catalog-aliases'||suffix==='catalog-aliases.resume'||suffix.startsWith('catalog-aliases.writer.');
  if(alias||['dish%3A','item%3A','new%3A','variant%3A','details%3A'].some(form=>suffix.startsWith(form)&&suffix.length>form.length))return {namespace:'workspace-form-writer-copies',ownership:identity===account.accountId?'account-id-key':'email-key'};
 }
 return null;
}

function ownedNamespace(key:string, account:RecoveryAccount):Match|null {
 const form=workspaceFormNamespace(key,account);if(form)return form;
 const id=account.accountId, encoded=encodeURIComponent(id);
 const prefixes:[string,string][]=[
  ['labula-evening-v1:'+encoded+':kitchen:','evening-and-morning-commands'],
  ['labula-finish-v1:'+encoded+':','finish-journal'],
  ['labula-finish-receipt-v1:'+encoded+':','finish-receipts'],
  ['labula-finish-resolution-v1:'+encoded+':','finish-resolutions'],
  ['labula.prep-notes.v1.'+encoded+'.','instruction-and-feedback-drafts'],
  ['labula.stock.v1.kitchen.'+encoded+'.','legacy-stock-commands'],
  ['labula.stock-frequency.v1.kitchen.'+encoded+'.','frequency-commands'],
  ['labula.stock-station.v1.kitchen.'+encoded+'.','station-commands'],
  ['labula.manage-settings.v1.'+encoded+'.','checklist-setting-commands'],
  ['labula.round-selection.v1.'+encoded+'.','round-selection-drafts'],
  ['labula-operations-v1:'+encoded+':','operation-commands'],
  ['labula-outcome-draft-v1:'+id+':','outcome-drafts'],
  ['labula-review-v2:'+id+':','review-writer-recoveries'],
  ['labula-team-v2:'+id+':','team-commands'],
  ['labula-profile-operation:'+id+':','profile-photo-commands'],
 ];
 for(const [prefix,namespace] of prefixes)if(key.startsWith(prefix))return {namespace,ownership:'account-id-key'};
 const exact:[string,string][]=[
  ['labula-team-v1:'+id,'legacy-team-command'],
  ['labula-team-form-v1:'+id,'team-form-draft'],
  ['labula-signout-drafts:'+id,'signout-work-copy'],
  ['labula-calendar-draft-v1:'+encoded,'calendar-draft'],
  ['labula.access-blocked.v1.'+encoded,'access-recovery-state'],
 ];
 for(const [name,namespace] of exact)if(key===name)return {namespace,ownership:'account-id-key'};
 const email=account.email.toLowerCase();
 const emailDraftPrefix='labula-workspace2-device-draft:'+encodeURIComponent(email)+':';
 if(key.startsWith(emailDraftPrefix))return {namespace:'workspace-notebook-writer-copies',ownership:'email-key'};
 if(key.startsWith('labula-workspace2-reviewed-copy:'+emailDraftPrefix))return {namespace:'workspace-notebook-review-markers',ownership:'email-key'};
 for(const [prefix,namespace] of [
  ['labula-preparation-v1:','preparation-draft'],
  ['labula-production-drafts:','production-task-drafts'],
  ['labula.group-change.v1.','ingredient-group-command'],
 ] as const){
  if(!key.startsWith(prefix))continue;
  const suffix=key.slice(prefix.length);
  if(suffix.toLowerCase()===email)return {namespace,ownership:'email-key'};
  try{if(decodeURIComponent(suffix).toLowerCase()===email)return {namespace,ownership:'email-key'};}catch{/* An unrecognised identity is never assigned to this account. */}
 }
 const legacy='labula-review:';
 if(key.toLowerCase().startsWith(legacy+email+':'))return {namespace:'legacy-review-writer-recoveries',ownership:'email-key'};
 return null;
}

// Inspect only ownership metadata; never replace, normalize or validate raw.
function explicitOtherAccount(raw:string,account:RecoveryAccount):boolean {
 try{
  const value=JSON.parse(raw);if(!value||typeof value!=='object'||Array.isArray(value))return false;
  for(const name of ['accountId','userId','actorId'])if(typeof value[name]==='string'&&value[name]!==account.accountId)return true;
  if(typeof value.user==='string'&&value.user.toLowerCase()!==account.email.toLowerCase())return true;
  if(typeof value.actorEmail==='string'&&value.actorEmail.toLowerCase()!==account.email.toLowerCase())return true;
  if(typeof value.account==='string'&&value.account!==account.accountId&&value.account.toLowerCase()!==account.email.toLowerCase())return true;
  for(const name of ['command','receipt']){const nested=value[name];if(nested&&typeof nested==='object'&&typeof nested.actorId==='string'&&nested.actorId!==account.accountId)return true;}
 }catch{/* Malformed owned entries are still exported exactly. */}
 return false;
}

export function collectDeviceRecovery(account:RecoveryAccount, stores:{localStorage:RecoveryStorage;sessionStorage:RecoveryStorage}, context:{origin:string;exportedAt:string}) {
 if(!account.accountId||!account.email)throw Error('A verified account is required.');
 const entries:DeviceRecoveryEntry[]=[],unattributed:DeviceRecoveryEntry[]=[],errors:{storage:string;message:string}[]=[];
 let excludedOtherAccountEntries=0;
 for(const storage of ['localStorage','sessionStorage'] as const){
  try{
   const source=stores[storage],keys:string[]=[];
   for(let index=0;index<source.length;index++){const key=source.key(index);if(key!==null)keys.push(key);}
   for(const key of [...new Set(keys)].sort()){
    const ownership=ownedNamespace(key,account),legacyUnscoped=key.startsWith('labula-recovery-resolution:');
    if(!ownership&&!legacyUnscoped)continue;
    const raw=source.getItem(key);if(raw===null){errors.push({storage,message:'A matching entry disappeared during the export.'});continue;}
    if(explicitOtherAccount(raw,account)){excludedOtherAccountEntries++;continue;}
    if(ownership){entries.push({...ownership,storage,key,raw});continue;}
    let userId:unknown;try{userId=JSON.parse(raw)?.userId;}catch{/* Preserve the unattributed raw entry. */}
    if(userId===account.accountId)entries.push({namespace:'review-recovery-resolution',ownership:'account-id-metadata',storage,key,raw});
    else unattributed.push({namespace:'legacy-review-recovery-resolution',ownership:'unattributed',storage,key,raw});
   }
  }catch{errors.push({storage,message:'Browser storage could not be read completely. Keep the original tab open.'});}
 }
 return {format:'LABULA device recovery',version:1,account:{accountId:account.accountId,email:account.email},origin:context.origin,exportedAt:context.exportedAt,
  scope:'Current browser origin; localStorage plus this tab sessionStorage. This does not include other tabs sessionStorage or in-memory editors.',
  rawEncoding:'Exact JavaScript storage strings; JSON string escaping is reversible.',entries,unattributed,excludedOtherAccountEntries,complete:errors.length===0,errors};
}
