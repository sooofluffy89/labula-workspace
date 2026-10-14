'use client';
import {Button} from '@/components/ui/button';
export function MenuScopeViews({value,onChange,current,total}:{value:'current'|'all';onChange:(value:'current'|'all')=>void;current:number;total:number}){return <div className="actions" role="group" aria-label="Item scope"><Button variant={value==='current'?'default':'outline'} aria-pressed={value==='current'} onClick={()=>onChange('current')}>Current work {current}</Button><Button variant={value==='all'?'default':'outline'} aria-pressed={value==='all'} onClick={()=>onChange('all')}>All items {total}</Button></div>;}
