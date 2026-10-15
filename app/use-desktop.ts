'use client';
import {useSyncExternalStore} from 'react';
const query='(min-width: 1100px)';
const subscribe=(listener:()=>void)=>{const media=window.matchMedia(query);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);};
export function useDesktop(){return useSyncExternalStore(subscribe,()=>window.matchMedia(query).matches,()=>false);}

const dockQuery='(min-width: 1536px)';
const subscribeDock=(listener:()=>void)=>{const media=window.matchMedia(dockQuery);media.addEventListener('change',listener);return()=>media.removeEventListener('change',listener);};
export function useDockedInformation(){return useSyncExternalStore(subscribeDock,()=>window.matchMedia(dockQuery).matches,()=>false);}
