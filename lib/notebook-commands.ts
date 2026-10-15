import {requireWriteScope} from './protected-api';
import {profileCommandSchema,applyProfileCommand} from './prep-draft';
import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {readNotebook,owner,canManage,snapshot,RequestError,notebookPayload} from './notebook-server';
import {validateNotebook,validationMessage,type Notebook} from './notebook';
import {validateOrdinaryEdit} from './catalog';
import {bulkCommandSchema,applyBulkCommand} from './bulk';
import {NotebookCapacityError} from './notebook-size';
import {validateProductionEdit} from './production-edit-server';

type Receipt={id:string;kind:string;actor_id:string;fingerprint:string;before_revision:number;after_revision:number;created_at:string};
async function command(user:ChatGPTUser,revision:number,id:string,kind:'bulk'|'save'|'profile',request:unknown,prepare:(before:Notebook)=>Promise<Notebook>){
 if(!/^[0-9a-f-]{36}$/i.test(id))throw new RequestError('A valid request ID is required.');
 const bytes=new TextEncoder().encode(JSON.stringify(request));
 if(bytes.length>750000)throw new RequestError('This request is too large.',413);
 const fingerprint=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const db=getRawDb();
 const receipt=async()=>{const previous=await db.prepare('SELECT * FROM notebook_commands WHERE id=?').bind(id).first<Receipt>();if(!previous)return null;if(previous.actor_id!==user.userId||previous.kind!==kind||previous.fingerprint!==fingerprint||previous.before_revision!==revision)throw new RequestError('This request ID belongs to a different change.',409,'command_mismatch');return previous;};
 const respond=async(r:Receipt,replayed:boolean)=>kind!=='save'?{...snapshot(await readNotebook(user),user,await owner(user),await canManage(user)),commandId:id,replayed}:{revision:r.after_revision,updatedAt:r.created_at,updatedBy:user.email,commandId:id,replayed};
 const previous=await receipt();if(previous)return respond(previous,true);
 const row=await readNotebook(user);
 if(row.revision!==revision){const raced=await receipt();if(raced)return respond(raced,true);throw new RequestError('The shared notebook changed. Keep your list, load the latest notebook and review it again.',409,'revision_conflict');}
 let next:Notebook;try{next=await prepare(validateNotebook(JSON.parse(row.payload)));}catch(e){if(e instanceof RequestError)throw e;if(e instanceof NotebookCapacityError)throw new RequestError(e.message,413,'capacity_limit');throw new RequestError(validationMessage(e));}
 const payload=notebookPayload(next);
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
 return command(user,revision,body.commandId,'bulk',request,async before=>{const next=applyBulkCommand(before,request);validateOrdinaryEdit(before,next,await canManage(user));return next;});
}
export async function saveWithReceipt(user:ChatGPTUser,revision:number,id:string,body:unknown){
 return command(user,revision,id,'save',body,async before=>{
  if((body as {schemaVersion?:number})?.schemaVersion!==4)throw new RequestError('Download your draft and reload this older page before saving.',409,'old_client');
  const next=validateNotebook(body);
  const manage=await canManage(user);if(manage)requireWriteScope('management');validateOrdinaryEdit(before,next,manage);
  await validateProductionEdit(before,next);
  const oldIds=new Set(before.items.map(i=>i.id)),newIds=new Set(next.items.filter(i=>!oldIds.has(i.id)).map(i=>i.id));
  if(newIds.size){const retired=await getRawDb().prepare('SELECT retired_id FROM catalog_operations WHERE retired_id IS NOT NULL').all<{retired_id:string}>();if(retired.results.some(r=>newIds.has(r.retired_id)))throw new RequestError('A merged item cannot be recreated. Reload and use its current catalog entry.');}
  return next;
 });
}

export async function profileSave(user:ChatGPTUser,revision:number,raw:unknown){
 const body=raw as {commandId?:unknown;command?:unknown;account?:unknown};if(typeof body.commandId!=='string')throw new RequestError('A request ID is required.');
 if(typeof body.account!=='string'||body.account.toLowerCase()!==user.email.toLowerCase())throw new RequestError('Sign in with the account that started this preparation draft.',403,'account_mismatch');
 const request=profileCommandSchema.parse(body.command);
 return command(user,revision,body.commandId,'profile',request,async before=>applyProfileCommand(before,request));
}
