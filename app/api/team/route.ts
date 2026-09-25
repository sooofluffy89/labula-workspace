import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readTeam,readTeamDirectory,teamCommand} from '@/lib/activity-server';
export const dynamic='force-dynamic';
export async function GET(req?:Request){try{const user=await identity('operations');return respond(req&&new URL(req.url).searchParams.get('management')==='1'?await readTeamDirectory(user):await readTeam(user));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(),{body}=await readWrite(req,10_000);return respond(await teamCommand(user,body));}catch(e){return failure(e);}}
