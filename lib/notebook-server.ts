import { getRawDb } from '@/db';
import { getChatGPTUser,type ChatGPTUser } from '@/app/chatgpt-auth';
import { initialNotebook,migrateNotebook,validateNotebook,validationMessage,type Notebook } from './notebook';
import { operationSchema,applyOperation,validateOrdinaryEdit } from './catalog';
export class RequestError extends Error {constructor(message:string,public status=400,public code?:string){super(message);}}
const checked=<T>(fn:()=>T):T=>{try{return fn();}catch(e){throw new RequestError(validationMessage(e));}};
export const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
export type Row={payload:string;revision:number;updated_at:string;updated_by:string};
type Audit={id:string;kind:string;request:string;actor_id:string;actor_email:string;before_revision:number;after_revision:number;before_payload:string;after_payload:string;summary:string;created_at:string;undo_of:string|null};
export async function identity(){const user=await getChatGPTUser();if(!user)throw new RequestError('Sign in to access the kitchen notebook.',401);return user;}
export async function owner(user:ChatGPTUser){
 // Bind the explicitly configured owner's verified dispatch identity once. Later checks use the site-scoped stable user ID.
 // The bundled loopback-only development identity is removed from production by Vite.
 const expectedEmail=import.meta.env.DEV?'seedy@sites.test':'jan@bananasport.cz';
 if(user.email.toLowerCase()===expectedEmail)await getRawDb().prepare('INSERT INTO kitchen_owner (id,user_id) VALUES (?,?) ON CONFLICT(id) DO NOTHING').bind('owner',user.userId).run();
 const record=await getRawDb().prepare('SELECT user_id FROM kitchen_owner WHERE id=?').bind('owner').first<{user_id:string}>();return record?.user_id===user.userId;
}
export async function readNotebook(user:ChatGPTUser):Promise<Row>{
 const db=getRawDb();await db.prepare('INSERT INTO notebooks (id,payload,revision,updated_at,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('kitchen',JSON.stringify(initialNotebook()),0,new Date().toISOString(),user.email).run();
 for(let attempt=0;attempt<4;attempt++){const row=await db.prepare('SELECT payload,revision,updated_at,updated_by FROM notebooks WHERE id=?').bind('kitchen').first<Row>();if(!row)throw Error('Notebook missing');const parsed=JSON.parse(row.payload);if(parsed.schemaVersion===2){validateNotebook(parsed);return row;}const migrated=migrateNotebook(parsed);await db.prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(migrated),new Date().toISOString(),user.email,'kitchen',row.revision).run();}
 throw new RequestError('The notebook changed while loading. Please try again.',409);
}
export function snapshot(row:Row,user:ChatGPTUser,isOwner:boolean){return {data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at,updatedBy:row.updated_by,user:user.email,isOwner};}
export async function readWrite(req:Request){if(req.headers.get('origin')!==new URL(req.url).origin)throw new RequestError('Request origin is not allowed.',403);if(!req.headers.get('content-type')?.startsWith('application/json'))throw new RequestError('JSON required.',415);const revision=Number(req.headers.get('if-match'));if(!req.headers.has('if-match')||!Number.isSafeInteger(revision)||revision<0)throw new RequestError('A valid saved revision is required.');const text=await req.text();if(text.length>750000)throw new RequestError('Notebook is too large.',413);return {revision,body:checked(()=>JSON.parse(text))};}
export function requireRevision(row:Row,revision:number){if(row.revision!==revision)throw new RequestError('Someone saved a newer version. Your draft is kept here. Download it before reloading the shared notebook.',409);}
export async function ordinarySave(user:ChatGPTUser,revision:number,body:unknown){if((body as {schemaVersion?:number})?.schemaVersion!==2)throw new RequestError('This page is an older version. Download your draft, then reload the application before saving.',409);const next=checked(()=>validateNotebook(body));const before=await readNotebook(user);requireRevision(before,revision);checked(()=>validateOrdinaryEdit(validateNotebook(JSON.parse(before.payload)),next));
 const newIds=next.items.filter(i=>!(JSON.parse(before.payload) as Notebook).items.some(old=>old.id===i.id)).map(i=>i.id);
 if(newIds.length){const retired=await getRawDb().prepare('SELECT retired_id FROM catalog_operations WHERE retired_id IS NOT NULL').all<{retired_id:string}>();if(retired.results.some(r=>newIds.includes(r.retired_id)))throw new RequestError('A merged item cannot be recreated. Reload and use its current catalog entry.');}
 const now=new Date().toISOString();const result=await getRawDb().prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(next),now,user.email,'kitchen',revision).run();if(!result.meta.changes)throw new RequestError('Someone saved a newer version. Your draft is kept here; reload before trying again.',409);return {revision:revision+1,updatedAt:now,updatedBy:user.email};
}
export async function catalogHistory(user:ChatGPTUser){if(!await owner(user))throw new RequestError('Only the owner can manage the catalog.',403);const row=await readNotebook(user);const entries=await getRawDb().prepare('SELECT id,kind,summary,actor_email,created_at,after_revision,undo_of FROM catalog_operations ORDER BY after_revision DESC LIMIT 30').all<Pick<Audit,'id'|'kind'|'summary'|'actor_email'|'created_at'|'after_revision'|'undo_of'>>();return {revision:row.revision,entries:entries.results.map(e=>({...e,canUndo:e.kind==='merge'&&e.after_revision===row.revision}))};}
export async function catalogCommand(user:ChatGPTUser,revision:number,raw:unknown){
 if(!await owner(user))throw new RequestError('Only the owner can manage alternative names and merges.',403);
 const body=raw as {operationId?:unknown;operation?:unknown};if(typeof body.operationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.operationId))throw new RequestError('A valid operation ID is required.');const op=operationSchema.parse(body.operation);const request=JSON.stringify(op),db=getRawDb();
 const replay=async()=>{const prior=await db.prepare('SELECT * FROM catalog_operations WHERE id=?').bind(body.operationId).first<Audit>();if(!prior)return null;if(prior.request!==request||prior.actor_id!==user.userId||prior.before_revision!==revision)throw new RequestError('That operation ID was already used for a different request.',409);return {...snapshot(await readNotebook(user),user,true),operationId:prior.id,replayed:true};};
 const prior=await replay();if(prior)return prior;
 const row=await readNotebook(user);if(row.revision!==revision){const receipt=await replay();if(receipt)return receipt;requireRevision(row,revision);}let next:Notebook,summary:string;
 if(op.kind==='undo'){const original=await db.prepare('SELECT * FROM catalog_operations WHERE id=?').bind(op.operationId).first<Audit>();if(!original||original.kind!=='merge')throw new RequestError('This merge is not available to undo.');if(original.after_revision!==row.revision||original.after_payload!==row.payload)throw new RequestError('Newer changes exist. Undo is unavailable because it would overwrite them.',409);next=validateNotebook(JSON.parse(original.before_payload));summary=`Undid: ${original.summary}`;}
 else ({next,summary}=checked(()=>applyOperation(validateNotebook(JSON.parse(row.payload)),op)));
 const payload=JSON.stringify(next);if(payload.length>750000)throw new RequestError('Notebook is too large.',413);const now=new Date().toISOString();
 const results=await db.batch([
 db.prepare('INSERT INTO catalog_operations (id,kind,request,actor_id,actor_email,before_revision,after_revision,before_payload,after_payload,summary,created_at,retired_id,undo_of) SELECT ?,?,?,?,?,revision,revision+1,payload,?,?,?,?,? FROM notebooks WHERE id=? AND revision=?').bind(body.operationId,op.kind,request,user.userId,user.email,payload,summary,now,op.kind==='merge'?op.sourceId:null,op.kind==='undo'?op.operationId:null,'kitchen',revision),
 db.prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM catalog_operations WHERE id=? AND before_revision=?)').bind(payload,now,user.email,'kitchen',revision,body.operationId,revision),
 ]);
 if(!results[0].meta.changes||!results[1].meta.changes){const receipt=await replay();if(receipt)return receipt;throw new RequestError('The notebook changed. Reload and review the operation again.',409);}
 return {...snapshot(await readNotebook(user),user,true),operationId:body.operationId,replayed:false};
}
export function failure(error:unknown){if(error instanceof RequestError)return respond({error:error.message,code:error.code},error.status);if(error instanceof Error&&error.name==='ZodError')return respond({error:validationMessage(error)},400);console.error('Notebook operation failed',error);return respond({error:'Could not confirm this operation. Your draft is kept here. Please retry.'},503);}
