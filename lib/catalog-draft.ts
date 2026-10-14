import {z} from 'zod';
import {operationSchema} from './catalog';
export const catalogRecoverySchema=z.object({id:z.string().uuid(),revision:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),operation:operationSchema}).strict();
export type CatalogRecovery=z.infer<typeof catalogRecoverySchema>;
export const aliasDraftSchema=z.object({itemId:z.string().min(1).max(100),text:z.string().max(750000),base:z.array(z.string().max(160)).max(30)}).strict();
export type AliasDraft=z.infer<typeof aliasDraftSchema>;
export type AliasDrafts=Record<string,AliasDraft>;
export const hasAliasChanges=(draft:AliasDraft)=>draft.text!==draft.base.join('\n');
