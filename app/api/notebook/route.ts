import {protectedApi} from '@/lib/protected-api';
import {identity,owner,canManage,readNotebook,snapshot,respond,readWrite,ordinarySave,failure} from '@/lib/notebook-server';
import {saveWithReceipt} from '@/lib/notebook-commands';
export const dynamic='force-dynamic';
async function GETHandler(){try{const user=await identity();return respond(snapshot(await readNotebook(user),user,await owner(user),await canManage(user)));}catch(e){return failure(e);}}
async function PUTHandler(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);const id=req.headers.get('X-Operation-Id');return respond(id?await saveWithReceipt(user,revision,id,body):await ordinarySave(user,revision,body));}catch(e){return failure(e);}}

export const GET=protectedApi('workspace',GETHandler);

export const PUT=protectedApi('workspace',PUTHandler);
