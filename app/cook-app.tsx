
'use client';
import {useCallback,useRef,useState} from 'react';
import {ProfilePageBar} from './profile';
import {InformationProvider} from './information-detail';
import {StockWorkflow,type StockView} from './stock-workflow';
import {useWorkspaceNavigation} from './use-workspace-navigation';
import type {WorkspaceDestination} from '@/lib/workspace-navigation';
export default function CookApp({account}:{account:string}){
 const ignore=useCallback(()=>{},[]),[request,setRequest]=useState<{view:StockView;serial:number;day?:string}>({view:'evening',serial:0}),pending=useRef<WorkspaceDestination|null>(null),pendingDay=useRef<string|undefined>(undefined);
 const navigate=useWorkspaceNavigation(true,route=>{const view=route.view==='morning'?'morning':'evening';pending.current=view;pendingDay.current=route.day;setRequest(r=>({view,day:route.day,serial:r.serial+1}));},'evening');
 const locationChanged=(view:WorkspaceDestination,day?:string,blocked=false)=>{const requested=!!pending.current;if(blocked){pending.current=null;pendingDay.current=undefined;}if(pending.current&&(pending.current!==view||(pendingDay.current&&pendingDay.current!==day)))return;pending.current=null;pendingDay.current=undefined;const current=new URL(location.href).searchParams;if(current.get('view')!==view||(day&&current.get('day')!==day))navigate({view,...(day?{day}:{})},blocked||requested||current.get('view')===view&&!current.get('day'),false);};
 return <InformationProvider key={account} account={account} operationsOnly><a className="skip-link" href="#workspace-content">Skip to content</a><main className="app-frame cook-frame" id="workspace-content" tabIndex={-1}><ProfilePageBar/><StockWorkflow account={account} active request={request} onLocation={locationChanged} onExit={ignore} onDraft={ignore} operationsOnly/></main></InformationProvider>;
}
