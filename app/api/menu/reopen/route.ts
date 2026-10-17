import {protectedApi} from '@/lib/protected-api';
import {identity,readWrite,respond,failure} from '@/lib/notebook-server';
import {reopenWorkspaceCompositions} from '@/lib/workspace-menu-server';
export const dynamic='force-dynamic';
export const POST=protectedApi('management',async(request:Request)=>{try{const user=await identity();const {revision,body}=await readWrite(request);return respond(await reopenWorkspaceCompositions(user,revision,body));}catch(error){return failure(error);}});
