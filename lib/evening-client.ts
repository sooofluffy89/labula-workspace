import {requestJson} from './request-json';
import {eveningCommandSchema,selectionQuery,type EveningCommand,type EveningSelection,type EveningSnapshot,type Availability} from './evening';

type Storage=Pick<globalThis.Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
type Requester=(url:string,init?:RequestInit)=>Promise<{res:Response;body:unknown}>;
export type PendingEvening={accountId:string;account:string;command:EveningCommand;created:number;sent:boolean;rejected:boolean};
export type EveningState={snapshot:EveningSnapshot|null;pending:PendingEvening[];loading:boolean;saving:boolean;error:string;unauthorized:boolean;notice:string;recoveryBlocked?:boolean;lastVerifiedAt?:number;freshnessError?:string;refreshing?:boolean;conflictReview?:string|null};
type Resolution={before:string[];next:PendingEvening[]};
const prefix='labula-evening-v1:';
export class EveningController {
 state:EveningState={snapshot:null,pending:[],loading:false,saving:false,error:'',unauthorized:false,notice:''};
 private listeners=new Set<()=>void>();private disposed=false;private busy=false;private polling=false;private snapshotSerial=0;private loadedRecovery=false;private accountId='';private deviceId=crypto.randomUUID();private sequence=0;private inflight:Promise<boolean>|null=null;private lastCreated=0;private actionSequence=0;
 constructor(private account:string,private storage:Storage,private selection:EveningSelection,private request:Requester=requestJson){}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 getSnapshot=()=>this.state;
 private emit(patch:Partial<EveningState>){if(this.disposed)return;this.state={...this.state,...patch};for(const f of this.listeners)f();}
 private acceptSnapshot(snapshot:EveningSnapshot){this.snapshotSerial++;this.emit({snapshot,lastVerifiedAt:Date.now(),freshnessError:'',conflictReview:null});}
 private conflictFingerprint(snapshot:EveningSnapshot,pending=this.state.pending){const check=snapshot.check;return JSON.stringify({id:check?.id,planRevision:check?.planRevision,notebookRevision:snapshot.notebookRevision,items:pending.filter(p=>p.rejected||p.command.kind==='answer'||p.command.kind==='ready').map(p=>{const c=p.command;if(c.kind==='answer'){const a=check?.answers.find(a=>a.itemId===c.itemId);return [c.itemId,a?.value,a?.revision,a?.mappingValid];}if(c.kind==='ready'){const t=check?.tasks.find(t=>t.itemId===c.itemId);return [c.itemId,t?.ready,t?.revision,t?.cancelled,t?.mappingValid];}return [c.kind];})});}
 dispose(){this.disposed=true;this.listeners.clear();}
 private accountPrefix(){return prefix+encodeURIComponent(this.accountId)+':kitchen:';}
 private key(p:PendingEvening){return this.accountPrefix()+p.command.id;}
 private persist(p:PendingEvening){this.storage.setItem(this.key(p),JSON.stringify(p));}
 private verify(snapshot:EveningSnapshot){if(!snapshot||snapshot.scope!=='kitchen'||snapshot.account.toLowerCase()!==this.account.toLowerCase()||(this.accountId&&snapshot.accountId!==this.accountId)){this.emit({unauthorized:true});throw Error('The signed-in account changed. Return to the original account before retrying.');}this.accountId=snapshot.accountId;}
 private async read(selection=this.selection,reportAuth=true){const {res,body}=await this.request('/api/evening?'+selectionQuery(selection),{cache:'no-store'});if(!res.ok){if(reportAuth)this.emit({unauthorized:res.status===401||res.status===403});throw Error((body as {error?:string}).error??'Could not load the shared check.');}const snap=body as EveningSnapshot;this.verify(snap);return snap;}
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
  this.lastCreated=Math.max(this.lastCreated,...entries.map(p=>p.created));this.loadedRecovery=true;
  this.emit({pending:entries,recoveryBlocked:false,notice:entries.length?'Changes recovered on this device. Retry to confirm their saved state.':''});
 }
 async refresh(selection?:EveningSelection){
  if(this.busy||this.disposed)return false;
  if(selection&&this.state.pending.length){this.emit({error:'Resolve the saved-on-device changes before opening another date.'});return false;}
  this.busy=true;this.emit({loading:true,error:'',unauthorized:false,conflictReview:null});
  try{
   const next=selection??this.selection,snapshot=await this.read(next);if(this.disposed)return false;
   this.selection=next;this.acceptSnapshot(snapshot);this.restore();
   if(this.state.pending.length){const first=this.state.pending[0].command,day=first.kind==='start'?first.day:first.checkId;if(snapshot.check?.id!==day){this.selection={day};const recovered=await this.read(this.selection);if(this.disposed)return false;this.acceptSnapshot(recovered);this.emit({notice:`Recovered changes for the ${day} check. Resolve them before opening another date.`});}}
   if(this.state.pending[0]?.rejected&&this.state.snapshot)this.emit({conflictReview:this.conflictFingerprint(this.state.snapshot)});
   return true;
  }catch(e){this.emit({error:e instanceof Error?e.message:'Could not load the shared check.'});return false;}finally{this.busy=false;this.emit({loading:false});}
 }
 // Background reads never replace an accepted local intent or a newer save response.
 async refreshVisible(){
  if(this.disposed||this.busy||this.polling||this.state.pending.length||this.state.error||this.state.recoveryBlocked)return false;
  this.polling=true;const serial=this.snapshotSerial,selected=JSON.stringify(this.selection);this.emit({refreshing:true});
  try{const snapshot=await this.read(this.selection,false);if(this.disposed||this.busy||this.state.pending.length||serial!==this.snapshotSerial||selected!==JSON.stringify(this.selection))return false;this.acceptSnapshot(snapshot);return true;}
  catch(e){if(!this.disposed&&!this.busy&&!this.state.pending.length&&serial===this.snapshotSerial)this.emit({freshnessError:e instanceof Error?e.message:'Could not refresh the shared check.'});return false;}
  finally{this.polling=false;this.emit({refreshing:false});}
 }
 // Shared snapshots remain authoritative; pending intents are a separate visible overlay.
 visibleCheck(){return visibleEveningCheck(this.state);}
 private enqueue(input:EveningCommand){
  const command={...input,actorId:this.accountId,meta:input.meta??{occurredAt:new Date().toISOString(),sessionId:this.deviceId,sequence:++this.actionSequence}};if(this.disposed||!this.state.snapshot)return false;
  if(this.state.pending.length>=500){this.emit({error:'Too many changes are waiting to sync. Retry before adding more.'});return false;}
  // Millisecond ties must not reorder rapid Ready/Undo on reload (legacy records still load).
  const created=Math.max(Date.now(),this.lastCreated+1);const p:PendingEvening={accountId:this.accountId,account:this.account,command,created,sent:false,rejected:false};
  try{this.persist(p);}catch{this.emit({error:'This browser cannot keep a recovery copy. No change was accepted. Free device storage or use another browser.'});return false;}
  this.lastCreated=created;this.emit({pending:[...this.state.pending,p],notice:'',error:''});void this.drain();return true;
 }
 answer(itemId:string,value:Availability){const check=this.visibleCheck();if(!check||check.stage!=='draft'||this.state.loading||this.state.error||this.state.recoveryBlocked||this.state.pending.some(p=>p.rejected||p.command.kind!=='answer'))return false;const a=check.answers.find(a=>a.itemId===itemId);if(!a||a.value===value)return !!a;return this.enqueue({id:crypto.randomUUID(),scope:'kitchen',actorId:this.accountId,kind:'answer',checkId:check.id,itemId,revision:a.revision,generation:check.version,value,deviceId:this.deviceId,sequence:++this.sequence});}
 ready(itemId:string,value:boolean){
  const check=this.visibleCheck();
  if(!check||check.version<1||this.state.loading||this.state.error||this.state.unauthorized||this.state.recoveryBlocked||this.state.pending.some(p=>p.rejected||p.command.kind!=='ready'||p.command.checkId!==check.id))return false;
  const task=check.tasks.find(t=>t.itemId===itemId&&!t.cancelled&&t.mappingValid);if(!task)return false;if(task.ready===value)return true;
  return this.enqueue({id:crypto.randomUUID(),scope:'kitchen',actorId:this.accountId,kind:'ready',checkId:check.id,itemId,revision:task.revision,value});
 }
 toggleReady(itemId:string){const task=this.visibleCheck()?.tasks.find(t=>t.itemId===itemId);return task?this.ready(itemId,!task.ready):false;}
 async action(command:EveningCommand){if(this.busy||this.state.pending.length||this.disposed||this.state.error||this.state.recoveryBlocked)return false;if(!this.enqueue(command))return false;return this.inflight??false;}
 private drain():Promise<boolean>{if(this.inflight)return this.inflight;if(this.disposed||this.busy||this.state.recoveryBlocked||!this.state.pending.length||this.state.pending[0].rejected)return Promise.resolve(false);this.inflight=this.run().finally(()=>{this.inflight=null;});return this.inflight;}
 private async run(){this.busy=true;this.emit({saving:true,error:'',unauthorized:false});try{
  while(this.state.pending.length&&!this.disposed){let p=this.state.pending[0];if(p.rejected)return false;
   if(!p.sent){p={...p,sent:true};this.persist(p);this.emit({pending:[p,...this.state.pending.slice(1)]});}
   const {res,body}=await this.request('/api/evening',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(p.command)});
   if(this.disposed)return false;
   const reply=body as {operationId?:string;snapshot?:EveningSnapshot;error?:string};
   if(!res.ok){if(res.status===409||res.status===400||res.status===404){const rejected={...p,rejected:true};this.persist(rejected);this.emit({pending:[rejected,...this.state.pending.slice(1)],conflictReview:null});try{const latest=await this.read();if(this.disposed)return false;this.acceptSnapshot(latest);this.emit({conflictReview:this.conflictFingerprint(latest)});}catch{this.emit({conflictReview:null});}}this.emit({unauthorized:res.status===401||res.status===403});throw Error(reply.error??'Could not confirm this save. Retry safely.');}
   if(reply.operationId!==p.command.id||!reply.snapshot||reply.snapshot.check?.id!==(p.command.kind==='start'?p.command.day:p.command.checkId))throw Error('The save response was incomplete. Retry to check its result.');
   this.verify(reply.snapshot);this.storage.removeItem(this.key(p));this.acceptSnapshot(reply.snapshot);this.emit({pending:this.state.pending.slice(1)});
  }
  this.emit({notice:'Shared changes saved.'});return !this.disposed;
 }catch(e){this.emit({error:e instanceof Error?e.message:'Connection failed. Changes are kept on this device.'});return false;}finally{this.busy=false;this.emit({saving:false});}}
 async retry(){
  if(this.busy||this.disposed)return false;this.busy=true;this.emit({loading:true,error:'',unauthorized:false});let verified=false;
  try{const snapshot=await this.read();if(this.disposed)return false;this.acceptSnapshot(snapshot);if(this.state.recoveryBlocked||!this.loadedRecovery){this.loadedRecovery=false;this.restore();}if(this.state.pending[0]?.rejected)this.emit({conflictReview:this.conflictFingerprint(snapshot)});verified=true;}
  catch(e){this.emit({error:e instanceof Error?e.message:'Sign in and retry.'});}finally{this.busy=false;this.emit({loading:false});}
  return verified?(this.state.pending.length?this.drain():true):false;
 }
 async flush(){if(this.state.error||this.state.recoveryBlocked||this.state.pending.some(p=>p.rejected))return false;if(this.inflight&&!await this.inflight)return false;if(this.state.pending.length&&!await this.drain())return false;return this.state.pending.length===0&&!this.busy&&!this.state.error;}
 async summary(){if(!await this.flush())return null;if(!await this.refresh())return null;return this.state.pending.length===0?this.state.snapshot:null;}
 async resolveRejected(useLocal:boolean){
  if(this.busy||this.state.recoveryBlocked||!this.state.pending[0]?.rejected)return false;
  const before=this.state.pending,reviewedFingerprint=this.state.conflictReview;if(before.slice(1).some(p=>p.sent))return false;
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
  this.emit({pending:next,error:'',notice:useLocal?'Your reviewed changes will be saved.':'Shared result kept.'});return next.length?this.drain():true;
 }
}

export function visibleEveningCheck(state:EveningState){
 const check=state.snapshot?.check;if(!check)return null;const copy=structuredClone(check);
 for(const p of state.pending){const c=p.command;if(c.kind==='answer'&&c.checkId===copy.id){const a=copy.answers.find(a=>a.itemId===c.itemId);if(a){a.value=c.value;a.revision=c.revision+1;}}
  if(c.kind==='ready'&&c.checkId===copy.id){const t=copy.tasks.find(t=>t.itemId===c.itemId);if(t&&!t.cancelled&&t.mappingValid){t.ready=c.value;t.revision=c.revision+1;}}
 }return copy;
}
export function morningProgress(state:EveningState,now=Date.now()){const check=visibleEveningCheck(state),tasks=check?.version?check.tasks.filter(t=>!t.cancelled):[],ready=tasks.filter(t=>t.ready&&t.mappingValid).length;return {tasks,ready,remaining:tasks.length-ready,complete:tasks.length>0&&ready===tasks.length&&!state.loading&&!state.saving&&!state.pending.length&&!state.error&&!state.unauthorized&&!state.recoveryBlocked&&!state.freshnessError&&!!state.lastVerifiedAt&&now-state.lastVerifiedAt<75000};}
