import {emptyRoundFilters,type RoundFilters} from './check-rounds';
import type {PrepInstruction} from './prep-notes';
export type InstructionFilter='all'|'without'|'with';
export function matchesInstruction(id:string,filter:InstructionFilter,index:PrepInstruction[]|null){
 if(filter==='all')return true;
 if(!index)return false;
 const present=!!index.find(i=>i.item_id===id)?.text.trim();
 return filter==='with'?present:!present;
}
export type RoundView={filters:RoundFilters;instruction:InstructionFilter;collapsed:string[];filterOpen:boolean;showSelected:boolean;scroll:number;sort?:'asc'|'desc';tableScroll?:number};
export const initialRoundView=():RoundView=>({filters:{...emptyRoundFilters,current:'this',tracking:'tracked'},instruction:'all',collapsed:[],filterOpen:false,showSelected:false,scroll:0});
const views=new Map<string,RoundView>();
export function roundViewKey(account:string,round:string){return `labula.round-view.v1.${encodeURIComponent(account)}.${round}`;}
export function keepRoundView(key:string,value:RoundView,storage:Pick<Storage,'setItem'>){views.set(key,value);try{storage.setItem(key,JSON.stringify(value));}catch{/* Navigation preferences stay in memory; operational drafts have separate error handling. */}}
export function readRoundView(key:string,storage:Pick<Storage,'getItem'>):RoundView{
 if(views.has(key))return views.get(key)!;
 try{const v=JSON.parse(storage.getItem(key)??'null');if(v&&v.filters&&typeof v.filters.search==='string'&&Array.isArray(v.filters.menu)&&v.filters.menu.every((x:unknown)=>typeof x==='string')&&['type','group','tracking','current'].every(k=>typeof v.filters[k]==='string')&&['all','with','without'].includes(v.instruction)&&Array.isArray(v.collapsed)&&v.collapsed.every((x:unknown)=>typeof x==='string'))return {...initialRoundView(),...v,scroll:Number.isFinite(v.scroll)?Math.max(0,v.scroll):0,sort:v.sort==='desc'?'desc':'asc',tableScroll:Number.isFinite(v.tableScroll)?Math.max(0,v.tableScroll):0};}catch{/* Corrupt UI preferences do not replace operational selections. */}return initialRoundView();
}
