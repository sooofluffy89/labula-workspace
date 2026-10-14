import {env} from 'cloudflare:workers';
import {Buffer} from 'node:buffer';
import {z} from 'zod';
import {getRawDb} from '@/db';
import {accessContext,RequestError} from './access-context';
import {normalizeProfilePng} from './profile-png';
import {PHOTO_BYTES,PHOTO_BODY_BYTES,type OwnProfile} from './profile-photo';
export type PhotoRow={user_id:string;revision:number;object_key:string|null;sha256:string|null;size:number|null;updated_at:string};
type Upload={id:string;actor_id:string;object_key:string|null;sha256:string|null;size:number|null;fingerprint:string;state:string;expires_at:string};
export function photoBucket(){const bucket=(env as unknown as {BUCKET?:R2Bucket}).BUCKET;if(!bucket)throw new RequestError('Photo storage is unavailable. Your previous photo is kept.',503);return bucket;}
export async function photoHash(bytes:Uint8Array){return Buffer.from(await crypto.subtle.digest('SHA-256',Uint8Array.from(bytes))).toString('hex');}
const schema=z.object({operationId:z.string().uuid(),revision:z.number().int().min(0),photo:z.string().max(Math.ceil(PHOTO_BYTES/3)*4).nullable()}).strict();
export async function readPhotoCommand(req:Request){
 if(req.headers.get('origin')!==new URL(req.url).origin)throw new RequestError('Request origin is not allowed.',403);
 if(req.headers.get('content-type')?.split(';')[0]!=='application/json')throw new RequestError('JSON required.',415);
 if(Number(req.headers.get('content-length'))>PHOTO_BODY_BYTES)throw new RequestError('The photo request is too large.',413);
 const reader=req.body?.getReader();if(!reader)throw new RequestError('Photo request missing.');const pieces:Uint8Array[]=[];let total=0;
 try{for(;;){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>PHOTO_BODY_BYTES){await reader.cancel();throw new RequestError('The photo request is too large.',413);}pieces.push(value);}}finally{reader.releaseLock();}
 try{return schema.parse(JSON.parse(Buffer.concat(pieces).toString('utf8')));}catch{throw new RequestError('This photo request is invalid.');}
}
export async function ownProfile(operationId?:string):Promise<{profile:OwnProfile;operation:{id:string;revision:number}|null}>{
 const context=accessContext.getStore();if(!context)throw new RequestError('Sign in required.',401);const user=context.user,db=getRawDb();
 const results=await db.batch([db.prepare('SELECT name,active FROM kitchen_team WHERE user_id=? AND access_enabled=1').bind(user.userId),db.prepare('SELECT * FROM user_photos WHERE user_id=?').bind(user.userId),db.prepare('SELECT id,after_revision FROM user_photo_commands WHERE id=? AND actor_id=?').bind(operationId??'',user.userId)]);
 const member=results[0].results[0] as {name:string;active:number}|undefined,row=results[1].results[0] as PhotoRow|undefined,command=results[2].results[0] as {id:string;after_revision:number}|undefined;
 if(!member)throw new RequestError('Your access changed.',403,'access_revoked');
 return {profile:{accountId:user.userId,name:member.name||user.displayName,email:user.email,role:context.role,active:!!member.active,revision:row?.revision??0,hasPhoto:!!row?.object_key,updatedAt:row?.updated_at??null},operation:command?{id:command.id,revision:command.after_revision}:null};
}
// Retiring a reservation is a D1 CAS. A concurrent commit and retirement cannot
// both win. Never delete uncertain or committed objects: an export can still
// hold the immutable pointer captured in its D1 snapshot.
async function retireUpload(id:string,actor:string){const db=getRawDb();await db.prepare("UPDATE user_photo_uploads SET state='retired' WHERE id=? AND actor_id=? AND state='staged' AND NOT EXISTS(SELECT 1 FROM user_photo_commands WHERE id=?)").bind(id,actor,id).run();const r=await db.prepare('SELECT * FROM user_photo_uploads WHERE id=? AND actor_id=?').bind(id,actor).first<Upload>();if(r?.state==='retired'){if(r.object_key)await photoBucket().delete(r.object_key);await db.prepare("UPDATE user_photo_uploads SET state='retired_clean' WHERE id=? AND actor_id=? AND state='retired'").bind(id,actor).run();}}
async function cleanExpired(actor:string){const rows=await getRawDb().prepare("SELECT id FROM user_photo_uploads WHERE actor_id=? AND expires_at<? AND state IN ('staged','retired') LIMIT 8").bind(actor,new Date().toISOString()).all<{id:string}>();for(const row of rows.results)await retireUpload(row.id,actor);}
export async function saveOwnPhoto(command:z.infer<typeof schema>){
 const context=accessContext.getStore();if(!context)throw new RequestError('Sign in required.',401);const actor=context.user.userId,db=getRawDb(),bucket=photoBucket();
 let bytes:Uint8Array|null=null;
 if(command.photo!==null){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(command.photo))throw new RequestError('Invalid photo encoding.');try{bytes=normalizeProfilePng(Buffer.from(command.photo,'base64'));}catch(e){throw new RequestError(e instanceof Error?e.message:'Invalid photo.');}}
 const sha=bytes?await photoHash(bytes):null,fingerprint=await photoHash(new TextEncoder().encode(JSON.stringify({revision:command.revision,sha}))),key=bytes?`profiles/${await photoHash(new TextEncoder().encode(actor))}/${command.operationId}-${sha}.png`:null;
 const now=new Date().toISOString(),expiry=new Date(Date.now()+24*60*60*1000).toISOString();
 await db.prepare("INSERT OR IGNORE INTO user_photo_uploads(id,actor_id,object_key,sha256,size,fingerprint,state,expires_at) VALUES(?,?,?,?,?,?,'staged',?)").bind(command.operationId,actor,key,sha,bytes?.length??null,fingerprint,expiry).run();
 const reservation=await db.prepare('SELECT * FROM user_photo_uploads WHERE id=?').bind(command.operationId).first<Upload>();
 if(!reservation||reservation.actor_id!==actor||reservation.fingerprint!==fingerprint)throw new RequestError('This photo operation does not match its original request.',409,'operation_mismatch');
 if(reservation.state==='committed')return ownProfile(command.operationId);
 if(reservation.state!=='staged'||reservation.expires_at<=now){await retireUpload(command.operationId,actor);throw new RequestError('This photo attempt expired or conflicted. Load the current profile before saving a new change.',409,'photo_conflict');}
 // The object is private and immutable in meaning; an identical replay writes
 // identical canonical bytes. A pointer is published only after put succeeds.
 if(bytes){await bucket.put(key!,Uint8Array.from(bytes),{httpMetadata:{contentType:'image/png',cacheControl:'private, no-store'},customMetadata:{sha256:sha!}});const head=await bucket.head(key!);if(!head||head.size!==bytes.length)throw new RequestError('Photo upload was not confirmed. Retry safely.',503);}
 await db.batch([
  db.prepare("INSERT OR IGNORE INTO user_photo_commands(id,actor_id,fingerprint,before_revision,after_revision,created_at) SELECT ?,?,?,?,?,? WHERE COALESCE((SELECT revision FROM user_photos WHERE user_id=?),0)=? AND EXISTS(SELECT 1 FROM user_photo_uploads WHERE id=? AND actor_id=? AND state='staged' AND expires_at>?)").bind(command.operationId,actor,fingerprint,command.revision,command.revision+1,now,actor,command.revision,command.operationId,actor,now),
  db.prepare("INSERT INTO user_photos(user_id,revision,object_key,sha256,size,updated_at) SELECT ?,?,?,?,?,? WHERE EXISTS(SELECT 1 FROM user_photo_commands WHERE id=? AND actor_id=? AND fingerprint=?) AND EXISTS(SELECT 1 FROM user_photo_uploads WHERE id=? AND state='staged') ON CONFLICT(user_id) DO UPDATE SET revision=excluded.revision,object_key=excluded.object_key,sha256=excluded.sha256,size=excluded.size,updated_at=excluded.updated_at WHERE user_photos.revision=?").bind(actor,command.revision+1,key,sha,bytes?.length??null,now,command.operationId,actor,fingerprint,command.operationId,command.revision),
  db.prepare("UPDATE user_photo_uploads SET state='committed' WHERE id=? AND actor_id=? AND EXISTS(SELECT 1 FROM user_photo_commands WHERE id=? AND actor_id=? AND fingerprint=?)").bind(command.operationId,actor,command.operationId,actor,fingerprint),
 ]);
 const result=await ownProfile(command.operationId);
 if(!result.operation){await retireUpload(command.operationId,actor);throw new RequestError('Your photo changed in another tab. Load the current profile before saving again.',409,'photo_conflict');}
 // Cleanup is best effort; it must not turn a confirmed change into a failed UI.
 try{await cleanExpired(actor);}catch{}return result;
}
export async function ownPhoto(revision:number){
 const actor=accessContext.getStore()?.user.userId;if(!actor)throw new RequestError('Sign in required.',401);
 const row=await getRawDb().prepare('SELECT * FROM user_photos WHERE user_id=?').bind(actor).first<PhotoRow>();
 if(!row?.object_key||row.revision!==revision)throw new RequestError('Photo is unavailable at this revision.',404);
 const object=await photoBucket().get(row.object_key);if(!object||object.size!==row.size||object.size>PHOTO_BYTES)throw new RequestError('Photo storage is unavailable.',503);
 const bytes=new Uint8Array(await object.arrayBuffer());if(await photoHash(bytes)!==row.sha256)throw new RequestError('Photo integrity check failed.',503);
 return new Response(bytes,{headers:{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Disposition':'inline; filename="profile.png"'}});
}
