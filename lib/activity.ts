import {answerActivityLabel} from './stock-wording';
import {z} from 'zod';

// Optional for old, already queued requests. Never synthesize a click time on retry.
export const actionMetaSchema=z.object({occurredAt:z.string().datetime(),sessionId:z.string().uuid(),sequence:z.number().int().positive(),supersedesCommandId:z.string().uuid().optional()}).strict();
export type ActionMeta=z.infer<typeof actionMetaSchema>;
export type TeamMember={id:string;userId:string|null;email:string;name:string;active:boolean;accessRole?:'cook'|'manager'|'legacy';revision:number;owner:boolean};
export type TeamSnapshot={accountId:string;self:TeamMember;isOwner:boolean;canManage?:boolean;members:TeamMember[]};
export type TeamDirectory={accountId:string;email:string;isOwner:boolean;canManage?:boolean;members:TeamMember[]};
export const teamCommandSchema=z.discriminatedUnion('kind',[
 z.object({id:z.string().uuid(),kind:z.literal('add'),email:z.string().trim().email().max(254).transform(v=>v.toLowerCase()),name:z.string().trim().min(1).max(80)}).strict(),
 z.object({id:z.string().uuid(),kind:z.literal('edit'),memberId:z.string().uuid(),revision:z.number().int().nonnegative(),name:z.string().trim().min(1).max(80),active:z.boolean()}).strict(),
 z.object({id:z.string().uuid(),kind:z.literal('role'),memberId:z.string().uuid(),revision:z.number().int().nonnegative(),role:z.enum(['cook','manager'])}).strict(),
]);
export type ActivityEvent={id:string;command_id:string;category:string;action:string;source:string;actor_id:string;actor_email:string;actor_name:string;recorded_at:string;client_at:string|null;session_id:string|null;sequence:number|null;supersedes_command_id:string|null;check_id:string|null;target_day:string|null;item_id:string|null;item_name:string|null;item_kind:string|null;before_value:string|null;after_value:string|null};
export type ActivityPage={events:ActivityEvent[];next:string|null;capturedThrough:string;throughRow:number;coverageFrom:string|null;isOwner:boolean};
export function activityTime(value:string){return new Date(value).toLocaleString('en-GB',{timeZone:'Europe/Prague',day:'numeric',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',second:'2-digit'});}
export function activityLabel(e:Pick<ActivityEvent,'category'|'action'|'after_value'>){
 const a=JSON.parse(e.after_value??'null');
 if(e.action==='answer')return answerActivityLabel(a?.value);
 if(e.action==='ready')return a?.ready?'Marked Ready':'Undid Ready';
 const labels:Record<string,string>={'prep-instruction':'Changed prep instruction','prep-feedback':'Added service feedback',start:'Started evening check',confirm:'Confirmed evening check',correct:'Reopened check for correction',dates:'Changed morning date',resolve:'Changed catalog link',supersede:'Linked merged item',created:'Task created from check',reopened:'Task reopened by check correction',cancelled:'Task removed by check correction',settings:'Changed stock settings',group:'Changed ingredient group',add:'Added team profile',edit:'Updated team profile',role:'Changed team role',merge:'Catalog merge affected stock',undo:'Catalog undo affected stock'};
 return labels[e.action]??e.action;
}
export function csvCell(value:unknown){const text=value==null?'':String(value);return '"'+(/^[\s]*[=+\-@]/.test(text)?"'"+text:text).replaceAll('"','""')+'"';}
