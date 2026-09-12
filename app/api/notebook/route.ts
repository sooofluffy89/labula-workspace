import { getRawDb } from '@/db';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { initialNotebook,validateNotebook,validationMessage } from '@/lib/notebook';
export const dynamic='force-dynamic';
const respond=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store'}});
type Row={payload:string;revision:number;updated_at:string;updated_by:string};
export async function GET(){
 const user=await getChatGPTUser();if(!user)return respond({error:'Sign in to access the kitchen notebook.'},401);
 try {const db=getRawDb();await db.prepare('INSERT INTO notebooks (id,payload,revision,updated_at,updated_by) VALUES (?,?,?,?,?) ON CONFLICT(id) DO NOTHING').bind('kitchen',JSON.stringify(initialNotebook()),0,new Date().toISOString(),user.email).run();
 const row=await db.prepare('SELECT payload,revision,updated_at,updated_by FROM notebooks WHERE id=?').bind('kitchen').first<Row>();if(!row)throw new Error('Notebook missing');return respond({data:JSON.parse(row.payload),revision:row.revision,updatedAt:row.updated_at,updatedBy:row.updated_by,user:user.email});
 }catch(error){console.error('Notebook load failed',error);return respond({error:'Shared storage is temporarily unavailable. Please try again.'},503);}
}
export async function PUT(req:Request){
 const user=await getChatGPTUser();if(!user)return respond({error:'Sign in again before saving. Your edits are still on this page.'},401);
 const origin=req.headers.get('origin');if(!origin||origin!==new URL(req.url).origin)return respond({error:'Request origin is not allowed.'},403);
 if(!req.headers.get('content-type')?.startsWith('application/json'))return respond({error:'JSON required.'},415);
 const revision=Number(req.headers.get('if-match'));if(!req.headers.has('if-match')||!Number.isSafeInteger(revision)||revision<0)return respond({error:'A valid revision is required.'},400);
 let data;try{const raw=await req.text();if(raw.length>750000)return respond({error:'Notebook is too large.'},413);data=validateNotebook(JSON.parse(raw));}catch(e){return respond({error:validationMessage(e)},400);}
 try{const now=new Date().toISOString();const result=await getRawDb().prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=?').bind(JSON.stringify(data),now,user.email,'kitchen',revision).run();
 if(!result.meta.changes)return respond({error:'Someone else saved a newer version. Your edits are kept here. Download your draft, then reload the shared notebook.'},409);
 return respond({revision:revision+1,updatedAt:now,updatedBy:user.email});
 }catch(error){console.error('Notebook save failed',error);return respond({error:'Could not confirm saving. Your edits are kept here; try saving again.'},503);}
}
