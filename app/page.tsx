import KitchenApp from './kitchen-app';
import CookApp from './cook-app';
import {getChatGPTUser} from './chatgpt-auth';
import {accessRole,recordSignIn} from '@/lib/team-access-server';
import {RequestError} from '@/lib/access-context';
import {AccessPage} from './access-page';
export const dynamic='force-dynamic';
export default async function Home(){
 const user=await getChatGPTUser();if(!user)return <AccessPage/>;
 let role:Awaited<ReturnType<typeof accessRole>>|null=null,error:string|undefined;
 try {role=await accessRole(user);await recordSignIn(user);}
 catch(e) {error=e instanceof RequestError?undefined:'Could not verify access. Please reload to try again.';}
 if(!role)return <AccessPage user={user} error={error}/>;
 return role==='cook'?<CookApp key={user.userId} account={user.email}/>:<KitchenApp key={user.userId} account={user.email}/>;
}
