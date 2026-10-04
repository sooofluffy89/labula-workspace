import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {stationCommand} from '@/lib/checking-stations-server';
export const dynamic='force-dynamic';
async function POSTHandler(req:Request){try{const user=await identity();const {body}=await readWrite(req,200_000);return respond(await stationCommand(user,body));}catch(e){return failure(e);}}

export const POST=protectedApi('management',POSTHandler);
