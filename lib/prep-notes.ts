import {z} from 'zod';
import {dateSchema} from './evening';
import {actionMetaSchema} from './activity';
const id=z.string().min(1).max(160),revision=z.number().int().nonnegative();
export const recordedInstructionSchema=z.object({catalogId:id,revision,text:z.string().max(500)});
export type RecordedInstruction=z.infer<typeof recordedInstructionSchema>;
export const noteContextSchema=z.object({checkId:dateSchema,itemId:id,catalogId:id,version:revision,instructionRevision:revision.nullable(),phase:z.enum(['evening','morning'])}).strict();
export type NoteContext=z.infer<typeof noteContextSchema>;
const base={id:z.string().uuid(),actorId:id,meta:actionMetaSchema.optional()};
export const prepNoteCommandSchema=z.discriminatedUnion('kind',[
 z.object({...base,kind:z.literal('instruction'),itemId:id,revision,text:z.string().max(500).transform(s=>s.trim())}).strict(),
 z.object({...base,kind:z.literal('feedback'),context:noteContextSchema,text:z.string().max(500).transform(s=>s.trim()).pipe(z.string().min(1))}).strict(),
]);
export type PrepNoteCommand=z.infer<typeof prepNoteCommandSchema>;
export type PrepComment={id:string;check_id:string;item_id:string;catalog_id:string;version:number;instruction_revision:number|null;phase:'evening'|'morning';text:string;actor_name:string;actor_id:string;actor_email:string;created_at:string;client_at:string|null};
export type PrepInstruction={item_id:string;text:string;revision:number;updated_at:string;updated_by:string};
export type InstructionIndex={account:string;accountId:string;supported:1;instructions:PrepInstruction[]};
export type InstructionVersion={id:string;item_id:string;text:string;revision:number;actor_name:string;created_at:string};
export type NotesPage={account:string;accountId:string;supported:1;canEdit:boolean;instruction?:PrepInstruction|null;comments:PrepComment[];versions:InstructionVersion[];next:string|null;versionsNext?:number|null};
export const contextKey=(c:NoteContext)=>[c.checkId,c.itemId,c.catalogId,c.version,c.instructionRevision??'legacy',c.phase].map(encodeURIComponent).join('.');

// A draft survives confirmation of the same service; a remap/instruction change keeps a separate draft.
export const draftContextKey=(c:NoteContext)=>[c.checkId,c.itemId,c.catalogId,c.instructionRevision??'legacy',c.phase].map(encodeURIComponent).join('.');
