import {z} from 'zod';
import {actionMetaSchema} from './activity';
import {normalizeName} from './notebook';
import type {Category} from './menu';
import type {IngredientGroupId} from './ingredient-groups';

export const stockChangeSchema=z.object({itemId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),included:z.boolean(),track:z.boolean()}).strict().refine(v=>v.included||!v.track,'Removed items cannot be tracked.');
export const stockCommandSchema=z.object({id:z.string().uuid(),meta:actionMetaSchema.optional(),changes:z.array(stockChangeSchema).min(1).max(1000)}).strict().refine(v=>new Set(v.changes.map(c=>c.itemId)).size===v.changes.length,'Each item can only appear once.');
export type StockCommand=z.infer<typeof stockCommandSchema>;
export type StockItem={itemId:string;name:string;aliases:string[];kind:'bought'|'prep';categories?:Category[];included:boolean;track:boolean;revision:number;updatedAt:string;updatedBy:string;groupId:IngredientGroupId|null;groupRevision:number;groupSource:string|null};
export type StockSnapshot={accountId:string;account:string;scope:'kitchen';items:StockItem[];notebookRevision:number;canManageGroups:boolean;groupConflicts:{sourceId:string;sourceName:string;targetId:string;targetName:string;sourceGroupId:IngredientGroupId|null;targetGroupId:IngredientGroupId|null}[]};
export type StockFilter='all'|'tracked'|'untracked';
export type StockTypeFilter='all'|StockItem['kind'];
export type StockCategoryFilter=readonly Category[];
export function stockRows(items:StockItem[],search:string,filter:StockFilter='all',included=true,kind:StockTypeFilter='all',categories:StockCategoryFilter=[]){
 const query=normalizeName(search);
 return items.filter(i=>i.included===included&&(kind==='all'||i.kind===kind)&&(!categories.length||categories.some(category=>i.categories?.includes(category)))&&(filter==='all'||(filter==='tracked'?i.track:!i.track))&&[i.name,...i.aliases].some(n=>normalizeName(n).includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.itemId.localeCompare(b.itemId));
}
export function stockCounts(items:StockItem[]){const included=items.filter(i=>i.included);const tracked=included.filter(i=>i.track).length;return {total:included.length,tracked,untracked:included.length-tracked};}
