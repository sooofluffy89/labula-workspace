import {registerSignOutWork} from './profile-signout';
import {requestJson} from './request-json';
import {prepNoteCommandSchema,contextKey,type PrepNoteCommand,type NotesPage,type InstructionIndex} from './prep-notes';
type Store=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
export type NotePending={command:PrepNoteCommand;rejected?:boolean;error?:string};
export type NotesState={identity:Pick<NotesPage,'account'|'accountId'|'canEdit'|'supported'>|null;pending:NotePending[];parked:NotePending[];unsafeDrafts:number;loading:boolean;sending:string|null;error:string;received:number;draftVersion?:number;index?:InstructionIndex|null;indexLoading?:boolean;indexError?:string;indexCheckedAt?:number};
const initial:NotesState={identity:null,pending:[],parked:[],unsafeDrafts:0,loading:false,sending:null,error:'',received:0};
export class PrepNotesController{
 state:NotesState=initial;private listeners=new Set<()=>void>();private disposed=false;private drain:Promise<boolean>|null=null;private init:Promise<boolean>|null=null;private session=crypto.randomUUID();private sequence=0;private indexFlight:Promise<boolean>|null=null;private indexEpoch=0;private volatileDrafts=new Map<string,{text:string;revision?:number}>();private unregisterSignout=registerSignOutWork(()=>this.volatileDrafts.size?{label:'Unbacked-up instruction / feedback text',value:[...this.volatileDrafts],safe:false}:null);
 constructor(private account:string,private storage:Store,private request:typeof requestJson=requestJson){}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 private set(p:Partial<NotesState>){if(this.disposed)return;this.state={...this.state,...p};this.listeners.forEach(fn=>fn());}
 private prefix(){return 'labula.prep-notes.v1.'+encodeURIComponent(this.state.identity!.accountId)+'.';}
 private key(id:string){return this.prefix()+'pending.'+id;}
 private restore(){const found:NotePending[]=[],parked:NotePending[]=[];for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(!k)continue;const isParked=k.startsWith(this.prefix()+'parked.');if(!isParked&&!k?.startsWith(this.prefix()+'pending.'))continue;const v=JSON.parse(this.storage.getItem(k)??'null');if(!v?.command)throw Error('A note recovery record could not be read. Keep this device data and ask the owner.');v.command=prepNoteCommandSchema.parse(v.command);if(v.command.actorId!==this.state.identity!.accountId||k!==(isParked?this.prefix()+'parked.'+v.command.id:this.key(v.command.id)))throw Error('A note recovery identity does not match.');(isParked?parked:found).push(v);}this.set({parked,pending:found.sort((a,b)=>(a.command.meta?.occurredAt??'').localeCompare(b.command.meta?.occurredAt??''))});}
 initialize(){if(this.init)return this.init;this.init=(async()=>{this.set({loading:true,error:''});try{const {res,body}=await this.request<NotesPage&{error?:string}>('/api/prep-notes',{cache:'no-store'});if(!res.ok){if(res.status===401||res.status===403){this.indexEpoch++;this.indexFlight=null;this.set({identity:null,index:null,indexLoading:false});}throw Error(body.error??'Prep notes are not available on this server. Retry after updating.');}if(body.account.toLowerCase()!==this.account.toLowerCase()||body.supported!==1||this.state.identity&&body.accountId!==this.state.identity.accountId){this.indexEpoch++;this.indexFlight=null;this.set({identity:null,index:null,indexLoading:false});throw Error('The signed-in account or supported notes version changed. Return to the original account.');}if(!body.canEdit){this.indexEpoch++;this.indexFlight=null;}this.set({identity:body,...(!body.canEdit?{index:null,indexLoading:false}:{})});this.restore();return true;}catch(e){this.set({error:(e as Error).message});return false;}finally{this.set({loading:false});this.init=null;}})();return this.init;}
 draft(key:string){if(!this.state.identity)return null;if(this.volatileDrafts.has(key))return this.volatileDrafts.get(key)!;const raw=this.storage.getItem(this.prefix()+'draft.'+key);if(!raw)return null;const d=JSON.parse(raw);if(typeof d.text!=='string'||d.text.length>500)throw Error('This local note draft needs review.');return d as {text:string;revision?:number};}
 saveDraft(key:string,text:string,revision?:number){if(!this.state.identity)throw Error('Wait for the signed-in account to be verified.');this.volatileDrafts.set(key,{text,revision});try{this.storage.setItem(this.prefix()+'draft.'+key,JSON.stringify({text,revision}));this.volatileDrafts.delete(key);}finally{this.set({unsafeDrafts:this.volatileDrafts.size,draftVersion:(this.state.draftVersion??0)+1});}}
 clearDraft(key:string){this.storage.removeItem(this.prefix()+'draft.'+key);this.volatileDrafts.delete(key);this.set({unsafeDrafts:this.volatileDrafts.size,draftVersion:(this.state.draftVersion??0)+1});}
 sharedChanged(kind?:'instruction'|'feedback'){this.set({received:this.state.received+1});if(kind!=='feedback'&&this.state.identity?.canEdit)void this.refreshIndex();}
 refreshIndex(maxAge=0):Promise<boolean>{
  if(this.indexFlight)return this.indexFlight;
  if(!this.state.identity?.canEdit||this.disposed)return Promise.resolve(false);
  if(maxAge>0&&this.state.index&&!this.state.indexError&&this.state.indexCheckedAt&&Date.now()-this.state.indexCheckedAt<maxAge)return Promise.resolve(true);
  const actor=this.state.identity.accountId,epoch=++this.indexEpoch;
  this.set({indexLoading:true,indexError:''});
  this.indexFlight=(async()=>{try{const {res,body}=await this.request<InstructionIndex&{error?:string}>('/api/prep-instructions',{cache:'no-store'});
   if(this.disposed||epoch!==this.indexEpoch)return false;
   if(!res.ok){if(res.status===401||res.status===403)this.set({index:null,identity:null});throw Error(body.error??'Could not refresh instructions.');}
   if(body.supported!==1||!Array.isArray(body.instructions)||body.accountId!==actor||body.account.toLowerCase()!==this.account.toLowerCase()){this.set({index:null,identity:null});throw Error('The signed-in account or instruction access changed.');}
   this.set({index:body,indexCheckedAt:Date.now()});return true;
  }catch(e){if(!this.disposed&&epoch===this.indexEpoch)this.set({indexError:(e as Error).message});return false;}finally{if(epoch===this.indexEpoch){this.indexFlight=null;this.set({indexLoading:false});}}})();return this.indexFlight;
 }
 draftChanged(){this.set({draftVersion:(this.state.draftVersion??0)+1});}
 keepDrafts(){try{for(const [key,d] of [...this.volatileDrafts])this.saveDraft(key,d.text,d.revision);return true;}catch{this.set({error:'Your text is only in memory. Keep the editor open and copy it before leaving, or retry saving the draft.'});return false;}}
 enqueue(input:Omit<Extract<PrepNoteCommand,{kind:'feedback'}>,'id'|'actorId'|'meta'>|Omit<Extract<PrepNoteCommand,{kind:'instruction'}>,'id'|'actorId'|'meta'>){
  if(!this.state.identity||this.disposed||this.state.loading)return false;
  try{this.restore();if(this.state.pending.some(p=>p.command.kind===input.kind&&(input.kind==='instruction'?p.command.kind==='instruction'&&p.command.itemId===input.itemId:p.command.kind==='feedback'&&contextKey(p.command.context)===contextKey(input.context)))){this.set({error:'This item already has a note waiting to be shared. Retry or review it first.'});return false;}
   const command=prepNoteCommandSchema.parse({...input,id:crypto.randomUUID(),actorId:this.state.identity.accountId,meta:{occurredAt:new Date().toISOString(),sessionId:this.session,sequence:++this.sequence}}),entry={command};
   this.storage.setItem(this.key(command.id),JSON.stringify(entry));this.restore();this.set({error:''});void this.flush();return true;
  }catch(e){this.set({error:'Could not keep this note safely on your device. Nothing new was sent. '+(e as Error).message});return false;}
 }
 flush(checkId?:string):Promise<boolean>{if(this.drain)return this.drain.then(ok=>ok?this.flush(checkId):!!checkId&&!this.state.pending.some(p=>p.command.kind==='feedback'&&p.command.context.checkId===checkId));this.drain=this.send(checkId).finally(()=>{this.drain=null;});return this.drain;}
 async prepareFinish(checkId:string,accountId:string,supported:boolean){
  if(!this.state.identity){
   // Older servers can keep their original Finish only when this verified account has no undiscovered note queue.
   if(!supported){try{const prefix='labula.prep-notes.v1.'+encodeURIComponent(accountId)+'.pending.';for(let i=0;i<this.storage.length;i++)if(this.storage.key(i)?.startsWith(prefix)){this.set({error:'This device has feedback waiting for a compatible server. Retry notes before finishing.'});return false;}return true;}catch{this.set({error:'Could not check saved feedback on this device. Retry before finishing.'});return false;}}
   if(!await this.initialize())return false;
  }
  if(this.state.identity?.accountId!==accountId){this.set({error:'The signed-in account changed. Return to the original account before finishing.'});return false;}
  return this.flush(checkId);
 }
 private async send(checkId?:string){
  if(!this.state.identity&&!await this.initialize())return false;if(this.disposed)return false;
  const belongs=(p:NotePending)=>!checkId||p.command.kind==='feedback'&&p.command.context.checkId===checkId;
  try{this.restore();}catch(e){this.set({error:(e as Error).message});return false;}
  this.set({error:''});let hadError=false;
  for(let sent=0;sent<100;sent++){
   this.restore();const p=this.state.pending.find(p=>belongs(p)&&!p.rejected);if(!p)break;
   if(this.disposed)return false;if(p.rejected){hadError=true;continue;}
   this.set({sending:p.command.id});
   try{const {res,body}=await this.request<{operationId?:string;accountId?:string;error?:string;code?:string}>('/api/prep-notes',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(p.command)});
    if(this.disposed)return false;
    if(!res.ok){if(res.status===400||res.status===409){this.storage.setItem(this.key(p.command.id),JSON.stringify({...p,rejected:true,error:body.error??'This note needs review.'}));}throw Error(body.error??'The note save could not be confirmed. Retry safely.');}
    if(body.accountId!==this.state.identity!.accountId||body.operationId!==p.command.id)throw Error('The original note save was not confirmed. Return to the original account and retry.');
    this.storage.removeItem(this.key(p.command.id));this.sharedChanged(p.command.kind);
   }catch(e){hadError=true;this.set({error:(e as Error).message});break;}finally{this.set({sending:null});}
  }
  try{this.restore();}catch(e){hadError=true;this.set({error:(e as Error).message});}
  return !hadError&&!this.state.pending.some(belongs);
 }
 // Only a definitely rejected operation may be retired; uncertain requests retain their original identity.
 discardRejected(id:string){const p=this.state.pending.find(p=>p.command.id===id);if(!p?.rejected)return false;try{this.storage.setItem(this.prefix()+'parked.'+id,JSON.stringify(p));this.storage.removeItem(this.key(id));this.restore();this.set({error:''});return true;}catch(e){this.set({error:(e as Error).message});return false;}}
 dispose(){this.unregisterSignout();this.indexEpoch++;this.disposed=true;this.listeners.clear();}
}
