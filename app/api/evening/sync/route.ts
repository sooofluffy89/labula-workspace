import {protectedApi} from '@/lib/protected-api';
import {stationClientResponse} from '@/lib/station-client-compatibility';
import {identity,respond,failure} from '@/lib/notebook-server';
import {readEveningDelta} from '@/lib/evening-sync-server';
import {operationalDay} from '@/lib/evening';
export const dynamic='force-dynamic';
async function GETHandler(req:Request){try{const user=await identity('operations'),q=new URL(req.url).searchParams;return respond(stationClientResponse(req,await readEveningDelta(user,q.has('morningDay')?{morningDay:q.get('morningDay')!}:{day:q.get('day')??operationalDay()},q.get('cursor')??'')));}catch(e){return failure(e);}}

export const GET=protectedApi('operations',GETHandler);
