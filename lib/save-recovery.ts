import {z} from 'zod';
import {validateNotebook} from './notebook';

export const MAX_NOTEBOOK_PAYLOAD_BYTES=750000;

// A recovery receipt must replay the original serialized request. Validation
// checks its contents without replacing it with a normalized notebook object.
const notebookPayloadSchema=z.string().superRefine((payload,ctx)=>{
 if(new TextEncoder().encode(payload).length>MAX_NOTEBOOK_PAYLOAD_BYTES){ctx.addIssue({code:z.ZodIssueCode.custom,message:'This saved notebook is too large.'});return;}
 try{
  const notebook=JSON.parse(payload,(key,value)=>{if(key==='__proto__'||key==='prototype'||key==='constructor')throw Error('Unsupported property in saved notebook.');return value;});
  validateNotebook(notebook);
 }catch{ctx.addIssue({code:z.ZodIssueCode.custom,message:'This saved notebook could not be validated.'});}
});

export const saveRecoverySchema=z.object({
 id:z.string().uuid(),
 revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
 payload:notebookPayloadSchema,
 localPayload:notebookPayloadSchema,
}).strict();
export type SaveRecovery=z.infer<typeof saveRecoverySchema>;
