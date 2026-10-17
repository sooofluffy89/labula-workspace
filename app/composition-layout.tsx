'use client';
import {useEffect,useState,type RefObject,type CSSProperties} from 'react';
export function useCompositionLayout(ref:RefObject<HTMLDivElement|null>,account:string,view:string){
 const [ratio,setRatio]=useState(60),[width,setWidth]=useState(1400),[dragging,setDragging]=useState(false);
 const key='labula:'+account+':composition-panels:'+view;
 useEffect(()=>{try{const saved=Number(localStorage.getItem(key));setRatio(saved>=35&&saved<=75?saved:60);}catch{setRatio(60);}},[key]);
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new ResizeObserver(([entry])=>setWidth(entry.contentRect.width));observer.observe(el);return()=>observer.disconnect();},[ref]);
 const min=Math.max(35,Math.min(60,560/Math.max(width-12,1)*100)),max=Math.min(75,Math.max(35,100-420/Math.max(width-12,1)*100));
 const effective=Math.min(max,Math.max(min,ratio));
 const change=(next:number)=>{const value=Math.round(Math.min(max,Math.max(min,next))*10)/10;setRatio(value);try{localStorage.setItem(key,String(value));}catch{}};
 const reset=()=>{setRatio(60);try{localStorage.removeItem(key);}catch{}};
 return {style:{'--mc-columns':`${effective}fr 12px ${100-effective}fr`} as CSSProperties,reset,separator:<div className="mc-separator" role="separator" aria-label="Resize list and detail" aria-orientation="vertical" aria-valuemin={Math.round(min)} aria-valuemax={Math.round(max)} aria-valuenow={Math.round(effective)} aria-valuetext={`${Math.round(effective)} percent list, ${Math.round(100-effective)} percent detail`} tabIndex={width>=1050?0:-1} onDoubleClick={reset} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();change(effective+(e.key==='ArrowLeft'?-1:1)*(e.shiftKey?5:1));}else if(e.key==='Home'){e.preventDefault();reset();}}} onPointerDown={e=>{if(e.button!==0)return;e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);setDragging(true);}} onPointerMove={e=>{if(!dragging||!e.currentTarget.hasPointerCapture(e.pointerId)||!ref.current)return;const rect=ref.current.getBoundingClientRect();change((e.clientX-rect.left-6)/(rect.width-12)*100);}} onPointerUp={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);setDragging(false);}} onLostPointerCapture={()=>setDragging(false)}><span/></div>};
}
