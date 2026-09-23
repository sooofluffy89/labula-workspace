import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readStock,stockCommand} from '@/lib/stock-server';
export const dynamic='force-dynamic';
export async function GET(){try{return respond(await readStock(await identity()));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity();const {body}=await readWrite(req,250_000);return respond(await stockCommand(user,body));}catch(e){return failure(e);}}
