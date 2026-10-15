'use client';
import {createContext,useContext,type ReactNode} from 'react';
import type {AppliedRecord} from '@/lib/review-v2/applied';
const MenuRecords=createContext<AppliedRecord[]>([]);
export function MenuScopeProvider({records,children}:{records:AppliedRecord[];children:ReactNode}){return <MenuRecords.Provider value={records}>{children}</MenuRecords.Provider>;}
export const useMenuRecords=()=>useContext(MenuRecords);
