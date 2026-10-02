import {finishFingerprint,finishProblem,type FinishIntent,type FinishRecord,type FinishRecovery} from './finish-intent';
import {compactCompletedFinishes,readFinishRecords,unresolvedFinishes,writeCompletedFinish,finishJournalPrefix,finishResolutionPrefix,keepSharedFinish} from './finish-journal';
import {PrepNotesController} from './prep-notes-client';
import {requestJson} from './request-json';
import {EVENING_BATCH_LIMIT,applyEveningDelta,mergeEveningSnapshot,type EveningBatchReply,type EveningDelta} from './evening-sync';
import {dateSchema,eveningCommandSchema,selectionQuery,type EveningCommand,type EveningSelection,type EveningSnapshot,type Availability} from './evening';

type Storage=Pick<globalThis.Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
type Requester=(url:string,init?:RequestInit)=>Promise<{res:Response;body:unknown}>;
export type PendingEvening={accountId:string;account:string;command:EveningCommand;created:number;sent:boolean;rejected:boolean};
export type SaveReceipt={accountId:string;command:EveningCommand};
export type EveningState={finish?:FinishRecord;finishRecovery?:FinishRecovery[];deviceWorkPending?:boolean;snapshot:EveningSnapshot|null;pending:PendingEvening[];loading:boolean;saving:boolean;error:string;unauthorized:boolean;notice:string;finishing?:boolean;finishPhase?:'saving'|'summary'|'publishing';errorKind?:'network'|'conflict'|'blocked';recoveryBlocked?:boolean;lastVerifiedAt?:number;freshnessError?:string;refreshing?:boolean;verifying?:'retry'|'manual'|'finality'|null;needsVerification?:boolean;sendingIds?:string[];requestedSelection?:string;loadedSelection?:string;conflictReview?:string|null;acknowledged?:Record<string,SaveReceipt>;settledSave?:SaveReceipt|null;publicationLoading?:boolean};
export const RECOVERY_COOLDOWN_MS=15_000;
type Resolution={before:string[];next:PendingEvening[]};
const prefix='labula-evening-v1:';
export class EveningController {
 state:EveningState={snapshot:null,pending:[],loading:false,saving:false,error:'',unauthorized:false,notice:''};
 private finishFlight:Promise<boolean>|null=null;private finishNotes:PrepNotesController|null=null;private finishWake=()=>{void this.recoverConnection();};
 private listeners=new Set<()=>void>();private disposed=false;private busy=false;private polling=false;private snapshotSerial=0;private loadedRecovery=false;private accountId='';private deviceId=crypto.randomUUID();private sequence=0;private inflight:Promise<boolean>|null=null;private lastCreated=0;private actionSequence=0;private readEpoch=0;private intentEpoch=0;private readProof=new WeakMap<EveningSnapshot,{epoch:number;empty:boolean}>();private retryTimer:ReturnType<typeof setTimeout>|null=null;private retryCount=0;private recoveryAt=-Infinity;private recoveryFlight:Promise<boolean>|null=null;private publicationFlight:Promise<boolean>|null=null;private syncEpoch=0;private syncFlight:{promise:Promise<boolean>;abort:AbortController;epoch:number;readEpoch:number;intent:number;empty:boolean;selected:string;serial:number}|null=null;
 private journalChanged=(event:StorageEvent)=>{if(!this.accountId)return;const key=event.key;if(!key||[this.accountPrefix(),this.finishPrefix(),finishResolutionPrefix(this.accountId),'labula-finish-receipt-v1:'+encodeURIComponent(this.accountId)+':','labula.prep-notes.v1.'+encodeURIComponent(this.accountId)+'.pending.'].some(p=>key.startsWith(p)))this.emit({});};
 constructor(private account:string,private storage:Storage,private selection:EveningSelection,private request:Requester=requestJson,private fastSync=true){if(typeof window!=='undefined')window.addEventListener('storage',this.journalChanged);}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 getSnapshot=()=>this.state;
 private emit(patch:Partial<EveningState>){if(this.disposed)return;this.state={...this.state,...patch};if(this.accountId){try{this.state.finishRecovery=this.recoveryList(this.finishRecords(),this.state.finish?.id);this.state.deviceWorkPending=this.keys().length>0||!!this.state.finishRecovery?.length||this.finishActive()||this.state.finish?.phase==='attention'||Array.from({length:this.storage.length},(_,i)=>this.storage.key(i)).some(k=>k?.startsWith('labula.prep-notes.v1.'+encodeURIComponent(this.accountId)+'.pending.'));}catch{this.state.deviceWorkPending=true;this.state.recoveryBlocked=true;this.state.errorKind='blocked';this.state.error='Saved Finish needs review. Keep device data and ask the manager.';}}for(const f of this.listeners)f();}
 private acceptSnapshot(snapshot:EveningSnapshot){this.snapshotSerial++;const proof=this.readProof.get(snapshot);this.emit({snapshot:mergeEveningSnapshot(this.state.snapshot,snapshot),loadedSelection:selectionQuery(this.selection),requestedSelection:selectionQuery(this.selection),lastVerifiedAt:Date.now(),freshnessError:'',conflictReview:null,...(proof?.empty&&proof.epoch===this.intentEpoch&&!this.state.pending.length?{needsVerification:false}:{})});}
 private refuse(reason:string){this.emit({notice:reason});return false;}
 cancelNavigation(){if(this.finishActive())return;this.readEpoch++;this.emit({loading:false,refreshing:false});}
 private conflictFingerprint(snapshot:EveningSnapshot,pending=this.state.pending){const check=snapshot.check;return JSON.stringify({id:check?.id,version:check?.version,stage:check?.stage,planRevision:check?.planRevision,notebookRevision:snapshot.notebookRevision,items:pending.filter(p=>p.rejected||p.command.kind==='answer'||p.command.kind==='ready').map(p=>{const c=p.command;if(c.kind==='answer'){const a=check?.answers.find(a=>a.itemId===c.itemId);return [c.itemId,a?.value,a?.revision,a?.mappingValid];}if(c.kind==='ready'){const t=check?.tasks.find(t=>t.itemId===c.itemId);return [c.itemId,t?.ready,t?.revision,t?.cancelled,t?.mappingValid];}return [c.kind];})});}
 dispose(){this.stopFinishWake();if(typeof window!=='undefined')window.removeEventListener('storage',this.journalChanged);this.finishNotes?.dispose();this.syncFlight?.abort.abort();this.syncEpoch++;if(this.retryTimer)clearTimeout(this.retryTimer);this.disposed=true;this.listeners.clear();}
 private accountPrefix(){return prefix+encodeURIComponent(this.accountId)+':kitchen:';}
 private key(p:PendingEvening){return this.accountPrefix()+p.command.id;}
 private persist(p:PendingEvening){try{this.storage.setItem(this.key(p),JSON.stringify(p));}catch{this.emit({errorKind:'blocked',recoveryBlocked:true});throw Error('Browser storage could not preserve this change. Keep browser data, free storage and retry.');}}
 private verify(snapshot:EveningSnapshot){if(!snapshot||snapshot.scope!=='kitchen'||snapshot.account.toLowerCase()!==this.account.toLowerCase()||(this.accountId&&snapshot.accountId!==this.accountId)){this.emit({unauthorized:true,errorKind:'blocked'});throw Error('The signed-in account changed. Return to the original account before retrying.');}this.accountId=snapshot.accountId;}
 private async read(selection=this.selection,reportAuth=true,current=()=>true){const proof={epoch:this.intentEpoch,empty:!this.state.pending.length};const {res,body}=await this.request('/api/evening?'+selectionQuery(selection),{cache:'no-store'});if(!current())return body as EveningSnapshot;if(!res.ok){if(reportAuth)this.emit({unauthorized:res.status===401||res.status===403});throw Error((body as {error?:string}).error??'Could not load the shared check.');}const snap=body as EveningSnapshot;this.verify(snap);this.readProof.set(snap,proof);return snap;}

 private keys(){return Array.from({length:this.storage.length},(_,i)=>this.storage.key(i)).filter((k):k is string=>!!k&&k.startsWith(this.accountPrefix()));}
 // One durable journal makes replacing rejected requests recoverable even if storage fails
 // halfway through. No replacement is sent until the journal has been fully materialized.
 private finishResolutions(){
  for(const key of this.keys().filter(k=>k.startsWith(this.accountPrefix()+'resolution:'))){
   const journal=JSON.parse(this.storage.getItem(key)!) as Resolution;
   if(!Array.isArray(journal.before)||!Array.isArray(journal.next))throw Error('Could not read saved recovery. Keep this device data and retry.');
   for(const p of journal.next){eveningCommandSchema.parse(p.command);if(p.accountId!==this.accountId||p.account.toLowerCase()!==this.account.toLowerCase())throw Error('Recovery belongs to another account.');this.persist(p);}
   for(const id of journal.before){if(!/^[0-9a-f-]{36}$/i.test(id))throw Error('Invalid recovery request.');this.storage.removeItem(this.accountPrefix()+id);}
   this.storage.removeItem(key);
  }
 }
 private restore(){
  if(this.loadedRecovery)return;
  this.finishResolutions();const entries:PendingEvening[]=[];
  for(const key of this.keys()){
   const p=JSON.parse(this.storage.getItem(key)!) as PendingEvening;
   if(p.accountId!==this.accountId||p.account.toLowerCase()!==this.account.toLowerCase())continue;
   eveningCommandSchema.parse(p.command);entries.push(p);
  }
  entries.sort((a,b)=>a.created-b.created||(a.command.kind==='answer'&&b.command.kind==='answer'&&a.command.deviceId===b.command.deviceId?a.command.sequence-b.command.sequence:a.command.id.localeCompare(b.command.id)));
  this.lastCreated=Math.max(this.lastCreated,...entries.map(p=>p.created));this.loadedRecovery=true;if(entries.length)this.intentEpoch++;
  this.emit({...entries.some(p=>p.command.kind==='ready')?{needsVerification:true}:{},pending:entries,...(entries.length&&!entries.some(p=>p.rejected)?{errorKind:'network' as const}:{}),recoveryBlocked:false,notice:entries.length?'Changes recovered on this device. Retry to confirm their saved state.':''});
 }
 async refresh(selection?:EveningSelection){
  if(this.disposed)return false;
  if(this.busy||this.state.verifying||this.state.publicationLoading)return this.refuse('Please wait for the current save or verification before opening another date.');
  if(selection&&this.state.pending.length)return this.refuse('Changes are saved on this device. Retry or resolve them before opening another date.');
  const epoch=++this.readEpoch,current=()=>!this.disposed&&epoch===this.readEpoch,next=selection??this.selection;this.selection=next;this.snapshotSerial++;
  const same=!!this.state.snapshot&&this.state.loadedSelection===selectionQuery(next);
  this.emit({loading:!same,refreshing:same,requestedSelection:selectionQuery(next),error:'',unauthorized:false,conflictReview:null,notice:''});
  try{
   const snapshot=await this.read(next,true,current);if(!current())return false;
   this.acceptSnapshot(snapshot);try{this.restore();}catch(e){this.emit({recoveryBlocked:true,errorKind:'blocked'});throw e;}
   if(this.state.pending.length){const first=this.state.pending[0].command,day=first.kind==='start'?first.day:first.checkId;if(snapshot.check?.id!==day){this.selection={day};this.emit({requestedSelection:selectionQuery(this.selection)});const recovered=await this.read(this.selection,true,current);if(!current())return false;this.acceptSnapshot(recovered);this.emit({notice:`Recovered changes for the ${day} check. Resolve them before opening another date.`});}}
   if(this.state.pending[0]?.rejected&&this.state.snapshot)this.emit({conflictReview:this.conflictFingerprint(this.state.snapshot)});
   try{this.restoreFinish();if(this.finishActive()&&this.state.finish!.checkId!==this.state.snapshot?.check?.id){this.selection={day:this.state.finish!.checkId};this.emit({requestedSelection:selectionQuery(this.selection)});const recovered=await this.read(this.selection,true,current);if(!current())return false;this.acceptSnapshot(recovered);}}catch(e){this.emit({recoveryBlocked:true,errorKind:'blocked'});throw e;}
   return true;
  }catch(e){if(current())this.emit({error:e instanceof Error?e.message:'Could not load the shared check.'});return false;}finally{if(current()){this.emit({loading:false,refreshing:false});if(this.finishActive())queueMicrotask(()=>void this.continueFinish());else if(this.state.pending.length&&this.state.errorKind==='network')this.scheduleRetry();}}
 }
 // Background reads never replace an accepted local intent or a newer save response.
 async refreshVisible(){
  if(this.finishActive())return this.recoverConnection();
  if(this.state.loading||this.state.verifying)return false;
  if(this.fastSync&&this.state.snapshot?.sync)return this.syncVisible();
  if(this.state.pending.length&&this.state.errorKind==='network')return this.recoverConnection();
  if(this.disposed||this.busy||this.polling||this.state.pending.length||this.state.error||this.state.recoveryBlocked)return false;
  this.polling=true;const serial=this.snapshotSerial,selected=JSON.stringify(this.selection),current=()=>!this.disposed&&!this.busy&&!this.state.pending.length&&serial===this.snapshotSerial&&selected===JSON.stringify(this.selection);this.emit({refreshing:true});
  try{const snapshot=await this.read(this.selection,false,current);if(!current())return false;this.acceptSnapshot(snapshot);return true;}
  catch(e){if(!this.disposed&&!this.busy&&!this.state.pending.length&&serial===this.snapshotSerial)this.emit({freshnessError:e instanceof Error?e.message:'Could not refresh the shared check.'});return false;}
  finally{this.polling=false;this.emit({refreshing:false});}
 }
 async syncVisible(force=false):Promise<boolean>{
  if(this.disposed||this.state.loading||this.state.publicationLoading||this.state.unauthorized||!this.state.snapshot?.sync||this.state.loadedSelection&&this.state.loadedSelection!==selectionQuery(this.selection))return false;
  const flight=this.syncFlight;
  if(flight){
   const compatible=flight.readEpoch===this.readEpoch&&flight.selected===JSON.stringify(this.selection)&&flight.serial===this.snapshotSerial&&flight.intent===this.intentEpoch&&flight.empty&&!this.state.pending.length;
   if(!force||compatible)return flight.promise;
   // Only replace a read. Never cancel an uncertain write or wait for obsolete polling.
   flight.abort.abort();
  }
  const epoch=++this.syncEpoch,abort=new AbortController();this.polling=true;
  const record={epoch,abort,readEpoch:this.readEpoch,intent:this.intentEpoch,empty:!this.state.pending.length,selected:JSON.stringify(this.selection),serial:this.snapshotSerial,promise:Promise.resolve(false)};
  this.syncFlight=record;record.promise=this.syncRead(epoch,abort).finally(()=>{if(this.syncFlight===record)this.syncFlight=null;});return record.promise;
 }
 // Focus/online are hints, not proof. Retry first verifies the original identity.
 recoverConnection():Promise<boolean>{
  if(this.finishActive()){if(this.finishFlight||this.state.unauthorized||this.state.recoveryBlocked||Date.now()-this.recoveryAt<RECOVERY_COOLDOWN_MS)return Promise.resolve(false);this.recoveryAt=Date.now();this.retryCount=0;return this.continueFinish();}
  if(this.disposed||this.state.unauthorized||this.state.recoveryBlocked||this.state.publicationLoading||this.state.finishing||this.state.loading||this.busy||this.state.verifying||this.state.errorKind!=='network'||!this.state.pending.length||this.runnable()<0||Date.now()-this.recoveryAt<RECOVERY_COOLDOWN_MS)return Promise.resolve(false);
  this.recoveryAt=Date.now();this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}return this.autoRetry();
 }
 private async syncRead(epoch:number,abort:AbortController){
  const readEpoch=this.readEpoch,selected=JSON.stringify(this.selection),accountId=this.accountId,current=()=>!this.disposed&&epoch===this.syncEpoch&&readEpoch===this.readEpoch&&selected===JSON.stringify(this.selection)&&accountId===this.accountId,proof={epoch:this.intentEpoch,empty:!this.state.pending.length};this.emit({refreshing:true});
  try{for(let page=0;page<100;page++){
   const snapshot:EveningSnapshot=this.state.snapshot!;
   const {res,body}=await this.request('/api/evening/sync?'+selectionQuery(this.selection)+'&cursor='+encodeURIComponent(snapshot.sync!.cursor),{cache:'no-store',signal:abort.signal});
   if(!current())return false;
   if(!res.ok){if(res.status===401||res.status===403)this.emit({unauthorized:true,errorKind:'blocked'});throw Error((body as {error?:string}).error??'Shared changes could not be refreshed.');}
   const delta=body as EveningDelta;
   if(delta.accountId!==this.accountId||delta.account.toLowerCase()!==this.account.toLowerCase()){this.emit({unauthorized:true,errorKind:'blocked'});throw Error('The signed-in account changed. Sign in again.');}
   // A full read or structural write completed while this read was in flight. Start at its new cursor.
   if(snapshot.sync!.cursor!==this.state.snapshot?.sync?.cursor)continue;
   if(delta.reset||delta.check?.id!==this.state.snapshot?.check?.id){const fresh=await this.read(this.selection,true,current);if(!current())return false;this.acceptSnapshot(fresh);void this.recoverConnection();return true;}
   const updated=applyEveningDelta(this.state.snapshot!,delta);this.emit({snapshot:updated,lastVerifiedAt:Date.now(),freshnessError:'',...(this.state.pending.some(p=>p.rejected)?{conflictReview:this.conflictFingerprint(updated)}:{})});
   if(!delta.more){if(proof.empty&&proof.epoch===this.intentEpoch&&!this.state.pending.length)this.emit({needsVerification:false});void this.recoverConnection();return true;}
  }throw Error('More shared changes are waiting. Refresh to continue safely.');}
  catch(e){if(current()&&!abort.signal.aborted)this.emit({freshnessError:e instanceof Error?e.message:'Could not refresh shared changes.'});return false;}
  finally{if(epoch===this.syncEpoch){this.polling=false;this.emit({refreshing:false});}}
 }
 private async sendBatch(){
  const blocked=new Set<string>(),batch:PendingEvening[]=[];
  for(const p of this.state.pending){const c=p.command;if(c.kind!=='answer'&&c.kind!=='ready')break;if(p.rejected){blocked.add(c.itemId);continue;}if(blocked.has(c.itemId))continue;if(batch.length&&c.checkId!==(batch[0].command as Extract<EveningCommand,{kind:'answer'}>).checkId)break;batch.push({...p,sent:true});if(batch.length===EVENING_BATCH_LIMIT)break;}
  if(!batch.length)throw Error('Review the conflicting change before continuing.');
  for(const p of batch)this.persist(p);
  const sentIds=new Set(batch.map(p=>p.command.id));this.emit({sendingIds:[...sentIds],pending:this.state.pending.map(p=>sentIds.has(p.command.id)?{...p,sent:true}:p)});
  const {res,body}=await this.request('/api/evening/batch',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify({commands:batch.map(p=>p.command)})}).catch(e=>{if(!this.state.recoveryBlocked&&!this.state.unauthorized)this.emit({errorKind:'network'});throw e;});
  if(this.disposed)return null;
  if(!res.ok){this.emit({unauthorized:res.status===401||res.status===403,errorKind:[400,401,403,404,409,413,422].includes(res.status)?'blocked':'network'});throw Error((body as {error?:string}).error??'Could not confirm these changes. Retry safely.');}
  const reply=body as EveningBatchReply;
  if(reply.accountId!==this.accountId||reply.account.toLowerCase()!==this.account.toLowerCase()){this.emit({unauthorized:true,errorKind:'blocked'});throw Error('The signed-in account changed. Return to the original account.');}
  if(!reply.changes||reply.results?.length!==batch.length||batch.some(p=>!reply.results.some(r=>r.operationId===p.command.id&&r.checkId===(p.command as Extract<EveningCommand,{kind:'answer'}>).checkId&&['saved','conflict','blocked'].includes(r.status))))throw Error('The save response was incomplete. Retry its original requests.');
  const saved=new Set(reply.results.filter(r=>r.status==='saved').map(r=>r.operationId));
  for(const p of batch){if(saved.has(p.command.id)){try{this.storage.removeItem(this.key(p));}catch{this.emit({recoveryBlocked:true,errorKind:'blocked'});throw Error('The save succeeded but local receipts could not be cleared. Free storage and retry.');}}else this.persist({...p,rejected:true});}
  const snapshot=this.state.snapshot!,updated=applyEveningDelta(snapshot,{...reply.changes,account:reply.account,accountId:reply.accountId,cursor:snapshot.sync!.cursor,reset:false,more:false});
  const acknowledged={...this.state.acknowledged};let last:SaveReceipt|null=null;
  for(const p of batch)if(saved.has(p.command.id)){last={accountId:this.accountId,command:p.command};acknowledged[p.command.kind+':'+('itemId' in p.command?p.command.itemId:'')]=last;}
  const pending=this.state.pending.filter(p=>!saved.has(p.command.id)).map(p=>sentIds.has(p.command.id)?{...p,rejected:true}:p);
  this.emit({snapshot:updated,pending,acknowledged,...(pending.some(p=>p.rejected)?{errorKind:'conflict' as const,error:'Some changes need review. Independent items can still be saved.',conflictReview:this.conflictFingerprint(updated,pending)}:{})});
  return last;
 }
 // Shared snapshots remain authoritative; pending intents are a separate visible overlay.
 visibleCheck(){return visibleEveningCheck(this.state);}
 private enqueue(input:EveningCommand){
  const command={...input,actorId:this.accountId,meta:input.meta??{occurredAt:new Date().toISOString(),sessionId:this.deviceId,sequence:++this.actionSequence}};if(this.disposed||!this.state.snapshot)return false;
  if(this.state.pending.length>=500){this.emit({error:'Too many changes are waiting to sync. Retry before adding more.'});return false;}
  // Millisecond ties must not reorder rapid Ready/Undo on reload (legacy records still load).
  const created=Math.max(Date.now(),this.lastCreated+1);const p:PendingEvening={accountId:this.accountId,account:this.account,command,created,sent:false,rejected:false};
  try{this.persist(p);}catch{this.emit({errorKind:'blocked',error:'This browser cannot keep a recovery copy. No change was accepted. Free device storage or use another browser.'});return false;}
  this.lastCreated=created;this.intentEpoch++;const waiting=this.state.errorKind==='network';this.emit({pending:[...this.state.pending,p],...(command.kind==='ready'?{needsVerification:true}:{}),notice:waiting?'Saved on this device — waiting to sync':'',...(waiting||this.state.pending.some(x=>x.rejected)?{}:{error:'',errorKind:undefined}),settledSave:null});if(!waiting)void this.drain();else this.scheduleRetry();return true;
 }
 answer(itemId:string,value:Availability){const check=this.visibleCheck();if(!check||check.stage!=='draft'||answerBlocked(this.state,itemId))return this.refuse(check?.stage==='confirmed'?'Open Correct check before changing a confirmed answer.':'This answer cannot be changed yet. Finish the current step or review its saved changes.');const a=check.answers.find(a=>a.itemId===itemId);if(!a||a.value===value)return !!a;return this.enqueue({id:crypto.randomUUID(),scope:'kitchen',actorId:this.accountId,kind:'answer',checkId:check.id,itemId,revision:a.revision,generation:check.version,value,deviceId:this.deviceId,sequence:++this.sequence});}
 ready(itemId:string,value:boolean){
  const check=this.visibleCheck();
  if(!check||readyBlocked(this.state,itemId))return this.refuse('This task cannot be changed yet. Finish the current step or review its saved changes.');
  const task=check.tasks.find(t=>t.itemId===itemId&&!t.cancelled&&t.mappingValid);if(!task)return this.refuse('This task is no longer available. Refresh the shared plan.');if(task.ready===value)return true;
  return this.enqueue({id:crypto.randomUUID(),scope:'kitchen',actorId:this.accountId,kind:'ready',checkId:check.id,itemId,revision:task.revision,value});
 }
 toggleReady(itemId:string){const task=this.visibleCheck()?.tasks.find(t=>t.itemId===itemId);return task?this.ready(itemId,!task.ready):false;}
 async action(command:EveningCommand){if(this.disposed)return false;if(this.busy||this.state.loading||this.state.publicationLoading||this.state.verifying||this.state.pending.length||this.state.error||this.state.recoveryBlocked||this.state.finishing&&command.kind!=='confirm')return this.refuse(this.state.pending.length?'Save or resolve the waiting changes before this action.':this.state.error||this.state.recoveryBlocked?'Resolve the connection or storage issue before this action.':'Please wait for the current step to finish.');if(command.kind==='confirm')this.emit({finishPhase:'publishing'});if(!this.enqueue(command))return false;return this.inflight??false;}
 private autoRetry(){if(this.disposed||this.state.unauthorized||this.state.recoveryBlocked||this.state.errorKind!=='network')return Promise.resolve(false);if(this.recoveryFlight)return this.recoveryFlight;const work=this.retry(false);this.recoveryFlight=work.finally(()=>{this.recoveryFlight=null;});return this.recoveryFlight;}
 private scheduleRetry(){if(this.retryTimer||this.retryCount>=3||this.disposed||this.state.unauthorized||!this.state.pending.length&&!this.finishActive())return;const delay=2000*2**this.retryCount++;this.retryTimer=setTimeout(()=>{this.retryTimer=null;void (this.finishActive()?this.continueFinish():this.autoRetry());},delay);}
 private runnable(){const blocked=new Set<string>();for(let i=0;i<this.state.pending.length;i++){const p=this.state.pending[i],c=p.command;if(p.rejected){if(c.kind!=='ready'&&c.kind!=='answer')return -1;blocked.add(c.itemId);continue;}if((c.kind==='ready'||c.kind==='answer')&&blocked.has(c.itemId))continue;return i;}return -1;}
 private drain():Promise<boolean>{if(this.inflight)return this.inflight;if(this.disposed||this.busy||this.state.recoveryBlocked||!this.state.pending.length||this.runnable()<0)return Promise.resolve(false);this.inflight=this.run().finally(()=>{this.inflight=null;});return this.inflight;}
 private async run(){let lastReceipt:SaveReceipt|null=null;let succeeded=false;this.busy=true;this.emit({saving:true,...(this.state.pending.some(p=>p.rejected)?{}:{error:'',errorKind:undefined}),unauthorized:false});try{
  while(this.state.pending.length&&!this.disposed){const index=this.runnable();if(index<0)return false;let p=this.state.pending[index];
   if(this.fastSync&&this.state.snapshot?.sync&&(p.command.kind==='answer'||p.command.kind==='ready')){const receipt=await this.sendBatch();if(receipt)lastReceipt=receipt;continue;}
   if(!p.sent){p={...p,sent:true};this.persist(p);this.emit({pending:this.state.pending.map(x=>x.command.id===p.command.id?p:x)});}
   this.emit({sendingIds:[p.command.id]});
   const {res,body}=await this.request('/api/evening',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0',...(this.fastSync?{'X-Labula-Confirm':'1'}:{})},body:JSON.stringify(p.command)}).catch(error=>{if(!this.state.recoveryBlocked&&!this.state.unauthorized)this.emit({errorKind:'network'});throw error;});
   if(this.disposed)return false;
   const reply=body as {operationId?:string;snapshot?:EveningSnapshot;publication?:import('./evening').PublicationReceipt;plan?:import('./evening').PublicationPlan;error?:string};
   if(!res.ok){if(res.status===409||res.status===400||res.status===404){const rejected={...p,rejected:true};this.persist(rejected);this.emit({pending:this.state.pending.map(x=>x.command.id===p.command.id?rejected:x),conflictReview:null,errorKind:'conflict'});try{const latest=await this.read();if(this.disposed)return false;this.acceptSnapshot(latest);this.emit({conflictReview:this.conflictFingerprint(latest)});}catch{this.emit({conflictReview:null});}}this.emit({unauthorized:res.status===401||res.status===403,errorKind:res.status===401||res.status===403?'blocked':res.status>=500?'network':'conflict',error:reply.error??'Could not confirm this save. Retry safely.'});if(p.command.kind==='ready'&&[400,404,409].includes(res.status))continue;throw Error(reply.error??'Could not confirm this save. Retry safely.');}
   if(p.command.kind==='confirm'&&reply.operationId===p.command.id&&reply.publication&&!reply.snapshot){
    const pub=reply.publication;
    if(pub.protocol!==1||pub.actorId!==this.accountId||pub.checkId!==p.command.checkId||pub.revision!==p.command.revision+1||pub.planRevision!==p.command.planRevision+1||!pub.confirmedAt||pub.confirmedBy.toLowerCase()!==this.account.toLowerCase()||!dateSchema.safeParse(pub.targetDay).success||!Number.isInteger(pub.version)||pub.version<1)throw Error('Publication could not be verified. Retry the original request.');
    this.finishReceipt(p.command,pub);
    try{this.storage.removeItem(this.key(p));}catch{this.emit({errorKind:'blocked',recoveryBlocked:true});throw Error('Publication succeeded but its local receipt could not be cleared. Free storage and retry.');}
    lastReceipt={accountId:this.accountId,command:p.command};this.emit({pending:this.state.pending.filter(x=>x.command.id!==p.command.id),publicationLoading:true,needsVerification:true,notice:'Check published. Loading shared Morning prep…'});
    const plan=reply.plan,prior=this.state.snapshot!;
    if(plan&&plan.check.id===pub.checkId&&plan.check.targetDay===pub.targetDay&&plan.check.version===pub.version&&plan.check.revision===pub.revision&&plan.check.planRevision===pub.planRevision&&plan.check.confirmedAt===pub.confirmedAt&&plan.check.confirmedBy===pub.confirmedBy&&Array.isArray(plan.tasks)){
     // Tasks were read within the committed transaction. Keep the sync cursor and
     // verification requirement; this receipt must not consume unseen events.
     this.acceptSnapshot({...prior,check:{...prior.check!,...plan.check,tasks:plan.tasks},checks:[...prior.checks.filter(c=>c.id!==pub.checkId),plan.check]});
     this.emit({publicationLoading:false,acknowledged:{...this.state.acknowledged,confirm:lastReceipt},notice:'Check published. Shared Morning prep loaded.'});
    }else queueMicrotask(()=>void this.loadPublication(pub.checkId));continue;
   }
   if(reply.operationId!==p.command.id||!reply.snapshot||reply.snapshot.check?.id!==(p.command.kind==='start'?p.command.day:p.command.checkId))throw Error('The save response was incomplete. Retry to check its result.');
   this.verify(reply.snapshot);if(p.command.kind==='confirm'){const c=reply.snapshot.check!;this.finishReceipt(p.command,{protocol:1,actorId:this.accountId,checkId:c.id,targetDay:c.targetDay,version:c.version,revision:c.revision,planRevision:c.planRevision,confirmedAt:c.confirmedAt!,confirmedBy:c.confirmedBy!});}if(this.fastSync)this.selection={day:reply.snapshot.check!.id};try{this.storage.removeItem(this.key(p));}catch{this.emit({errorKind:'blocked',recoveryBlocked:true});throw Error('The save succeeded, but its local receipt could not be cleared. Free device storage and retry safely.');}this.acceptSnapshot(reply.snapshot);// Receipts are memory-only presentation signals, never restored from a snapshot or recovery journal.
   const receipt={accountId:this.accountId,command:p.command};lastReceipt=receipt;
   const key=p.command.kind+('itemId' in p.command?':'+p.command.itemId:'');
   const acknowledged=Object.fromEntries(Object.entries(this.state.acknowledged??{}).filter(([,r])=>r.accountId===this.accountId&&'checkId' in r.command&&r.command.checkId===reply.snapshot!.check!.id));
   this.emit({pending:this.state.pending.filter(x=>x.command.id!==p.command.id),acknowledged:{...acknowledged,[key]:receipt}});
   if(this.state.pending.some(x=>x.rejected))this.emit({conflictReview:this.conflictFingerprint(reply.snapshot)});
  }
  succeeded=!this.disposed;this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}this.emit({notice:'Shared changes saved.',error:'',errorKind:undefined});return succeeded;
 }catch(e){this.emit({errorKind:this.state.errorKind??'network',error:e instanceof Error?e.message:'Connection failed. Changes are kept on this device.'});if(this.state.errorKind==='network')this.scheduleRetry();return false;}finally{this.busy=false;this.emit({saving:false,sendingIds:[],...(succeeded&&(!this.fastSync||!this.state.snapshot?.sync)?{needsVerification:false}:{}),...(succeeded?{settledSave:lastReceipt}:{})});if(succeeded&&!this.state.verifying&&(lastReceipt?.command.kind==='confirm'||this.state.needsVerification&&this.visibleCheck()?.tasks.filter(t=>!t.cancelled).every(t=>t.ready&&t.mappingValid)))queueMicrotask(()=>void this.verifyMorning());}}
 async retry(manual=true,mode:'retry'|'manual'='retry'){
  if(this.state.finish&&this.state.finish.phase!=='complete'&&!this.state.pending.some(p=>p.rejected)){if(!this.finishActive())this.finishStep(this.state.finish.command?'publishing':'sending');if(manual){this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}}return this.continueFinish();}
  if(this.recoveryFlight)return this.recoveryFlight;
  if(this.state.publicationLoading&&!this.busy)return this.loadPublication();
  if(!manual)this.recoveryAt=Date.now();
  if(manual){this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}}
  if(this.disposed)return false;if(this.busy||this.state.loading||this.state.verifying)return this.refuse('A save or verification is already in progress. Your changes stay on this device.');
  this.busy=true;this.emit({verifying:mode,error:'',errorKind:undefined,unauthorized:false,notice:''});let verified=false;
  try{const snapshot=await this.read();if(this.disposed)return false;this.acceptSnapshot(snapshot);if(this.state.recoveryBlocked||!this.loadedRecovery){this.loadedRecovery=false;this.restore();this.restoreFinish();}if(this.state.pending[0]?.rejected)this.emit({conflictReview:this.conflictFingerprint(snapshot)});verified=true;}
  catch(e){this.emit({errorKind:this.state.unauthorized?'blocked':'network',error:e instanceof Error?e.message:'Sign in and retry.'});if(!this.state.unauthorized)this.scheduleRetry();}finally{this.busy=false;}
  try{if(!verified)return false;if(this.state.pending.length&&!await this.drain())return false;if(this.state.publicationLoading)return true;if(this.state.needsVerification){if(this.fastSync&&this.state.snapshot?.sync)return await this.syncVisible(true);const snapshot=await this.read();this.acceptSnapshot(snapshot);}return true;}
  finally{this.emit({verifying:null});}
 }
 userRefresh(){return this.retry(true,'manual');}
 private loadPublication(day=this.state.snapshot?.check?.id):Promise<boolean>{if(this.publicationFlight)return this.publicationFlight;this.publicationFlight=this.readPublication(day).finally(()=>{this.publicationFlight=null;});return this.publicationFlight;}
 private async readPublication(day=this.state.snapshot?.check?.id){
  if(!day||this.disposed)return false;
  const accountId=this.accountId;this.emit({publicationLoading:true,freshnessError:'',error:''});
  try{
   const {res,body}=await this.request('/api/evening?day='+encodeURIComponent(day)+'&publication=1',{cache:'no-store'});
   if(this.disposed||accountId!==this.accountId||this.state.snapshot?.check?.id!==day)return false;
   if(!res.ok){if(res.status===401||res.status===403)this.emit({unauthorized:true,errorKind:'blocked'});throw Error((body as {error?:string}).error??'The check is published, but shared tasks could not be loaded. Retry loading.');}
   const fresh=body as EveningSnapshot;this.verify(fresh);if(fresh.check?.id!==day||!fresh.check.version)throw Error('Published tasks could not be verified. Retry loading.');
   const prior=this.state.snapshot!;
   this.acceptSnapshot({...prior,...fresh,sync:prior.sync,trackedCount:prior.trackedCount,checks:[...prior.checks.filter(c=>!fresh.checks.some(n=>n.id===c.id)),...fresh.checks]});
   this.emit({publicationLoading:false,notice:'Check published. Shared Morning prep loaded.'});return true;
  }catch(e){if(!this.disposed&&accountId===this.accountId&&this.state.snapshot?.check?.id===day)this.emit({freshnessError:e instanceof Error?e.message:'Could not load published tasks.',notice:'Check published. Retry loading Morning prep.'});return false;}
 }
 private async verifyMorning(){
  if(this.disposed||this.state.pending.length||this.state.verifying||this.state.loading)return;
  this.emit({verifying:'finality'});try{if(this.fastSync&&this.state.snapshot?.sync)await this.syncVisible(true);else {const snapshot=await this.read();if(!this.disposed)this.acceptSnapshot(snapshot);}}catch(e){this.emit({freshnessError:e instanceof Error?e.message:'Could not verify shared tasks.'});}finally{this.emit({verifying:null});}
 }
 async flush(){if(this.state.error||this.state.recoveryBlocked||this.state.pending.some(p=>p.rejected))return false;if(this.inflight&&!await this.inflight)return false;if(this.state.pending.length&&!await this.drain())return false;return this.state.pending.length===0&&!this.busy&&!this.state.error;}
 async summary(){
  if(this.disposed)return null;if(this.state.finishing||this.state.loading||this.state.verifying){this.refuse('Please wait for the current verification before finishing.');return null;}this.emit({finishing:true,finishPhase:'saving'});let complete=false;
  try{if(!await this.flush()){this.refuse('Finish needs all waiting changes saved. Retry or review the changes below.');return null;}this.emit({finishPhase:'summary'});if(this.fastSync&&this.state.snapshot?.sync){if(!await this.syncVisible(true))return null;}else if(!await this.refresh())return null;complete=this.state.pending.length===0&&!!this.state.snapshot?.check&&!this.disposed;return complete?this.state.snapshot:null;}
  finally{if(!complete)this.endFinish();}
 }
 endFinish(){if(this.finishActive())return;this.emit({finishing:false,finishPhase:undefined});}

 private finishComplete(){return this.state.finish?.phase==='complete';}
 finishActive(){return !!this.state.finish&&!['complete','attention'].includes(this.state.finish.phase);}
 private finishPrefix(){return finishJournalPrefix(this.accountId);}
 private finishRecords(){return readFinishRecords(this.storage,this.accountId,this.account);}
 private recoveryList(records:FinishRecord[],selected?:string){return unresolvedFinishes(records).filter(f=>f.id!==selected).map(({id,checkId,targetDay,phase,reason})=>({id,checkId,targetDay,phase,reason}));}
 private storeFinish(f:FinishRecord){
  // Cleanup can fail (quota/interruption). Do it before accepting a new approval,
  // so a refused Finish can never leave an unseen durable approval behind.
  const before=compactCompletedFinishes(this.storage,this.accountId,this.account,f.id);
  const prior=before.find(p=>p.id===f.id);if(prior?.phase==='complete'&&f.phase!=='complete')f=prior;
  if(prior?.resolved&&f.phase!=='complete'){this.emit({finish:undefined,finishing:false,error:'This Finish was withdrawn in another tab. Refresh the shared check.'});throw Error('Finish was withdrawn in another tab.');}
  if(f.phase==='complete')f=writeCompletedFinish(this.storage,f);else this.storage.setItem(this.finishPrefix()+f.id,JSON.stringify(f));
  const records=f.phase==='complete'?compactCompletedFinishes(this.storage,this.accountId,this.account,f.id):[...before.filter(p=>p.id!==f.id),f];
  this.emit({finish:f,finishRecovery:this.recoveryList(records,f.id),finishing:!['complete','attention'].includes(f.phase)});
 }
 private finishStep(phase:FinishIntent['phase'],reason=''){const f=this.state.finish;if(f&&f.phase!=='complete'&&!('compact' in f))this.storeFinish({...f,phase,reason});}
 private startFinishWake(){if(typeof window!=='undefined'){window.addEventListener('online',this.finishWake);window.addEventListener('focus',this.finishWake);}}
 private stopFinishWake(){if(typeof window!=='undefined'){window.removeEventListener('online',this.finishWake);window.removeEventListener('focus',this.finishWake);}}
 private restoreFinish(){
  const records=compactCompletedFinishes(this.storage,this.accountId,this.account,this.state.finish?.id),unresolved=unresolvedFinishes(records),checkId=this.state.snapshot?.check?.id;
  const current=this.state.finish;const f=current&&current.phase!=='complete'&&!records.find(f=>f.id===current.id)?.resolved?records.find(f=>f.id===current.id):current&&current.phase==='complete'&&current.checkId===checkId?records.find(f=>f.id===current.id):unresolved.find(f=>f.checkId===checkId)??unresolved[0]??records.filter(f=>f.phase==='complete'&&f.checkId===checkId).at(-1);
  this.emit({finish:f,finishRecovery:this.recoveryList(records,f?.id),finishing:!!f&&!['complete','attention'].includes(f.phase)});
  if(this.finishActive()){this.selection={day:f!.checkId};this.startFinishWake();}
 }
 async resumeFinish(id:string){
  if(this.finishActive()||this.state.saving||this.state.verifying||this.state.pending.length)return this.refuse('Resolve the current saved-on-device work before resuming another check.');
  try{const f=unresolvedFinishes(this.finishRecords()).find(f=>f.id===id);if(!f)return this.refuse('This Finish has already been resolved. Refresh the check.');this.emit({finish:undefined});return await this.refresh({day:f.checkId});}
  catch(e){this.emit({recoveryBlocked:true,error:e instanceof Error?e.message:'Saved Finish needs review.'});return false;}
 }
 async keepReviewedSharedFinish(){
  const f=this.state.finish,snapshot=this.state.snapshot;
  if(!f||f.phase!=='attention'||'compact' in f||f.command||!snapshot||this.state.pending.length||this.keys().length||this.busy||this.state.verifying||this.state.unauthorized||this.state.recoveryBlocked)return this.refuse('Verify or resolve the original save before keeping the shared check.');
  const reviewed=finishFingerprint(snapshot);if(!await this.refresh())return false;
  if(this.state.finish?.id!==f.id||finishFingerprint(this.state.snapshot!)!==reviewed)return this.refuse('The shared check changed again. Review its updated details, then choose again.');
  try{keepSharedFinish(this.storage,f);this.emit({finish:undefined,finishing:false,error:'',errorKind:undefined,notice:'Shared check kept. Your earlier Finish was withdrawn, not published.'});return true;}
  catch{this.emit({recoveryBlocked:true,error:'Could not preserve your decision. Keep device data and retry.'});return false;}
 }
 reviewFinish():EveningSnapshot|null{
  if(this.disposed||this.finishActive()||this.state.loading||this.state.verifying||this.state.recoveryBlocked||this.state.unauthorized||this.state.pending.some(p=>p.rejected||p.command.kind!=='answer')){this.refuse('Resolve the waiting changes or verification before reviewing Finish.');return null;}
  const snapshot=this.state.snapshot,check=this.visibleCheck();if(!snapshot||!check)return null;
  return structuredClone({...snapshot,check});
 }
 requestFinish(approved:EveningSnapshot){
  if(this.finishActive())return false;
  const current=this.reviewFinish();if(!current)return false;
  const problem=finishProblem(approved);if(problem||finishFingerprint(current)!==finishFingerprint(approved)){this.refuse(problem||'Answers changed while you reviewed. Keep editing and open a new summary.');return false;}
  const c=approved.check!,f:FinishIntent={protocol:1,id:crypto.randomUUID(),accountId:this.accountId,account:this.account,checkId:c.id,targetDay:c.targetDay,generation:c.version,createdAt:new Date().toISOString(),approved:structuredClone(approved),fingerprint:finishFingerprint(approved),dependencies:this.state.pending.map(p=>p.command.id),supersedes:this.state.finish?.checkId===c.id&&this.state.finish.phase!=='complete'?this.state.finish.id:undefined,phase:'sending'};
  try{this.storeFinish(f);}catch{this.refuse('Finish was not accepted: device storage is full. Keep this window open, free storage, and try again.');return false;}
  this.startFinishWake();void this.continueFinish();return true;
 }
 private finishReceipt(command:Extract<EveningCommand,{kind:'confirm'}>,receipt:import('./evening').PublicationReceipt){
  const f=this.state.finish;if(!f||f.id!==command.id||f.accountId!==receipt.actorId||f.checkId!==receipt.checkId||f.targetDay!==receipt.targetDay)return;
  if(receipt.version!==f.generation+1||receipt.revision!==command.revision+1||receipt.planRevision!==command.planRevision+1||!receipt.confirmedAt||receipt.confirmedBy.toLowerCase()!==f.account.toLowerCase())throw Error('The original Finish receipt could not be verified.');
  this.storeFinish({...f,phase:'complete',receipt,reason:''});this.stopFinishWake();
 }
 continueFinish():Promise<boolean>{
  if(this.finishFlight)return this.finishFlight;
  if(!this.finishActive()||this.disposed)return Promise.resolve(false);
  this.finishFlight=this.runFinish().finally(()=>{this.finishFlight=null;});return this.finishFlight;
 }
 private async runFinish(){
  const f=this.state.finish;if(!f||f.phase==='complete'||'compact' in f)return false;
  try{
   this.finishStep(f.command?'publishing':'sending');
   // Verify original identity even with a warm cache. For an uncertain confirm,
   // replay its original command before comparing the now-published snapshot.
   const uncertain=this.state.unauthorized||this.state.recoveryBlocked||!!f.command||f.phase==='offline'||this.state.errorKind==='network';
   let fresh=this.state.snapshot!;
   if(uncertain||fresh.check?.id!==f.checkId){fresh=await this.read({day:f.checkId});this.selection={day:f.checkId};this.acceptSnapshot(fresh);this.emit({unauthorized:false,error:'',errorKind:undefined});}
   if(this.disposed)return false;
   if(this.finishComplete())return true;
   if(this.state.recoveryBlocked){this.loadedRecovery=false;this.restore();}if(this.state.recoveryBlocked)throw Error('Free device storage before finishing.');
   if(f.command){
    const saved=this.state.pending.find(p=>p.command.id===f.id);
    if(saved?.rejected){this.finishStep('attention','The shared check changed. Review the conflict and approve a new summary.');return false;}
    if(!saved&&!this.enqueue(f.command))throw Error(this.state.notice||'Could not recover the original Finish request.');
    if(this.inflight)await this.inflight;else await this.drain();
    if(this.disposed)return false;
    if(this.finishComplete())return true;
    throw Error(this.state.error||'Could not verify the original Finish. Retry safely.');
   }
   if(this.state.pending.length){
    if(this.state.pending.some(p=>p.rejected)){this.finishStep('attention','Review the conflicting answer before approving a new summary.');return false;}
    this.emit({error:'',errorKind:undefined});
    if(this.inflight)await this.inflight;if(this.state.pending.length)await this.drain();
    if(this.disposed)return false;
    if(this.state.pending.length)throw Error(this.state.error||'Answers are still waiting to be shared.');
   }
   // This independent dependency reader survives the feedback editor unmount.
   // It sends only already-accepted immutable commands, never note drafts.
   const prefix='labula.prep-notes.v1.'+encodeURIComponent(this.accountId)+'.pending.';
   let hasNotes=false;for(let i=0;i<this.storage.length;i++)if(this.storage.key(i)?.startsWith(prefix))hasNotes=true;
   if(hasNotes){
    this.finishNotes??=new PrepNotesController(this.account,this.storage,async<T>(url:string,init?:RequestInit)=>{const r=await this.request(url,init);return {...r,body:r.body as T};});
    if(!await this.finishNotes.prepareFinish(f.checkId,this.accountId,fresh.prepNotes===1)){if(this.finishNotes.state.pending.some(p=>p.rejected)){this.finishStep('attention',this.finishNotes.state.error||'Accepted feedback needs review. Open its item and resolve the note.');return false;}throw Error(this.finishNotes.state.error||'Accepted feedback is not shared yet. Retry notes before finishing.');}
   }
   if(this.disposed)return false;
   this.finishStep('checking');
   let verified:EveningSnapshot;
   if(this.fastSync&&this.state.snapshot?.sync&&this.state.snapshot.check?.id===f.checkId){if(!await this.syncVisible(true))throw Error(this.state.freshnessError||'Could not verify shared answers.');verified=this.state.snapshot;}else{verified=await this.read({day:f.checkId});this.acceptSnapshot(verified);}
   if(this.disposed)return false;
   if(finishFingerprint(verified)!==f.fingerprint||finishProblem(verified)){
    this.finishStep('attention','Shared answers, links, date, or Morning prep changed since your approval. Review a new summary before finishing.');return false;
   }
   const c=verified.check!;const command:Extract<EveningCommand,{kind:'confirm'}>={id:f.id,scope:'kitchen',actorId:this.accountId,kind:'confirm',checkId:f.checkId,revision:c.revision,planRevision:c.planRevision,notebookRevision:verified.notebookRevision,meta:{occurredAt:f.createdAt,sessionId:this.deviceId,sequence:++this.actionSequence}};
   this.storeFinish({...f,command,phase:'publishing'});
   this.emit({error:'',errorKind:undefined});if(!this.enqueue(command))throw Error(this.state.notice||'Could not keep the Finish command.');
   if(this.inflight)await this.inflight;else await this.drain();
   if(this.disposed)return false;
   if(this.finishComplete())return true;
   throw Error(this.state.error||'The original Finish has not been confirmed. Retry safely.');
  }catch(e){
   if(this.disposed)return false;
   const reason=e instanceof Error?e.message:'Could not finish. Your approved check is kept on this device.';
   if(this.finishComplete())return true;
   try{this.finishStep(this.state.unauthorized||this.state.recoveryBlocked||this.state.errorKind==='conflict'?'attention':'offline',reason);}catch{this.emit({recoveryBlocked:true,error:'Could not preserve Finish progress. Keep device data and retry.'});}
   if(this.finishActive())this.scheduleRetry();else this.stopFinishWake();return false;
  }finally{if(this.finishComplete()){this.emit({finishing:false,finishPhase:undefined});this.finishNotes?.dispose();}}
 }

 async resolveRejected(useLocal:boolean){
  if(this.busy||this.state.recoveryBlocked||!this.state.pending[0]?.rejected)return false;
  const before=this.state.pending,reviewedFingerprint=this.state.conflictReview;if(before.slice(1).some(p=>p.sent&&!p.rejected)){this.emit({error:'Some original saves still have an unknown result. Retry remaining saves before resolving the conflict.'});return false;}
  if(!reviewedFingerprint){this.emit({error:'Refresh the shared result before choosing how to resolve this change.'});return false;}
  if(!await this.refresh())return false;
  const kind=before[0].command.kind,check=this.state.snapshot?.check;
  if(!this.state.snapshot)return false;
  const currentFingerprint=this.conflictFingerprint(this.state.snapshot,before);
  if(currentFingerprint!==reviewedFingerprint){this.emit({conflictReview:currentFingerprint,error:'Shared result changed again. Review the updated comparison, then choose again.'});return false;}
  if(useLocal&&kind!=='answer'&&kind!=='ready')return false;
  const keep=useLocal?before:[];
  if(keep.some(p=>p.command.kind!==kind||!check||p.command.kind==='start'||p.command.checkId!==check.id)||(kind==='answer'&&keep.length&&(check?.stage!=='draft'||keep.some(p=>p.command.kind==='answer'&&p.command.generation!==check.version)))){this.emit({error:'The check changed. Keep the shared result and review the check before making new changes.'});return false;}
  // A fresh fetch cannot silently expand the user's approval to a different shared result.
  const rows=kind==='ready'?check?.tasks.filter(t=>!t.cancelled&&t.mappingValid):check?.answers.filter(a=>a.mappingValid&&!a.supersededBy);
  const revisions=new Map(rows?.map(a=>[a.itemId,a.revision]));
  const values=new Map(rows?.map(a=>[a.itemId,'value' in a?a.value:a.ready]));
  if(keep.some(p=>!('itemId' in p.command)||!revisions.has(p.command.itemId))){this.emit({error:'A listed item is no longer available. Keep the shared result and use Correct check to resolve its link.'});return false;}
  const next:PendingEvening[]=[];
  for(const p of keep){
   const c=p.command as Extract<EveningCommand,{kind:'answer'|'ready'}>,revision=revisions.get(c.itemId)!;
   // Explicit review of a definitively rejected change can adopt the same fresh
   // result without inventing a transition/author. Later different intents still
   // run in order; an uncertain sent command was excluded above and is replayed.
   if(values.get(c.itemId)===c.value&&(c.kind==='ready'||c.generation===check!.version))continue;
   revisions.set(c.itemId,revision+1);values.set(c.itemId,c.value);
   next.push({...p,sent:false,rejected:false,command:{...c,id:crypto.randomUUID(),revision,meta:{occurredAt:new Date().toISOString(),sessionId:this.deviceId,sequence:++this.actionSequence,supersedesCommandId:c.id},...(c.kind==='answer'?{generation:check!.version}:{})}});
  }
  const journal:Resolution={before:before.map(p=>p.command.id),next};
  const abandoned=!useLocal&&kind==='confirm'&&this.state.finish?.phase==='attention'&&before.some(p=>p.rejected&&p.command.id===this.state.finish?.id)?this.state.finish as FinishIntent:undefined;
  try{if(abandoned)keepSharedFinish(this.storage,abandoned);this.storage.setItem(this.accountPrefix()+'resolution:'+crypto.randomUUID(),JSON.stringify(journal));this.finishResolutions();}
  catch{this.emit({recoveryBlocked:true,error:'Could not finish saving the reviewed recovery. Your changes are kept. Free device storage, then retry.'});return false;}
  this.emit({pending:next,...(abandoned?{finish:undefined,finishing:false}:{}),error:'',errorKind:undefined,notice:useLocal?'Your reviewed changes will be saved.':'Shared result kept.'});return next.length?this.drain():true;
 }
}

export function visibleEveningCheck(state:EveningState){
 const check=state.snapshot?.check;if(!check)return null;const copy=structuredClone(check);
 for(const p of state.pending){const c=p.command;if(c.kind==='answer'&&c.checkId===copy.id){const a=copy.answers.find(a=>a.itemId===c.itemId);if(a){a.value=c.value;a.revision=c.revision+1;}}
  if(c.kind==='ready'&&c.checkId===copy.id){const t=copy.tasks.find(t=>t.itemId===c.itemId);if(t&&!t.cancelled&&t.mappingValid){t.ready=c.value;t.revision=c.revision+1;}}
 }return copy;
}
export function morningProgress(state:EveningState,now=Date.now()){const check=visibleEveningCheck(state),tasks=check?.version?check.tasks.filter(t=>!t.cancelled):[],rejected=new Set(state.pending.flatMap(p=>p.rejected&&p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[])),ready=tasks.filter(t=>t.ready&&t.mappingValid&&!rejected.has(t.itemId)).length;return {tasks,ready,remaining:tasks.length-ready,complete:tasks.length>0&&ready===tasks.length&&!state.publicationLoading&&!state.loading&&!state.verifying&&!state.needsVerification&&!state.saving&&!state.pending.length&&!state.error&&!state.unauthorized&&!state.recoveryBlocked&&!state.freshnessError&&!!state.lastVerifiedAt&&now-state.lastVerifiedAt<75000};}

export function readyBlocked(state:EveningState,itemId:string){const check=state.snapshot?.check;return !check||check.version<1||state.finishing||state.publicationLoading||state.loading||state.unauthorized||state.recoveryBlocked||!!state.error&&state.errorKind!=='network'&&state.errorKind!=='conflict'||state.pending.some(p=>p.command.kind!=='ready'||p.command.checkId!==check.id||p.rejected&&p.command.itemId===itemId);}

export function answerBlocked(state:EveningState,itemId:string){const check=state.snapshot?.check;return !check||state.finishing||state.publicationLoading||state.loading||state.unauthorized||state.recoveryBlocked||!!state.error&&state.errorKind!=='network'&&state.errorKind!=='conflict'||state.pending.some(p=>p.command.kind!=='answer'||p.command.checkId!==check.id||p.rejected&&p.command.itemId===itemId);}

const finishControllers=new Map<string,EveningController>();
export function acquireEveningController(account:string,storage:Storage,selection:EveningSelection){
 const key=account.toLowerCase(),existing=finishControllers.get(key);
 if(existing?.finishActive())return existing;
 const controller=new EveningController(account,storage,selection);finishControllers.set(key,controller);return controller;
}
export function releaseEveningController(account:string,controller:EveningController){
 if(!controller.finishActive())controller.dispose();if(!controller.finishActive()&&finishControllers.get(account.toLowerCase())===controller)finishControllers.delete(account.toLowerCase());
}

// Inspect device journals without making a hidden service read on an empty device.
// A malformed record still requires authenticated recovery; nothing is removed here.
export function hasStoredEveningWork(account:string,storage:Pick<Storage,'length'|'key'|'getItem'>){
 try{for(let i=0;i<storage.length;i++){const key=storage.key(i);if(!key||!key.startsWith('labula-evening-v1:')&&!key.startsWith('labula-finish-v1:'))continue;const entry=JSON.parse(storage.getItem(key)??'null');if(!entry||!entry.account)return true;if(entry.account.toLowerCase()===account.toLowerCase()&&entry.phase!=='complete')return true;}return false;}catch{return true;}
}
export function currentFinishReceipt(state:EveningState){const check=state.snapshot?.check,f=state.finish;return !!(check&&f?.phase==='complete'&&f.checkId===check.id&&check.stage==='confirmed'&&f.receipt?.version===check.version&&f.receipt.targetDay===check.targetDay&&f.command?.id===f.id&&f.receipt.actorId===state.snapshot?.accountId&&!state.pending.length&&!state.saving&&!state.error&&!state.unauthorized&&!state.recoveryBlocked);}
export function safeToCloseEvening(state:EveningState){return currentFinishReceipt(state)&&!state.deviceWorkPending&&!state.finishRecovery?.length;}
