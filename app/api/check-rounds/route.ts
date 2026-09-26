import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readRounds,roundCommand} from '@/lib/check-rounds-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await readRounds(await identity()));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity();const {body}=await readWrite(req,150_000);return respond(await roundCommand(user,body));}catch(e){return failure(e);}}
