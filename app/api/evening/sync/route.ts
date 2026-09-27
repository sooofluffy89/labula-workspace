import {identity,respond,failure} from '@/lib/notebook-server';
import {readEveningDelta} from '@/lib/evening-sync-server';
import {operationalDay} from '@/lib/evening';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await identity('operations'),q=new URL(req.url).searchParams;return respond(await readEveningDelta(user,q.has('morningDay')?{morningDay:q.get('morningDay')!}:{day:q.get('day')??operationalDay()},q.get('cursor')??''));}catch(e){return failure(e);}}
