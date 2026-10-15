import {redirect} from 'next/navigation';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {accessRole} from '@/lib/team-access-server';
import DeviceRecovery from './device-recovery';

export const dynamic='force-dynamic';
export default async function Page(){
 const user=await getChatGPTUser();
 if(!user)redirect(chatGPTSignInPath('/workspace-device-recovery'));
 let permitted=false;
 try{permitted=await accessRole(user,'management',false)==='owner';}catch{/* Never link an account or change sign-in state here. */}
 if(!permitted)return <main style={{maxWidth:720,margin:'48px auto',padding:24}}><h1>Device recovery unavailable</h1><p>Sign in with the existing Owner account to export its device recovery.</p><a href="/">Back to workspace</a></main>;
 return <DeviceRecovery accountId={user.userId} email={user.email}/>;
}
