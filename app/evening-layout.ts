'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';

export const EVENING_QUIET_MS=950;
const same=(a:string[],b:string[])=>a.length===b.length&&a.every((id,i)=>id===b[i]);

// Only row positions are delayed. Answers, receipts and server writes are never timed here.
export function useEveningLayout(scope:string,itemIds:string[],checkedIds:string[],dialogOpen:boolean){
 const [presented,setPresented]=useState(()=>({scope,ids:checkedIds}));
 const shownIds=presented.scope===scope?presented.ids:checkedIds;
 const root=useRef<HTMLDivElement>(null),checkedHeading=useRef<HTMLButtonElement>(null);
 const pointers=useRef(new Set<number>()),keys=useRef(new Set<string>()),lastInput=useRef(0);
 const timer=useRef<ReturnType<typeof setTimeout>|null>(null),schedule=useRef<()=>void>(()=>{});
 const focusAfter=useRef<{id:string;selector:string}|null>(null),anchorAfter=useRef<{id:string;top:number}|null>(null);
 const signature=checkedIds.join('\u0000');
 const clear=()=>{if(timer.current){clearTimeout(timer.current);timer.current=null;}};
 const rows=()=>[...root.current?.querySelectorAll<HTMLElement>('.evening-row[data-item-id]')??[]];
 const row=(id:string)=>rows().find(el=>el.dataset.itemId===id);
 const record=()=>{
  const focused=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const id=focused?.closest<HTMLElement>('.evening-row')?.dataset.itemId;
  if(id&&shownIds.includes(id)!==checkedIds.includes(id)){
   if(!checkedIds.includes(id))focusAfter.current={id,selector:focused?.classList.contains('evening-answer')?'.evening-answer:not(:disabled)':'.evening-name'};
   else{
    const visibleIds=rows().filter(el=>el.getClientRects().length&&!checkedIds.includes(el.dataset.itemId!)).map(el=>el.dataset.itemId!);
    const index=itemIds.indexOf(id);
    const next=itemIds.slice(index+1).find(id=>visibleIds.includes(id))??itemIds.slice(0,index).reverse().find(id=>visibleIds.includes(id));
    focusAfter.current={id:next??'checked-heading',selector:`.evening-answer[data-value="${focused?.dataset.value==='missing'?'missing':'have'}"]:not(:disabled)`};
   }
  }
  const sticky=root.current?Number.parseFloat(getComputedStyle(root.current).getPropertyValue('--stock-status-height'))||48:48;
  const visible=rows().find(el=>{const r=el.getBoundingClientRect();return !checkedIds.includes(el.dataset.itemId!)&&el.getClientRects().length&&r.bottom>sticky&&r.top<window.innerHeight;});
  anchorAfter.current=visible?{id:visible.dataset.itemId!,top:visible.getBoundingClientRect().top}:null;
 };
 useEffect(()=>{
  lastInput.current=Date.now();
  schedule.current=()=>{
   clear();
   if(presented.scope!==scope||same(presented.ids,checkedIds)||dialogOpen||pointers.current.size||keys.current.size)return;
   timer.current=setTimeout(()=>{
    timer.current=null;
    if(pointers.current.size||keys.current.size||dialogOpen)return;
    if(document.querySelector('[role="dialog"][data-state="open"]')){lastInput.current=Date.now();schedule.current();return;}
    record();setPresented({scope,ids:checkedIds});
   },Math.max(0,lastInput.current+EVENING_QUIET_MS-Date.now()));
  };
  if(presented.scope!==scope){let cancelled=false;clear();queueMicrotask(()=>{if(!cancelled)setPresented({scope,ids:checkedIds});});return()=>{cancelled=true;};}
  schedule.current();return clear;
 // Polling/revision changes never restart a quiet pause; only membership or an open dialog does.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[scope,signature,presented,dialogOpen]);
 useEffect(()=>{
  const heldPointers=pointers.current,heldKeys=keys.current;
  const touch=()=>{lastInput.current=Date.now();clear();schedule.current();};
  const down=(e:globalThis.PointerEvent)=>{pointers.current.add(e.pointerId);touch();};
  const up=(e:globalThis.PointerEvent)=>{pointers.current.delete(e.pointerId);touch();};
  const keyDown=(e:globalThis.KeyboardEvent)=>{keys.current.add(e.code);touch();};
  const keyUp=(e:globalThis.KeyboardEvent)=>{keys.current.delete(e.code);touch();};
  const release=()=>{pointers.current.clear();keys.current.clear();touch();};
  document.addEventListener('pointerdown',down,true);document.addEventListener('pointerup',up,true);document.addEventListener('pointercancel',up,true);
  document.addEventListener('keydown',keyDown,true);document.addEventListener('keyup',keyUp,true);document.addEventListener('scroll',touch,true);window.addEventListener('blur',release);
  return()=>{clear();heldPointers.clear();heldKeys.clear();document.removeEventListener('pointerdown',down,true);document.removeEventListener('pointerup',up,true);document.removeEventListener('pointercancel',up,true);document.removeEventListener('keydown',keyDown,true);document.removeEventListener('keyup',keyUp,true);document.removeEventListener('scroll',touch,true);window.removeEventListener('blur',release);};
 },[scope]);
 useLayoutEffect(()=>{
  const anchor=anchorAfter.current;anchorAfter.current=null;
  if(anchor){const el=row(anchor.id);if(el)window.scrollBy({top:el.getBoundingClientRect().top-anchor.top,behavior:'instant'});}
  const target=focusAfter.current;focusAfter.current=null;
  if(target){const preferred=target.id==='checked-heading'?checkedHeading.current:row(target.id)?.querySelector<HTMLElement>(target.selector)??row(target.id)?.querySelector<HTMLElement>('.evening-name');(preferred??checkedHeading.current)?.focus({preventScroll:true});}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[presented]);
 return {checkedSet:new Set(shownIds),root,checkedHeading};
}
