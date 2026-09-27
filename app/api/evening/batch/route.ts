import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {eveningBatch} from '@/lib/evening-sync-server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const user=await identity('operations'),{body}=await readWrite(req,100_000);return respond(await eveningBatch(user,body));}catch(e){return failure(e);}}
