import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {readNotebook,owner,snapshot,RequestError,type Row} from './notebook-server';
import {validateNotebook,validationMessage,type Notebook} from './notebook';
import {validateOrdinaryEdit} from './catalog';
import {bulkCommandSchema,applyBulkCommand} from './bulk';

type Receipt={id:string;kind:string;actor_id:string;fingerprint:string;before_revision:number;after_revision:number;created_at:string};
async function command(user:ChatGPTUser,revision:number,id:string,kind:'bulk'|'save',request:unknown,prepare:(before:Notebook)=>Promise<Notebook>){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new RequestError('A valid request ID is required.');
 const bytes=new TextEncoder().encode(JSON.stringify(request));
 if(bytes.length>750000)throw new RequestError('This request is too large.',413);
 const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const db=getRawDb();
 const receipt=async()=>{const previous=await db.prepare('SELECT * FROM notebook_commands WHERE id=?').bind(id).first<Receipt>();if(!previous)return null;if(previous.actor_id!==user.userId||previous.kind!==kind||previous.fingerprint!==fingerprint||previous.before_revision!==revision)throw new RequestError('This request ID belongs to a different change.',409,'command_mismatch');return previous;};
 const respond=async(r:Receipt,replayed:boolean)=>kind==='bulk'?{...snapshot(await readNotebook(user),user,await owner(user)),commandId:id,replayed}:{revision:r.after_revision,updatedAt:r.created_at,updatedBy:user.email,commandId:id,replayed};
 const previous=await receipt();if(previous)return respond(previous,true);
 const row=await readNotebook(user);
 if(row.revision!==revision){const raced=await receipt();if(raced)return respond(raced,true);throw new RequestError('The shared notebook changed. Keep your list, load the latest notebook and review it again.',409,'revision_conflict');}
 let next:Notebook;try{next=await prepare(validateNotebook(JSON.parse(row.payload)));}catch(e){if(e instanceof RequestError)throw e;throw new RequestError(validationMessage(e));}
 const payload=JSON.stringify(next);if(new TextEncoder().encode(payload).length>750000)throw new RequestError('The notebook is too large.',413);
 const now=new Date().toISOString();
 const result=await db.batch([
  db.prepare('INSERT INTO notebook_commands (id,kind,actor_id,fingerprint,before_revision,after_revision,created_at) SELECT ?,?,?,?,revision,revision+1,? FROM notebooks WHERE id=? AND revision=?').bind(id,kind,user.userId,fingerprint,now,'kitchen',revision),
  db.prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM notebook_commands WHERE id=? AND before_revision=?)').bind(payload,now,user.email,'kitchen',revision,id,revision),
 ]);
 if(!result[0].meta.changes||!result[1].meta.changes){const raced=await receipt();if(raced)return respond(raced,true);throw new RequestError('The shared notebook changed. Keep your list, load the latest notebook and review it again.',409,'revision_conflict');}
 return respond({id,kind,actor_id:user.userId,fingerprint,before_revision:revision,after_revision:revision+1,created_at:now},false);
}
export async function bulkSave(user:ChatGPTUser,revision:number,raw:unknown){
 const body=raw as {commandId?:unknown;command?:unknown};if(typeof body.commandId!=='string')throw new RequestError('A request ID is required.');
 const request=bulkCommandSchema.parse(body.command);
 return command(user,revision,body.commandId,'bulk',request,async before=>{const next=applyBulkCommand(before,request);validateOrdinaryEdit(before,next);return next;});
}
export async function saveWithReceipt(user:ChatGPTUser,revision:number,id:string,body:unknown){
 if((body as {schemaVersion?:number})?.schemaVersion!==2)throw new RequestError('Download your draft and reload this older page before saving.',409);
 const next=validateNotebook(body);
 return command(user,revision,id,'save',next,async before=>{
  validateOrdinaryEdit(before,next);
  const oldIds=new Set(before.items.map(i=>i.id)),newIds=new Set(next.items.filter(i=>!oldIds.has(i.id)).map(i=>i.id));
  if(newIds.size){const retired=await getRawDb().prepare('SELECT retired_id FROM catalog_operations WHERE retired_id IS NOT NULL').all<{retired_id:string}>();if(retired.results.some(r=>newIds.has(r.retired_id)))throw new RequestError('A merged item cannot be recreated. Reload and use its current catalog entry.');}
  return next;
 });
}
