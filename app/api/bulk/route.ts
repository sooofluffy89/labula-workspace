import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {bulkSave} from '@/lib/notebook-commands';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);return respond(await bulkSave(user,revision,body));}catch(e){return failure(e);}}
