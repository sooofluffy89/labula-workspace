import {protectedApi} from '@/lib/protected-api';
import {identity,readWrite,respond,failure} from '@/lib/notebook-server';
import {readWorkspaceMenu,writeWorkspaceMenu} from '@/lib/workspace-menu-server';

export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await readWorkspaceMenu(await identity('operations')));}catch(error){return failure(error);}}
async function PUTHandler(request:Request){try{const user=await identity();const {revision,body}=await readWrite(request);return respond(await writeWorkspaceMenu(user,revision,body));}catch(error){return failure(error);}}
// Menu introduces a narrow Cook read capability; write authority remains management-only.
export const GET=protectedApi('operations',GETHandler);
export const PUT=protectedApi('management',PUTHandler);
