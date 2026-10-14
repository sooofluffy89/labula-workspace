import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readTeam,readTeamDirectory,teamCommand} from '@/lib/activity-server';
export const dynamic='force-dynamic';
async function GETHandler(req?:Request){try{const user=await identity('operations');return respond(req&&new URL(req.url).searchParams.get('management')==='1'?await readTeamDirectory(user):await readTeam(user));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity(),{body}=await readWrite(req,10_000);return respond(await teamCommand(user,body));}catch(e){return failure(e);}}

export const GET=protectedApi('operations',GETHandler);

export const POST=protectedApi('management',POSTHandler);
