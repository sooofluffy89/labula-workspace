import {protectedApi} from '@/lib/protected-api';
import {getRawDb} from '@/db';
import {identity,canManage,RequestError,failure} from '@/lib/notebook-server';
import {privateBackupTables as tables} from '@/lib/private-backup';
import {Buffer} from 'node:buffer';
import {photoBucket,photoHash,type PhotoRow} from '@/lib/profile-photo-server';
import {accessRole} from '@/lib/team-access-server';
import {PHOTO_BYTES} from '@/lib/profile-photo';
export const dynamic='force-dynamic';
// A single read-only D1 transaction captures complete rows, including operation payloads.
// No client-provided table names, identity headers, writes, migrations or restore route.
async function GETHandler(){try{
 const user=await identity(),db=getRawDb();
 if(!await canManage(user))throw new RequestError('Only the owner or a Manager can download a complete private backup.',403);
 const results=await db.batch(tables.map(t=>db.prepare('SELECT * FROM '+t+' ORDER BY rowid')));
 const data=Object.fromEntries(tables.map((table,i)=>[table,results[i].results]));
 const capturedAt=new Date().toISOString(),references=(data.user_photos as unknown as PhotoRow[]).filter(r=>r.object_key);
 // Versioned objects are retained after replacement/removal, so this D1
 // snapshot remains consistent while a user changes their photo. Read one
 // bounded image at a time; incomplete/error streams are not valid backups.
 const encoder=new TextEncoder();
 async function* chunks(){
  yield JSON.stringify({format:'Labula private database backup',version:1,stations:1,access:1,profiles:1,menuScope:1,capturedAt}).slice(0,-1)+',"tables":{';
  for(let t=0;t<tables.length;t++){
   yield (t?',':'')+JSON.stringify(tables[t])+':[';
   // Keep the atomic D1 snapshot, but never allocate another whole-database
   // JSON string and byte buffer. Large historical exports stream row by row.
   for(let r=0;r<results[t].results.length;r++)yield (r?',':'')+JSON.stringify(results[t].results[r]);
   yield ']';
  }
  yield '},"counts":'+JSON.stringify(Object.fromEntries(tables.map((t,i)=>[t,results[i].results.length])))+',"photos":[';
  for(let index=0;index<references.length;index++){
   await accessRole(user,'management',false);const row=references[index];
  if(!row.size||row.size>PHOTO_BYTES)throw Error('Invalid photo metadata.');
  const object=await photoBucket().get(row.object_key!);if(!object||object.size!==row.size)throw Error('A referenced photo is missing.');
  const bytes=new Uint8Array(await object.arrayBuffer());if(await photoHash(bytes)!==row.sha256)throw Error('Photo checksum mismatch.');
   yield (index?',':'')+JSON.stringify({userId:row.user_id,revision:row.revision,objectKey:row.object_key,sha256:row.sha256,size:row.size,mime:'image/png',dataBase64:Buffer.from(bytes).toString('base64')});
  }
  yield ']}';
 }
 const iterator=chunks();const stream=new ReadableStream<Uint8Array>({async pull(controller){try{const next=await iterator.next();if(next.done)controller.close();else controller.enqueue(encoder.encode(next.value));}catch(e){controller.error(e);}},async cancel(){await iterator.return();}});
 return new Response(stream,{headers:{'Content-Type':'application/json','Cache-Control':'private, no-store','Content-Disposition':'attachment; filename="labula-private-backup.json"','X-Content-Type-Options':'nosniff'}});
 }catch(error){return failure(error);}}

export const GET=protectedApi('management',GETHandler);
