import {requestJson} from './request-json';
import {eveningCommandSchema,selectionQuery,type EveningCommand,type EveningSelection,type EveningSnapshot,type Availability} from './evening';

type Storage=Pick<globalThis.Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
type Requester=(url:string,init?:RequestInit)=>Promise<{res:Response;body:unknown}>;
export type PendingEvening={accountId:string;account:string;command:EveningCommand;created:number;sent:boolean;rejected:boolean};
export type EveningState={snapshot:EveningSnapshot|null;pending:PendingEvening[];loading:boolean;saving:boolean;error:string;unauthorized:boolean;notice:string};
const prefix='labula-evening-v1:';
export class EveningController {
 state:EveningState={snapshot:null,pending:[],loading:false,saving:false,error:'',unauthorized:false,notice:''};
 private listeners=new Set<()=>void>();private disposed=false;private busy=false;private loadedRecovery=false;private accountId='';private deviceId=crypto.randomUUID();private sequence=0;private inflight:Promise<boolean>|null=null;
 constructor(private account:string,private storage:Storage,private selection:EveningSelection,private request:Requester=requestJson){}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 getSnapshot=()=>this.state;
 private emit(patch:Partial<EveningState>){if(this.disposed)return;this.state={...this.state,...patch};for(const f of this.listeners)f();}
 dispose(){this.disposed=true;this.listeners.clear();}
 private key(p:PendingEvening){return prefix+encodeURIComponent(p.accountId)+':kitchen:'+p.command.id;}
 private persist(p:PendingEvening){this.storage.setItem(this.key(p),JSON.stringify(p));}
 private verify(snapshot:EveningSnapshot){if(!snapshot||snapshot.scope!=='kitchen'||snapshot.account.toLowerCase()!==this.account.toLowerCase()||(this.accountId&&snapshot.accountId!==this.accountId)){this.emit({unauthorized:true});throw Error('The signed-in account changed. Return to the original account before retrying.');}this.accountId=snapshot.accountId;}
 private async read(selection=this.selection){const {res,body}=await this.request('/api/evening?'+selectionQuery(selection),{cache:'no-store'});if(!res.ok){this.emit({unauthorized:res.status===401||res.status===403});throw Error((body as {error?:string}).error??'Could not load the shared check.');}const snap=body as EveningSnapshot;this.verify(snap);return snap;}
 private restore(){if(this.loadedRecovery)return;const entries:PendingEvening[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(!key?.startsWith(prefix+encodeURIComponent(this.accountId)+':kitchen:'))continue;const p=JSON.parse(this.storage.getItem(key)! ) as PendingEvening;if(p.accountId!==this.accountId||p.account.toLowerCase()!==this.account.toLowerCase())continue;eveningCommandSchema.parse(p.command);entries.push(p);}entries.sort((a,b)=>a.created-b.created||(a.command.kind==='answer'&&b.command.kind==='answer'&&a.command.deviceId===b.command.deviceId?a.command.sequence-b.command.sequence:a.command.id.localeCompare(b.command.id)));this.loadedRecovery=true;this.emit({pending:entries,notice:entries.length?'Answers are kept on this device. Retry to confirm their saved state.':''});}
 async refresh(selection?:EveningSelection){if(this.busy||this.disposed)return false;if(selection&&this.state.pending.length){this.emit({error:'Resolve the saved-on-device changes before opening another date.'});return false;}this.busy=true;this.emit({loading:true,error:'',unauthorized:false});try{const next=selection??this.selection,snapshot=await this.read(next);if(this.disposed)return false;this.selection=next;this.emit({snapshot});this.restore();if(this.state.pending.length){const first=this.state.pending[0].command,day=first.kind==='start'?first.day:first.checkId;if(snapshot.check?.id!==day){this.selection={day};this.emit({snapshot:await this.read(this.selection)});}}return true;}catch(e){this.emit({error:e instanceof Error?e.message:'Could not load the shared check.'});return false;}finally{this.busy=false;this.emit({loading:false});}}
 // The shared state is never mutated optimistically: queued intents are a separate visible overlay.
 visibleCheck(){return visibleEveningCheck(this.state);}
 private enqueue(input:EveningCommand){const command={...input,actorId:this.accountId};if(this.disposed||!this.state.snapshot||this.state.pending.length>=500)return false;const p:PendingEvening={accountId:this.accountId,account:this.account,command,created:Date.now(),sent:false,rejected:false};try{this.persist(p);}catch{this.emit({error:'This browser cannot keep a recovery copy. No change was accepted. Free device storage or use another browser.'});return false;}this.emit({pending:[...this.state.pending,p],notice:'',error:''});void this.drain();return true;}
 answer(itemId:string,value:Availability){const check=this.visibleCheck();if(!check||check.stage!=='draft'||this.state.loading||this.state.error||this.state.pending.some(p=>p.rejected||p.command.kind!=='answer'))return false;const a=check.answers.find(a=>a.itemId===itemId);if(!a||a.value===value)return !!a;return this.enqueue({id:crypto.randomUUID(),scope:'kitchen',actorId:this.accountId,kind:'answer',checkId:check.id,itemId,revision:a.revision,generation:check.version,value,deviceId:this.deviceId,sequence:++this.sequence});}
 async action(command:EveningCommand){if(this.busy||this.state.pending.length||this.disposed||this.state.error)return false;if(!this.enqueue(command))return false;return this.inflight??false;}
 private drain():Promise<boolean>{if(this.inflight)return this.inflight;if(this.disposed||this.busy||!this.state.pending.length||this.state.pending[0].rejected)return Promise.resolve(false);this.inflight=this.run().finally(()=>{this.inflight=null;});return this.inflight;}
 private async run(){this.busy=true;this.emit({saving:true,error:'',unauthorized:false});try{
  while(this.state.pending.length&&!this.disposed){let p=this.state.pending[0];if(p.rejected)return false;
   // Mark sent durably before fetch. Its ID/content are immutable from this point.
   if(!p.sent){p={...p,sent:true};this.persist(p);this.emit({pending:[p,...this.state.pending.slice(1)]});}
   const {res,body}=await this.request('/api/evening',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(p.command)});
   if(this.disposed)return false;
   const reply=body as {operationId?:string;snapshot?:EveningSnapshot;error?:string};
   if(!res.ok){if(res.status===409||res.status===400||res.status===404){const rejected={...p,rejected:true};this.persist(rejected);this.emit({pending:[rejected,...this.state.pending.slice(1)]});}this.emit({unauthorized:res.status===401||res.status===403});throw Error(reply.error??'Could not confirm this save. Retry safely.');}
   if(reply.operationId!==p.command.id||!reply.snapshot)throw Error('The save response was incomplete. Retry to check its result.');
   this.verify(reply.snapshot);this.storage.removeItem(this.key(p));this.selection={day:reply.snapshot.check!.id};this.emit({snapshot:reply.snapshot,pending:this.state.pending.slice(1)});
  }
  this.emit({notice:'Shared changes saved.'});return !this.disposed;
 }catch(e){this.emit({error:e instanceof Error?e.message:'Connection failed. Answers are kept on this device.'});return false;}finally{this.busy=false;this.emit({saving:false});}}
 async retry(){if(this.busy||this.disposed)return false;this.busy=true;this.emit({loading:true,error:'',unauthorized:false});let verified=false;try{const snapshot=await this.read();if(this.disposed)return false;this.emit({snapshot});verified=true;}catch(e){this.emit({error:e instanceof Error?e.message:'Sign in and retry.'});}finally{this.busy=false;this.emit({loading:false});}return verified?this.drain():false;}

 async flush(){if(this.state.error||this.state.pending.some(p=>p.rejected))return false;if(this.inflight&&!await this.inflight)return false;if(this.state.pending.length&&!await this.drain())return false;return this.state.pending.length===0&&!this.busy&&!this.state.error;}
 async summary(){if(!await this.flush())return null;if(!await this.refresh())return null;return this.state.pending.length===0?this.state.snapshot:null;}
 // Only a definitively rejected command can be discarded. Later unsent same-item intents are
 // explicitly included in this review and rebuilt; uncertain sent operations are never rewritten.
 async resolveRejected(useLocal:boolean){if(this.busy||!this.state.pending[0]?.rejected)return false;
  const before=this.state.pending;if(before.slice(1).some(p=>p.sent))return false;
  if(!await this.refresh())return false;
  const rejected=before[0];if(rejected.command.kind!=='answer'&&useLocal)return false;
  const check=this.state.snapshot?.check;
  const keep=useLocal?before:[];
  if(keep.some(p=>p.command.kind!=='answer'||!check||p.command.checkId!==check.id)||check?.stage!=='draft'&&keep.length){this.emit({error:'This check was confirmed elsewhere. Keep the shared result; use Correct check for further changes.'});return false;}
  const revisions=new Map(check?.answers.map(a=>[a.itemId,a.revision])??[]);
  const next:PendingEvening[]=keep.map(p=>{const c=p.command as Extract<EveningCommand,{kind:'answer'}>;const revision=revisions.get(c.itemId);if(revision===undefined)throw Error('Check item is no longer available.');revisions.set(c.itemId,revision+1);return {...p,sent:false,rejected:false,command:{...c,id:crypto.randomUUID(),revision,generation:check!.version}};});
  try{for(const p of next)this.persist(p);for(const p of before)this.storage.removeItem(this.key(p));}catch{this.emit({error:'Could not save the reviewed recovery. Keep this page open and retry.'});return false;}
  this.emit({pending:next,error:'',notice:useLocal?'Your reviewed answers will be saved.':'Shared result kept.'});return next.length?this.drain():true;
 }
}

export function visibleEveningCheck(state:EveningState){const check=state.snapshot?.check;if(!check)return null;const copy=structuredClone(check);for(const p of state.pending){const c=p.command;if(c.kind==='answer'&&c.checkId===copy.id){const a=copy.answers.find(a=>a.itemId===c.itemId);if(a){a.value=c.value;a.revision=c.revision+1;}}}return copy;}
