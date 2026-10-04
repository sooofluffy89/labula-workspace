import {protectedApi} from '@/lib/protected-api';
import {RequestError} from '@/lib/access-context';
import {ownPhoto} from '@/lib/profile-photo-server';
export const dynamic='force-dynamic';
export const GET=protectedApi('operations',async(req:Request)=>{const params=new URL(req.url).searchParams;for(const key of params.keys())if(key!=='revision')throw new RequestError('Unsupported photo lookup.');const revision=Number(params.get('revision'));if(!params.has('revision')||!Number.isSafeInteger(revision)||revision<1)throw new RequestError('A photo revision is required.');return ownPhoto(revision);});
