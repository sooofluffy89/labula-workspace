import {protectedApi} from '@/lib/protected-api';
import {identity,respond,failure} from '@/lib/notebook-server';
import {readInstructionIndex} from '@/lib/prep-notes-server';
export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await readInstructionIndex(await identity()));}catch(e){return failure(e);}}

export const GET=protectedApi('management',GETHandler);
