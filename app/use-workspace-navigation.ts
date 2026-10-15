'use client';
import {useCallback,useEffect,useRef} from 'react';
import {canonicalWorkspaceRoute,readWorkspaceRoute,sameWorkspaceRoute,workspaceUrl,type WorkspaceRoute,type WorkspaceDestination} from '@/lib/workspace-navigation';
type Entry={key:string;scroll:number;reviewReturn?:boolean;previousUrl?:string;focusKey?:string};
export function useWorkspaceNavigation(ready:boolean,onRoute:(route:WorkspaceRoute)=>void,defaultView:WorkspaceDestination='morning'){
 const apply=useRef(onRoute);apply.current=onRoute;
 const route=useRef<WorkspaceRoute>({view:defaultView}),initialized=useRef(false);
 const saveScroll=useCallback(()=>{const entry=history.state?.labulaWorkspace as Entry|undefined;if(entry){const target=document.activeElement instanceof HTMLElement&&document.getElementById('workspace-content')?.contains(document.activeElement)?document.activeElement:null;let focusKey=entry.focusKey;if(target&&target.id!=='workspace-content'){focusKey=target.dataset.workspaceFocus??crypto.randomUUID();target.dataset.workspaceFocus=focusKey;}history.replaceState({...history.state,labulaWorkspace:{...entry,scroll:window.scrollY,focusKey}},'');}},[]);
 const restoring=useRef<(()=>void)|null>(null);
 const reveal=useCallback((scroll:number,focus:boolean,focusKey?:string)=>{
  restoring.current?.();let stopped=false,focused=false,observer:ResizeObserver|undefined,timer:number|undefined;
  const stop=()=>{stopped=true;observer?.disconnect();if(timer)window.clearTimeout(timer);for(const event of ['pointerdown','wheel','keydown'])window.removeEventListener(event,stop);if(restoring.current===stop)restoring.current=null;};
  restoring.current=stop;
  const attempt=()=>{if(stopped)return;window.scrollTo({top:scroll,behavior:'instant'});
   if(focus&&!focused){focused=true;const main=document.getElementById('workspace-content'),heading=Array.from(main?.querySelectorAll<HTMLElement>('h1')??[]).find(e=>e.getClientRects().length),remembered=focusKey?main?.querySelector<HTMLElement>('[data-workspace-focus='+JSON.stringify(focusKey)+']'):null,target=remembered?.getClientRects().length?remembered:heading??main;if(target){if(target===heading||target===main)target.tabIndex=-1;target.focus({preventScroll:true});}}
   if(Math.abs(window.scrollY-scroll)<2)stop();
  };
  requestAnimationFrame(()=>requestAnimationFrame(()=>{if(stopped)return;attempt();if(!stopped){observer=new ResizeObserver(attempt);observer.observe(document.body);timer=window.setTimeout(stop,30000);for(const event of ['pointerdown','wheel','keydown'])window.addEventListener(event,stop,{once:true});}}));
 },[]);
 useEffect(()=>{
  if(!ready)return;
  if(!initialized.current){initialized.current=true;route.current=readWorkspaceRoute(new URL(location.href),defaultView);const entry=history.state?.labulaWorkspace as Entry|undefined;history.replaceState({...history.state,labulaWorkspace:entry??{key:crypto.randomUUID(),scroll:0}},'');apply.current(route.current);reveal(entry?.scroll??0,false);}
  const previous=history.scrollRestoration;history.scrollRestoration='manual';
  const read=()=>{const next=readWorkspaceRoute(new URL(location.href),defaultView);if(sameWorkspaceRoute(next,route.current))return;route.current=next;apply.current(next);reveal(history.state?.labulaWorkspace?.scroll??0,true,history.state?.labulaWorkspace?.focusKey);};
  let frame=0;const scroll=()=>{cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{if(!restoring.current)saveScroll();});};
  window.addEventListener('popstate',read);window.addEventListener('hashchange',read);window.addEventListener('scroll',scroll,{passive:true});
  return()=>{restoring.current?.();cancelAnimationFrame(frame);window.removeEventListener('popstate',read);window.removeEventListener('hashchange',read);window.removeEventListener('scroll',scroll);history.scrollRestoration=previous;};
 },[ready,reveal,saveScroll,defaultView]);
 const navigate=useCallback((input:WorkspaceRoute,replace=false,applyRoute=true)=>{
  const next=canonicalWorkspaceRoute(input);
  if(!initialized.current)return;
  saveScroll();const previousRoute=route.current;const same=sameWorkspaceRoute(next,previousRoute);route.current=next;
  const url=workspaceUrl(new URL(location.href),next);
  if(!same||url.href!==location.href){const entry={key:replace?(history.state?.labulaWorkspace?.key??crypto.randomUUID()):crypto.randomUUID(),scroll:replace?window.scrollY:0,previousUrl:replace?history.state?.labulaWorkspace?.previousUrl:location.href,...(next.view==='review'?{reviewReturn:previousRoute.view!=='review'||!!history.state?.labulaWorkspace?.reviewReturn}:{})};history[replace?'replaceState':'pushState']({...history.state,labulaWorkspace:entry},'',url);}
  if(applyRoute)apply.current(next);if(!replace)reveal(0,true);
 },[reveal,saveScroll]);
 return navigate;
}
