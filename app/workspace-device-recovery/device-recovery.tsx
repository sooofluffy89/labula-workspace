'use client';
import {useRef,useState} from 'react';
import {Button} from '@/components/ui/button';
import {collectDeviceRecovery} from '@/lib/device-recovery-export';

export default function DeviceRecovery({accountId,email}:{accountId:string;email:string}){
 const [status,setStatus]=useState(''),busy=useRef(false);
 const download=()=>{
  if(busy.current)return;busy.current=true;
  try{
   const result=collectDeviceRecovery({accountId,email},{get localStorage(){return window.localStorage;},get sessionStorage(){return window.sessionStorage;}},{origin:window.location.origin,exportedAt:new Date().toISOString()});
   const url=URL.createObjectURL(new Blob([JSON.stringify(result,null,2)],{type:'application/json'})),link=document.createElement('a');
   link.href=url;link.download='labula-device-recovery.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),10000);
   setStatus(`${result.complete?'Recovery downloaded':'Partial recovery downloaded'}: ${result.entries.length} account entries and ${result.unattributed.length} unattributed legacy entries.${result.complete?'':' Some storage could not be read. Keep the original tab open.'}`);
  }catch{setStatus('The recovery could not be downloaded. Keep the original tab open and try again.');}
  finally{busy.current=false;}
 };
 return <main style={{maxWidth:720,margin:'48px auto',padding:24}}><h1>Device recovery</h1><p>Download recovery stored for {email} in this browser. Saved strings, including unreadable records, are kept exactly. This does not submit or remove any work.</p><p>This includes shared browser storage and this tab’s session storage. Export from each existing tab to keep its separate session drafts. Other browsers and devices are separate.</p><p>Before leaving an editor, use its existing draft download. Unsubmitted recipe, catalog, ingredient-list and note fields may exist only in the original open page. This page cannot recover another page’s memory.</p><p>The file can contain private recipes, comments and photo requests. Keep it private. Unattributed legacy records are labelled separately and are not assigned to your account.</p><Button onClick={download}>Download device recovery</Button><p role="status">{status}</p><p><a href="/">Back to workspace</a></p></main>;
}
