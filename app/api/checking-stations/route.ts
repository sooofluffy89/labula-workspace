import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {stationCommand} from '@/lib/checking-stations-server';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const user=await identity();const {body}=await readWrite(req,200_000);return respond(await stationCommand(user,body));}catch(e){return failure(e);}}
