import {requestJson} from './request-json';
import {roundCommandSchema,type RoundCommand,type RoundsSnapshot} from './check-rounds';
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'|'length'|'key'>;
type Pending={command:RoundCommand;rejected:boolean};
type Requester=typeof requestJson;
export type RoundClientState={snapshot:RoundsSnapshot|null;pending:Pending|null;busy:boolean;error:string;notice:string;reviewReady?:boolean};
export class RoundClient{
 state:RoundClientState={snapshot:null,pending:null,busy:false,error:'',notice:''};
 private listeners=new Set<()=>void>();private disposed=false;private actor='';
 constructor(private account:string,private store:Store,private request:Requester=requestJson){}
 subscribe(fn:()=>void){this.listeners.add(fn);return()=>{this.listeners.delete(fn);};}
 dispose(){this.disposed=true;this.listeners.clear();}
 private emit(p:Partial<RoundClientState>){if(this.disposed)return;this.state={...this.state,...p};for(const f of this.listeners)f();}
 private prefix(){return `labula.round-command.v1.${encodeURIComponent(this.actor)}.`;}
 private key(p:Pending){return this.prefix()+p.command.id;}
 private async read(){const r=await this.request<RoundsSnapshot&{error?:string}>('/api/check-rounds',{cache:'no-store'});if(!r.res.ok)throw Error(r.body.error??'Sign in, then retry loading check rounds.');if(r.body.account.toLowerCase()!==this.account.toLowerCase()||this.actor&&r.body.accountId!==this.actor)throw Error('The account changed. Return to the original account.');this.actor=r.body.accountId;return r.body;}
 private restore(){for(let i=0;i<this.store.length;i++){const key=this.store.key(i);if(!key?.startsWith(this.prefix()))continue;const p=JSON.parse(this.store.getItem(key)!) as Pending;roundCommandSchema.parse(p.command);if(p.command.actorId!==this.actor)throw Error('Saved request belongs to another account.');this.emit({pending:p});return;}this.emit({pending:null});}
 async refresh(){if(this.state.busy||this.disposed)return;this.emit({busy:true,error:'',reviewReady:false});try{const snapshot=await this.read();if(this.disposed)return;this.emit({snapshot});this.restore();this.emit({reviewReady:!!this.state.pending?.rejected});}catch(e){this.emit({error:(e as Error).message});}finally{this.emit({busy:false});}}
 async submit(command:RoundCommand){if(this.state.busy||this.disposed||this.state.pending)return false;try{roundCommandSchema.parse(command);const p={command,rejected:false};this.store.setItem(this.key(p),JSON.stringify(p));this.emit({pending:p});}catch{this.emit({error:'Could not keep a recovery copy. Nothing was sent. Enable browser storage and retry.'});return false;}return this.retry();}
 async retry(){const p=this.state.pending;if(!p||p.rejected||this.state.busy||this.disposed)return false;this.emit({busy:true,error:'',notice:''});try{
  await this.read();if(this.disposed)return false;
  const r=await this.request<{operationId?:string;error?:string;code?:string}>('/api/check-rounds',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(p.command)});
  if(!r.res.ok){if([400,403,409].includes(r.res.status)){const rejected={...p,rejected:true};this.store.setItem(this.key(p),JSON.stringify(rejected));this.emit({pending:rejected,reviewReady:false});}throw Error(r.body.error??'Save could not be confirmed. Retry the same request.');}
  if(r.body.operationId!==p.command.id)throw Error('The save result is uncertain. Retry the original request.');
  this.store.removeItem(this.key(p));this.emit({pending:null,notice:'Saved. Applies to new checks. Existing checks keep their list.'});
  const snapshot=await this.read();this.emit({snapshot});this.restore();return true;
 }catch(e){this.emit({error:(e as Error).message});return false;}finally{this.emit({busy:false});}}
 // Only a definitively rejected operation can be discarded. A new review uses fresh revisions.
 discardRejected(){const p=this.state.pending;if(!p?.rejected||!this.state.reviewReady||this.state.busy)return;try{this.store.removeItem(this.key(p));this.emit({pending:null,error:'',notice:'Rejected request cleared. Review the latest shared settings before saving again.'});}catch{this.emit({error:'Could not clear the rejected request. Retry.'});}}
}
