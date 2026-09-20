import {z} from 'zod';
import {digest} from './stamp';

const text=z.string().max(2000);
const key=z.string().min(1).max(150).refine(s=>!['__proto__','constructor','prototype'].includes(s));
export const workKinds=['A separate preparation','Made together with other items','A later step using an existing preparation','Received ready to use, no local prep','No longer used here','I need to check'] as const;
export const triggers=['A planned prep list','A stock level we check','The stock looks low','We run out during service','A customer order','Something else','Not sure'] as const;
export const limits=['Quality changes','Storage or cooling limits are not confirmed','Not enough storage space','Equipment capacity','It must be finished fresh','Demand varies too much','No known limit, not tested','Other','Not sure'] as const;
export const coverage=['Whole named task','Some parts missing','Already counted in another task','Not sure'] as const;
const answer=z.enum(['','estimate','check']);
export const outputSchema=z.object({id:key,detached:z.boolean().optional(),itemId:text,stage:text,status:answer,amount:text,unit:z.enum(['','kg','g','l','ml','pieces','portions','packs']),pack:text,content:text,contentUnit:z.enum(['','kg','g','l','ml','pieces']),meaning:text}).strict();
export const processSchema=z.object({id:key,name:text,kind:z.enum(['',...workKinds]),inputTask:text.optional(),inputOutput:text.optional(),inputId:text,separation:text,sharedScope:z.enum(['','All this work is local and separate','Includes shared work outside this review','I need to check']),outputs:z.array(outputSchema).max(40),workStatus:answer,minutes:text,crewMode:z.enum(['','One person','Constant crew','Total person-minutes']),people:text,coverage:z.enum(['',...coverage]),countedIn:text,fullStatus:answer,full:text,topupStatus:answer,topups:text,trigger:z.enum(['',...triggers]),emergency:z.boolean(),triggerOther:text,limits:z.array(z.enum(limits)).max(9),limitBasis:z.enum(['','Observed here','Assumption','I need to check']),limitOther:text,context:text}).strict();
// Compatibility is deliberately limited to the exact former server-generated shape.
const closedStamp=z.string().max(1500000).superRefine((v,ctx)=>{
 if(v.length<=60000)return;
 try{const old=JSON.parse(v),process=JSON.parse(old.process);if(Object.keys(old).sort().join(',')!=='by,evidence,on,process,result'||!['result','evidence','by','on'].every(k=>typeof old[k]==='string'&&old[k].length<=2000)||!processSchema.safeParse(process.facts).success||!z.object({days:text,unknown:z.boolean()}).strict().safeParse(process.week).success||Object.keys(process).some(k=>!['facts','week','countedIn'].includes(k))||process.countedIn&&!processSchema.safeParse(process.countedIn).success)throw Error();}
 catch{ctx.addIssue({code:'custom',message:'Unrecognised oversized confirmation. Keep the original for assisted recovery.'});}
}).transform(v=>v.length>60000?'qr1:sha256:'+digest(v):v);
export const quickCheckSchema=z.object({id:key,origin:z.enum(['explicit','draft-gap']).optional(),withdrawn:z.object({hash:text,reason:text,by:text,at:text}).strict().optional(),processId:text,topic:text,method:text,owner:text,due:text,result:text,evidence:text,performedBy:text,performedOn:text,closedHash:closedStamp.optional()}).strict();
export const quickSchema=z.object({version:z.literal(1),week:z.object({days:text,unknown:z.boolean()}).strict(),cases:z.array(z.object({id:key,processIds:z.array(key).max(20),deferred:z.boolean(),finished:z.string().max(200000).optional()}).strict()).length(8),processes:z.array(processSchema).max(80),checks:z.array(quickCheckSchema).max(500),position:z.object({caseId:text,processId:text,step:z.number().int().min(0).max(2),view:z.enum(['cases','case','results','checks','archive'])}).strict(),offers:z.record(key,z.object({decision:z.enum(['accepted','dismissed']),revision:z.number().int().min(0),itemId:text,field:text,previous:text,at:text}).strict()),approval:z.object({effective:text,reason:text,evidence:text}).strict()}).strict();
export type Quick=z.infer<typeof quickSchema>;
export type QuickProcess=z.infer<typeof processSchema>;
export type QuickOutput=z.infer<typeof outputSchema>;
export type QuickCheck=z.infer<typeof quickCheckSchema>;
