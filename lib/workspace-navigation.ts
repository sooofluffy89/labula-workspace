import {dateSchema} from './evening';
/** Stable legacy view IDs remain valid links. URL state never contains work or writes. */
export const workspaceDestinations = ['insights','recipes','catalog','house-made','overview','team','evening','morning','manage','rounds','history','operations','calendar','review','data'] as const;
export type WorkspaceDestination = typeof workspaceDestinations[number];
export type WorkspaceRoute = {
 view:WorkspaceDestination; dish?:string; variant?:string; item?:string; itemPath?:string[]; query?:string; day?:string;
 kind?:'all'|'prep'|'bought'|'review'; scope?:'current'|'all'|'off'|'archived'; checkedOnly?:boolean;
};
export type WorkspaceArea = 'today'|'menu'|'settings';
export function workspaceArea(view:WorkspaceDestination):WorkspaceArea {
 if(['recipes','catalog','house-made','overview','manage'].includes(view))return 'menu';
 if(['team','calendar','rounds','review','data'].includes(view))return 'settings';
 return 'today';
}
export function canonicalWorkspaceRoute(route:WorkspaceRoute):WorkspaceRoute {
 if(route.view==='insights')return {...route,view:'morning'};
 if(route.view==='overview')return {...route,view:'recipes'};
 if(route.view==='manage')return {...route,view:'catalog',checkedOnly:true,scope:'all'};
 if(route.view==='operations')return {...route,view:'history'};
 return route;
}
export function readWorkspaceRoute(url:URL,fallback:WorkspaceDestination='morning'):WorkspaceRoute {
 const value=url.searchParams.get('view');
 const view=workspaceDestinations.includes(value as WorkspaceDestination)?value as WorkspaceDestination:fallback;
 const ops=new URLSearchParams(url.hash.startsWith('#ops=')?url.hash.slice(1):url.search);
 const kind=url.searchParams.get('kind'),scope=url.searchParams.get('scope');
 const id=(key:string)=>url.searchParams.get(key)?.slice(0,100)||undefined;
 return canonicalWorkspaceRoute({view:ops.get('ops')==='history'?'history':view,
  ...(id('dish')?{dish:id('dish')}:{}),...(id('variant')?{variant:id('variant')}:{}),...(id('item')?{item:id('item')}:{}),
  ...(url.searchParams.has('trail')?{itemPath:url.searchParams.getAll('trail').filter(value=>value.length>0&&value.length<=100).slice(-50)}:{}),
  ...(dateSchema.safeParse(url.searchParams.get('day')).success?{day:url.searchParams.get('day')!}:{}),
  ...(url.searchParams.get('q')?{query:url.searchParams.get('q')!.slice(0,160)}:{}),
  ...(['all','off','archived'].includes(scope??'')?{scope:scope as WorkspaceRoute['scope']}:{}),
  ...(url.searchParams.get('checked')==='1'?{checkedOnly:true}:{}),
  ...(['all','prep','bought','review'].includes(kind??'')?{kind:kind as WorkspaceRoute['kind']}:{})});
}
export function workspaceUrl(current:URL,input:WorkspaceRoute):URL {
 const url=new URL(current),route=canonicalWorkspaceRoute(input);
 for(const key of ['view','dish','variant','item','q','kind','day','ops','check','scope','checked','trail'])url.searchParams.delete(key);
 url.searchParams.set('view',route.view);
 if(['evening','morning','history'].includes(route.view)&&route.day)url.searchParams.set('day',route.day);
 if(['recipes','catalog','house-made'].includes(route.view)){
  if(route.dish)url.searchParams.set('dish',route.dish);
  if(route.variant)url.searchParams.set('variant',route.variant);
  if(route.item)url.searchParams.set('item',route.item);
  for(const item of (route.itemPath??[]).slice(-50))url.searchParams.append('trail',item);
  if(route.scope&&route.scope!=='current')url.searchParams.set('scope',route.scope);
  if(route.query)url.searchParams.set('q',route.query);
  if(route.kind&&route.kind!=='all')url.searchParams.set('kind',route.kind);
  if(route.checkedOnly)url.searchParams.set('checked','1');
 }
 if(url.hash.startsWith('#ops='))url.hash='';
 return url;
}
export function sameWorkspaceRoute(a:WorkspaceRoute,b:WorkspaceRoute){return (a.scope??'current')===(b.scope??'current')&&a.view===b.view&&a.dish===b.dish&&a.variant===b.variant&&a.item===b.item&&JSON.stringify(a.itemPath??[])===JSON.stringify(b.itemPath??[])&&!!a.checkedOnly===!!b.checkedOnly&&a.day===b.day&&(a.query??'')===(b.query??'')&&(a.kind??'all')===(b.kind??'all');}
