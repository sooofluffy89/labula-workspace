import {z} from 'zod';
import {settingValueSchema} from './manage-settings';
import {roundIds} from './check-rounds';
import {stationIdSchema} from './checking-stations';
import {groupIdSchema} from './ingredient-groups';
export const menuStockChangeSchema=z.object({itemId:z.string().min(1).max(100),before:settingValueSchema,target:z.object({track:z.boolean(),roundId:z.enum(roundIds).nullable(),stationId:stationIdSchema}).strict(),groupId:groupIdSchema,groupRevision:z.number().int().nonnegative()}).strict();
export const menuApplySchema=z.object({kind:z.literal('apply-menu'),fingerprint:z.string().min(1).max(100),recipeIds:z.array(z.string().min(1).max(100)).max(500),changes:z.array(menuStockChangeSchema).max(1000)}).strict();
export type MenuApplyOperation=z.infer<typeof menuApplySchema>;
