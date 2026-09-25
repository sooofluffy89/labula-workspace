import KitchenApp from './kitchen-app';
import CookApp from './cook-app';
import {getChatGPTUser} from './chatgpt-auth';
import {workspaceRole} from '@/lib/notebook-server';
export const dynamic='force-dynamic';
export default async function Home(){const user=await getChatGPTUser();return user&&await workspaceRole(user)==='cook'?<CookApp account={user.email}/>:<KitchenApp/>;}
