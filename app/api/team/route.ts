import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readTeam,teamCommand} from '@/lib/activity-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await readTeam(await identity()));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(),{body}=await readWrite(req,10_000);return respond(await teamCommand(user,body));}catch(e){return failure(e);}}
