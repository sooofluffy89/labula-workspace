import {protectedApi} from '@/lib/protected-api';
import {stationClientResponse} from '@/lib/station-client-compatibility';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readEvening,readConfirmation,eveningCommand} from '@/lib/evening-server';
import {operationalDay} from '@/lib/evening';
export const dynamic='force-dynamic';
async function GETHandler(req:Request){try{const user=await identity('operations'),q=new URL(req.url).searchParams;if(q.get('publication')==='1')return respond(await readConfirmation(user,q.get('day')??operationalDay()));return respond(stationClientResponse(req,await readEvening(user,q.has('morningDay')?{morningDay:q.get('morningDay')!}:{day:q.get('day')??operationalDay()})));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity('operations');const {body}=await readWrite(req,25_000);const receipt=await eveningCommand(user,body);if(req.headers.get('X-Labula-Confirm')==='1'&&receipt.publication)return respond(receipt);return respond(stationClientResponse(req,{...receipt,snapshot:await readEvening(user,{day:receipt.checkId})}));}catch(e){return failure(e);}}

export const GET=protectedApi('operations',GETHandler);

export const POST=protectedApi('operations',POSTHandler);
