import {protectedApi} from '@/lib/protected-api';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readManageSettings,manageSettingsCommand} from '@/lib/manage-settings-server';
export const dynamic='force-dynamic';
async function GETHandler(){try{return respond(await readManageSettings(await identity()));}catch(e){return failure(e);}}
async function POSTHandler(req:Request){try{const user=await identity(),{body}=await readWrite(req,20_000);return respond(await manageSettingsCommand(user,body));}catch(e){return failure(e);}}

export const GET=protectedApi('management',GETHandler);

export const POST=protectedApi('management',POSTHandler);
