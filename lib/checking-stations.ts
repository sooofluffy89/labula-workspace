import {z} from 'zod';
import {actionMetaSchema} from './activity';
import type {StockItem} from './stock';
export const stationIds=['station-1','station-2','station-3'] as const;
export type StationId=typeof stationIds[number];
export type StationFilter='all'|'none'|StationId;
export const stationIdSchema=z.enum(stationIds).nullable();
export const stationFilterSchema=z.enum(['all','none',...stationIds]);
export const stationLabel=(id:StationId|null|undefined)=>id?`Station ${stationIds.indexOf(id)+1}`:'Not assigned';
export function validStation(id:unknown):StationId|null{return stationIds.includes(id as StationId)?id as StationId:null;}
export function matchesStation(item:{stationId?:StationId|null},filter:StationFilter){return filter==='all'||(item.stationId??'none')===filter;}
export function stationGroups<T extends {stationId?:StationId|null;value:unknown;mappingValid:boolean}>(items:T[]){return [...stationIds,null].map(id=>{const rows=items.filter(i=>(i.stationId??null)===id);return {id,label:stationLabel(id),rows,checked:rows.filter(i=>i.value!==null&&i.mappingValid).length};});}
export const stationCommandSchema=z.object({kind:z.literal('station'),id:z.string().uuid(),actorId:z.string().min(1),meta:actionMetaSchema.optional(),changes:z.array(z.object({itemId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),stationId:z.enum(stationIds).nullable(),beforeStationId:z.enum(stationIds).nullable().optional()}).strict()).min(1).max(1000)}).strict().refine(c=>new Set(c.changes.map(i=>i.itemId)).size===c.changes.length,'Select each item only once.');
export type StationCommand=z.infer<typeof stationCommandSchema>;
export const isStationCommand=(c:unknown):c is StationCommand=>!!c&&typeof c==='object'&&'kind' in c&&c.kind==='station';
export function makeStationCommand(items:StockItem[],stationId:StationId|null,actorId:string):StationCommand{return stationCommandSchema.parse({kind:'station',id:crypto.randomUUID(),actorId,changes:items.map(i=>({itemId:i.itemId,revision:i.stationRevision??0,stationId,beforeStationId:i.stationId??null}))});}
