import {stationClientResponse} from '@/lib/station-client-compatibility';
import {identity,respond,readWrite,failure} from '@/lib/notebook-server';
import {readStock,stockCommand} from '@/lib/stock-server';
import {readStockSettings} from '@/lib/stock-frequency-server';
export const dynamic='force-dynamic';
export async function GET(req?:Request){try{const user=await identity();return respond(stationClientResponse(req,await (req&&new URL(req.url).searchParams.get('planning')==='1'?readStockSettings(user):readStock(user))));}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity();const {body}=await readWrite(req,250_000);return respond(await stockCommand(user,body));}catch(e){return failure(e);}}
