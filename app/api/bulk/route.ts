import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {bulkSave} from '@/lib/notebook-commands';
export const dynamic='force-dynamic';
async function POSTHandler(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);return respond(await bulkSave(user,revision,body));}catch(e){return failure(e);}}

export const POST=protectedApi('workspace',POSTHandler);
