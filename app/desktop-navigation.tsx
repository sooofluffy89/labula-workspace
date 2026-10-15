'use client';
import {Button} from '@/components/ui/button';
import {Sidebar,SidebarContent,SidebarProvider} from '@/components/ui/sidebar';
import {usePrepNotes} from './prep-notes';
import {useInformationControls} from './information-context';
import {ClipboardCheck,Sun,Package,CalendarDays,UtensilsCrossed,Layers,ChartNoAxesCombined,History,Users,Settings,Network} from 'lucide-react';
import type {WorkspaceDestination} from '@/lib/workspace-navigation';
export type {WorkspaceDestination} from '@/lib/workspace-navigation';
const groups=[
 {label:'Daily work',items:[{id:'evening',name:'Evening check',icon:ClipboardCheck},{id:'morning',name:'Morning prep',icon:Sun}]},
 {label:'Kitchen library',items:[{id:'catalog',name:'Ingredients',icon:Layers},{id:'recipes',name:'Dish recipes',icon:UtensilsCrossed}]},
 {label:'Analysis',items:[{id:'review',name:'Kitchen review',icon:ClipboardCheck},{id:'insights',name:'Preparation analysis',icon:ChartNoAxesCombined},{id:'overview',name:'Menu analysis',icon:Network},{id:'history',name:'Operations history',icon:History},{id:'operations',name:'Operations overview',icon:ChartNoAxesCombined}]},
 {label:'Settings',items:[{id:'manage',name:'Checklist settings',icon:Package},{id:'rounds',name:'Check rounds',icon:CalendarDays},{id:'calendar',name:'Calendar & deadlines',icon:Settings},{id:'team',name:'Team & access',icon:Users}]},
] as const;
export function DesktopNavigation({current,disabled,canManage,onNavigate}:{current:WorkspaceDestination;disabled:boolean;canManage:boolean;onNavigate:(id:WorkspaceDestination)=>void}){
 const notes=usePrepNotes(),info=useInformationControls();
 const allowed=groups.map(group=>({...group,items:group.items.filter(i=>canManage||!['rounds','team','calendar','operations','history'].includes(i.id))}));
 const go=(id:WorkspaceDestination)=>{if(notes.controller&&!notes.controller.keepDrafts())return;info.navigate(()=>onNavigate(id));};
 return <><a className="skip-link" href="#workspace-content" onClick={()=>document.getElementById('workspace-content')?.focus()}>Skip to content</a>
 <nav className="workspace-mobile-nav" aria-label="Workspace navigation"><strong>LABULA</strong><label className="sr-only" htmlFor="workspace-destination">Workspace section</label><select id="workspace-destination" value={current} disabled={disabled} onChange={e=>go(e.target.value as WorkspaceDestination)}>{allowed.map(group=><optgroup key={group.label} label={group.label}>{group.items.map(i=><option key={i.id} value={i.id}>{i.name}</option>)}</optgroup>)}</select></nav>
 <div className="desktop-navigation"><SidebarProvider><Sidebar collapsible="none"><SidebarContent><nav aria-label="Main navigation"><div className="desktop-brand">LABULA <small>Worskspace</small></div>{allowed.map(group=><section key={group.label}><h2>{group.label}</h2>{group.items.map(i=><Button key={i.id} variant="ghost" disabled={disabled} aria-current={current===i.id?'page':undefined} onClick={()=>go(i.id)}><i.icon aria-hidden="true"/>{i.name}</Button>)}</section>)}</nav></SidebarContent></Sidebar></SidebarProvider></div></>;
}
