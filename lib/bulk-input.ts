import {normalizeName} from './notebook';

export type CopiedLine = {key:string;name:string;cleaned:string|null;parts:string[]|null};
const prefix=/^(?:[-*•●▪◦‣]\s+|\d+[.)]\s+|\(\d+\)\s+)/;
// Only propose splitting outside quoted or bracketed descriptions. The chef confirms it.
function splitNames(name:string):string[]{
 const parts:string[]=[];let current='',depth=0,quoted=false;
 for(const c of name){if(c==='"')quoted=!quoted;if(!quoted){if('([{'.includes(c))depth++;if(')]}'.includes(c))depth=Math.max(0,depth-1);}
  if(!quoted&&!depth&&/[,;\t，；、]/.test(c)){parts.push(current.trim());current='';}else current+=c;
 }
 parts.push(current.trim());return parts;
}
export function copiedLines(text:string):CopiedLine[]{
 const result=new Map<string,CopiedLine>();
 for(const raw of text.split(/\r?\n/)){const name=raw.trim();if(!name)continue;let cleaned=name;while(prefix.test(cleaned))cleaned=cleaned.replace(prefix,'').trim();
  const parts=splitNames(cleaned);if(cleaned!==name||parts.length>1){const key=normalizeName(name);result.set(key,{key,name,cleaned:cleaned!==name&&cleaned?cleaned:null,parts:parts.length>1&&parts.every(Boolean)?parts:null});}
 }
 return [...result.values()];
}
export function transformCopiedLine(text:string,key:string,parts:string[]):string{
 if(!parts.length||parts.some(p=>!p.trim()||p.length>160))throw Error('Each resulting name must be 1–160 characters. Edit the list to shorten it.');
 const next=text.split(/\r?\n/).flatMap(line=>normalizeName(line)===key?parts:[line]).join('\n');
 if(next.split('\n').filter(s=>s.trim()).length>150)throw Error('This split would exceed 150 lines. Your original text has been kept. Shorten the list first.');
 return next;
}
export function validKeptNames(text:string,kept:string[]):string[]{
 const keys=new Set(copiedLines(text).filter(line=>line.name.length<=160).map(line=>line.key));
 return [...new Set(kept)].filter(key=>keys.has(key));
}
