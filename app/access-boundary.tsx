'use client';
import {useEffect,useLayoutEffect,useState,type ReactNode} from 'react';
import {accessLostEvent,accessDraftEvent,accessDraftAvailableEvent,configureClientAccess} from '@/lib/access-client';
export function AccessBoundary({userId,children}:{userId?:string;children:ReactNode}){
 const [reason,setReason]=useState(''),[draftAvailable,setDraftAvailable]=useState(false);
 useLayoutEffect(()=>{configureClientAccess(userId);const lost=(e:Event)=>setReason((e as CustomEvent<string>).detail);const draft=(e:Event)=>setDraftAvailable((e as CustomEvent<boolean>).detail);window.addEventListener(accessLostEvent,lost);window.addEventListener(accessDraftAvailableEvent,draft);return()=>{window.removeEventListener(accessLostEvent,lost);window.removeEventListener(accessDraftAvailableEvent,draft);};},[userId]);
 useEffect(()=>{if(reason)document.body.dataset.appAccess='blocked';else delete document.body.dataset.appAccess;return()=>{delete document.body.dataset.appAccess;};},[reason]);
 // Keep mounted state and recovery stores intact. Never silently retry old Finish
 // after restoration; a full identity/revision check comes before any continuation.
 return <div className="app-access-boundary">{reason&&<main className="access-page" role="alert"><h1>Access changed</h1><p>{reason}</p><p>Your unsent work is kept for the original account. Keep this tab open. Restoring access does not automatically submit an old Finish.</p>{draftAvailable&&<button className="access-link" onClick={()=>window.dispatchEvent(new Event(accessDraftEvent))}>Download this device’s recipe draft</button>}<p><button onClick={()=>window.location.assign(new URL('/',window.location.href).href)}>Recheck access</button> · <a target="_top" href="/signout-with-chatgpt?return_to=%2F">Use another account</a></p></main>}<div hidden={!!reason} inert={!!reason}>{children}</div></div>;
}
