import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {profileSave} from '@/lib/notebook-commands';
export const dynamic='force-dynamic';
export async function POST(req:Request){try{const user=await identity();const {revision,body}=await readWrite(req);return respond(await profileSave(user,revision,body));}catch(e){return failure(e);}}
