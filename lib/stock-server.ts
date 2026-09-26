import {initializeRounds} from './round-store';
import {activeMember,eventStatement} from './activity-server';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {readNotebook,RequestError,owner} from './notebook-server';
import {stockCommandSchema,type StockCommand,type StockSnapshot} from './stock';
import {groupCommandSchema,type GroupCommand,validGroup} from './ingredient-groups';
import groupSeed from './ingredient-group-seed.json';
import {usageMap,type Notebook} from './notebook';
import {menu,categories} from './menu';

type StockRow={item_id:string;included:number;track:number;revision:number;updated_at:string;updated_by:string;group_id:string|null;group_revision:number;group_source:string|null};
type Receipt={id:string;actor_id:string;request:string;result:string};
const seed=JSON.stringify(groupSeed.assignments.filter(row=>row.proposedGroupId));
// Read the *saved* catalog inside SQL. A missing entry is new, an explicit tombstone is not.
async function initialize(user:ChatGPTUser){
 await readNotebook(user);
 await getRawDb().prepare(`INSERT INTO stock_items (item_id,included,track,revision,updated_at,updated_by)
 SELECT json_extract(j.value,'$.id'),1,0,0,?,? FROM notebooks n,json_each(n.payload,'$.items') j
 WHERE n.id='kitchen' ON CONFLICT(item_id) DO NOTHING`).bind(new Date().toISOString(),user.userId).run();
 // An exact ID/name/type match is required; a manual null assignment remains authoritative.
 await getRawDb().prepare(`UPDATE stock_items SET group_id=json_extract(seed.value,'$.proposedGroupId'),group_revision=group_revision+1,group_source='seed',group_updated_at=?,group_updated_by='system:group-seed'
 FROM json_each(?) seed,notebooks n,json_each(n.payload,'$.items') item
 WHERE n.id='kitchen' AND stock_items.item_id=json_extract(seed.value,'$.itemId') AND stock_items.group_source IS NULL
 AND json_extract(item.value,'$.id')=stock_items.item_id AND json_extract(item.value,'$.name')=json_extract(seed.value,'$.expectedName')
 AND json_extract(item.value,'$.kind')=json_extract(seed.value,'$.expectedKind')`).bind(new Date().toISOString(),seed).run();
 await initializeRounds();
}
export async function readStock(user:ChatGPTUser):Promise<StockSnapshot>{
 await initialize(user);
 // A single transaction prevents pairing a newer catalog with an older merge configuration.
 const results=await getRawDb().batch([
  getRawDb().prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'"),
  getRawDb().prepare('SELECT * FROM stock_items'),
 ]);
 const notebook=results[0].results[0] as {payload:string;revision:number};
 const rows=new Map((results[1].results as StockRow[]).map(row=>[row.item_id,row]));
 const saved=JSON.parse(notebook.payload) as Notebook,usage=usageMap(saved);
 const items=saved.items.map(item=>{
  const row=rows.get(item.id);
  const usedBy=usage.get(item.id)?.all;
  const itemCategories=categories.filter(category=>menu.some(dish=>dish.category===category&&usedBy?.has(dish.id)));
  // A newly committed catalog item may arrive between initialization and this read.
  return {itemId:item.id,name:item.name,aliases:item.aliases,kind:item.kind,categories:itemCategories,included:row?!!row.included:true,track:row?!!row.track:false,revision:row?.revision??0,updatedAt:row?.updated_at??'',updatedBy:row?.updated_by??'',groupId:validGroup(row?.group_id),groupRevision:row?.group_revision??0,groupSource:row?.group_source??null};
 });
 const canManageGroups=await owner(user);
 const byItem=new Map(items.map(item=>[item.itemId,item]));
 const merges=canManageGroups?(await getRawDb().prepare(`SELECT retired_id AS source_id,json_extract(request,'$.targetId') AS target_id FROM catalog_operations c
  WHERE kind='merge' AND retired_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM catalog_operations u WHERE u.kind='undo' AND u.undo_of=c.id)`).all<{source_id:string;target_id:string}>()).results:[];
 const groupConflicts=merges.flatMap(m=>{const source=rows.get(m.source_id),target=byItem.get(m.target_id),sourceName=(JSON.parse(notebook.payload) as Notebook).items.find(i=>i.id===m.source_id)?.name;
  if(!source?.group_source||!target||source.group_id===target.groupId)return [];
  return [{sourceId:m.source_id,sourceName:sourceName??'Retired item',targetId:m.target_id,targetName:target.name,sourceGroupId:validGroup(source.group_id),targetGroupId:target.groupId}];});
 return {accountId:user.userId,account:user.email,scope:'kitchen',items,notebookRevision:notebook.revision,canManageGroups,groupConflicts};
}
export async function ingredientGroupCommand(user:ChatGPTUser,raw:unknown){
 const c:GroupCommand=groupCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(c);
 if(!await owner(user))throw new RequestError('Only the owner can change ingredient groups.',403,'role_restricted');
 const replay=async()=>{const prior=await db.prepare('SELECT * FROM ingredient_group_commands WHERE id=?').bind(c.id).first<Receipt>();
  if(!prior)return null;if(prior.actor_id!==user.userId||prior.request!==request)throw new RequestError('This request ID belongs to another change.',409,'command_mismatch');
  return {operationId:c.id,result:JSON.parse(prior.result),replayed:true};};
 const prior=await replay();if(prior)return prior;
 await initialize(user);const member=await activeMember(user),now=new Date().toISOString();
 const gate='EXISTS (SELECT 1 FROM ingredient_group_commands WHERE id=? AND actor_id=? AND request=?)',args=[c.id,user.userId,request];
 const result=JSON.stringify({itemId:c.itemId,groupId:c.groupId,revision:c.revision+1});
 const receipt=db.prepare(`INSERT INTO ingredient_group_commands(id,actor_id,request,result,created_at)
 SELECT ?,?,?,?,? WHERE EXISTS (SELECT 1 FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i
 WHERE n.id='kitchen' AND s.item_id=? AND s.group_revision=? AND json_extract(i.value,'$.id')=s.item_id)
 AND EXISTS (SELECT 1 FROM kitchen_owner WHERE id='owner' AND user_id=?)
 AND EXISTS (SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(c.id,user.userId,request,result,now,c.itemId,c.revision,user.userId,user.userId);
 const event=eventStatement(user,member.name,c,now,{category:'stock',action:'group',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",
  before:"json_object('groupId',s.group_id,'revision',s.group_revision)",after:"json_object('groupId',?,'revision',s.group_revision+1)",
  from:`FROM stock_items s,notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND s.item_id=? AND s.group_revision=? AND json_extract(i.value,'$.id')=s.item_id AND ${gate}`,
  args:[c.groupId,c.itemId,c.revision,...args]});
 const update=db.prepare(`UPDATE stock_items SET group_id=?,group_revision=group_revision+1,group_source='owner',group_updated_at=?,group_updated_by=? WHERE item_id=? AND group_revision=? AND ${gate}`).bind(c.groupId,now,user.userId,c.itemId,c.revision,...args);
 await db.batch([receipt,event,update]);
 const saved=await replay();if(saved)return saved;
 throw new RequestError('This ingredient group changed or the item is no longer available. Refresh and review the shared result.',409,'group_conflict');
}
export async function stockCommand(user:ChatGPTUser,raw:unknown){
 const command:StockCommand=stockCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(command);
 const replay=async()=>{const prior=await db.prepare('SELECT * FROM stock_commands WHERE id=?').bind(command.id).first<Receipt>();if(!prior)return null;
  if(prior.actor_id!==user.userId||prior.request!==request)throw new RequestError('This request belongs to a different account or change.',409,'command_mismatch');
  return {operationId:prior.id,result:JSON.parse(prior.result),replayed:true};
 };
 const prior=await replay();if(prior)return prior;
 const member=await activeMember(user);
 await initialize(user);
 const now=new Date().toISOString(),changes=JSON.stringify(command.changes);
 const result=JSON.stringify(command.changes.map(c=>({...c,revision:c.revision+1,updatedAt:now,updatedBy:user.userId})));
 // Receipt + all item updates are one D1 transaction. Per-item CAS permits unrelated concurrent edits.
 const receipt=db.prepare(`INSERT INTO stock_commands (id,actor_id,request,result,created_at)
 SELECT ?,?,?,?,? WHERE NOT EXISTS (
 SELECT 1 FROM json_each(?) c LEFT JOIN stock_items s ON s.item_id=json_extract(c.value,'$.itemId')
 WHERE s.item_id IS NULL OR s.revision!=json_extract(c.value,'$.revision')
 OR (s.included=0 AND json_extract(c.value,'$.track')=1)
 OR NOT EXISTS (SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id)
 ) AND EXISTS (SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(command.id,user.userId,request,result,now,changes,user.userId);
 const update=db.prepare(`UPDATE stock_items SET
 included=json_extract(c.value,'$.included'),track=json_extract(c.value,'$.track'),revision=stock_items.revision+1,updated_at=?,updated_by=?
 FROM json_each(?) c WHERE stock_items.item_id=json_extract(c.value,'$.itemId') AND stock_items.revision=json_extract(c.value,'$.revision')
 AND EXISTS (SELECT 1 FROM stock_commands WHERE id=? AND actor_id=? AND request=?)`).bind(now,user.userId,changes,command.id,user.userId,request);
 const events=eventStatement(user,member.name,command,now,{category:'stock',action:'settings',itemId:'s.item_id',itemName:"json_extract(i.value,'$.name')",itemKind:"json_extract(i.value,'$.kind')",before:"json_object('included',s.included,'track',s.track,'revision',s.revision)",after:"json_object('included',json_extract(c.value,'$.included'),'track',json_extract(c.value,'$.track'),'revision',s.revision+1)",from:`FROM json_each(?) c JOIN stock_items s ON s.item_id=json_extract(c.value,'$.itemId'),notebooks n,json_each(n.payload,'$.items') i WHERE n.id='kitchen' AND json_extract(i.value,'$.id')=s.item_id AND s.revision=json_extract(c.value,'$.revision') AND (s.included!=json_extract(c.value,'$.included') OR s.track!=json_extract(c.value,'$.track')) AND EXISTS (SELECT 1 FROM stock_commands WHERE id=? AND actor_id=? AND request=?)`,args:[changes,command.id,user.userId,request]});
 await db.batch([receipt,events,update]);
 const saved=await replay();if(saved)return saved;
 throw new RequestError('This stock item changed or is no longer available. Refresh the list, review your intended change, then try again.',409,'stock_conflict');
}
