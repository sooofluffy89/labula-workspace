import {dateSchema} from './evening';
/** URL state contains view preferences only, never drafts or operational writes. */
export const workspaceDestinations = ['insights','recipes','catalog','overview','team','evening','morning','manage','rounds','history','operations','calendar','review'] as const;
export type WorkspaceDestination = typeof workspaceDestinations[number];
export type WorkspaceRoute = {view:WorkspaceDestination;dish?:string;variant?:string;query?:string;day?:string;kind?:'all'|'prep'|'bought'};
export function readWorkspaceRoute(url:URL,fallback:WorkspaceDestination='insights'):WorkspaceRoute {
 const value=url.searchParams.get('view');
 const view=workspaceDestinations.includes(value as WorkspaceDestination)?value as WorkspaceDestination:fallback;
 const ops=new URLSearchParams(url.hash.startsWith('#ops=')?url.hash.slice(1):url.search);
 const kind=url.searchParams.get('kind');
 return {view:ops.get('ops')==='history'?(view==='operations'?'operations':'history'):view,
  ...(url.searchParams.get('dish')?{dish:url.searchParams.get('dish')!.slice(0,100)}:{}),
  ...(url.searchParams.get('variant')?{variant:url.searchParams.get('variant')!.slice(0,100)}:{}),
  ...(dateSchema.safeParse(url.searchParams.get('day')).success?{day:url.searchParams.get('day')!}:{}),
  ...(url.searchParams.get('q')?{query:url.searchParams.get('q')!.slice(0,160)}:{}),
  ...(['all','prep','bought'].includes(kind??'')?{kind:kind as WorkspaceRoute['kind']}:{})};
}
export function workspaceUrl(current:URL,route:WorkspaceRoute):URL {
 const url=new URL(current);
 for(const key of ['view','dish','variant','q','kind','day','ops','check'])url.searchParams.delete(key);
 url.searchParams.set('view',route.view);
 if(['evening','morning'].includes(route.view)&&route.day)url.searchParams.set('day',route.day);
 if(route.view==='recipes'){if(route.dish)url.searchParams.set('dish',route.dish);if(route.variant)url.searchParams.set('variant',route.variant);}
 if(route.view==='catalog'){if(route.query)url.searchParams.set('q',route.query);if(route.kind&&route.kind!=='all')url.searchParams.set('kind',route.kind);}
 if(url.hash.startsWith('#ops='))url.hash='';
 return url;
}
export function sameWorkspaceRoute(a:WorkspaceRoute,b:WorkspaceRoute){return a.view===b.view&&a.dish===b.dish&&a.variant===b.variant&&a.day===b.day&&(a.query??'')===(b.query??'')&&(a.kind??'all')===(b.kind??'all');}
