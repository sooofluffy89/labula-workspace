import {z} from 'zod';
import {normalizeName} from './notebook';

export const stockChangeSchema=z.object({itemId:z.string().min(1).max(100),revision:z.number().int().nonnegative(),included:z.boolean(),track:z.boolean()}).strict().refine(v=>v.included||!v.track,'Removed items cannot be tracked.');
export const stockCommandSchema=z.object({id:z.string().uuid(),changes:z.array(stockChangeSchema).min(1).max(1000)}).strict().refine(v=>new Set(v.changes.map(c=>c.itemId)).size===v.changes.length,'Each item can only appear once.');
export type StockCommand=z.infer<typeof stockCommandSchema>;
export type StockItem={itemId:string;name:string;aliases:string[];kind:'bought'|'prep';included:boolean;track:boolean;revision:number;updatedAt:string;updatedBy:string};
export type StockSnapshot={accountId:string;account:string;scope:'kitchen';items:StockItem[];notebookRevision:number};
export type StockFilter='all'|'tracked'|'untracked';
export function stockRows(items:StockItem[],search:string,filter:StockFilter='all',included=true){
 const query=normalizeName(search);
 return items.filter(i=>i.included===included&&(filter==='all'||(filter==='tracked'?i.track:!i.track))&&[i.name,...i.aliases].some(n=>normalizeName(n).includes(query))).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.itemId.localeCompare(b.itemId));
}
export function stockCounts(items:StockItem[]){const included=items.filter(i=>i.included);const tracked=included.filter(i=>i.track).length;return {total:included.length,tracked,untracked:included.length-tracked};}
