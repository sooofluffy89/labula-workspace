import {emptyUX} from './ux-schema';
import {same,parseDraft,migrate,type Draft,type Review2Record} from './model';
import type {ReviewSource} from '../data-review';
export type Pending={clientVersion?:3|4;operationId:string;revision:number;action:'save2';data:Draft};
export class SaveQueue{
 current:Draft;acknowledged:Draft;revision:number;pending:Pending|null=null;running=false;
 constructor(record:Review2Record,private persist:()=>void,private notify:()=>void){this.current=record.data;this.acknowledged=record.data;this.revision=record.revision;}
 get dirty(){return !same(this.current,this.acknowledged)||!!this.pending;}
 edit(data:Draft){this.current=data;this.persist();this.notify();}
 async save(send:(p:Pending)=>Promise<{operationId:string;revision:number}>){if(this.running||!this.dirty)return;this.running=true;this.notify();try{this.pending??={operationId:crypto.randomUUID(),revision:this.revision,action:'save2',clientVersion:this.current.quick?4:3,data:structuredClone(this.current)};this.persist();const p=this.pending,r=await send(p);if(r.operationId!==p.operationId||r.revision!==p.revision+1)throw Error('Save acknowledgement could not be verified. Retry safely.');this.revision=r.revision;this.acknowledged=p.data;this.pending=null;this.persist();}catch(e){const code=(e as {status?:number}).status;if([400,401,403,413,415,422,426].includes(code??0)){this.pending=null;this.persist();}throw e;}finally{this.running=false;this.notify();}}
}
export type Recovery={format:'Labula review recovery v2';campaign:string;userId:string;user:string;record:Review2Record;current:Draft;acknowledged:Draft;pending:Pending|null;pendingAction?:{body:Record<string,unknown>;revision:number}|null;revision:number;savedAt:string};
export type ImportCandidate={source:ReviewSource;current:Draft;acknowledged:Draft;raw:unknown;pending:unknown;revision:number;campaign:string;user:string;userId?:string;pendingAction?:{body:Record<string,unknown>;revision:number}};
export function importCandidate(raw:unknown):ImportCandidate{const b=raw as Record<string,unknown>;if(!b||typeof b!=='object')throw Error('This is not a review recovery file. The original file remains available.');const record=b.record as {source?:ReviewSource};if(!record?.source?.notebook||typeof b.revision!=='number'||typeof b.campaign!=='string'||typeof b.user!=='string')throw Error('Recovery metadata is missing. Keep the original file for repair.');return {source:record.source,current:migrate(record.source,b.current),acknowledged:migrate(record.source,b.acknowledged),raw,pending:b.pending,pendingAction:b.pendingAction as ImportCandidate['pendingAction'],revision:b.revision,campaign:b.campaign,user:b.user,userId:typeof b.userId==='string'?b.userId:undefined};}
export type Difference={path:string[];label:string;base:unknown;local:unknown;shared:unknown;conflict:boolean};
// Add/remove records atomically; merge edits by stable row identity. Never infer array types from field names.
export function differences(base:Draft,local:Draft,shared:Draft):Difference[]{
 const out:Difference[]=[];
 const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
 const rows=(v:unknown):v is {id:string}[]=>Array.isArray(v)&&v.every(x=>object(x)&&typeof x.id==='string');
 const walk=(before:unknown,after:unknown,now:unknown,path:string[])=>{
  if(same(before,after))return;
  if(path[0]==='ux'&&['workPosition','returns','focus'].includes(path[1]))return;
  if(path.length===1&&['schemaVersion','position','imports','legacy','migration'].includes(path[0]))return;
  if(rows(before)&&rows(after)&&rows(now)){
   for(const id of new Set([...before,...after].map(x=>x.id)))walk(before.find(x=>x.id===id),after.find(x=>x.id===id),now.find(x=>x.id===id),[...path,id]);
  }else if(object(before)&&object(after)&&object(now)){
   for(const k of new Set([...Object.keys(before),...Object.keys(after)]))walk(before[k],after[k],now[k],[...path,k]);
  }else out.push({path,label:path.join(' / '),base:before,local:after,shared:now,conflict:!same(now,before)&&!same(now,after)});
 };
 walk({...base,ux:base.ux??emptyUX()},{...local,ux:local.ux??emptyUX()},{...shared,ux:shared.ux??emptyUX()},[]);return out;
}
function setPath(root:unknown,path:string[],value:unknown){
 const [head,...tail]=path;if(!head)return;
 if(Array.isArray(root)){
  const index=root.findIndex(x=>x?.id===head);
  if(tail.length){if(index<0)throw Error('The shared row changed. Compare the versions again.');setPath(root[index],tail,value);}
  else if(value===undefined){if(index>=0)root.splice(index,1);}
  else if(index<0)root.push(structuredClone(value));else root[index]=structuredClone(value);
 }else if(root&&typeof root==='object'){
  const obj=root as Record<string,unknown>;
  if(tail.length){if(obj[head]===undefined)throw Error('The shared record changed. Compare the versions again.');setPath(obj[head],tail,value);}
  else if(value===undefined)delete obj[head];else obj[head]=structuredClone(value);
 }else throw Error('The shared record structure changed. Keep the recovery copy and compare again.');
}
export function mergeCandidate(shared:Draft,diff:Difference[],choices:Record<string,'local'|'shared'>):Draft{const next=structuredClone(shared.ux||diff.some(x=>x.path[0]==='ux')?{...shared,ux:shared.ux??emptyUX()}:shared);for(const change of diff){const key=JSON.stringify(change.path);if(change.conflict&&!choices[key])throw Error('Choose which answer to keep for every conflict.');if(choices[key]!=='shared')setPath(next,change.path,change.local);}return parseDraft(next);}
