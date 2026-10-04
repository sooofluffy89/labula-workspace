import {bindReviewSource,activeGroups,values,list,str,entity,options,same,taskHash,type Draft,type Entity} from './model';
import {groups,visible,type Field,type Values} from './fields';
import type {ReviewSource} from '../data-review';
import {emptyUX} from './ux-schema';
import {changeField,changeValue} from './change-presentation';

// Only dependencies of this topic are stamped. Navigation and unrelated answers never invalidate it.
export function topicDependencies(d:Draft,e:Entity,id:string,source?:ReviewSource):string {
 const g=activeGroups(d,e,source).find(g=>g.id===id);if(!g)return 'inactive';
 const result:Record<string,unknown>={};
 for(const [key,fact] of Object.entries(d.ux?.facts??{}))if(fact.target.entityId===e.id&&fact.target.group===id&&fact.decision!=='accepted')result['source-decision:'+key]=fact;
 const own=(group:string,keys?:string[])=>{const v=values(e,group);result['context:'+group]=keys?Object.fromEntries(keys.map(k=>[k,v[k]])):v;};
 if(e.kind==='item'&&id!=='ITEM-01')own('ITEM-01',['identity','alias','aliasPhase']);
 if(id==='ITEM-04')own('ITEM-03');
 if(id.startsWith('DISH'))own('MENU-01',['status','practice']);
 if(id==='DISH-03'||id==='DISH-05')own('DISH-01');
 if(id.startsWith('RUN')&&id!=='RUN-01')own('RUN-01');
 if(id==='RUN-04')own('RUN-03');
 if(id==='RUN-07')own('RUN-06');
 if(id.startsWith('STORE')&&id!=='STORE-01')own('STORE-01');
 if(['STORE-03','STORE-04','STORE-05'].includes(id))own('STORE-02');
 if(id.startsWith('OPS')&&id!=='OPS-01')own('OPS-01');
 const visited=new Set<string>();
 const scan=(record:Entity,gid:string)=>{const key=record.id+':'+gid;if(visited.has(key))return;visited.add(key);const definition=groups.find(g=>g.id===gid);if(definition)walk(definition.fields,values(record,gid),record);};
 const walk=(fs:Field[],v:Values,context:Entity)=>{for(const f of fs){if(!visible(f,v,fs))continue;if(f.type==='rows'){for(const row of list(v,f.key))walk(f.fields??[],row,context);continue;}if(f.type!=='ref'||!str(v,f.key))continue;const ref=str(v,f.key),record=entity(d,ref);if(record){const identity=record.kind==='item'?'ITEM-01':record.kind==='process'?'PROC-01':record.kind==='dish'?'MENU-01':record.kind==='run'?'RUN-01':record.kind==='storage'?'STORE-01':'OPS-01';const value=values(record,identity);result[ref+':identity']=record.kind==='item'?{name:record.name,identity:value.identity,alias:value.alias}:value;if(record.kind==='process'){for(const gid of ['PROC-01','PROC-02','PROC-03','PROC-05']){result[ref+':'+gid]=values(record,gid);scan(record,gid);}}else if(record.kind!=='item')scan(record,identity);continue;}
   result[ref+':valid']=options(d,context,f,v).some(o=>o.id===ref);
   for(const owner of d.entities.filter(x=>!x.archived))for(const [gid,key] of [['ITEM-01','stages'],['ITEM-02','sources'],['PROC-02','inputs'],['PROC-03','outputs'],['DISH-01','components'],['DISH-02','groups'],['RUN-07','steps']]){const row=list(values(owner,gid),key).find(r=>r.id===ref),stamp=owner.id+':'+gid+':'+ref;if(row&&!visited.has(stamp)){visited.add(stamp);result[stamp]=row;walk(groups.find(g=>g.id===gid)?.fields.find(f=>f.key===key)?.fields??[],row,owner);if(gid==='RUN-07'){result[owner.id+':RUN-01']=values(owner,'RUN-01');scan(owner,'RUN-01');}}}
 }};scan(e,id);for(const key of Object.keys(result).filter(k=>k.startsWith('context:')))scan(e,key.slice(8));return JSON.stringify(Object.entries(result).sort(([a],[b])=>a.localeCompare(b)));
}
export function confirmationStatus(d:Draft,e:Entity,id:string,source?:ReviewSource){
 bindReviewSource(d,source);
 const stored=e.confirmations[id],stamp=d.ux?.confirmations[e.id]?.[id],reasons:string[]=[];
 if(d.tasks.some(t=>t.targets.some(x=>x.entityId===e.id&&x.group===id)&&(!t.closedHash||t.closedHash!==taskHash(d,t))))reasons.push('A check for this topic is still open.');
 if(unresolvedSourceChecks(d,e,id).length)reasons.push('A previously recorded fact still needs its assigned check.');
 if(stored===undefined)return {valid:false,previouslyConfirmed:false,reasons};
 if(d.ux&&!stamp)reasons.push('The saved confirmation context is missing; confirm this topic again.');
 if(stored!==JSON.stringify(values(e,id)))reasons.push('Answers in this topic changed.');
 if(stamp&&stamp.dependencies!==topicDependencies(d,e,id,source))reasons.push('A previous-entry decision or a linked stage, source or process changed.');
 if(stamp&&stamp.value!==stored)reasons.push('The confirmation and its context no longer match.');
 return {valid:!reasons.length,previouslyConfirmed:true,reasons};
}

export type ConfirmationChange={
 title:string;
 detail:string;
 before?:string;
 after?:string;
 target?:{entityId:string;group:string;path:string[]};
 exact:boolean;
};

function leafChanges(before:unknown,after:unknown,path:string[]=[],result:{path:string[];before:unknown;after:unknown}[]=[]){
 if(same(before,after))return result;
 if(Array.isArray(before)&&Array.isArray(after)){
  const stable=(rows:unknown[])=>rows.every(row=>row&&typeof row==='object'&&!Array.isArray(row)&&typeof (row as Record<string,unknown>).id==='string');
  if(stable(before)&&stable(after)){
   const oldRows=new Map(before.map(row=>[String((row as Record<string,unknown>).id),row])),newRows=new Map(after.map(row=>[String((row as Record<string,unknown>).id),row]));
   for(const rowId of new Set([...oldRows.keys(),...newRows.keys()]))leafChanges(oldRows.get(rowId),newRows.get(rowId),[...path,rowId],result);
   if(same([...oldRows.keys()].sort(),[...newRows.keys()].sort())&&!same([...oldRows.keys()],[...newRows.keys()]))result.push({path,before:'Recorded rows in their previous order',after:'Same rows in a different order'});
   return result;
  }
 }
 if(before&&after&&typeof before==='object'&&typeof after==='object'&&!Array.isArray(before)&&!Array.isArray(after)){
  const keys=new Set([...Object.keys(before as Record<string,unknown>),...Object.keys(after as Record<string,unknown>)]);
  for(const key of keys)leafChanges((before as Record<string,unknown>)[key],(after as Record<string,unknown>)[key],[...path,key],result);
 }else result.push({path,before,after});
 return result;
}
function dependencyMap(value:string):Record<string,unknown>|null{
 try{const parsed=JSON.parse(value);return Array.isArray(parsed)?Object.fromEntries(parsed):null;}catch{return null;}
}
function dependencyTarget(d:Draft,current:Entity,currentGroup:string,key:string,path:string[]):ConfirmationChange['target']{
 if(key.startsWith('context:'))return {entityId:current.id,group:key.slice(8),path};
 if(key.startsWith('source-decision:'))return {entityId:current.id,group:currentGroup,path:[]};
 const parts=key.split(':'),linked=entity(d,parts[0]);
 if(!linked)return undefined;
 if(parts[1]==='identity')return {entityId:linked.id,group:linked.kind==='item'?'ITEM-01':linked.kind==='process'?'PROC-01':linked.kind==='dish'?'MENU-01':linked.kind==='run'?'RUN-01':linked.kind==='storage'?'STORE-01':'OPS-01',path};
 if(/^(SET|MENU|DISH|ITEM|PROC|RUN|STORE|OPS|CHECK|APPROVE)-\d+$/.test(parts[1]??'')){
  if(parts[2]){const group=groups.find(g=>g.id===parts[1]),rowField=group?.fields.find(f=>f.type==='rows'&&list(values(linked,parts[1]),f.key).some(row=>row.id===parts[2]));return {entityId:linked.id,group:parts[1],path:rowField?[rowField.key,parts[2],...path]:[]};}
  return {entityId:linked.id,group:parts[1],path};
 }
 return undefined;
}
function changeTitle(d:Draft,target:ConfirmationChange['target'],fallback:string){if(!target)return fallback;const record=entity(d,target.entityId),group=groups.find(g=>g.id===target.group);return [record?.name,group?.title,...changeField(target).labels].filter(Boolean).join(' · ')||fallback;}

// Explanations are presentation-only. They never update confirmation baselines.
export function confirmationChanges(d:Draft,e:Entity,id:string,source?:ReviewSource):ConfirmationChange[]{
 const stored=e.confirmations[id],stamp=d.ux?.confirmations[e.id]?.[id];
 if(stored===undefined||confirmationStatus(d,e,id,source).valid)return [];
 if(!stamp)return [{title:'Confirmation context is unavailable',detail:'The saved answer is kept, but its confirmation context is missing. Review this topic again.',target:{entityId:e.id,group:id,path:[]},exact:false}];
 if(stamp.at==='legacy-context')return [{title:'Earlier confirmation needs a fresh review',detail:'This context was captured when the review was upgraded. It is not proof of the exact state when the earlier confirmation was made.',target:{entityId:e.id,group:id,path:[]},exact:false}];
 const changes:ConfirmationChange[]=[],before=dependencyMap(stamp.dependencies),after=dependencyMap(topicDependencies(d,e,id,source));
 const describe=(change:{path:string[];before:unknown;after:unknown},target:ConfirmationChange['target'],detail:string)=>{const old=changeValue(d,change.before,target,true,before),now=changeValue(d,change.after,target,false,after);const record=target&&entity(d,target.entityId);let safe=record&&!record.archived&&activeGroups(d,record,source).some(g=>g.id===target!.group)?target:undefined;if(safe&&safe.path.length&&!changeField(safe).field)safe={...safe,path:[]};return {title:changeTitle(d,target,'Linked information changed'),detail,before:old.text,after:now.text,target:safe,exact:!!target&&old.exact&&now.exact};};
 if(stored!==JSON.stringify(values(e,id))){
  try{for(const change of leafChanges(JSON.parse(stored),values(e,id)))changes.push(describe(change,{entityId:e.id,group:id,path:change.path},'This answer changed after it was confirmed.'));}
  catch{changes.push({title:'Answer changed',detail:'The current answer no longer matches the confirmed value. Review this topic again.',target:{entityId:e.id,group:id,path:[]},exact:false});}
 }
 if(stamp.dependencies!==topicDependencies(d,e,id,source)){
  if(before&&after){
   const keys=new Set([...Object.keys(before),...Object.keys(after)]);
   for(const key of keys){if(same(before[key],after[key]))continue;for(const change of leafChanges(before[key],after[key])){const target=dependencyTarget(d,e,id,key,change.path);changes.push(describe(change,target,target?'A linked fact used by this answer changed. Review the current record before confirming again.':'The linked context changed, but the earlier detail cannot be mapped safely. Review this topic again.'));}}
  }else changes.push({title:'Linked information changed',detail:'The saved dependency context cannot be read safely. The earlier answer is kept; review this topic again.',target:{entityId:e.id,group:id,path:[]},exact:false});
 }
 if(stamp.value!==stored)changes.push({title:'Confirmation record does not match',detail:'The stored confirmation and its context disagree. No earlier value is being guessed; confirm the current topic again.',target:{entityId:e.id,group:id,path:[]},exact:false});
 const unique=new Map<string,ConfirmationChange>();for(const change of changes)unique.set(JSON.stringify([change.title,change.detail,change.before,change.after,change.target]),change);const all=[...unique.values()];return all.length<=8?all:[...all.slice(0,8),{title:`${all.length-8} more changes`,detail:'This is a shortened list. Review all answers in the affected topic before confirming.',target:{entityId:e.id,group:id,path:[]},exact:false}];
}
export function confirmTopic(d:Draft,eid:string,gid:string,source:ReviewSource):Draft{
 const e=entity(d,eid);if(!e)return d;const value=JSON.stringify(values(e,gid)),ux=d.ux??emptyUX();
 return bindReviewSource({...d,ux:{...ux,confirmations:{...ux.confirmations,[eid]:{...ux.confirmations[eid],[gid]:{value,dependencies:topicDependencies(d,e,gid,source),at:new Date().toISOString()}}}},entities:d.entities.map(x=>x.id===eid?{...x,confirmations:{...x.confirmations,[gid]:value}}:x)},source);
}
// On first UX edit, preserve the exact old confirmation and its currently known context.
// A confirmation already stale is never made valid by this compatibility snapshot.
export function upgradeUX(d:Draft,source:ReviewSource):Draft{
 bindReviewSource(d,source);if(d.ux)return d;let next:Draft={...d,ux:emptyUX()};for(const e of d.entities)for(const [gid,hash] of Object.entries(e.confirmations)){if(!groups.some(g=>g.id===gid))continue;next={...next,ux:{...next.ux!,confirmations:{...next.ux!.confirmations,[e.id]:{...next.ux!.confirmations[e.id],[gid]:{value:hash,dependencies:topicDependencies(d,e,gid,source),at:'legacy-context'}}}}};}return bindReviewSource(next,source);
}
export function confirmationContextChanged(before:Draft,after:Draft,eid:string,gid:string){return !same(before.ux?.confirmations[eid]?.[gid],after.ux?.confirmations[eid]?.[gid]);}

export function unresolvedSourceChecks(d:Draft,e:Entity,id:string){return Object.values(d.ux?.facts??{}).filter(f=>f.decision==='check'&&f.target.entityId===e.id&&f.target.group===id&&!d.tasks.some(t=>t.closedHash&&t.closedHash===taskHash(d,t)&&t.targets.some(target=>target.entityId===e.id&&target.group===id&&target.path.every((p,i)=>f.target.path[i]===p))));}
