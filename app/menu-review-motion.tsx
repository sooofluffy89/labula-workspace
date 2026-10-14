'use client';

import {useLayoutEffect,useRef,type ReactNode,type RefObject} from 'react';

const duration=160;
const reduced=()=>typeof matchMedia==='function'&&matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Animate presentation only. The notebook and focus never wait for an effect. */
export function useMenuReviewMotion(ref:RefObject<HTMLElement|null>,selectionKey:string,saveStatus:string,progress:number):void{
 const running=useRef(new Map<HTMLElement,Animation>());
 const previousSelection=useRef(selectionKey),previousSave=useRef(saveStatus),previousProgress=useRef(progress);
 const play=(element:HTMLElement|null,keyframes:Keyframe[])=>{
  if(!element||reduced()||typeof element.animate!=='function')return;
  running.current.get(element)?.cancel();
  const animation=element.animate(keyframes,{duration,easing:'cubic-bezier(.2,.7,.3,1)'});
  running.current.set(element,animation);
  const clean=()=>{if(running.current.get(element)===animation)running.current.delete(element);};
  animation.onfinish=clean;animation.oncancel=clean;
 };
 useLayoutEffect(()=>{
  const root=ref.current;if(!root)return;
  const items=()=>new Set([...root.querySelectorAll<HTMLElement>('[data-review-motion-item]')].map(element=>element.dataset.reviewMotionItem));
  let known=items(),variant=root.querySelector<HTMLElement>('[data-review-selection]')?.dataset.reviewSelection;
  const observer=new MutationObserver(records=>{
   const nextVariant=root.querySelector<HTMLElement>('[data-review-selection]')?.dataset.reviewSelection;
   if(variant!==nextVariant){variant=nextVariant;known=items();play(root.querySelector<HTMLElement>('[data-review-selection]'),[{opacity:.88},{opacity:1}]);return;}
   // Text and value changes are deliberately ignored, so typing never flashes.
   if(!records.some(record=>record.type==='childList'))return;
   const next=items();
   for(const element of root.querySelectorAll<HTMLElement>('[data-review-motion-item]'))if(!known.has(element.dataset.reviewMotionItem))play(element,[{opacity:.2,transform:'translateY(3px)'},{opacity:1,transform:'translateY(0)'}]);
   for(const record of records)for(const node of record.addedNodes)if(node instanceof HTMLElement){
    const undo=node.matches('.ingredient-undo')?node:node.querySelector<HTMLElement>('.ingredient-undo');
    if(undo)play(undo,[{opacity:.3},{opacity:1}]);
   }
   known=next;
  });
  observer.observe(root,{subtree:true,childList:true,attributes:true,attributeFilter:['data-review-selection']});
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const cancel=()=>{for(const animation of running.current.values())animation.cancel();running.current.clear();};
  media.addEventListener('change',cancel);
  return()=>{observer.disconnect();media.removeEventListener('change',cancel);cancel();};
 // Presentation uses current DOM nodes; it does not need a new observer on edits.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[ref,selectionKey]);
 useLayoutEffect(()=>{
  if(previousSelection.current===selectionKey)return;
  previousSelection.current=selectionKey;
  for(const animation of running.current.values())animation.cancel();
  running.current.clear();
  play(ref.current?.querySelector<HTMLElement>('[data-review-selection], .review-overview')??null,[{opacity:.88},{opacity:1}]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selectionKey,ref]);
 useLayoutEffect(()=>{
  if(previousSave.current===saveStatus)return;
  const wasSaved=/\bsaved\b/i.test(previousSave.current);previousSave.current=saveStatus;
  // The status comes from the acknowledged notebook state. Never invent a save.
  const statusElement=ref.current?.closest('.menu-review-panel')?.querySelector<HTMLElement>('.review-save-status')??null;
  const saved=statusElement?.dataset.saveState==='saved';
  if(saved&&wasSaved)return;
  play(statusElement,[{opacity:.65},{opacity:1}]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[saveStatus,ref]);
 useLayoutEffect(()=>{
  if(previousProgress.current===progress)return;
  previousProgress.current=progress;
  const element=ref.current?.closest('.menu-review-panel')?.querySelector<HTMLElement>('.review-progress')??null;
  play(element,[{backgroundColor:'#e2ead9'},{backgroundColor:'transparent'}]);
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[progress,ref]);
}

/** Keep editors mounted while hiding their focus targets immediately on close. */
export function ReviewRegion({open,className,children}:{open:boolean;className?:string;children:ReactNode}){
 const ref=useRef<HTMLDivElement>(null),initialOpen=useRef(open),animation=useRef<Animation|null>(null),generation=useRef(0);
 useLayoutEffect(()=>{
  const element=ref.current;if(!element)return;
  const ticket=++generation.current;
  const previousHeight=element.hidden?0:element.getBoundingClientRect().height;
  animation.current?.cancel();animation.current=null;
  if(!open&&element.contains(document.activeElement)){
   // The disclosure's controlling button immediately precedes the region.
   const controller=element.previousElementSibling?.querySelector<HTMLElement>('[aria-expanded]');
   controller?.focus({preventScroll:true});
  }
  element.hidden=false;
  element.style.height='';element.style.overflow='';
  const targetHeight=open?element.getBoundingClientRect().height:0;
  const finish=()=>{if(generation.current!==ticket)return;element.hidden=!open;element.style.height='';element.style.overflow='';animation.current=null;};
  if(reduced()||typeof element.animate!=='function'||previousHeight===targetHeight){finish();return;}
  element.style.overflow='hidden';
  const current=element.animate([{height:`${previousHeight}px`,opacity:open?.6:1},{height:`${targetHeight}px`,opacity:open?1:0}],{duration,easing:'cubic-bezier(.2,.7,.3,1)',fill:'both'});
  animation.current=current;
  current.onfinish=()=>{if(generation.current!==ticket)return;finish();current.cancel();};
  return()=>{generation.current++;const height=element.getBoundingClientRect().height;current.cancel();element.style.height=`${height}px`;};
 },[open]);
 useLayoutEffect(()=>{
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  const stop=()=>{if(!media.matches)return;animation.current?.finish();};
  media.addEventListener('change',stop);return()=>{media.removeEventListener('change',stop);animation.current?.cancel();};
 },[]);
 return <div ref={ref} className="review-region" hidden={!initialOpen.current} inert={!open} aria-hidden={!open}><div className={className}>{children}</div></div>;
}
