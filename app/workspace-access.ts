import {redirect} from 'next/navigation';
import {requireChatGPTUser} from './chatgpt-auth';
import {workspaceRole} from '@/lib/notebook-server';
export async function requireWorkspacePage(path:string){
 const user=await requireChatGPTUser(path);
 if(await workspaceRole(user)==='cook')redirect('/');
 return user;
}
