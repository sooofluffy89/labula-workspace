import {identity,respond,readWrite,catalogCommand,catalogHistory,failure} from '@/lib/notebook-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await catalogHistory(await identity()));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);return respond(await catalogCommand(user,revision,body));}catch(e){return failure(e);}}
