'use client';
import {useEffect} from 'react';
/** Keep dialog actions inside the visual viewport when a software keyboard opens. */
export function ViewportSize(){
 useEffect(()=>{const viewport=window.visualViewport;if(!viewport)return;const update=()=>{document.documentElement.style.setProperty('--viewport-height',viewport.height+'px');document.documentElement.style.setProperty('--viewport-offset',viewport.offsetTop+'px');};update();viewport.addEventListener('resize',update);viewport.addEventListener('scroll',update);return()=>{viewport.removeEventListener('resize',update);viewport.removeEventListener('scroll',update);};},[]);
 return null;
}
