import {identity,respond,failure} from '@/lib/notebook-server';
import {readInstructionIndex} from '@/lib/prep-notes-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await readInstructionIndex(await identity()));}catch(e){return failure(e);}}
