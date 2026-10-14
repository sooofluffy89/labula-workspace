'use client';
import {useEffect,useLayoutEffect,useRef,useState,type KeyboardEvent,type PointerEvent} from 'react';

const QUIET_MS=950;
const same=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);

// Business state changes immediately. Only the position of rows waits for a safe pause in input.
export function useMorningLayout(scope:string,itemIds:string[],readyIds:string[],dialogOpen:boolean){
 const [presented,setPresented]=useState(()=>({scope,ids:readyIds}));
 const shownIds=presented.scope===scope?presented.ids:readyIds;
 const readySet=new Set(shownIds);
 const [expanded,setExpanded]=useState<{scope:string;open:boolean}>({scope,open:false});
 const readyOpen=expanded.scope===scope&&expanded.open;
 const root=useRef<HTMLDivElement>(null),readyHeading=useRef<HTMLButtonElement>(null);
 const pointers=useRef(new Set<number>()),keys=useRef(new Set<string>()),lastInput=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),schedule=useRef<()=>void>(()=>{});
 const focusAfter=useRef<string|null>(null),anchorAfter=useRef<{id:string;top:number}|null>(null);
 const readySignature=readyIds.join('\u0000');
 const clearTimer=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
 const row=(id:string)=>[...root.current?.querySelectorAll<HTMLElement>('.morning-row[data-item-id]')??[]].find(el=>el.dataset.itemId===id);
 const recordPosition=()=>{
  const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const focusedId=focused?.closest<HTMLElement>('.morning-row')?.dataset.itemId;
  if(focusedId&&shownIds.includes(focusedId)!==readyIds.includes(focusedId)){
   const index=itemIds.indexOf(focusedId),remaining=itemIds.filter(id=>!readyIds.includes(id));
   focusAfter.current=itemIds.slice(index+1).find(id=>remaining.includes(id))??itemIds.slice(0,index).reverse().find(id=>remaining.includes(id))??'ready-heading';
  }
  const sticky=Number.parseFloat(getComputedStyle(root.current!).getPropertyValue('--stock-status-height'))||48;
  const visible=itemIds.filter(id=>!readyIds.includes(id)).map(id=>row(id)).find(el=>{
   if(!el)return false;const rect=el.getBoundingClientRect();return rect.bottom>sticky&&rect.top<window.innerHeight;
  });
  anchorAfter.current=visible?{id:visible.dataset.itemId!,top:visible.getBoundingClientRect().top}:null;
 };
 useEffect(()=>{
  schedule.current=()=>{
   clearTimer();
   if(presented.scope!==scope||same(presented.ids,readyIds)||dialogOpen||pointers.current.size||keys.current.size)return;
   timer.current=setTimeout(()=>{
    timer.current=null;
    if(pointers.current.size||keys.current.size||dialogOpen){schedule.current();return;}
    recordPosition();setPresented({scope,ids:readyIds});
   },Math.max(0,lastInput.current+QUIET_MS-Date.now()));
  };
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[scope,readySignature,presented,dialogOpen]);
 useEffect(()=>{
  if(presented.scope!==scope){let cancelled=false;clearTimer();queueMicrotask(()=>{if(!cancelled)setPresented({scope,ids:readyIds});});return()=>{cancelled=true;};}
  schedule.current();return clearTimer;
 // Only changes in membership should reschedule; polling and clock ticks must not defer movement.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[scope,readySignature,presented,dialogOpen]);
 useEffect(()=>{
  pointers.current.clear();keys.current.clear();
  const pointerEnd=(event:globalThis.PointerEvent)=>{if(pointers.current.delete(event.pointerId)){lastInput.current=Date.now();schedule.current();}};
  const keyEnd=(event:globalThis.KeyboardEvent)=>{if(keys.current.delete(event.code)){lastInput.current=Date.now();schedule.current();}};
  const release=()=>{pointers.current.clear();keys.current.clear();schedule.current();};
  document.addEventListener('pointerup',pointerEnd);document.addEventListener('pointercancel',pointerEnd);
  document.addEventListener('keyup',keyEnd);window.addEventListener('blur',release);
  return()=>{clearTimer();document.removeEventListener('pointerup',pointerEnd);document.removeEventListener('pointercancel',pointerEnd);document.removeEventListener('keyup',keyEnd);window.removeEventListener('blur',release);};
 },[scope]);
 useLayoutEffect(()=>{
  const anchor=anchorAfter.current;anchorAfter.current=null;
  if(anchor){const element=row(anchor.id);if(element)window.scrollBy({top:element.getBoundingClientRect().top-anchor.top,behavior:'instant'});}
  const target=focusAfter.current;focusAfter.current=null;
  if(target){
   const preferred=target==='ready-heading'?readyHeading.current:row(target)?.querySelector<HTMLElement>('.morning-toggle');
   const fallback=root.current?.querySelector<HTMLElement>('.morning-to-prepare .morning-toggle:not(:disabled),.morning-to-prepare .ingredient-group-heading,.morning-ready-heading');
   (preferred??fallback)?.focus({preventScroll:true});
  }
 },[presented]);
 useEffect(()=>{let open=false;try{open=sessionStorage.getItem('labula.morning.ready.v1.'+encodeURIComponent(scope))==='open';}catch{}queueMicrotask(()=>setExpanded({scope,open}));},[scope]);
 const toggleReady=()=>{const open=!readyOpen;setExpanded({scope,open});try{sessionStorage.setItem('labula.morning.ready.v1.'+encodeURIComponent(scope),open?'open':'closed');}catch{/* Optional view preference. */}};
 const onPointerDownCapture=(event:PointerEvent<HTMLDivElement>)=>{pointers.current.add(event.pointerId);lastInput.current=Date.now();clearTimer();};
 const onKeyDownCapture=(event:KeyboardEvent<HTMLDivElement>)=>{if((event.code==='Space'||event.code==='Enter')&&!event.repeat){keys.current.add(event.code);lastInput.current=Date.now();clearTimer();}};
 const noteAction=()=>{lastInput.current=Date.now();clearTimer();};
 return {readySet,readyOpen,root,readyHeading,toggleReady,onPointerDownCapture,onKeyDownCapture,noteAction};
}
