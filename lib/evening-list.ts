import type {CheckAnswer} from './evening';
import type {EveningState} from './evening-client';

// Display eligibility only. Saving and Finish continue to use the controller's original state.
export function eveningListIssues(state:EveningState,extraIds:string[]=[]){
 return new Set([...extraIds,...state.pending.flatMap(p=>p.rejected&&p.accountId===state.snapshot?.accountId&&p.command.kind==='answer'&&p.command.checkId===state.snapshot?.check?.id?[p.command.itemId]:[])]);
}
export function isEveningChecked(answer:CheckAnswer,issues:ReadonlySet<string>){return answer.value!==null&&answer.mappingValid&&!issues.has(answer.itemId);}
