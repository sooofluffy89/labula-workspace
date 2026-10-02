import {dateSchema,eveningCommandSchema} from './evening';
import {finishFingerprint,type FinishIntent,type FinishRecord,type CompletedFinish} from './finish-intent';

type Storage=Pick<globalThis.Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
export const FINISH_RECEIPT_LIMIT=20;
export const finishJournalPrefix=(accountId:string)=>'labula-finish-v1:'+encodeURIComponent(accountId)+':';
export const finishReceiptPrefix=(accountId:string)=>'labula-finish-receipt-v1:'+encodeURIComponent(accountId)+':';
export const finishResolutionPrefix=(accountId:string)=>'labula-finish-resolution-v1:'+encodeURIComponent(accountId)+':';
const invalid=()=>Error('Saved Finish needs review. Keep device data and ask the manager.');

export function validateFinishRecord(raw:unknown,accountId:string,account:string):FinishRecord{
 const f=raw as FinishRecord;
 if(!f||f.protocol!==1||typeof f.id!=='string'||!/^[-0-9a-f]{36}$/i.test(f.id)||!Number.isFinite(Date.parse(f.createdAt))||f.accountId!==accountId||typeof f.account!=='string'||f.account.toLowerCase()!==account.toLowerCase()||!dateSchema.safeParse(f.checkId).success||!dateSchema.safeParse(f.targetDay).success||!Number.isSafeInteger(f.generation)||f.generation<0||!['sending','checking','publishing','offline','attention','complete'].includes(f.phase)||f.supersedes!==undefined&&(typeof f.supersedes!=='string'||!/^[-0-9a-f]{36}$/i.test(f.supersedes)||f.supersedes===f.id))throw invalid();
 if('compact' in f){if(f.compact!==1||f.phase!=='complete')throw invalid();}
 else if(!Array.isArray(f.dependencies)||!f.dependencies.every(id=>typeof id==='string')||f.generation!==f.approved?.check?.version||f.fingerprint!==finishFingerprint(f.approved)||f.checkId!==f.approved.check?.id||f.targetDay!==f.approved.check?.targetDay||f.approved.accountId!==accountId||f.approved.account.toLowerCase()!==account.toLowerCase())throw invalid();
 if(f.command){const c=eveningCommandSchema.parse(f.command);if(c.kind!=='confirm'||c.id!==f.id||c.actorId!==accountId||c.checkId!==f.checkId)throw invalid();}
 if(f.phase==='complete'){
  const r=f.receipt,c=f.command;
  if(!r||!c||r.protocol!==1||r.actorId!==accountId||r.checkId!==f.checkId||r.targetDay!==f.targetDay||r.version!==f.generation+1||r.revision!==c.revision+1||r.planRevision!==c.planRevision+1||!Number.isFinite(Date.parse(r.confirmedAt))||typeof r.confirmedBy!=='string'||r.confirmedBy.toLowerCase()!==account.toLowerCase())throw invalid();
 }
 return f;
}

export function readFinishRecords(storage:Storage,accountId:string,account:string){
 const prefixes=[finishJournalPrefix(accountId),finishReceiptPrefix(accountId)],byId=new Map<string,FinishRecord>();
 const keys=Array.from({length:storage.length},(_,i)=>storage.key(i)).filter((k):k is string=>!!k&&prefixes.some(p=>k.startsWith(p)));
 for(const key of keys){
  const text=storage.getItem(key);if(text===null)continue;
  const raw=JSON.parse(text);if(raw&&typeof raw==='object')delete raw.resolved;
  const f=validateFinishRecord(raw,accountId,account);
  if(key!==('compact' in f?prefixes[1]:prefixes[0])+f.id)throw invalid();
  const old=byId.get(f.id);
  if(old&&(old.checkId!==f.checkId||old.targetDay!==f.targetDay||old.generation!==f.generation||old.createdAt!==f.createdAt||old.command&&f.command&&JSON.stringify(old.command)!==JSON.stringify(f.command)))throw invalid();
  if(!old||'compact' in f)byId.set(f.id,f);
 }
 const records=[...byId.values()].sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.id.localeCompare(b.id));
 for(const f of records){const seen=new Set([f.id]);let at=f;while(at.supersedes){const prior=byId.get(at.supersedes);if(!prior||prior.checkId!==f.checkId)break;if(seen.has(prior.id))throw invalid();seen.add(prior.id);at=prior;}}
 // Separate explicit decisions survive a stale tab rewriting the original full
 // journal. They do not invent a successful publication or its author.
 const resolutionPrefix=finishResolutionPrefix(accountId);
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);if(!key?.startsWith(resolutionPrefix))continue;
  const r=JSON.parse(storage.getItem(key)??'null'),f=byId.get(r?.id);
  if(!f||key!==resolutionPrefix+f.id||r.protocol!==1||r.mode!=='keep-shared'||r.accountId!==accountId||r.account!==account.toLowerCase()||r.checkId!==f.checkId||r.generation!==f.generation||r.createdAt!==f.createdAt||r.commandId!==null&&r.commandId!==f.command?.id||!Number.isFinite(Date.parse(r.resolvedAt)))throw invalid();
  if(f.phase!=='complete')Object.assign(f,{resolved:true});
 }
 return records;
}

export function keepSharedFinish(storage:Storage,f:FinishIntent){
 if(f.phase!=='attention'||f.command&&f.command.id!==f.id)throw invalid();
 const key=finishResolutionPrefix(f.accountId)+f.id,text=JSON.stringify({protocol:1,mode:'keep-shared',id:f.id,accountId:f.accountId,account:f.account.toLowerCase(),checkId:f.checkId,generation:f.generation,createdAt:f.createdAt,commandId:f.command?.id??null,resolvedAt:new Date().toISOString()});
 storage.setItem(key,text);if(storage.getItem(key)!==text)throw invalid();
}

export function unresolvedFinishes(records:FinishRecord[]):FinishIntent[]{
 // Historical cross-date supersedes pointers must never hide another check.
 const superseded=new Set(records.flatMap(f=>f.supersedes&&records.some(p=>p.id===f.supersedes&&p.checkId===f.checkId&&p.createdAt<=f.createdAt)?[f.supersedes]:[]));
 return records.filter((f):f is FinishIntent=>f.phase!=='complete'&&!f.resolved&&!superseded.has(f.id));
}

export function compactFinish(f:FinishRecord):CompletedFinish{
 if(f.phase!=='complete'||!f.command||!f.receipt)throw invalid();
 return {protocol:1,compact:1,id:f.id,accountId:f.accountId,account:f.account,checkId:f.checkId,targetDay:f.targetDay,generation:f.generation,createdAt:f.createdAt,phase:'complete',command:f.command,receipt:f.receipt,...(f.supersedes?{supersedes:f.supersedes}:{})};
}

export function writeCompletedFinish(storage:Storage,f:FinishRecord){
 const compact=compactFinish(f),key=finishReceiptPrefix(f.accountId)+f.id,text=JSON.stringify(compact);
 // A new namespace keeps older clients from parsing a compact record as a full
 // approval. Write and verify the replacement before removing the old journal.
 storage.setItem(key,text);
 if(storage.getItem(key)!==text)throw Error('The Finish receipt could not be preserved. Keep device data and retry.');
 validateFinishRecord(JSON.parse(text),f.accountId,f.account);
 storage.removeItem(finishJournalPrefix(f.accountId)+f.id);
 return compact;
}

export function compactCompletedFinishes(storage:Storage,accountId:string,account:string,keepId?:string){
 let records=readFinishRecords(storage,accountId,account);
 for(const f of records)if(f.phase==='complete'){
  const fullKey=finishJournalPrefix(accountId)+f.id;
  if(!('compact' in f))writeCompletedFinish(storage,f);
  else if(storage.getItem(fullKey)!==null)storage.removeItem(fullKey);
 }
 records=readFinishRecords(storage,accountId,account);
 const protectedIds=new Set<string>(keepId?[keepId]:[]),byId=new Map(records.map(f=>[f.id,f]));
 for(const f of unresolvedFinishes(records)){let at:FinishRecord|undefined=f;while(at&&!protectedIds.has(at.id)){protectedIds.add(at.id);at=at.supersedes?byId.get(at.supersedes):undefined;}}
 const completed=records.filter(f=>f.phase==='complete'&&!protectedIds.has(f.id));
 for(const f of completed.slice(0,Math.max(0,completed.length-FINISH_RECEIPT_LIMIT)))storage.removeItem(finishReceiptPrefix(accountId)+f.id);
 return readFinishRecords(storage,accountId,account);
}
