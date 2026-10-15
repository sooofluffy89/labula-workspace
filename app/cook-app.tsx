'use client';
import {useCallback,useRef,useState} from 'react';
import {InformationProvider} from './information-detail';
import {StockWorkflow,type StockView} from './stock-workflow';
import {useWorkspaceNavigation} from './use-workspace-navigation';
import {WorkspaceShell} from './workspace-shell';
import {MenuWorkspace,type MenuSelection} from './menu-workspace';
import {workspaceArea,workspaceUrl,type WorkspaceDestination,type WorkspaceRoute} from '@/lib/workspace-navigation';
import {Toaster} from '@/components/ui/sonner';

/** Cook never loads the editor notebook: Menu has its own minimal, read-only API. */
export default function CookApp({account}:{account:string}){
 const ignore=useCallback(()=>{},[]),[route,setRoute]=useState<WorkspaceRoute>({view:'morning'});
 const [request,setRequest]=useState<{view:StockView;serial:number;day?:string}>({view:'morning',serial:0});
 const [menu,setMenu]=useState<MenuSelection>({view:'dishes'}),[visited,setVisited]=useState(false);
 const active=useRef<WorkspaceDestination>('morning'),pending=useRef<WorkspaceDestination|null>(null),pendingDay=useRef<string|undefined>(undefined);
 const lastToday=useRef<WorkspaceRoute>({view:'morning'}),lastMenu=useRef<WorkspaceRoute>({view:'recipes'});
 const navigate=useWorkspaceNavigation(true,input=>{
  const next:WorkspaceRoute=['recipes','catalog','morning','evening'].includes(input.view)?input:{view:'morning'};
  active.current=next.view;setRoute(next);
  if(next.view==='recipes'||next.view==='catalog'){
   lastMenu.current=next;setVisited(true);setMenu({view:next.view==='recipes'?'dishes':'ingredients',dishId:next.dish,variantId:next.variant,itemId:next.item,itemPath:next.itemPath,query:next.query,kind:next.kind==='review'?'all':next.kind,scope:'current'});
  }else{lastToday.current=next;pending.current=next.view;pendingDay.current=next.day;setRequest(r=>({view:next.view==='evening'?'evening':'morning',day:next.day,serial:r.serial+1}));}
 },'morning');
 const locationChanged=(view:WorkspaceDestination,day?:string,blocked=false)=>{
  if(active.current!=='morning'&&active.current!=='evening')return;
  const requested=!!pending.current;if(blocked){pending.current=null;pendingDay.current=undefined;}
  if(pending.current&&(pending.current!==view||(pendingDay.current&&pendingDay.current!==day)))return;
  pending.current=null;pendingDay.current=undefined;
  const next={view,...(day?{day}:{})},current=new URL(location.href).searchParams;
  if(current.get('view')!==view||(day&&current.get('day')!==day)){active.current=view;setRoute(next);lastToday.current=next;navigate(next,blocked||requested||current.get('view')===view&&!current.get('day'),false);}
 };
 const openMenu=(selection:MenuSelection)=>{const next:WorkspaceRoute={view:selection.view==='dishes'?'recipes':'catalog',dish:selection.dishId,variant:selection.variantId,item:selection.itemId,itemPath:selection.itemPath,query:selection.query,kind:selection.kind};const sameDetail=route.view===next.view&&route.dish===next.dish&&route.variant===next.variant&&route.item===next.item&&JSON.stringify(route.itemPath??[])===JSON.stringify(next.itemPath??[]);const url=workspaceUrl(new URL(location.href),next);if(!sameDetail&&history.state?.labulaWorkspace?.previousUrl===url.href){history.back();return;}navigate(next,sameDetail);};
 const menuActive=workspaceArea(route.view)==='menu';
 return <InformationProvider key={account} account={account} operationsOnly><WorkspaceShell area={menuActive?'menu':'today'} canManage={false} onToday={()=>navigate(lastToday.current)} onMenu={()=>navigate(lastMenu.current)} onSettings={ignore}>
  <div hidden={menuActive}><StockWorkflow account={account} active={!menuActive} request={request} onLocation={locationChanged} onExit={ignore} onDraft={ignore} operationsOnly onRecipe={itemId=>openMenu({view:'ingredients',itemId})}/></div>
  <div hidden={!menuActive}>{visited&&<MenuWorkspace selection={menu} onNavigate={openMenu}/>}</div>
 </WorkspaceShell><Toaster position="bottom-right"/></InformationProvider>;
}
