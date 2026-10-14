import {draftSuggestions,type DraftRow} from './bulk';
import type {Item} from './notebook';
const scope=self as unknown as {onmessage:(event:MessageEvent<{items:Item[];rows:DraftRow[]}>)=>void;postMessage:(value:unknown)=>void};
scope.onmessage=event=>{try{scope.postMessage({matches:draftSuggestions(event.data.items,event.data.rows)});}catch{scope.postMessage({error:'Could not check possible matches. Retry the check before saving.'});}};
