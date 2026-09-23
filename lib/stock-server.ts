import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {readNotebook,RequestError} from './notebook-server';
import {stockCommandSchema,type StockCommand,type StockSnapshot} from './stock';
import type {Notebook} from './notebook';

type StockRow={item_id:string;included:number;track:number;revision:number;updated_at:string;updated_by:string};
type Receipt={id:string;actor_id:string;request:string;result:string};
// Read the *saved* catalog inside SQL. A missing entry is new, an explicit tombstone is not.
async function initialize(user:ChatGPTUser){
 await readNotebook(user);
 await getRawDb().prepare(`INSERT INTO stock_items (item_id,included,track,revision,updated_at,updated_by)
 SELECT json_extract(j.value,'$.id'),1,0,0,?,? FROM notebooks n,json_each(n.payload,'$.items') j
 WHERE n.id='kitchen' ON CONFLICT(item_id) DO NOTHING`).bind(new Date().toISOString(),user.userId).run();
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
 const items=(JSON.parse(notebook.payload) as Notebook).items.map(item=>{
  const row=rows.get(item.id);
  // A newly committed catalog item may arrive between initialization and this read.
  return {itemId:item.id,name:item.name,aliases:item.aliases,kind:item.kind,included:row?!!row.included:true,track:row?!!row.track:false,revision:row?.revision??0,updatedAt:row?.updated_at??'',updatedBy:row?.updated_by??''};
 });
 return {accountId:user.userId,account:user.email,scope:'kitchen',items,notebookRevision:notebook.revision};
}
export async function stockCommand(user:ChatGPTUser,raw:unknown){
 const command:StockCommand=stockCommandSchema.parse(raw),db=getRawDb(),request=JSON.stringify(command);
 const replay=async()=>{const prior=await db.prepare('SELECT * FROM stock_commands WHERE id=?').bind(command.id).first<Receipt>();if(!prior)return null;
  if(prior.actor_id!==user.userId||prior.request!==request)throw new RequestError('This request belongs to a different account or change.',409,'command_mismatch');
  return {operationId:prior.id,result:JSON.parse(prior.result),replayed:true};
 };
 const prior=await replay();if(prior)return prior;
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
 ) ON CONFLICT(id) DO NOTHING`).bind(command.id,user.userId,request,result,now,changes);
 const update=db.prepare(`UPDATE stock_items SET
 included=json_extract(c.value,'$.included'),track=json_extract(c.value,'$.track'),revision=stock_items.revision+1,updated_at=?,updated_by=?
 FROM json_each(?) c WHERE stock_items.item_id=json_extract(c.value,'$.itemId') AND stock_items.revision=json_extract(c.value,'$.revision')
 AND EXISTS (SELECT 1 FROM stock_commands WHERE id=? AND actor_id=? AND request=?)`).bind(now,user.userId,changes,command.id,user.userId,request);
 await db.batch([receipt,update]);
 const saved=await replay();if(saved)return saved;
 throw new RequestError('This stock item changed or is no longer available. Refresh the list, review your intended change, then try again.',409,'stock_conflict');
}
