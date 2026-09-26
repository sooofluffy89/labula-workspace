'use client';
import {createContext,useContext} from 'react';
import type {InformationTarget} from '@/lib/information';
export const InformationContext=createContext<((target:InformationTarget)=>void)|null>(null);
export const useInformation=()=>useContext(InformationContext);
