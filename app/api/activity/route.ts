import {protectedApi} from '@/lib/protected-api';
import {identity,respond,failure} from '@/lib/notebook-server';
import {readActivity} from '@/lib/activity-server';
export const dynamic='force-dynamic';
async function GETHandler(req:Request){try{return respond(await readActivity(await identity(),new URL(req.url).searchParams));}catch(e){return failure(e);}}

export const GET=protectedApi('workspace',GETHandler);
