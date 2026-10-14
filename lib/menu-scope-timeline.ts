import {scopeSource,type MenuScopeSource} from './menu-scope';
import type {Timeline} from './check-rounds';

/** Intersect immutable menu intervals with tracking intervals without modifying manual settings. */
export const menuIntervals=(sources:MenuScopeSource[])=>sources.map(row=>({at:row.recorded_at,eligible:scopeSource(row).operational}));
export function menuTimeline(itemId:string,timeline:Timeline[],sources:MenuScopeSource[],intervals=menuIntervals(sources)):Timeline[]{
 const events=[...timeline.filter(e=>e.itemId===itemId).map(e=>({at:e.recordedAt,track:e})),...intervals.map(row=>({at:row.at,scope:row.eligible.has(itemId)}))].sort((a,b)=>a.at.localeCompare(b.at));
 let tracked:Timeline|undefined,eligible=true;const result:Timeline[]=[];
 for(const event of events){if('track' in event)tracked=event.track;else eligible=event.scope;if(!tracked)continue;
  const next={...tracked,recordedAt:event.at,active:tracked.active&&eligible,source:'scope' in event?'menu-scope':tracked.source,seq:result.length+1};
  const prior=result.at(-1);if(prior&&prior.active===next.active&&prior.roundId===next.roundId&&JSON.stringify(prior.days)===JSON.stringify(next.days))continue;result.push(next);
 }
 return result;
}
