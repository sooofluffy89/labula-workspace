import {morningProgress,type EveningState,type SaveReceipt} from './evening-client';

// A matching ACK is necessary but not sufficient: a later intent or shared revision wins.
export function rowFeedback(state:EveningState,kind:'answer'|'ready',itemId:string){
 const check=state.snapshot?.check;
 const pending=state.pending.filter(p=>p.accountId===state.snapshot?.accountId&&p.command.kind===kind&&p.command.checkId===check?.id&&p.command.itemId===itemId);
 const receipt=state.acknowledged?.[kind+':'+itemId],c=receipt?.command;
 const blocked=state.loading||!!state.error||state.unauthorized||state.recoveryBlocked||!!state.freshnessError;
 const row=kind==='answer'?check?.answers.find(a=>a.itemId===itemId):check?.tasks.find(t=>t.itemId===itemId);
 const matches=receipt?.accountId===state.snapshot?.accountId&&c?.kind===kind&&c.checkId===check?.id&&row?.mappingValid&&row.revision===c.revision+1&&('value' in row?row.value===c.value:!row.cancelled&&row.ready===c.value);
 const label=pending.some(p=>p.rejected)?'Needs review':pending.length?state.verifying?'Verifying…':state.errorKind==='network'?'On this device · not shared':state.unauthorized||state.recoveryBlocked?'Not shared · action needed':pending.some(p=>state.sendingIds?.includes(p.command.id))?'Sending…':'Waiting to share':'';
 return {pending:pending.length>0,label,receiptId:c?.id??null,ackEligible:!pending.length&&!blocked&&!!matches};
}
export function savedStatus(state:EveningState,account:string,now=Date.now()){
 if(state.snapshot&&state.snapshot.account.toLowerCase()!==account.toLowerCase())return 'Verifying signed-in account…';
 if(state.publicationLoading)return 'Check published · loading shared Morning prep…';
 if(state.verifying&&state.pending.length)return `Checking the connection · ${state.pending.length} changes kept on this device`;
 if(state.verifying)return state.verifying==='finality'?'Verifying the complete morning plan…':'Verifying shared changes…';
 if(state.loading)return 'Loading shared check…';
 if(state.notice&&/Please wait|before this action|before opening|cannot be changed|no longer available|Finish needs|Open Correct/.test(state.notice))return state.notice;
 if(state.finishPhase==='summary')return 'Checking the shared summary…';
 if(state.finishPhase==='publishing')return 'Publishing morning prep…';
 if(state.errorKind==='network'&&state.pending.length&&!state.unauthorized&&!state.recoveryBlocked)return `Saved on this device · ${state.pending.length} changes waiting to sync. We’ll retry when the connection returns.`;
 if(state.error||state.unauthorized||state.recoveryBlocked)return 'Shared state could not be confirmed.';
 if(state.saving)return `${state.finishing?'Saving':'Sharing'} ${state.pending.length} change${state.pending.length===1?'':'s'}…`;
 if(state.pending.length)return `${state.pending.length} changes waiting to sync`;
 if(!state.snapshot)return 'Loading…';
 if(state.freshnessError||!state.lastVerifiedAt||now-state.lastVerifiedAt>=75000)return 'Shared state needs a refresh.';
 if(state.needsVerification)return 'Changes shared · complete plan needs verification.';
 if(morningProgress(state,now).complete)return '✓ All morning items ready · shared';
 return 'All changes shared.';
}
export function settledReceipt(state:EveningState,kind:SaveReceipt['command']['kind']){
 const r=state.settledSave,c=r?.command;
 return r?.accountId===state.snapshot?.accountId&&c?.kind===kind&&'checkId' in c&&c.checkId===state.snapshot?.check?.id?c.id:null;
}
