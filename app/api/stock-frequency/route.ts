import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {frequencyCommand} from '@/lib/stock-frequency-server';
export const dynamic='force-dynamic';
async function POSTHandler(req:Request){try{const user=await identity();const {body}=await readWrite(req,20_000);return respond(await frequencyCommand(user,body));}catch(e){return failure(e);}}

export const POST=protectedApi('management',POSTHandler);
