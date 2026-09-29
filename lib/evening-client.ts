import {requestJson} from './request-json';
import {EVENING_BATCH_LIMIT,applyEveningDelta,mergeEveningSnapshot,type EveningBatchReply,type EveningDelta} from './evening-sync';
import {eveningCommandSchema,selectionQuery,type EveningCommand,type EveningSelection,type EveningSnapshot,type Availability} from './evening';

type Storage=Pick<globalThis.Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
type Requester=(url:string,init?:RequestInit)=>Promise<{res:Response;body:unknown}>;
export type PendingEvening={accountId:string;account:string;command:EveningCommand;created:number;sent:boolean;rejected:boolean};
export type SaveReceipt={accountId:string;command:EveningCommand};
export type EveningState={snapshot:EveningSnapshot|null;pending:PendingEvening[];loading:boolean;saving:boolean;error:string;unauthorized:boolean;notice:string;finishing?:boolean;finishPhase?:'saving'|'summary'|'publishing';errorKind?:'network'|'conflict'|'blocked';recoveryBlocked?:boolean;lastVerifiedAt?:number;freshnessError?:string;refreshing?:boolean;verifying?:'retry'|'manual'|'finality'|null;needsVerification?:boolean;sendingIds?:string[];requestedSelection?:string;loadedSelection?:string;conflictReview?:string|null;acknowledged?:Record<string,SaveReceipt>;settledSave?:SaveReceipt|null};
type Resolution={before:string[];next:PendingEvening[]};
const prefix='labula-evening-v1:';
export class EveningController {
 state:EveningState={snapshot:null,pending:[],loading:false,saving:false,error:'',unauthorized:false,notice:''};
 private listeners=new Set<()=>void>();private disposed=false;private busy=false;private polling=false;private snapshotSerial=0;private loadedRecovery=false;private accountId='';private deviceId=crypto.randomUUID();private sequence=0;private inflight:Promise<boolean>|null=null;private lastCreated=0;private actionSequence=0;private readEpoch=0;private intentEpoch=0;private readProof=new WeakMap<EveningSnapshot,{epoch:number;empty:boolean}>();private retryTimer:ReturnType<typeof setTimeout>|null=null;private retryCount=0;
 constructor(private account:string,private storage:Storage,private selection:EveningSelection,private request:Requester=requestJson,private fastSync=true){}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 getSnapshot=()=>this.state;
 private emit(patch:Partial<EveningState>){if(this.disposed)return;this.state={...this.state,...patch};for(const f of this.listeners)f();}
 private acceptSnapshot(snapshot:EveningSnapshot){this.snapshotSerial++;const proof=this.readProof.get(snapshot);this.emit({snapshot:mergeEveningSnapshot(this.state.snapshot,snapshot),loadedSelection:selectionQuery(this.selection),requestedSelection:selectionQuery(this.selection),lastVerifiedAt:Date.now(),freshnessError:'',conflictReview:null,...(proof?.empty&&proof.epoch===this.intentEpoch&&!this.state.pending.length?{needsVerification:false}:{})});}
 private refuse(reason:string){this.emit({notice:reason});return false;}
 cancelNavigation(){this.readEpoch++;this.emit({loading:false});}
 private conflictFingerprint(snapshot:EveningSnapshot,pending=this.state.pending){const check=snapshot.check;return JSON.stringify({id:check?.id,planRevision:check?.planRevision,notebookRevision:snapshot.notebookRevision,items:pending.filter(p=>p.rejected||p.command.kind==='answer'||p.command.kind==='ready').map(p=>{const c=p.command;if(c.kind==='answer'){const a=check?.answers.find(a=>a.itemId===c.itemId);return [c.itemId,a?.value,a?.revision,a?.mappingValid];}if(c.kind==='ready'){const t=check?.tasks.find(t=>t.itemId===c.itemId);return [c.itemId,t?.ready,t?.revision,t?.cancelled,t?.mappingValid];}return [c.kind];})});}
 dispose(){if(this.retryTimer)clearTimeout(this.retryTimer);this.disposed=true;this.listeners.clear();}
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
  this.emit({...entries.some(p=>p.command.kind==='ready')?{needsVerification:true}:{},pending:entries,recoveryBlocked:false,notice:entries.length?'Changes recovered on this device. Retry to confirm their saved state.':''});
 }
 async refresh(selection?:EveningSelection){
  if(this.disposed)return false;
  if(this.busy||this.state.verifying)return this.refuse('Please wait for the current save or verification before opening another date.');
  if(selection&&this.state.pending.length)return this.refuse('Changes are saved on this device. Retry or resolve them before opening another date.');
  const epoch=++this.readEpoch,current=()=>!this.disposed&&epoch===this.readEpoch,next=selection??this.selection;this.selection=next;this.snapshotSerial++;
  this.emit({loading:true,requestedSelection:selectionQuery(next),error:'',unauthorized:false,conflictReview:null,notice:''});
  try{
   const snapshot=await this.read(next,true,current);if(!current())return false;
   this.acceptSnapshot(snapshot);try{this.restore();}catch(e){this.emit({recoveryBlocked:true,errorKind:'blocked'});throw e;}
   if(this.state.pending.length){const first=this.state.pending[0].command,day=first.kind==='start'?first.day:first.checkId;if(snapshot.check?.id!==day){this.selection={day};this.emit({requestedSelection:selectionQuery(this.selection)});const recovered=await this.read(this.selection,true,current);if(!current())return false;this.acceptSnapshot(recovered);this.emit({notice:`Recovered changes for the ${day} check. Resolve them before opening another date.`});}}
   if(this.state.pending[0]?.rejected&&this.state.snapshot)this.emit({conflictReview:this.conflictFingerprint(this.state.snapshot)});
   return true;
  }catch(e){if(current())this.emit({error:e instanceof Error?e.message:'Could not load the shared check.'});return false;}finally{if(current())this.emit({loading:false});}
 }
 // Background reads never replace an accepted local intent or a newer save response.
 async refreshVisible(){
  if(this.state.loading||this.state.verifying)return false;
  if(this.fastSync&&this.state.snapshot?.sync)return this.syncVisible();
  if(this.disposed||this.busy||this.polling||this.state.pending.length||this.state.error||this.state.recoveryBlocked)return false;
  this.polling=true;const serial=this.snapshotSerial,selected=JSON.stringify(this.selection),current=()=>!this.disposed&&!this.busy&&!this.state.pending.length&&serial===this.snapshotSerial&&selected===JSON.stringify(this.selection);this.emit({refreshing:true});
  try{const snapshot=await this.read(this.selection,false,current);if(!current())return false;this.acceptSnapshot(snapshot);return true;}
  catch(e){if(!this.disposed&&!this.busy&&!this.state.pending.length&&serial===this.snapshotSerial)this.emit({freshnessError:e instanceof Error?e.message:'Could not refresh the shared check.'});return false;}
  finally{this.polling=false;this.emit({refreshing:false});}
 }
 async syncVisible(force=false){
  if(this.disposed||this.state.loading||this.state.unauthorized||!this.state.snapshot?.sync||this.state.loadedSelection&&this.state.loadedSelection!==selectionQuery(this.selection))return false;
  if(this.polling){if(!force)return false;while(this.polling&&!this.disposed)await new Promise(r=>setTimeout(r,10));if(this.disposed)return false;}
  this.polling=true;const readEpoch=this.readEpoch,selected=JSON.stringify(this.selection),accountId=this.accountId,current=()=>!this.disposed&&readEpoch===this.readEpoch&&selected===JSON.stringify(this.selection)&&accountId===this.accountId,proof={epoch:this.intentEpoch,empty:!this.state.pending.length};this.emit({refreshing:true});
  try{for(let page=0;page<100;page++){
   const snapshot:EveningSnapshot=this.state.snapshot!;
   const {res,body}=await this.request('/api/evening/sync?'+selectionQuery(this.selection)+'&cursor='+encodeURIComponent(snapshot.sync!.cursor),{cache:'no-store'});
   if(!current())return false;
   if(!res.ok){if(res.status===401||res.status===403)this.emit({unauthorized:true,errorKind:'blocked'});throw Error((body as {error?:string}).error??'Shared changes could not be refreshed.');}
   const delta=body as EveningDelta;
   if(delta.accountId!==this.accountId||delta.account.toLowerCase()!==this.account.toLowerCase())throw Error('The signed-in account changed. Sign in again.');
   // A full read or structural write completed while this read was in flight. Start at its new cursor.
   if(snapshot.sync!.cursor!==this.state.snapshot?.sync?.cursor)continue;
   if(delta.reset||delta.check?.id!==this.state.snapshot?.check?.id){const fresh=await this.read(this.selection,true,current);if(!current())return false;this.acceptSnapshot(fresh);return true;}
   const updated=applyEveningDelta(this.state.snapshot!,delta);this.emit({snapshot:updated,lastVerifiedAt:Date.now(),freshnessError:'',...(this.state.pending.some(p=>p.rejected)?{conflictReview:this.conflictFingerprint(updated)}:{})});
   if(!delta.more){if(proof.empty&&proof.epoch===this.intentEpoch&&!this.state.pending.length)this.emit({needsVerification:false});return true;}
  }throw Error('More shared changes are waiting. Refresh to continue safely.');}
  catch(e){if(current())this.emit({freshnessError:e instanceof Error?e.message:'Could not refresh shared changes.'});return false;}
  finally{this.polling=false;this.emit({refreshing:false});}
 }
 private async sendBatch(){
  const blocked=new Set<string>(),batch:PendingEvening[]=[];
  for(const p of this.state.pending){const c=p.command;if(c.kind!=='answer'&&c.kind!=='ready')break;if(p.rejected){blocked.add(c.itemId);continue;}if(blocked.has(c.itemId))continue;if(batch.length&&c.checkId!==(batch[0].command as Extract<EveningCommand,{kind:'answer'}>).checkId)break;batch.push({...p,sent:true});if(batch.length===EVENING_BATCH_LIMIT)break;}
  if(!batch.length)throw Error('Review the conflicting change before continuing.');
  for(const p of batch)this.persist(p);
  const sentIds=new Set(batch.map(p=>p.command.id));this.emit({sendingIds:[...sentIds],pending:this.state.pending.map(p=>sentIds.has(p.command.id)?{...p,sent:true}:p)});
  const {res,body}=await this.request('/api/evening/batch',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify({commands:batch.map(p=>p.command)})}).catch(e=>{if(!this.state.recoveryBlocked&&!this.state.unauthorized)this.emit({errorKind:'network'});throw e;});
  if(this.disposed)return null;
  if(!res.ok){this.emit({unauthorized:res.status===401||res.status===403,errorKind:res.status===401||res.status===403?'blocked':'network'});throw Error((body as {error?:string}).error??'Could not confirm these changes. Retry safely.');}
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
 async action(command:EveningCommand){if(this.disposed)return false;if(this.busy||this.state.loading||this.state.verifying||this.state.pending.length||this.state.error||this.state.recoveryBlocked||this.state.finishing&&command.kind!=='confirm')return this.refuse(this.state.pending.length?'Save or resolve the waiting changes before this action.':this.state.error||this.state.recoveryBlocked?'Resolve the connection or storage issue before this action.':'Please wait for the current step to finish.');if(command.kind==='confirm')this.emit({finishPhase:'publishing'});if(!this.enqueue(command))return false;return this.inflight??false;}
 private scheduleRetry(){if(this.retryTimer||this.retryCount>=3||this.disposed||this.state.unauthorized||!this.state.pending.length)return;const delay=2000*2**this.retryCount++;this.retryTimer=setTimeout(()=>{this.retryTimer=null;void this.retry(false);},delay);}
 private runnable(){const blocked=new Set<string>();for(let i=0;i<this.state.pending.length;i++){const p=this.state.pending[i],c=p.command;if(p.rejected){if(c.kind!=='ready'&&c.kind!=='answer')return -1;blocked.add(c.itemId);continue;}if((c.kind==='ready'||c.kind==='answer')&&blocked.has(c.itemId))continue;return i;}return -1;}
 private drain():Promise<boolean>{if(this.inflight)return this.inflight;if(this.disposed||this.busy||this.state.recoveryBlocked||!this.state.pending.length||this.runnable()<0)return Promise.resolve(false);this.inflight=this.run().finally(()=>{this.inflight=null;});return this.inflight;}
 private async run(){let lastReceipt:SaveReceipt|null=null;let succeeded=false;this.busy=true;this.emit({saving:true,...(this.state.pending.some(p=>p.rejected)?{}:{error:'',errorKind:undefined}),unauthorized:false});try{
  while(this.state.pending.length&&!this.disposed){const index=this.runnable();if(index<0)return false;let p=this.state.pending[index];
   if(this.fastSync&&this.state.snapshot?.sync&&(p.command.kind==='answer'||p.command.kind==='ready')){const receipt=await this.sendBatch();if(receipt)lastReceipt=receipt;continue;}
   if(!p.sent){p={...p,sent:true};this.persist(p);this.emit({pending:this.state.pending.map(x=>x.command.id===p.command.id?p:x)});}
   this.emit({sendingIds:[p.command.id]});
   const {res,body}=await this.request('/api/evening',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(p.command)}).catch(error=>{if(!this.state.recoveryBlocked&&!this.state.unauthorized)this.emit({errorKind:'network'});throw error;});
   if(this.disposed)return false;
   const reply=body as {operationId?:string;snapshot?:EveningSnapshot;error?:string};
   if(!res.ok){if(res.status===409||res.status===400||res.status===404){const rejected={...p,rejected:true};this.persist(rejected);this.emit({pending:this.state.pending.map(x=>x.command.id===p.command.id?rejected:x),conflictReview:null,errorKind:'conflict'});try{const latest=await this.read();if(this.disposed)return false;this.acceptSnapshot(latest);this.emit({conflictReview:this.conflictFingerprint(latest)});}catch{this.emit({conflictReview:null});}}this.emit({unauthorized:res.status===401||res.status===403,errorKind:res.status===401||res.status===403?'blocked':res.status>=500?'network':'conflict',error:reply.error??'Could not confirm this save. Retry safely.'});if(p.command.kind==='ready'&&[400,404,409].includes(res.status))continue;throw Error(reply.error??'Could not confirm this save. Retry safely.');}
   if(reply.operationId!==p.command.id||!reply.snapshot||reply.snapshot.check?.id!==(p.command.kind==='start'?p.command.day:p.command.checkId))throw Error('The save response was incomplete. Retry to check its result.');
   this.verify(reply.snapshot);if(this.fastSync)this.selection={day:reply.snapshot.check!.id};try{this.storage.removeItem(this.key(p));}catch{this.emit({errorKind:'blocked',recoveryBlocked:true});throw Error('The save succeeded, but its local receipt could not be cleared. Free device storage and retry safely.');}this.acceptSnapshot(reply.snapshot);// Receipts are memory-only presentation signals, never restored from a snapshot or recovery journal.
   const receipt={accountId:this.accountId,command:p.command};lastReceipt=receipt;
   const key=p.command.kind+('itemId' in p.command?':'+p.command.itemId:'');
   const acknowledged=Object.fromEntries(Object.entries(this.state.acknowledged??{}).filter(([,r])=>r.accountId===this.accountId&&'checkId' in r.command&&r.command.checkId===reply.snapshot!.check!.id));
   this.emit({pending:this.state.pending.filter(x=>x.command.id!==p.command.id),acknowledged:{...acknowledged,[key]:receipt}});
   if(this.state.pending.some(x=>x.rejected))this.emit({conflictReview:this.conflictFingerprint(reply.snapshot)});
  }
  succeeded=!this.disposed;this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}this.emit({notice:'Shared changes saved.',error:'',errorKind:undefined});return succeeded;
 }catch(e){this.emit({errorKind:this.state.errorKind??'network',error:e instanceof Error?e.message:'Connection failed. Changes are kept on this device.'});if(this.state.errorKind==='network')this.scheduleRetry();return false;}finally{this.busy=false;this.emit({saving:false,sendingIds:[],...(succeeded&&(!this.fastSync||!this.state.snapshot?.sync)?{needsVerification:false}:{}),...(succeeded?{settledSave:lastReceipt}:{})});if(succeeded&&this.state.needsVerification&&!this.state.verifying&&this.visibleCheck()?.tasks.filter(t=>!t.cancelled).every(t=>t.ready&&t.mappingValid))queueMicrotask(()=>void this.verifyMorning());}}
 async retry(manual=true,mode:'retry'|'manual'='retry'){
  if(manual){this.retryCount=0;if(this.retryTimer){clearTimeout(this.retryTimer);this.retryTimer=null;}}
  if(this.disposed)return false;if(this.busy||this.state.loading||this.state.verifying)return this.refuse('A save or verification is already in progress. Your changes stay on this device.');
  this.busy=true;this.emit({verifying:mode,error:'',errorKind:undefined,unauthorized:false,notice:''});let verified=false;
  try{const snapshot=await this.read();if(this.disposed)return false;this.acceptSnapshot(snapshot);if(this.state.recoveryBlocked||!this.loadedRecovery){this.loadedRecovery=false;this.restore();}if(this.state.pending[0]?.rejected)this.emit({conflictReview:this.conflictFingerprint(snapshot)});verified=true;}
  catch(e){this.emit({errorKind:this.state.unauthorized?'blocked':'network',error:e instanceof Error?e.message:'Sign in and retry.'});if(!this.state.unauthorized)this.scheduleRetry();}finally{this.busy=false;}
  try{if(!verified)return false;if(this.state.pending.length&&!await this.drain())return false;if(this.state.needsVerification){if(this.fastSync&&this.state.snapshot?.sync)return await this.syncVisible(true);const snapshot=await this.read();this.acceptSnapshot(snapshot);}return true;}
  finally{this.emit({verifying:null});}
 }
 userRefresh(){return this.retry(true,'manual');}
 private async verifyMorning(){
  if(this.disposed||this.state.pending.length||this.state.verifying||this.state.loading)return;
  this.emit({verifying:'finality'});try{if(this.fastSync&&this.state.snapshot?.sync)await this.syncVisible(true);}finally{this.emit({verifying:null});}
 }
 async flush(){if(this.state.error||this.state.recoveryBlocked||this.state.pending.some(p=>p.rejected))return false;if(this.inflight&&!await this.inflight)return false;if(this.state.pending.length&&!await this.drain())return false;return this.state.pending.length===0&&!this.busy&&!this.state.error;}
 async summary(){
  if(this.disposed)return null;if(this.state.finishing||this.state.loading||this.state.verifying){this.refuse('Please wait for the current verification before finishing.');return null;}this.emit({finishing:true,finishPhase:'saving'});let complete=false;
  try{if(!await this.flush()){this.refuse('Finish needs all waiting changes saved. Retry or review the changes below.');return null;}this.emit({finishPhase:'summary'});if(this.fastSync&&this.state.snapshot?.sync){if(!await this.syncVisible(true))return null;}else if(!await this.refresh())return null;complete=this.state.pending.length===0&&!!this.state.snapshot?.check&&!this.disposed;return complete?this.state.snapshot:null;}
  finally{if(!complete)this.endFinish();}
 }
 endFinish(){this.emit({finishing:false,finishPhase:undefined});}

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
  if(keep.some(p=>p.command.kind!==kind||!check||p.command.kind==='start'||p.command.checkId!==check.id)||(kind==='answer'&&keep.length&&check?.stage!=='draft')){this.emit({error:'The check changed. Keep the shared result and review the check before making new changes.'});return false;}
  // A fresh fetch cannot silently expand the user's approval to a different shared result.
  const revisions=new Map(kind==='ready'?check?.tasks.filter(t=>!t.cancelled&&t.mappingValid).map(t=>[t.itemId,t.revision]):check?.answers.map(a=>[a.itemId,a.revision]));
  if(keep.some(p=>!('itemId' in p.command)||!revisions.has(p.command.itemId))){this.emit({error:'A listed item is no longer available. Keep the shared result and use Correct check to resolve its link.'});return false;}
  const next:PendingEvening[]=keep.map(p=>{
   const c=p.command as Extract<EveningCommand,{kind:'answer'|'ready'}>,revision=revisions.get(c.itemId)!;revisions.set(c.itemId,revision+1);
   return {...p,sent:false,rejected:false,command:{...c,id:crypto.randomUUID(),revision,meta:{occurredAt:new Date().toISOString(),sessionId:this.deviceId,sequence:++this.actionSequence,supersedesCommandId:c.id},...(c.kind==='answer'?{generation:check!.version}:{})}};
  });
  const journal:Resolution={before:before.map(p=>p.command.id),next};
  try{this.storage.setItem(this.accountPrefix()+'resolution:'+crypto.randomUUID(),JSON.stringify(journal));this.finishResolutions();}
  catch{this.emit({recoveryBlocked:true,error:'Could not finish saving the reviewed recovery. Your changes are kept. Free device storage, then retry.'});return false;}
  this.emit({pending:next,error:'',errorKind:undefined,notice:useLocal?'Your reviewed changes will be saved.':'Shared result kept.'});return next.length?this.drain():true;
 }
}

export function visibleEveningCheck(state:EveningState){
 const check=state.snapshot?.check;if(!check)return null;const copy=structuredClone(check);
 for(const p of state.pending){const c=p.command;if(c.kind==='answer'&&c.checkId===copy.id){const a=copy.answers.find(a=>a.itemId===c.itemId);if(a){a.value=c.value;a.revision=c.revision+1;}}
  if(c.kind==='ready'&&c.checkId===copy.id){const t=copy.tasks.find(t=>t.itemId===c.itemId);if(t&&!t.cancelled&&t.mappingValid){t.ready=c.value;t.revision=c.revision+1;}}
 }return copy;
}
export function morningProgress(state:EveningState,now=Date.now()){const check=visibleEveningCheck(state),tasks=check?.version?check.tasks.filter(t=>!t.cancelled):[],rejected=new Set(state.pending.flatMap(p=>p.rejected&&p.command.kind==='ready'&&p.command.checkId===check?.id?[p.command.itemId]:[])),ready=tasks.filter(t=>t.ready&&t.mappingValid&&!rejected.has(t.itemId)).length;return {tasks,ready,remaining:tasks.length-ready,complete:tasks.length>0&&ready===tasks.length&&!state.loading&&!state.verifying&&!state.needsVerification&&!state.saving&&!state.pending.length&&!state.error&&!state.unauthorized&&!state.recoveryBlocked&&!state.freshnessError&&!!state.lastVerifiedAt&&now-state.lastVerifiedAt<75000};}

export function readyBlocked(state:EveningState,itemId:string){const check=state.snapshot?.check;return !check||check.version<1||state.finishing||state.loading||state.unauthorized||state.recoveryBlocked||!!state.error&&state.errorKind!=='network'&&state.errorKind!=='conflict'||state.pending.some(p=>p.command.kind!=='ready'||p.command.checkId!==check.id||p.rejected&&p.command.itemId===itemId);}

export function answerBlocked(state:EveningState,itemId:string){const check=state.snapshot?.check;return !check||state.finishing||state.loading||state.unauthorized||state.recoveryBlocked||!!state.error&&state.errorKind!=='network'&&state.errorKind!=='conflict'||state.pending.some(p=>p.command.kind!=='answer'||p.command.checkId!==check.id||p.rejected&&p.command.itemId===itemId);}
