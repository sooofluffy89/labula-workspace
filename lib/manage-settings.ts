import {z} from 'zod';
import {actionMetaSchema} from './activity';
import {roundIds,type RoundId,type Round} from './check-rounds';
import {stationIdSchema,type StationId} from './checking-stations';
import type {StockItem,StockSnapshot} from './stock';
const revision=z.number().int().nonnegative();
export const settingValueSchema=z.object({included:z.boolean(),track:z.boolean(),roundId:z.enum(roundIds).nullable(),stationId:stationIdSchema,revision,roundRevision:revision,stationRevision:revision}).strict();
export type SettingValue=z.infer<typeof settingValueSchema>;
export const manageCommandSchema=z.object({kind:z.literal('item-settings'),id:z.string().uuid(),actorId:z.string().min(1),itemId:z.string().min(1).max(100),meta:actionMetaSchema,
 before:settingValueSchema,target:z.object({track:z.boolean(),roundId:z.enum(roundIds).nullable(),stationId:stationIdSchema}).strict()
}).strict();
export type ManageCommand=z.infer<typeof manageCommandSchema>;
export type ManageSnapshot=StockSnapshot&{manageSettings:1;rounds:Round[];configuration:Record<string,SettingValue>};
export type ManageReceipt={operationId:string;itemId:string;before:SettingValue;after:SettingValue};
export function settingValue(item:StockItem,roundId:RoundId|null,roundRevision:number):SettingValue{return {included:item.included,track:item.track,roundId,stationId:item.stationId??null,revision:item.revision,roundRevision,stationRevision:item.stationRevision??0};}
export function settingAfter(before:SettingValue,target:ManageCommand['target']):SettingValue{
 const included=target.track?true:before.included,stockChanged=included!==before.included||target.track!==before.track,roundChanged=stockChanged||target.roundId!==before.roundId;
 return {...before,...target,included,revision:before.revision+Number(stockChanged),roundRevision:before.roundRevision+Number(roundChanged),stationRevision:before.stationRevision+Number(target.stationId!==before.stationId)};
}
export function settingProblem(before:SettingValue,target:ManageCommand['target']):string{
 if(target.track&&!target.roundId)return 'Choose a frequency to turn tracking on.';
 if(target.track&&!target.stationId&&(!before.track||!!before.stationId))return 'Choose a station to turn tracking on.';
 return '';
}
export function sameSetting(a:SettingValue,b:SettingValue){return a.included===b.included&&a.track===b.track&&a.roundId===b.roundId&&a.stationId===b.stationId&&a.revision===b.revision&&a.roundRevision===b.roundRevision&&a.stationRevision===b.stationRevision;}
export const settingDescription=(v:Pick<SettingValue,'track'|'roundId'|'stationId'>)=>`Track ${v.track?'On':'Off'} · ${v.roundId==='twice-weekly'?'Twice weekly':v.roundId==='daily'?'Daily':v.roundId==='weekly'?'Weekly':'No frequency'} · ${v.stationId?'Station '+v.stationId.slice(-1):'Not assigned'}`;
export function applySetting(snapshot:ManageSnapshot,itemId:string,value:SettingValue):ManageSnapshot{
 const previous=snapshot.configuration[itemId];if(!previous)return snapshot;
 // Independent revision domains: an old ACK must not replace newer station or round data.
 const stock=value.revision>=previous.revision,round=value.roundRevision>=previous.roundRevision,station=value.stationRevision>=previous.stationRevision;
 const next={...previous,...(stock?{track:value.track,included:value.included,revision:value.revision}:{}),...(round?{roundId:value.roundId,roundRevision:value.roundRevision}:{}),...(station?{stationId:value.stationId,stationRevision:value.stationRevision}:{})};
 return {...snapshot,configuration:{...snapshot.configuration,[itemId]:next},items:snapshot.items.map(i=>i.itemId===itemId?{...i,included:next.included,track:next.track,revision:next.revision,stationId:next.stationId,stationRevision:next.stationRevision}:i)};
}
export type SettingPatch={track?:boolean;roundId?:RoundId|null;stationId?:StationId|null};
