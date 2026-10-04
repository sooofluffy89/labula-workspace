import {protectedApi} from '@/lib/protected-api';
import {RequestError} from '@/lib/access-context';
import {ownProfile,readPhotoCommand,saveOwnPhoto} from '@/lib/profile-photo-server';
export const dynamic='force-dynamic';
export const GET=protectedApi('operations',async(req:Request)=>{const params=new URL(req.url).searchParams;for(const key of params.keys())if(key!=='operationId')throw new RequestError('Unsupported profile lookup.');const id=params.get('operationId')??undefined;if(id&&!/^[\da-f-]{36}$/i.test(id))throw new RequestError('Invalid operation.');return Response.json(await ownProfile(id));});
export const POST=protectedApi('operations',async(req:Request)=>Response.json(await saveOwnPhoto(await readPhotoCommand(req))));
