import {resolveDraft,type BulkSuggestion,type DraftRow} from './bulk';
import type {Item} from './notebook';

export type MatchEnd={type:'row'|'item';key:string;name:string;kind:Item['kind']};
export type MatchPair={id:string;a:MatchEnd;b:MatchEnd};
export const pairId=(a:MatchEnd,b:MatchEnd)=>JSON.stringify([a,b].map(({type,key})=>[type,key]).sort((x,y)=>JSON.stringify(x).localeCompare(JSON.stringify(y))));

// Resolve suggestions to their current roots, then present each pair only once.
export function matchPairs(rows:DraftRow[],items:Item[],matches:Map<string,BulkSuggestion[]>):MatchPair[]{
 const {resolve}=resolveDraft(rows,items),byKey=new Map(rows.map(r=>[r.key,r])),byId=new Map(items.map(i=>[i.id,i]));
 const endpoint=(row:DraftRow):MatchEnd|null=>{if(row.skip)return null;try{const r=resolve(row);if(r.itemId)return {type:'item',key:r.itemId,name:r.name,kind:r.kind};const root=byKey.get(r.key.slice(4));return root&&!root.separate?{type:'row',key:root.key,name:r.name,kind:r.kind}:null;}catch{return null;}};
 const pairs=new Map<string,MatchPair>();
 for(const row of rows){const a=endpoint(row);if(!a)continue;for(const s of matches.get(row.key)??[]){let b:MatchEnd|null=null;if(s.target.type==='row'){const other=byKey.get(s.target.key);b=other?endpoint(other):null;}else{const item=byId.get(s.target.id);if(item)b={type:'item',key:item.id,name:item.name,kind:item.kind};}if(!b||(a.type==='item'&&b.type==='item')||a.type===b.type&&a.key===b.key)continue;const id=pairId(a,b);if(!pairs.has(id))pairs.set(id,{id,a,b});}}
 return [...pairs.values()];
}
export function useMatch(rows:DraftRow[],pair:MatchPair,chosen:MatchEnd):DraftRow[]{
 const other=pair.a.type===chosen.type&&pair.a.key===chosen.key?pair.b:pair.a;
 if(other.type!=='row')throw Error('Use the existing catalog item. Catalog entries cannot be merged here.');
 return rows.map(r=>r.key===other.key?{...r,target:chosen.type==='item'?{type:'item' as const,id:chosen.key}:{type:'row' as const,key:chosen.key},separate:false}:r);
}
