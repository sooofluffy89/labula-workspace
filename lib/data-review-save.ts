import {type ReviewData,type ReviewRecord} from './data-review';
export type PendingReview={operationId:string;revision:number;action:'save';data:ReviewData};
// Serial queue: acknowledgements never replace newer edits; an uncertain request is retried unchanged.
export class ReviewSaveQueue {
 current:ReviewData;acknowledged:ReviewData;revision:number;pending:PendingReview|null=null;running=false;
 constructor(record:ReviewRecord,public persist:()=>void,public changed:()=>void){this.current=record.data;this.acknowledged=record.data;this.revision=record.revision;}
 get dirty(){return JSON.stringify(this.current)!==JSON.stringify(this.acknowledged)||!!this.pending;}
 edit(data:ReviewData){this.current=data;this.persist();this.changed();}
 async save(send:(p:PendingReview)=>Promise<{revision:number;operationId:string}>){
  if(this.running||!this.dirty)return;this.running=true;this.changed();
  try{
   this.pending??={operationId:crypto.randomUUID(),revision:this.revision,action:'save',data:this.current};this.persist();
   const request=this.pending,result=await send(request);
   if(result.operationId!==request.operationId||result.revision!==request.revision+1)throw Error('Could not verify this save. Retry the same request.');
   this.revision=result.revision;this.acknowledged=request.data;this.pending=null;this.persist();
  }catch(error){
   // A definitive rejection did not write anything. A corrected draft must get a new ID.
   // Network failures and ambiguous responses retain the exact original operation.
   if([400,401,403,413,415,422].includes((error as {status?:number})?.status??0)){this.pending=null;this.persist();}
   throw error;
  }finally{this.running=false;this.changed();}
 }
}
