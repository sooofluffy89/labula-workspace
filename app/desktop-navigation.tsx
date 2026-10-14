'use client';
import {Button} from '@/components/ui/button';
import {Sidebar,SidebarContent,SidebarProvider} from '@/components/ui/sidebar';
import {usePrepNotes} from './prep-notes';
import {useInformationControls} from './information-context';
import {ClipboardCheck,Sun,Package,CalendarDays,UtensilsCrossed,Layers,ChartNoAxesCombined,History,Users,Settings,Network} from 'lucide-react';
export type WorkspaceDestination='insights'|'recipes'|'catalog'|'overview'|'team'|'evening'|'morning'|'manage'|'rounds'|'history'|'operations'|'calendar';
const groups=[
 {label:'Daily work',items:[{id:'evening',name:'Evening check',icon:ClipboardCheck},{id:'morning',name:'Morning prep',icon:Sun}]},
 {label:'Manage',items:[{id:'manage',name:'Manage list',icon:Package},{id:'rounds',name:'Check rounds',icon:CalendarDays},{id:'catalog',name:'Ingredients & prep',icon:Layers},{id:'recipes',name:'Dish recipes',icon:UtensilsCrossed}]},
 {label:'Insights',items:[{id:'insights',name:'Prep dashboards',icon:ChartNoAxesCombined},{id:'overview',name:'Kitchen overview',icon:Network},{id:'history',name:'History',icon:History},{id:'operations',name:'Operations overview',icon:ChartNoAxesCombined}]},
 {label:'Settings',items:[{id:'calendar',name:'Calendar & deadlines',icon:Settings},{id:'team',name:'Team & access',icon:Users}]},
] as const;
export function DesktopNavigation({current,disabled,canManage,onNavigate}:{current:WorkspaceDestination;disabled:boolean;canManage:boolean;onNavigate:(id:WorkspaceDestination)=>void}){
 const notes=usePrepNotes(),info=useInformationControls();
 const go=(id:WorkspaceDestination)=>{if(notes.controller&&!notes.controller.keepDrafts())return;info.navigate(()=>onNavigate(id));};
 return <div className="desktop-navigation"><SidebarProvider><Sidebar collapsible="none"><SidebarContent><nav aria-label="Main navigation"><div className="desktop-brand">LABULA <small>Worskspace</small></div>{groups.map(group=><section key={group.label}><h2>{group.label}</h2>{group.items.filter(i=>canManage||!['rounds','team','calendar','operations','history'].includes(i.id)).map(i=><Button key={i.id} variant="ghost" disabled={disabled} aria-current={current===i.id?'page':undefined} onClick={()=>go(i.id)}><i.icon aria-hidden="true"/>{i.name}</Button>)}</section>)}</nav></SidebarContent></Sidebar></SidebarProvider></div>;
}
