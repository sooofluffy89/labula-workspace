import {identity,respond,failure} from '@/lib/notebook-server';
import {readActivity} from '@/lib/activity-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return respond(await readActivity(await identity(),new URL(req.url).searchParams));}catch(e){return failure(e);}}
