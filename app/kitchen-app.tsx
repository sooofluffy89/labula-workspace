'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {MenuScopeProvider} from './menu-scope-context';
import {InformationProvider} from './information-detail';
import {StockWorkflow,type StockView} from './stock-workflow';
import {TeamWorkspace} from './team-workspace';
import {useNotebook} from './use-notebook';
import {useReviewedData} from './reviewed-data';
import {useWorkspaceNavigation} from './use-workspace-navigation';
import {WorkspaceShell,SettingsNavigation} from './workspace-shell';
import {WorkspaceData} from './workspace-data';
import {MenuWorkspace,type MenuSelection} from './menu-workspace';
import DataReview from './review/review';
import {Toaster} from '@/components/ui/sonner';
import {Button} from '@/components/ui/button';
import {toast} from 'sonner';
import {canonicalWorkspaceRoute,workspaceArea,workspaceUrl,type WorkspaceRoute,type WorkspaceDestination} from '@/lib/workspace-navigation';

type StockRequest={view:StockView;serial:number;day?:string;rounds?:boolean;operations?:'history'|'overview'|'calendar'};
const stockDestinations=['morning','evening','history','calendar','rounds'];
export default function KitchenApp({account='',role='legacy'}:{account?:string;role?:'owner'|'manager'|'legacy'}={}){
 const nb=useNotebook(),reviewed=useReviewedData(account,nb.updatedAt);
 const canManage=role==='owner'||role==='manager';
 const [route,setRoute]=useState<WorkspaceRoute>({view:'morning'});
 const active=useRef<WorkspaceDestination>('morning');
 const pending=useRef<WorkspaceDestination|null>(null),pendingDay=useRef<string|undefined>(undefined);
 const [request,setRequest]=useState<StockRequest>({view:'morning',serial:0});
 const [menu,setMenu]=useState<MenuSelection>({view:'dishes'}),[menuVisited,setMenuVisited]=useState(false);
 const [teamVisited,setTeamVisited]=useState(false),[reviewVisited,setReviewVisited]=useState(false);
 const lastToday=useRef<WorkspaceRoute>({view:'morning'}),lastMenu=useRef<WorkspaceRoute>({view:'recipes'});
 const ignore=useCallback(()=>{},[]);
 const navigate=useWorkspaceNavigation(true,input=>{
  let next=canonicalWorkspaceRoute(input);
  if(!canManage&&['team','calendar','rounds'].includes(next.view))next={view:'data'};
  active.current=next.view;setRoute(next);
  if(stockDestinations.includes(next.view)){
   pending.current=next.view;pendingDay.current=next.day;
   setRequest(previous=>({view:next.view==='morning'?'morning':next.view==='rounds'?'manage':'evening',serial:previous.serial+1,day:next.day,rounds:next.view==='rounds',operations:next.view==='history'?'history':next.view==='calendar'?'calendar':undefined}));
   if(next.view==='morning'||next.view==='evening')lastToday.current=next;
  }else if(next.view==='recipes'||next.view==='catalog'){
   lastMenu.current=next;setMenuVisited(true);
   setMenu({view:next.view==='recipes'?'dishes':'ingredients',dishId:next.dish,variantId:next.variant,itemId:next.item,itemPath:next.itemPath,query:next.query,kind:next.kind==='review'?'all':next.kind,scope:next.scope,checkedOnly:next.checkedOnly});
  }else if(next.view==='team')setTeamVisited(true);
  else if(next.view==='review')setReviewVisited(true);
 },'morning');
 const go=(next:WorkspaceRoute)=>navigate(canonicalWorkspaceRoute(next));
 const locationChanged=(id:WorkspaceDestination,day?:string,blocked=false)=>{
  if(!stockDestinations.includes(active.current))return;
  const requested=!!pending.current;
  if(blocked){pending.current=null;pendingDay.current=undefined;}
  if(pending.current&&(id!==pending.current||(pendingDay.current&&day!==pendingDay.current)))return;
  pending.current=null;pendingDay.current=undefined;
  const next=canonicalWorkspaceRoute({view:id,...(day?{day}:{})});
  const current=new URL(location.href).searchParams;
  if(current.get('view')!==next.view||(day&&current.get('day')!==day)){
   active.current=next.view;setRoute(next);
   if(next.view==='morning'||next.view==='evening')lastToday.current=next;
   navigate(next,blocked||requested||current.get('view')===next.view&&!current.get('day'),false);
  }
 };
 const openMenu=(selection:MenuSelection)=>{const next:WorkspaceRoute={view:selection.view==='dishes'?'recipes':'catalog',dish:selection.dishId,variant:selection.variantId,item:selection.itemId,itemPath:selection.itemPath,query:selection.query,kind:selection.kind,scope:selection.scope,checkedOnly:selection.checkedOnly};const sameDetail=route.view===next.view&&route.dish===next.dish&&route.variant===next.variant&&route.item===next.item&&JSON.stringify(route.itemPath??[])===JSON.stringify(next.itemPath??[]);const url=workspaceUrl(new URL(location.href),next);if(!sameDetail&&history.state?.labulaWorkspace?.previousUrl===url.href){history.back();return;}navigate(next,sameDetail);};
 const openItem=(id:string)=>go({view:'catalog',item:id,scope:'all'});
 const manageChecklist=()=>go({view:'catalog',checkedOnly:true,scope:'all'});
 const stockActive=stockDestinations.includes(route.view),area=workspaceArea(route.view);
 const settings=['team','calendar','rounds','data'].includes(route.view);
 // Keep the legacy read-only WebMCP navigation contract; no operational command is exposed.
 const bridge=useRef({data:nb.data,open:(id:string)=>go({view:'recipes',dish:id})});bridge.current={data:nb.data,open:id=>go({view:'recipes',dish:id})};
 useEffect(()=>{
  type Context={registerTool:(tool:{name:string;description:string;inputSchema:object;annotations:object;execute:(i:unknown)=>unknown},opts:{signal:AbortSignal})=>void|Promise<void>};
  const context=(document as Document&{modelContext?:Context}).modelContext;if(!context?.registerTool)return;
  const controller=new AbortController();
  const tool={name:'open_dish_recipe',description:'Open an existing menu dish. Does not change recipes or daily work.',inputSchema:{type:'object',properties:{menuId:{type:'string'}},required:['menuId'],additionalProperties:false},annotations:{readOnlyHint:false,untrustedContentHint:false},execute:(input:unknown)=>{if(!input||typeof input!=='object'||Object.keys(input).some(k=>k!=='menuId'))throw Error('Expected a menuId.');const id=(input as {menuId?:string}).menuId;if(!bridge.current.data.dishes.some(d=>d.id===id))throw Error('Unknown menu dish.');bridge.current.open(id!);return {openedMenuId:id};}};
  try{void Promise.resolve(context.registerTool(tool,{signal:controller.signal})).catch(()=>{});}catch{/* Optional browser integration. */}
  return()=>controller.abort();
 },[]);
 return <MenuScopeProvider records={reviewed.records??[]}><InformationProvider key={account} account={account} onEdit={openItem} onCorrectType={canManage?openItem:undefined} onRounds={canManage?()=>go({view:'rounds'}):undefined}>
  <WorkspaceShell area={area} canManage onToday={()=>go(lastToday.current)} onMenu={()=>go(lastMenu.current)} onSettings={()=>go({view:'data'})}>
   {settings&&canManage&&<div className="ws-settings-page"><SettingsNavigation current={route.view==='team'?'people':route.view==='data'?'data':'schedule'} onNavigate={section=>go({view:section==='people'?'team':section==='schedule'?'calendar':'data'})}/></div>}
   <div hidden={!stockActive} className={route.view==='calendar'||route.view==='rounds'?'ws-settings-page':undefined}>
    <StockWorkflow account={account} active={stockActive} request={request} onExit={()=>go(lastToday.current)} onDraft={ignore} onLocation={locationChanged} onManageChecklist={canManage?manageChecklist:undefined} onRecipe={openItem}/>
    {route.view==='calendar'&&canManage&&<div className="ws-data-panel"><h2>Check frequency</h2><p>Move items between Daily, 2× weekly and Weekly in their Daily checks settings. Set the days for each round here.</p><div className="actions"><Button variant="outline" onClick={()=>go({view:'rounds'})}>Round days</Button><Button variant="outline" onClick={manageChecklist}>Manage checklist</Button></div></div>}
   </div>
   <div hidden={area!=='menu'}>{menuVisited&&<MenuWorkspace nb={nb} selection={menu} onNavigate={openMenu} onDailyChecks={itemId=>itemId?openItem(itemId):manageChecklist()}/>}</div>
   <div hidden={route.view!=='team'} className="ws-settings-page">{teamVisited&&canManage&&<TeamWorkspace account={account} active={route.view==='team'}/>}</div>
   <WorkspaceData nb={nb} account={account} active={route.view==='data'} canManage={canManage} onReview={()=>go({view:'review'})}/>
   <div hidden={route.view!=='review'}>{reviewVisited&&<><div className="ws-recovery-notice"><p>Review archive contains earlier assessments and drafts. Current recipes are maintained in Menu.</p><Button variant="outline" onClick={()=>go({view:'data'})}>Back to Data & backup</Button></div><DataReview embedded onNotebookChanged={async()=>{const result=await nb.refreshBulk();if(!result.ok)toast.error(result.error??'Changes were saved. Refresh Menu before editing.');}} onBack={()=>go({view:'data'})}/></>}</div>
  </WorkspaceShell><Toaster position="bottom-right"/>
 </InformationProvider></MenuScopeProvider>;
}
