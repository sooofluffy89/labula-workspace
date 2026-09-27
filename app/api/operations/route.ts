import {identity,readWrite,respond,failure} from '@/lib/notebook-server';
import {readOperations,readHistoryDetail,outcomeCommand,operationsCsv} from '@/lib/operations-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await identity(),q=new URL(req.url).searchParams;if(q.has('check'))return respond(await readHistoryDetail(user,q.get('check')!));const page=await readOperations(user,q);return q.get('export')==='1'?new Response(operationsCsv(page),{headers:{'Content-Type':'text/csv;charset=utf-8','Cache-Control':'no-store','Content-Disposition':'attachment; filename="labula-operations.csv"'}}):respond(page);}catch(e){return failure(e);}}
export async function POST(req:Request){try{const user=await identity(),{body}=await readWrite(req,8000);return respond(await outcomeCommand(user,body));}catch(e){return failure(e);}}
