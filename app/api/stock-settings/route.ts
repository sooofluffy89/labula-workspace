import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readManageSettings,manageSettingsCommand} from '@/lib/manage-settings-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await readManageSettings(await identity()));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(),{body}=await readWrite(req,20_000);return respond(await manageSettingsCommand(user,body));}catch(e){return failure(e);}}
