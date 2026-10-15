/** Browser-only form recovery. Each page owns a distinct writer; copies are never consumed. */
type DraftStorage=Pick<Storage,'length'|'key'|'getItem'|'setItem'>;
export type FormDraftCopy<T>={key:string;value:T;updatedAt:string;writerId:string|null};
type RecordValue<T>={version:2;account:string;id:string;writerId:string;sequence:number;updatedAt:string;closed:boolean;value?:T};
type Parsed<T>={value:T|null;updatedAt:string;writerId:string|null;sequence:number;closed:boolean};
const clone=<T>(value:T):T=>{const raw=JSON.stringify(value);if(raw===undefined)throw Error('This draft cannot be stored.');return JSON.parse(raw) as T;};
export const formDraftPrefix=(account:string,id:string)=>`labula.workspace2.form.v1.${encodeURIComponent(account)}.${encodeURIComponent(id)}`;

export class FormDraftStore<T>{
 private readonly prefix:string;
 private ownedKey:string;
 private sequence=0;
 constructor(private readonly storage:DraftStorage,private readonly account:string,private readonly id:string,readonly writerId:string){
  if(!account||!id||!writerId)throw Error('A draft requires an account, form and unique page writer.');
  this.prefix=formDraftPrefix(account,id);
  this.ownedKey=`${this.prefix}.writer.${encodeURIComponent(writerId)}`;
  const latest=this.latestWriter(writerId);if(latest){this.ownedKey=latest.key;this.sequence=latest.record.sequence;}
 }
 get currentKey(){return this.ownedKey;}
 private inScope(key:string){return key===this.prefix||key.startsWith(this.prefix+'.writer.');}
 private parse(key:string,raw:string):Parsed<T>{
  if(!this.inScope(key))throw Error('This draft belongs to a different form.');
  const record=JSON.parse(raw);
  if(!record||typeof record!=='object'||record.account!==this.account||record.id!==this.id)throw Error('This draft does not match the current account and form. Its original copy was kept.');
  if(record.version===1&&key===this.prefix&&Object.hasOwn(record,'value'))return {value:record.value,updatedAt:typeof record.updatedAt==='string'?record.updatedAt:'',writerId:null,sequence:0,closed:false};
  if(record.version!==2||typeof record.writerId!=='string'||!record.writerId||typeof record.closed!=='boolean'||typeof record.updatedAt!=='string'||!Number.isFinite(Date.parse(record.updatedAt))||record.sequence!==undefined&&(!Number.isSafeInteger(record.sequence)||record.sequence<0)||!record.closed&&!Object.hasOwn(record,'value'))throw Error('This saved draft could not be read. Its original copy was kept.');
  const writerKey=`${this.prefix}.writer.${encodeURIComponent(record.writerId)}`;
  if(key!==writerKey&&!key.startsWith(writerKey+'.fork.'))throw Error('This draft does not match its writer. Its original copy was kept.');
  return {value:record.closed?null:record.value,updatedAt:record.updatedAt,writerId:record.writerId,sequence:record.sequence??0,closed:record.closed};
 }
 private owned(){
  const raw=this.storage.getItem(this.ownedKey);if(raw===null)return null;
  const record=this.parse(this.ownedKey,raw);
  if(record.writerId!==this.writerId)throw Error('This draft is owned by a different page. Its original copy was kept.');
  return record;
 }
 read():{value:T|null;restored:boolean;closed:boolean}{
  const record=this.owned();return {value:record?.value??null,restored:!!record&&!record.closed,closed:record?.closed??false};
 }
 private serialized(value:T|undefined,closed:boolean,sequence=this.sequence){
  const record:RecordValue<T>={version:2,account:this.account,id:this.id,writerId:this.writerId,sequence,updatedAt:new Date().toISOString(),closed,...(closed?{}:{value:clone(value as T)})};
  return JSON.stringify(record);
 }
 write(value:T){this.owned();this.storage.setItem(this.ownedKey,this.serialized(value,false));}
 /** A tombstone suppresses reopening this page's completed draft without deleting another writer. */
 clear(){this.owned();this.storage.setItem(this.ownedKey,this.serialized(undefined,true));}
 private keys(){const result:string[]=[];for(let i=0;i<this.storage.length;i++){const key=this.storage.key(i);if(key&&this.inScope(key))result.push(key);}return result;}
 private latestWriter(writerId:string){
  let latest:{key:string;record:Parsed<T>}|null=null;
  for(const key of this.keys()){
   const raw=this.storage.getItem(key);if(raw===null)continue;
   try{const record=this.parse(key,raw);if(record.writerId===writerId&&(!latest||record.sequence>latest.record.sequence||record.sequence===latest.record.sequence&&record.updatedAt>latest.record.updatedAt))latest={key,record};}catch{/* Preserve damaged copies for explicit recovery. */}
  }
  return latest;
 }
 /** A reload may prefer a previous writer only when that writer did not close its latest fork. */
 writerClosed(writerId:string){return this.latestWriter(writerId)?.record.closed??false;}
 copies():FormDraftCopy<T>[]{
  const result:FormDraftCopy<T>[]=[];
  for(const key of this.keys()){
   if(key===this.ownedKey)continue;
   const raw=this.storage.getItem(key);if(raw===null)continue;
   try{const record=this.parse(key,raw);if(!record.closed)result.push({key,value:record.value as T,updatedAt:record.updatedAt,writerId:record.writerId});}catch{/* Keep unreadable copies available separately; one damaged copy cannot block the rest. */}
  }
  return result.sort((a,b)=>b.updatedAt.localeCompare(a.updatedAt)||a.key.localeCompare(b.key));
 }
 unreadable():{key:string;raw:string}[]{
  const result:{key:string;raw:string}[]=[];
  for(const key of this.keys()){
   const raw=this.storage.getItem(key);if(raw===null)continue;
   try{const identity=JSON.parse(raw);if(identity?.account!==undefined&&identity.account!==this.account||identity?.id!==undefined&&identity.id!==this.id)continue;}catch{/* Unparseable bytes remain downloadable in their own account/form namespace. */}
   try{this.parse(key,raw);}catch{result.push({key,raw});}
  }
  return result;
 }
 /** Fork first, then switch ownership. Both the source and this page's previous copy survive. */
 loadCopy(key:string):T{
  if(!this.inScope(key))throw Error('This draft belongs to a different form.');
  const raw=this.storage.getItem(key);if(raw===null)throw Error('This saved draft is no longer available.');
  const record=this.parse(key,raw);if(record.closed)throw Error('This draft was already closed.');
  const value=clone(record.value as T),sequence=(this.latestWriter(this.writerId)?.record.sequence??this.sequence)+1,nextKey=`${this.prefix}.writer.${encodeURIComponent(this.writerId)}.fork.${sequence}.${crypto.randomUUID()}`;
  if(this.storage.getItem(nextKey)!==null)throw Error('A new draft copy could not be allocated. Retry.');
  this.storage.setItem(nextKey,this.serialized(value,false,sequence));
  this.ownedKey=nextKey;this.sequence=sequence;return value;
 }
}
