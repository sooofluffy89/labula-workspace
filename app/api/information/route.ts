import {identity,respond,failure,RequestError} from '@/lib/notebook-server';
import {informationTarget} from '@/lib/information';
import {readInformation} from '@/lib/information-server';
export const dynamic='force-dynamic';
export async function GET(req:Request){try{const user=await identity('operations'),q=new URL(req.url).searchParams;let raw:unknown;try{raw=JSON.parse(q.get('target')??'null');}catch{throw new RequestError('Invalid information link.');}const target=informationTarget.parse(raw);return respond({account:user.email,data:await readInformation(user,target)});}catch(e){return failure(e);}}
