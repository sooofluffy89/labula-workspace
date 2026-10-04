import {protectedApi} from '@/lib/protected-api';
import {getRawDb} from '@/db';
import {identity,canManage,RequestError,failure} from '@/lib/notebook-server';
import {privateBackupTables as tables} from '@/lib/private-backup';
export const dynamic='force-dynamic';
// A single read-only D1 transaction captures complete rows, including operation payloads.
// No client-provided table names, identity headers, writes, migrations or restore route.
async function GETHandler(){try{
 const user=await identity(),db=getRawDb();
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can download a complete private backup.',403);
 const results=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 const data=Object.fromEntries(tables.map((table,i)=>[table,results[i].results]));
 return Response.json({format:'Labula private database backup',version:1,stations:1,access:1,capturedAt:new Date().toISOString(),tables:data,counts:Object.fromEntries(tables.map((t,i)=>[t,results[i].results.length]))},{headers:{'Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="labula-private-backup.json"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}}

export const GET=protectedApi('management',GETHandler);
