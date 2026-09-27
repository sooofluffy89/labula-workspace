import {z} from 'zod';
import {calendarDay,dateSchema,shiftDay} from './evening';

const time=z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const deadlineSchema=z.object({evening:time.nullable(),eveningOffset:z.union([z.literal(0),z.literal(1)]),morning:time.nullable()}).strict();
export const calendarConfigSchema=z.object({
 openDays:z.array(z.number().int().min(0).max(6)).min(1).max(7).refine(v=>new Set(v).size===v.length,'Choose distinct open days.'),
 exceptions:z.array(z.object({day:dateSchema,open:z.boolean(),note:z.string().max(160)}).strict()).max(366),
 deadlines:z.array(deadlineSchema.extend({weekday:z.number().int().min(0).max(6)})).length(7),
 deadlineExceptions:z.array(deadlineSchema.extend({day:dateSchema})).max(366),
}).strict().superRefine((v,c)=>{for(const [key,values] of [['exceptions',v.exceptions.map(x=>x.day)],['deadlines',v.deadlines.map(x=>x.weekday)],['deadlineExceptions',v.deadlineExceptions.map(x=>x.day)]] as const)if(new Set<string|number>(values).size!==values.length)c.addIssue({code:'custom',path:[key],message:'Each day must appear only once.'});});
export type CalendarConfig=z.infer<typeof calendarConfigSchema>;
export type CalendarVersion={revision:number;effectiveDay:string;config:CalendarConfig;createdAt:string;createdBy:string};
export type CalendarSnapshot={versions:CalendarVersion[];revision:number;accountId:string;account?:string;isOwner:boolean;impacts?:{id:string;targetDay:string;stage:string}[]};
export const defaultCalendar=():CalendarConfig=>({openDays:[0,2,3,4,5,6],exceptions:[],deadlines:Array.from({length:7},(_,weekday)=>({weekday,evening:null,eveningOffset:0,morning:null})),deadlineExceptions:[]});
export function weekday(day:string){return new Date(day+'T12:00:00Z').getUTCDay();}
export function calendarVersion(day:string,versions:CalendarVersion[]){return versions.filter(v=>v.effectiveDay<=day).sort((a,b)=>b.effectiveDay.localeCompare(a.effectiveDay)||b.revision-a.revision)[0]??null;}
export function isOpenDay(day:string,versions:CalendarVersion[]){const c=calendarVersion(day,versions)?.config;return c?(c.exceptions.find(e=>e.day===day)?.open??c.openDays.includes(weekday(day))):true;}
export function nextOpenDay(day:string,versions:CalendarVersion[],include=false){for(let n=include?0:1;n<=740;n++){const d=shiftDay(day,n);if(!d)break;if(isOpenDay(d,versions))return d;}throw Error('No open day found. Ask the owner to review the operating calendar.');}
export function previousOpenDay(day:string,versions:CalendarVersion[]){for(let n=1;n<=740;n++){const d=shiftDay(day,-n);if(!d)break;if(isOpenDay(d,versions))return d;}throw Error('No earlier open day found.');}
export function deadlineRule(day:string,versions:CalendarVersion[]){const v=calendarVersion(day,versions);return v?{version:v.revision,rule:v.config.deadlineExceptions.find(r=>r.day===day)??v.config.deadlines.find(r=>r.weekday===weekday(day))!}:null;}
// Convert a Prague wall clock to an instant. Repeated DST times use the later
// occurrence; non-existent spring times advance to the first valid local minute.
export function pragueInstant(day:string,hhmm:string){
 const target=Date.parse(day+'T'+hhmm+':00Z');if(!Number.isFinite(target))throw Error('Invalid local time.');
 const format=new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Prague',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
 const desired=day+' '+hhmm,exact:number[]=[];let following:number|undefined;
 for(let t=target-3*3600000;t<=target+3600000;t+=60000){const local=format.format(new Date(t));if(local===desired)exact.push(t);if(local.slice(0,10)===day&&local>desired&&following===undefined)following=t;}
 const t=exact.at(-1)??following;if(t===undefined)throw Error('This local deadline cannot be resolved.');return new Date(t).toISOString();
}
export function deadlineAt(day:string,kind:'evening'|'morning',versions:CalendarVersion[]){const d=deadlineRule(day,versions);if(!d||!d.rule[kind])return null;return pragueInstant(kind==='evening'?shiftDay(day,d.rule.eveningOffset):day,d.rule[kind]!);}
export function openDaysBack(count:number,versions:CalendarVersion[],now=new Date()){let day=calendarDay(now);if(!isOpenDay(day,versions))day=previousOpenDay(shiftDay(day,1),versions);const through=day;for(let n=1;n<count;n++)day=previousOpenDay(day,versions);return {from:day,to:through};}
export const calendarCommandSchema=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('initialize'),id:z.string().uuid(),actorId:z.string().min(1)}).strict(),
 z.object({kind:z.literal('configure'),id:z.string().uuid(),actorId:z.string().min(1),revision:z.number().int().nonnegative(),effectiveDay:dateSchema,config:calendarConfigSchema}).strict(),
]);
