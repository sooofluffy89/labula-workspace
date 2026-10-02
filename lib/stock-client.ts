import {stationCommandSchema,isStationCommand,type StationCommand} from './checking-stations';
import {frequencyCommandSchema,isFrequencyCommand,type FrequencyCommand} from './stock-frequency';
import {requestJson} from './request-json';
import {stockCommandSchema,type StockCommand,type StockSnapshot} from './stock';

export type StockRecovery={accountId:string;scope:'kitchen';command:StockCommand|FrequencyCommand|StationCommand;rejected?:boolean};
export type StockState={snapshot:StockSnapshot|null;loading:boolean;saving:boolean;error:string;unauthorized:boolean;pending:StockRecovery|null;notice:string};
type Reply={error?:string;code?:string;operationId?:string};
type StoragePort=Pick<Storage,'length'|'key'|'getItem'|'setItem'|'removeItem'>;
const prefix=(accountId:string)=>`labula.stock.v1.kitchen.${encodeURIComponent(accountId)}.`;
const failureMessage=(error:unknown,fallback:string)=>error instanceof SyntaxError?'The server reply was incomplete. Your change may be saved. Retry to confirm it safely.':error instanceof TypeError?'The connection was interrupted. Your change is kept here. Retry to check its result.':error instanceof Error?error.message:fallback;
export class StockController {
 state:StockState={snapshot:null,loading:false,saving:false,error:'',unauthorized:false,pending:null,notice:''};
 private listeners=new Set<()=>void>();
 private epoch=0;
 private busy=false;
 private sessionId=crypto.randomUUID();private actionSequence=0;
 private disposed=false;
 constructor(private accountEmail:string,private storage:StoragePort,private request:typeof requestJson=requestJson,private planning=false){}
 private readUrl(){return this.planning?'/api/stock?planning=1':'/api/stock';}
 subscribe=(fn:()=>void)=>{this.listeners.add(fn);return()=>{this.listeners.delete(fn);};};
 getSnapshot=()=>this.state;
 private set(patch:Partial<StockState>){if(this.disposed)return;this.state={...this.state,...patch};this.listeners.forEach(fn=>fn());}
 private key(p:StockRecovery){return (isStationCommand(p.command)?`labula.stock-station.v1.kitchen.${encodeURIComponent(p.accountId)}.`:isFrequencyCommand(p.command)?`labula.stock-frequency.v1.kitchen.${encodeURIComponent(p.accountId)}.`:prefix(p.accountId))+p.command.id;}
 private persist(p:StockRecovery){this.storage.setItem(this.key(p),JSON.stringify(p));}
 private restore(accountId:string){
  const entries:string[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key&&(key.startsWith(`labula.stock-station.v1.kitchen.${encodeURIComponent(accountId)}.`)||key.startsWith(prefix(accountId))||key.startsWith(`labula.stock-frequency.v1.kitchen.${encodeURIComponent(accountId)}.`)))entries.push(key);}
  for(const key of entries.sort()){
   let raw:StockRecovery;try{raw=JSON.parse(this.storage.getItem(key)??'null') as StockRecovery;}catch{throw Error('A stock recovery record could not be read. Keep this browser data and ask the owner for help.');}
   if(!raw||raw.accountId!==accountId||raw.scope!=='kitchen'||typeof raw.rejected!=='undefined'&&typeof raw.rejected!=='boolean')throw Error('A stock recovery record could not be read. Keep this browser data and ask the owner for help.');
   raw.command=isStationCommand(raw.command)?stationCommandSchema.parse(raw.command):isFrequencyCommand(raw.command)?frequencyCommandSchema.parse(raw.command):stockCommandSchema.parse(raw.command);if(key!==this.key(raw))throw Error('A stock recovery ID is inconsistent. Keep this browser data and ask the owner for help.');return raw;
  }return null;
 }
 dispose(){this.disposed=true;this.epoch++;this.listeners.clear();}
 async refresh(){
  if(this.busy||this.disposed)return false;this.busy=true;const epoch=++this.epoch;this.set({loading:true,error:'',unauthorized:false});
  try{
   const {res,body}=await this.request<StockSnapshot&Reply>(this.readUrl(),{cache:'no-store'});
   if(this.disposed||epoch!==this.epoch)return false;
   if(!res.ok){this.set({unauthorized:res.status===401||res.status===403});throw Error(body.error??'Could not load stock settings.');}
   if(body.scope!=='kitchen'||body.account.toLowerCase()!==this.accountEmail.toLowerCase()||this.state.snapshot&&body.accountId!==this.state.snapshot.accountId){this.set({unauthorized:true});throw Error('The signed-in account changed. Return to the original account or reload the application. No pending changes were sent.');}
   const pending=this.state.pending??this.restore(body.accountId);
   this.set({snapshot:body,pending});return true;
  }catch(e){if(epoch===this.epoch)this.set({error:failureMessage(e,'Could not load stock settings.')});return false;}
  finally{if(epoch===this.epoch){this.busy=false;this.set({loading:false});}}
 }
 async change(changes:StockCommand['changes']){
  if(this.busy||this.disposed||this.state.pending||this.state.error||!this.state.snapshot)return false;
  const command=stockCommandSchema.parse({id:crypto.randomUUID(),changes,meta:{occurredAt:new Date().toISOString(),sessionId:this.sessionId,sequence:++this.actionSequence}});
  const pending:StockRecovery={accountId:this.state.snapshot.accountId,scope:'kitchen',command};
  try{this.persist(pending);}catch{this.set({error:'Your browser could not keep a recovery copy. Nothing was sent. Enable browser storage and try again.'});return false;}
  this.set({pending,notice:''});return this.retry();
 }
 async changeFrequency(command:FrequencyCommand){
  if(this.busy||this.disposed||this.state.pending||this.state.error||!this.state.snapshot)return false;
  const parsed=frequencyCommandSchema.parse({...command,meta:{occurredAt:new Date().toISOString(),sessionId:this.sessionId,sequence:++this.actionSequence}});
  const pending:StockRecovery={accountId:this.state.snapshot.accountId,scope:'kitchen',command:parsed};
  try{this.persist(pending);}catch{this.set({error:'Could not keep a recovery copy. Nothing was sent. Enable browser storage and retry.'});return false;}
  this.set({pending,notice:''});return this.retry();
 }
 async changeStation(command:StationCommand){
  if(this.busy||this.disposed||this.state.pending||this.state.error||!this.state.snapshot)return false;
  const parsed=stationCommandSchema.parse({...command,meta:{occurredAt:new Date().toISOString(),sessionId:this.sessionId,sequence:++this.actionSequence}});
  const pending:StockRecovery={accountId:this.state.snapshot.accountId,scope:'kitchen',command:parsed};
  try{this.persist(pending);}catch{this.set({error:'Could not keep a recovery copy. Nothing was sent. Enable browser storage and retry.'});return false;}
  this.set({pending,notice:''});return this.retry();
 }
 async retry(){
  const pending=this.state.pending;if(this.busy||this.disposed||!pending||pending.rejected||!this.state.snapshot)return false;
  this.busy=true;const epoch=++this.epoch;this.set({saving:true,error:'',unauthorized:false});let ok=false;
  try{
   // Never replay a stored command under a newly signed-in account, including after a 401.
   const auth=await this.request<StockSnapshot&Reply>(this.readUrl(),{cache:'no-store'});
   if(this.disposed||epoch!==this.epoch)return false;
   if(!auth.res.ok){this.set({unauthorized:auth.res.status===401||auth.res.status===403});throw Error(auth.body.error??'Could not check the signed-in account.');}
   if(auth.body.accountId!==pending.accountId||auth.body.scope!==pending.scope){this.set({unauthorized:true});throw Error('Sign in with the account that started this stock change, then retry.');}
   const {res,body}=await this.request<Reply>(isStationCommand(pending.command)?'/api/checking-stations':isFrequencyCommand(pending.command)?'/api/stock-frequency':'/api/stock',{method:'POST',headers:{'Content-Type':'application/json','If-Match':'0'},body:JSON.stringify(pending.command)});
   if(this.disposed||epoch!==this.epoch)return false;
   if(!res.ok){
    this.set({unauthorized:res.status===401||res.status===403});
    if(body.code==='station_conflict'||body.code==='stock_conflict'||body.code==='frequency_conflict'||res.status===400||body.code==='command_mismatch'){
     const rejected={...pending,rejected:true};this.persist(rejected);this.set({pending:rejected});
    }
    throw Error(body.error??'The stock save could not be confirmed. Retry the original change safely.');
   }
   if(body.operationId!==pending.command.id)throw Error('The server did not confirm the original stock change. Retry to check its result.');
   this.storage.removeItem(this.key(pending));this.set({pending:null,notice:isStationCommand(pending.command)||isFrequencyCommand(pending.command)?'':'Stock list changes saved.'});ok=true;
  }catch(e){if(epoch===this.epoch)this.set({error:failureMessage(e,'Could not confirm the stock change.')});}
  finally{if(epoch===this.epoch){this.busy=false;this.set({saving:false});}}
  if(ok&&!this.disposed){const fresh=await this.refresh();if(fresh&&isStationCommand(pending.command))this.set({notice:'Checking stations saved. New checks will use these assignments.'});if(fresh&&isFrequencyCommand(pending.command))this.set({notice:'Check frequency saved. Items outside your filters may be hidden.'});}return ok;
 }
 // Only definitely rejected requests may be discarded or rebased. Uncertain writes must be resolved first.
 async keepShared(){const p=this.state.pending;if(this.busy||!p?.rejected)return false;
  try{this.storage.removeItem(this.key(p));this.set({pending:null,error:'',notice:'Kept shared stock settings.'});return this.refresh();}catch{this.set({error:'Could not clear the local recovery. Please retry.'});return false;}
 }
 async applyReviewed(){const p=this.state.pending,s=this.state.snapshot;if(this.busy||!p?.rejected||!s||this.state.error)return false;
  if(isStationCommand(p.command)){this.set({error:'Refresh and keep shared settings, then review and confirm stations using the latest values.'});return false;}
  if(isFrequencyCommand(p.command)){this.set({error:'Keep shared settings, then select and confirm a frequency using the latest schedule.'});return false;}
  const changes=p.command.changes.map(c=>{const row=s.items.find(i=>i.itemId===c.itemId);if(!row||!row.included&&c.track)return null;return {...c,revision:row.revision};});
  if(changes.some(c=>c===null)){this.set({error:'An item was removed or merged. Keep shared settings, then select the available catalog item again.'});return false;}
  // Persist a replacement before removing the rejected intent, so interruption never loses both.
  const next:StockRecovery={accountId:p.accountId,scope:'kitchen',command:{id:crypto.randomUUID(),changes:changes as StockCommand['changes'],meta:{occurredAt:new Date().toISOString(),sessionId:this.sessionId,sequence:++this.actionSequence,supersedesCommandId:p.command.id}}};
  try{this.persist(next);this.storage.removeItem(this.key(p));this.set({pending:next});return this.retry();}catch{this.set({error:'Could not update the recovery copy. Please retry.'});return false;}
 }
}
