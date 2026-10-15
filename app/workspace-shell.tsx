'use client';
import type {ReactNode} from 'react';
import {CalendarCheck2,UtensilsCrossed,Settings2} from 'lucide-react';
import {ProfileButton} from './profile';
import {usePrepNotes} from './prep-notes';
import {useInformationControls} from './information-context';
import type {WorkspaceArea} from '@/lib/workspace-navigation';

export function WorkspaceShell({area,canManage,onToday,onMenu,onSettings,children}:{
 area:WorkspaceArea;canManage:boolean;onToday:()=>void;onMenu:()=>void;onSettings:()=>void;children:ReactNode;
}){
 const notes=usePrepNotes(),information=useInformationControls();
 const go=(action:()=>void)=>{if(notes.controller&&!notes.controller.keepDrafts())return;information.navigate(action);};
 const navigation=(mobile:boolean)=><nav className={mobile?'ws-main-nav ws-mobile-nav':'ws-main-nav ws-desktop-nav'} aria-label="Main navigation">
  <button type="button" aria-current={area==='today'?'page':undefined} onClick={()=>go(onToday)}><CalendarCheck2 aria-hidden="true"/><span>Today</span></button>
  <button type="button" aria-current={area==='menu'?'page':undefined} onClick={()=>go(onMenu)}><UtensilsCrossed aria-hidden="true"/><span>Menu</span></button>
 </nav>;
 return <div className="workspace-v2" data-workspace-area={area}>
  <a className="skip-link" href="#workspace-content" onClick={()=>document.getElementById('workspace-content')?.focus()}>Skip to content</a>
  <header className="ws-header"><div className="ws-header-inner">
   <button type="button" className="ws-brand" aria-label="Workspace 2.0 home" onClick={()=>go(onToday)}><span className="wordmark">LABULA</span><span className="ws-product-name">Workspace 2.0</span></button>
   {navigation(false)}
   <div className="ws-header-actions">{canManage&&<button type="button" className="ws-settings-button" aria-label="Settings" aria-current={area==='settings'?'page':undefined} onClick={()=>go(onSettings)}><Settings2 aria-hidden="true"/><span>Settings</span></button>}<ProfileButton/></div>
  </div></header>
  <main id="workspace-content" className="ws-content" tabIndex={-1}>{children}</main>
  {navigation(true)}
 </div>;
}

export function SettingsNavigation({current,onNavigate}:{current:'people'|'schedule'|'data';onNavigate:(view:'people'|'schedule'|'data')=>void}){
 return <nav className="ws-settings-nav" aria-label="Settings sections">{(['people','schedule','data'] as const).map(view=><button type="button" key={view} onClick={()=>onNavigate(view)} aria-current={current===view?'page':undefined}>{view==='people'?'People':view==='schedule'?'Schedule':'Data & backup'}</button>)}</nav>;
}

export function WorkspaceError({title,children,onRetry}:{title:string;children?:ReactNode;onRetry?:()=>void}){
 return <div className="ws-error" role="alert"><strong>{title}</strong>{children&&<p>{children}</p>}{onRetry&&<button type="button" onClick={onRetry}>Try again</button>}</div>;
}
