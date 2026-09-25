'use client';
import {useEffect,useState} from 'react';
import {groupLabel} from '@/lib/ingredient-groups';

const key=(account:string,view:string,scope:string)=>`labula.groups.v1.${encodeURIComponent(account)}.${view}.${encodeURIComponent(scope)}`;
export function useCollapsedGroups(account:string,view:string,scope:string){
 const storageKey=key(account,view,scope);
 const [saved,setSaved]=useState<{key:string;ids:string[]}>({key:storageKey,ids:[]});
 useEffect(()=>{let ids:string[]=[];try{const value=JSON.parse(localStorage.getItem(storageKey)??'[]');if(Array.isArray(value))ids=value.filter((id):id is string=>typeof id==='string'&&id.length<80);}catch{}queueMicrotask(()=>setSaved({key:storageKey,ids}));},[storageKey]);
 const collapsed=saved.key===storageKey?saved.ids:[];
 const write=(ids:string[])=>{setSaved({key:storageKey,ids});try{localStorage.setItem(storageKey,JSON.stringify(ids));}catch{/* Display preference is optional. */}};
 const toggle=(id:string)=>write(collapsed.includes(id)?collapsed.filter(x=>x!==id):[...collapsed,id]);
 const expand=(id:string)=>{if(collapsed.includes(id))write(collapsed.filter(x=>x!==id));};
 return {collapsed,toggle,expand};
}

export function GroupSection({id,label=groupLabel(id),meta='',alert=false,open,onToggle,children,sectionId}:{id:string|null;label?:string;meta?:string;alert?:boolean;open:boolean;onToggle:()=>void;children:React.ReactNode;sectionId:string}){
 const contentId=sectionId+'-'+(id??'unassigned');
 return <section className="ingredient-group" aria-label={label}>
  <button type="button" id={sectionId+'-heading-'+(id??'unassigned')} className="ingredient-group-heading" aria-expanded={open} aria-controls={contentId} onClick={onToggle}>
   <span className="ingredient-group-arrow" aria-hidden="true">{open?'▾':'▸'}</span><span className="ingredient-group-name">{label}</span><span className="ingredient-group-count">{meta}</span>{alert&&<span className="ingredient-group-warning">Needs review</span>}
  </button>
  <div id={contentId} hidden={!open}>{children}</div>
 </section>;
}
