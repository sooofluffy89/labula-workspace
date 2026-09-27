import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readPrepNotes,prepNoteCommand} from '@/lib/prep-notes-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{return respond(await readPrepNotes(await identity('operations'),new URL(req.url).searchParams));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity('operations'),{body}=await readWrite(req,8000);return respond(await prepNoteCommand(user,body));}catch(e){return failure(e);}}
