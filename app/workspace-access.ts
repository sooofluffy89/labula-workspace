import {redirect} from 'next/navigation';
import {requireChatGPTUser} from './chatgpt-auth';
import {accessRole} from '@/lib/team-access-server';
export async function requireWorkspacePage(path:string){
 const user=await requireChatGPTUser(path);
 try {if(await accessRole(user)==='cook')redirect('/');}
 catch {redirect('/');}
 return user;
}
