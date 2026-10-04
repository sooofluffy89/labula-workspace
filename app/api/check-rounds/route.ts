import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readRounds,roundCommand} from '@/lib/check-rounds-server';
export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await readRounds(await identity()));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity();const {body}=await readWrite(req,150_000);return respond(await roundCommand(user,body));}catch(e){return failure(e);}}

export const GET=protectedApi('management',GETHandler);

export const POST=protectedApi('management',POSTHandler);
