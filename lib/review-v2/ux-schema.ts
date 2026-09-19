import {z} from 'zod';
const key=z.string().min(1).max(150).refine(s=>!['__proto__','prototype','constructor'].includes(s));
const target=z.object({entityId:key,group:key,path:z.array(key).max(12)}).strict();
const position=z.object({entityId:key,group:key}).strict();
export const uxSchema=z.object({
 version:z.literal(1),
 facts:z.record(key,z.object({target,sourceRevision:z.number().int(),sourcePath:z.string().max(1000),sourceValue:z.string().max(12000),decision:z.enum(['accepted','change','check']),at:z.string().max(40)}).strict()),
 confirmations:z.record(key,z.record(key,z.object({value:z.string().max(200000),dependencies:z.string().max(200000),at:z.string().max(40)}).strict())),
 returns:z.array(z.object({id:key,origin:target,expected:z.string().max(12000),destination:position,selection:key.optional(),ref:key.optional(),label:z.string().max(1000)}).strict()).max(20),
 workPosition:position.optional(),
 focus:target.optional(),
}).strict();
export type ReviewUX=z.infer<typeof uxSchema>;
export const emptyUX=():ReviewUX=>({version:1,facts:{},confirmations:{},returns:[]});
