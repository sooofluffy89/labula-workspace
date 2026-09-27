import {z} from 'zod';
import {dateSchema,type CheckAnswer} from './evening';
import {menu} from './menu';
import type {Item,Notebook,Recipe} from './notebook';
import type {CheckTask} from './review-v2/model';
import type {Round} from './check-rounds';
import type {QuickProcess,QuickCheck} from './quick-review/schema';

const id=z.string().min(1).max(160);
export const informationTarget=z.discriminatedUnion('kind',[
 z.object({kind:z.literal('ingredient'),id}).strict(),
 z.object({kind:z.literal('recipe'),id,item:id.optional()}).strict(),
 z.object({kind:z.literal('usage'),id,item:id,active:z.boolean().optional()}).strict(),
 z.object({kind:z.literal('source'),id:dateSchema,version:z.number().int().positive().optional(),item:id.optional()}).strict(),
 z.object({kind:z.literal('review'),id}).strict(),
 z.object({kind:z.literal('history'),id,check:dateSchema.optional()}).strict(),
]);
export type InformationTarget=z.infer<typeof informationTarget>;
export function informationHash(target:InformationTarget){return '#info='+encodeURIComponent(JSON.stringify(target));}
export function parseInformationHash(hash:string):InformationTarget|null{try{if(!hash.startsWith('#info='))return null;const r=informationTarget.safeParse(JSON.parse(decodeURIComponent(hash.slice(6))));return r.success?r.data:null;}catch{return null;}}
export function itemVariants(n:Notebook,itemId:string){return menu.flatMap(d=>{const variants=n.recipes.filter(r=>r.menuId===d.id&&r.inputs.some(i=>i.itemId===itemId));return variants.length?[{id:d.id,name:d.name,variants}]:[];});}
export type RelatedReview={id:string;name:string;status:string;openChecks:number};
export type StockInformation={included:boolean;track:boolean;groupId:string|null;roundId:string|null;round:Round|null};
export type IngredientInformation={kind:'ingredient';item:Item|null;id:string;uses:ReturnType<typeof itemVariants>;inputs:{id:string;name:string}[];related:RelatedReview[];stock:StockInformation|null;excluded:boolean;revision:number;mergedInto:string|null};
export type RecipeInformation={kind:'recipe';recipe:Recipe;dish:string;items:Item[];highlight?:string};
export type UsageInformation={kind:'usage';dish:string;item:string;variants:Recipe[]};
export type SourceInformation={kind:'source';id:string;version:number;targetDay:string;confirmedAt:string;confirmedBy:string;answers:Pick<CheckAnswer,'itemId'|'catalogId'|'name'|'kind'|'value'|'updatedAt'|'updatedBy'|'supersededBy'|'groupId'|'round'|'instruction'|'feedbackCount'>[];latestVersion:number;correcting:boolean;item?:string};
export type ReviewInformation={kind:'review';name:string;status:string;week:{days:string;unknown:boolean}|null;references:Record<string,string>;updatedAt:string;updatedBy:string;processes:{id:string;name:string;facts:Partial<QuickProcess>;production:boolean;checks:(QuickCheck&{open:boolean})[];approval:string;approvalBy?:string;approvalAt?:string;outputs:{id:string;name:string}[]}[];legacyStatus:string;legacyChecks:(CheckTask&{open:boolean})[];legacy:{title:string;values:Record<string,unknown>}[]};
export type Information=IngredientInformation|RecipeInformation|UsageInformation|SourceInformation|ReviewInformation;
