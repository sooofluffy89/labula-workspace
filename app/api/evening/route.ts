import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readEvening,eveningCommand} from '@/lib/evening-server';
import {operationalDay} from '@/lib/evening';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await identity(),q=new URL(req.url).searchParams;return respond(await readEvening(user,q.has('morningDay')?{morningDay:q.get('morningDay')!}:{day:q.get('day')??operationalDay()}));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity();const {body}=await readWrite(req,25_000);const receipt=await eveningCommand(user,body);return respond({...receipt,snapshot:await readEvening(user,{day:receipt.checkId})});}catch(e){return failure(e);}}
