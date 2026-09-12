import {identity,owner,readNotebook,snapshot,respond,readWrite,ordinarySave,failure} from '@/lib/notebook-server';
import {saveWithReceipt} from '@/lib/notebook-commands';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await identity();return respond(snapshot(await readNotebook(user),user,await owner(user)));}catch(e){return failure(e);}}
export async function PUT(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);const id=req.headers.get('X-Operation-Id');return respond(id?await saveWithReceipt(user,revision,id,body):await ordinarySave(user,revision,body));}catch(e){return failure(e);}}
