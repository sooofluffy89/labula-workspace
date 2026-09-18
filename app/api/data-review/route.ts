import {getRawDb} from '@/db';
import {identity,readWrite,respond,failure,RequestError} from '@/lib/notebook-server';
import {REVIEW_ID,emptyReview,validateReview,type ReviewSource} from '@/lib/data-review';
import {validateNotebook} from '@/lib/notebook';

export const dynamic='force-dynamic';
type Row={source:string;payload:string;revision:number;updated_at:string;updated_by:string};
const read=()=>getRawDb().prepare('SELECT source,payload,revision,updated_at,updated_by FROM data_reviews WHERE id=?').bind(REVIEW_ID).first<Row>();
const record=(r:Row)=>({source:JSON.parse(r.source),data:JSON.parse(r.payload),revision:r.revision,updatedAt:r.updated_at,updatedBy:r.updated_by});
export async function GET(){try{const user=await identity(),row=await read();const notebook=await getRawDb().prepare('SELECT revision FROM notebooks WHERE id=?').bind('kitchen').first<{revision:number}>();return respond({record:row?record(row):null,user:user.email,notebookRevision:notebook?.revision??null});}catch(e){return failure(e);}}
export async function POST(req:Request){try{
 const user=await identity(),{revision,body}=await readWrite(req),db=getRawDb();
 if(typeof body.operationId!=='string'||!/^[0-9a-f-]{36}$/i.test(body.operationId))throw new RequestError('Missing operation ID.');
 const operationId=body.operationId,request=JSON.stringify(body),now=new Date().toISOString();
 const replay=async()=>{const receipt=await db.prepare('SELECT actor_id,request,before_revision,after_revision FROM data_review_commands WHERE id=?').bind(operationId).first<{actor_id:string;request:string;before_revision:number;after_revision:number}>();if(!receipt)return null;if(receipt.actor_id!==user.userId||receipt.request!==request||receipt.before_revision!==revision)throw new RequestError('This request ID has different content.',409);return {operationId,revision:receipt.after_revision,updatedAt:now,updatedBy:user.email,replayed:true};};
 const prior=await replay();if(prior)return respond(prior);
 if(body.action==='start'){
  const notebook=await db.prepare('SELECT payload,revision FROM notebooks WHERE id=?').bind('kitchen').first<{payload:string;revision:number}>();if(!notebook)throw new RequestError('Save the recipe notebook before starting this review.',409);
  const source:ReviewSource={notebook:validateNotebook(JSON.parse(notebook.payload)),revision:notebook.revision,capturedAt:now};
  // Creation is idempotent. Losing a response cannot create a second campaign or replace its source.
  await db.prepare('INSERT INTO data_reviews (id,source,payload,revision,updated_at,updated_by) VALUES (?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind(REVIEW_ID,JSON.stringify(source),JSON.stringify(emptyReview()),0,now,user.email).run();
  return respond({record:record((await read())!),user:user.email,notebookRevision:notebook.revision});
 }
 if(body.action!=='save')throw new RequestError('Unknown review action.');
 const row=await read();if(!row)throw new RequestError('Start the review first.',409);
 if(row.revision!==revision){const receipt=await replay();if(receipt)return respond(receipt);throw new RequestError('Another tab or cook saved a newer review. Your draft is kept. Download it before loading the shared version.',409,'revision_conflict');}
 let data;try{data=validateReview(JSON.parse(row.source),body.data);}catch(e){throw new RequestError(e instanceof Error?e.message:'Check the answers.',422);}
 const payload=JSON.stringify(data);
 if(payload.length>750000)throw new RequestError('This review is too large. Download the draft before continuing.',413);
 const results=await db.batch([
  db.prepare('INSERT INTO data_review_commands (id,review_id,actor_id,actor_email,request,before_revision,after_revision,before_payload,after_payload,created_at) SELECT ?,?,?,?,?,revision,revision+1,payload,?,? FROM data_reviews WHERE id=? AND revision=?').bind(operationId,REVIEW_ID,user.userId,user.email,request,payload,now,REVIEW_ID,revision),
  db.prepare('UPDATE data_reviews SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM data_review_commands WHERE id=? AND before_revision=?)').bind(payload,now,user.email,REVIEW_ID,revision,operationId,revision),
 ]);
 if(!results[0].meta.changes||!results[1].meta.changes){const receipt=await replay();if(receipt)return respond(receipt);throw new RequestError('A newer review was saved. Your draft is preserved.',409,'revision_conflict');}
 return respond({operationId,revision:revision+1,updatedAt:now,updatedBy:user.email});
 }catch(e){return failure(e);}}
