import {teamCommandSchema,type TeamDirectory} from './activity';
import {requestJson} from './request-json';
import type {z} from 'zod';

export type TeamCommand=z.infer<typeof teamCommandSchema>;
type Recovery={key:string;command:TeamCommand;rejected:boolean};
export type TeamState={directory:TeamDirectory|null;busy:boolean;error:string;notice:string;pending:Recovery[];unreadable:{key:string;raw:string}[];storageError:boolean};
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'|'key'|'length'>;
type Transport=typeof requestJson;
export const initialTeamState:TeamState={directory:null,busy:false,error:'',notice:'',pending:[],unreadable:[],storageError:false};

// Independent per-command recovery keys prevent two tabs overwriting each other.
// The previous single-command key is still read and retried with its original ID.
export class TeamController{
 state:TeamState={...initialTeamState};private disposed=false;private locked=false;private accountId:string|null=null;
 constructor(private email:string,private storage:Store,private changed:(s:TeamState)=>void,private transport:Transport=requestJson){}
 private emit(p:Partial<TeamState>){this.state={...this.state,...p};if(!this.disposed)this.changed(this.state);}
 dispose(){this.disposed=true;}
 private recover(){
  if(!this.accountId)return;
  const pending:Recovery[]=[],unreadable:{key:string;raw:string}[]=[];
  const legacy='labula-team-v1:'+this.accountId,prefix='labula-team-v2:'+this.accountId+':';
  const keys=new Set([legacy]);for(let i=0;i<this.storage.length;i++){const k=this.storage.key(i);if(k?.startsWith(prefix))keys.add(k);}
  for(const key of keys){const raw=this.storage.getItem(key);if(raw===null)continue;
   try{const command=teamCommandSchema.parse(JSON.parse(raw));if(key!==legacy&&key!==prefix+command.id)throw Error();pending.push({key,command,rejected:this.state.pending.some(p=>p.key===key&&p.rejected)});}
   catch{unreadable.push({key,raw});}
  }
  this.emit({pending,unreadable,storageError:false});
 }
 private async read(){
  const {res,body}=await this.transport<TeamDirectory&{error?:string}>('/api/team?management=1',{cache:'no-store'});
  if(!res.ok){if(res.status===401||res.status===403)this.emit({directory:null});throw Error(body.error??'Could not load the kitchen team.');}
  if(!(body.canManage??body.isOwner)||body.email.toLowerCase()!==this.email.toLowerCase()||(this.accountId&&this.accountId!==body.accountId)){
   this.emit({directory:null});throw Error('The signed-in account changed. Return to the original managing account before continuing.');
  }
  this.accountId=body.accountId;
  if(!this.disposed)this.emit({directory:body});
  return body;
 }
 async refresh(){if(this.locked||this.disposed)return;this.locked=true;this.emit({busy:true,error:''});
  try{await this.read();try{this.recover();}catch{this.emit({storageError:true});throw Error('Local recovery cannot be read. Allow browser storage, then retry. Existing changes have not been removed.');}}
  catch(e){this.emit({error:(e as Error).message});}finally{this.locked=false;this.emit({busy:false});}
 }
 async save(input:TeamCommand,recoveryKey?:string):Promise<boolean>{
  if(this.locked||this.disposed)return false;this.locked=true;this.emit({busy:true,error:'',notice:''});let key=recoveryKey;
  try{
   await this.read();if(this.disposed)return false;
   this.recover();if(this.state.unreadable.length)throw Error('Resolve the unreadable recovery file before saving another profile.');
   if(!recoveryKey&&this.state.pending.length)throw Error('Confirm the unfinished profile change before starting another.');
   const command=teamCommandSchema.parse(input);
   if(recoveryKey){const found=this.state.pending.find(p=>p.key===recoveryKey);if(!found||JSON.stringify(found.command)!==JSON.stringify(command))throw Error('The recovery record changed. Refresh before continuing.');}
   key??='labula-team-v2:'+this.accountId+':'+command.id;
   const existing=this.storage.getItem(key);if(existing&&JSON.stringify(teamCommandSchema.parse(JSON.parse(existing)))!==JSON.stringify(command))throw Error('A different change already uses this recovery ID.');
   this.storage.setItem(key,JSON.stringify(command));this.recover();
   const {res,body}=await this.transport<{operationId?:string;error?:string}>('/api/team',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(command)});
   if(this.disposed)return false;
   if(!res.ok){if(res.status===400||res.status===409)this.emit({pending:this.state.pending.map(p=>p.key===key?{...p,rejected:true}:p)});throw Error(body.error??'Could not confirm this profile change.');}
   if(body.operationId!==command.id)throw Error('Save confirmation is missing. Retry the original profile change.');
   this.storage.removeItem(key);this.recover();this.emit({notice:this.state.directory?.accessMode==='application'?'Team access saved.':'App permission saved. Sites invitations still apply until the owner completes the access transition.'});
   try{await this.read();}catch(e){this.emit({error:'The profile was saved, but the list could not refresh. '+(e as Error).message});}
   return true;
  }catch(e){this.emit({error:(e as Error).message||'Could not save. Your unfinished change is kept.'});return false;}
  finally{this.locked=false;this.emit({busy:false});}
 }
 async discardRejected(key:string){
  if(this.locked||!this.state.pending.some(p=>p.key===key&&p.rejected))return;
  try{this.storage.removeItem(key);await this.refresh();}catch{this.emit({error:'Could not clear local recovery. No new change was sent.',storageError:true});}
 }
 async clearUnreadable(){
  if(this.locked)return;
  try{for(const r of this.state.unreadable){if(this.storage.getItem(r.key)!==r.raw)throw Error('The local recovery changed. Refresh first.');this.storage.removeItem(r.key);}await this.refresh();}
  catch(e){this.emit({error:(e as Error).message});}
 }
}
