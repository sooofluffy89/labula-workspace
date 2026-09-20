import {getRawDb} from '@/db';
import {identity,RequestError,failure} from '@/lib/notebook-server';
export const dynamic='force-dynamic';
const tables=['notebooks','kitchen_owner','notebook_commands','catalog_operations','data_reviews','data_review_commands','review_actions','review_authority','reviewed_entities','review_import_chunks'] as const;
// A single read-only D1 transaction captures complete rows, including operation payloads.
// No client-provided table names, identity headers, writes, migrations or restore route.
export async function GET(){try{
 const user=await identity(),db=getRawDb();
 const owner=await db.prepare('SELECT user_id FROM kitchen_owner WHERE id=?').bind('owner').first<{user_id:string}>();
 if(owner?.user_id!==user.userId)throw new RequestError('Only the existing notebook owner can download a complete private backup.',403);
 const results=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 const data=Object.fromEntries(tables.map((table,i)=>[table,results[i].results]));
 return Response.json({format:'Labula private database backup',version:1,capturedAt:new Date().toISOString(),tables:data,counts:Object.fromEntries(tables.map((t,i)=>[t,results[i].results.length]))},{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="labula-private-backup.json"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}}
