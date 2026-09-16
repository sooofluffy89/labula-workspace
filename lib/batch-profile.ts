import {z} from 'zod';

const positive=z.number().finite().positive().max(1000000).nullable();
export const batchUnits=[['kg','Kilograms'],['g','Grams'],['l','Litres'],['ml','Millilitres'],['pieces','Pieces'],['portions','Portions'],['other','Other']] as const;
export const batchPeriods=[['service','Per service'],['day','Per operating day'],['week','Per typical week']] as const;
export const batchSchedules=[['planned','Mostly planned','Made at scheduled times, before or during service.'],['mixed','Planned, with unexpected top-ups','We sometimes have to make extra batches during service.'],['unplanned','Mostly unexpected top-ups','We usually make more when it starts running out.'],['unknown','Not sure','']] as const;
export const batchSchema=z.object({version:z.literal(1),basis:z.literal('estimate'),output:z.object({amount:positive,unit:z.enum(['kg','g','l','ml','pieces','portions','other']).nullable(),unitOther:z.string().max(200),unknown:z.boolean()}).strict(),frequency:z.object({times:positive,period:z.enum(['service','day','week']).nullable(),unknown:z.boolean()}).strict(),work:z.object({minutes:positive,unknown:z.boolean()}).strict(),schedule:z.enum(['planned','mixed','unplanned','unknown']).nullable(),note:z.string().max(2000)}).strict();
export const editableBatchSchema=batchSchema.extend({output:batchSchema.shape.output.extend({amount:z.number().finite().nullable()}),frequency:batchSchema.shape.frequency.extend({times:z.number().finite().nullable()}),work:batchSchema.shape.work.extend({minutes:z.number().finite().nullable()})});
export type BatchProfile=z.infer<typeof batchSchema>;
export const emptyBatch=():BatchProfile=>({version:1,basis:'estimate',output:{amount:null,unit:null,unitOther:'',unknown:false},frequency:{times:null,period:null,unknown:false},work:{minutes:null,unknown:false},schedule:null,note:''});
export function cleanBatch(raw:BatchProfile){const b=structuredClone(editableBatchSchema.parse(raw));if(b.output.unknown){b.output.amount=null;b.output.unit=null;b.output.unitOther='';}if(b.output.unit!=='other')b.output.unitOther='';if(b.frequency.unknown){b.frequency.times=null;b.frequency.period=null;}if(b.work.unknown)b.work.minutes=null;return batchSchema.parse(b);}
export function batchCompletion(p:{workflow:string|null;batch?:BatchProfile}){
 const applicable=p.workflow!=='supplied'&&p.workflow!=='order';
 if(!applicable)return {complete:true,applicable:false,unknown:false,missing:[] as string[]};
 if(p.workflow!=='ahead'&&p.workflow!=='hybrid')return {complete:false,applicable:true,unknown:false,missing:['how this item is used']};
 const b=p.batch??emptyBatch(),missing:string[]=[];
 if(!b.output.unknown){if(b.output.amount===null||b.output.amount<=0)missing.push('usual batch output');if(!b.output.unit||b.output.unit==='other'&&!b.output.unitOther.trim())missing.push('output unit');}
 if(!b.frequency.unknown){if(b.frequency.times===null||b.frequency.times<=0)missing.push('batches made');if(!b.frequency.period)missing.push('frequency period');}
 if(!b.work.unknown&&(b.work.minutes===null||b.work.minutes<=0))missing.push('hands-on minutes');
 if(!b.schedule)missing.push('planned or unexpected batches');
 return {complete:!missing.length,applicable:true,unknown:b.output.unknown||b.frequency.unknown||b.work.unknown||b.schedule==='unknown',missing};
}
