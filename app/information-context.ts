'use client';
import {createContext,useContext} from 'react';
import type {InformationTarget} from '@/lib/information';
export type InformationTab='overview'|'instruction'|'history';
export const InformationContext=createContext<((target:InformationTarget,tab?:InformationTab)=>void)|null>(null);
export const useInformation=()=>useContext(InformationContext);
export const InformationControls=createContext<{target:InformationTarget|null;navigate:(action:()=>void)=>void}>({target:null,navigate:action=>action()});
export const useInformationControls=()=>useContext(InformationControls);
