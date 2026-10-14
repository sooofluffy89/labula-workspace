import {protectedApi} from '@/lib/protected-api';
import {identity,readWrite,respond,failure} from '@/lib/notebook-server';
import {readCalendar,calendarCommand} from '@/lib/calendar-server';
export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await readCalendar(await identity('operations')));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity(),{body}=await readWrite(req,100_000);return respond({...await calendarCommand(user,body),snapshot:await readCalendar(user)});}catch(e){return failure(e);}}

export const GET=protectedApi('workspace',GETHandler);

export const POST=protectedApi('management',POSTHandler);
