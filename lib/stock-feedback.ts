import type {EveningState,SaveReceipt} from './evening-client';

// A matching ACK is necessary but not sufficient: a later intent or shared revision wins.
export function rowFeedback(state:EveningState,kind:'answer'|'ready',itemId:string){
 const check=state.snapshot?.check;
 const pending=state.pending.filter(p=>p.accountId===state.snapshot?.accountId&&p.command.kind===kind&&p.command.checkId===check?.id&&p.command.itemId===itemId);
 const receipt=state.acknowledged?.[kind+':'+itemId],c=receipt?.command;
 const blocked=state.loading||!!state.error||state.unauthorized||state.recoveryBlocked||!!state.freshnessError;
 const row=kind==='answer'?check?.answers.find(a=>a.itemId===itemId):check?.tasks.find(t=>t.itemId===itemId);
 const matches=receipt?.accountId===state.snapshot?.accountId&&c?.kind===kind&&c.checkId===check?.id&&row?.mappingValid&&row.revision===c.revision+1&&('value' in row?row.value===c.value:!row.cancelled&&row.ready===c.value);
 return {pending:pending.length>0,label:pending.length?(pending.some(p=>p.rejected)||blocked?'Save not confirmed — review or retry':'Waiting to sync'):'',receiptId:c?.id??null,ackEligible:!pending.length&&!blocked&&!!matches};
}
export function savedStatus(state:EveningState,account:string,now=Date.now()){
 if(state.snapshot&&state.snapshot.account.toLowerCase()!==account.toLowerCase())return 'Verifying signed-in account…';
 if(state.error||state.unauthorized||state.recoveryBlocked)return 'Shared state could not be confirmed.';
 if(state.loading)return 'Loading shared check…';
 if(state.saving)return 'Saving changes…';
 if(state.pending.length)return `${state.pending.length} changes waiting to sync`;
 if(!state.snapshot)return 'Loading…';
 if(state.freshnessError||!state.lastVerifiedAt||now-state.lastVerifiedAt>=75000)return 'Shared state needs a refresh.';
 return 'Changes saved.';
}
export function settledReceipt(state:EveningState,kind:SaveReceipt['command']['kind']){
 const r=state.settledSave,c=r?.command;
 return r?.accountId===state.snapshot?.accountId&&c?.kind===kind&&'checkId' in c&&c.checkId===state.snapshot?.check?.id?c.id:null;
}
