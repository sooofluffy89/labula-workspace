import {duplicatePairs,type CatalogItem} from './catalog';
const scope=self as unknown as {onmessage:(event:MessageEvent<{items:CatalogItem[];distinctPairs:[string,string][]}>)=>void;postMessage:(value:unknown)=>void};
scope.onmessage=event=>{
 try{const pairs=duplicatePairs(event.data);scope.postMessage({total:pairs.length,pairs:pairs.slice(0,20).map(({a,b,score})=>({a:a.id,b:b.id,score}))});}
 catch{scope.postMessage({error:'Could not finish checking duplicates. Try again.'});}
};
