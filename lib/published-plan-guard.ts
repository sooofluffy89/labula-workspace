import {getRawDb} from '@/db';
import {accessContext,RequestError} from './access-context';
import {displayDay,operationalDay} from './evening';
import {menuScope} from './menu-scope';
import {latestMenuSourceSql} from './menu-scope-server';
import type {Notebook} from './notebook';
import type {AppliedRecord} from './review-v2/applied';

type ScopeGuard={sql:string;args:(string|number)[];changedItemIds:string[]};
/**
 * Legacy publications derived their visible tasks from the live menu. New
 * clients must explicitly republish those plans before changing that scope.
 * The returned predicate also belongs in the receipt's atomic CAS, since a
 * legacy publication can arrive after this read while cutover is in progress.
 */
export async function legacyPlanScopeGuard(before:Notebook,after:Notebook,options:{beforeRecords?:AppliedRecord[];afterRecords?:AppliedRecord[]}={}):Promise<ScopeGuard>{
 if((accessContext.getStore()?.clientVersion??1)<2)return {sql:'1',args:[],changedItemIds:[]};
 const db=getRawDb();
 const source=options.beforeRecords?null:await db.prepare(latestMenuSourceSql).first<{review_payload:string}>();
 const beforeRecords=options.beforeRecords??(source?JSON.parse(source.review_payload) as AppliedRecord[]:[]),afterRecords=options.afterRecords??beforeRecords;
 const previous=menuScope(before,beforeRecords),next=menuScope(after,afterRecords);
 const suspended=(scope:ReturnType<typeof menuScope>,id:string)=>scope.usage.has(id)&&!scope.operational.has(id);
 const changedItemIds=[...new Set([...before.items,...after.items].map(item=>item.id))].filter(id=>suspended(previous,id)!==suspended(next,id));
 if(!changedItemIds.length)return {sql:'1',args:[],changedItemIds};
 const affectedSql=`SELECT c.id,c.plan_day FROM evening_checks c JOIN morning_tasks t ON t.check_id=c.id WHERE c.version>0 AND c.plan_policy_version<2 AND c.plan_day>=? AND t.cancelled=0 AND t.catalog_id IN (SELECT value FROM json_each(?))`;
 const args=[operationalDay(),JSON.stringify(changedItemIds)];
 const affected=await db.prepare(`SELECT DISTINCT id,plan_day FROM (${affectedSql}) ORDER BY plan_day`).bind(...args).all<{id:string;plan_day:string}>();
 if(affected.results.length){
  const dates=affected.results.map(check=>displayDay(check.plan_day)).join(', ');
  throw new RequestError(`This change would alter a legacy morning plan for ${dates}. Your draft is kept. Open its Evening check, choose Correct check, review the tasks and Finish check before changing the menu.`,409,'legacy_plan_scope');
 }
 return {sql:`NOT EXISTS (${affectedSql})`,args,changedItemIds};
}
