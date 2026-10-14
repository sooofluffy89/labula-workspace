import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,catalogCommand,catalogHistory,failure} from '@/lib/notebook-server';
export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await catalogHistory(await identity()));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);return respond(await catalogCommand(user,revision,body));}catch(e){return failure(e);}}

export const GET=protectedApi('management',GETHandler);

export const POST=protectedApi('management',POSTHandler);
