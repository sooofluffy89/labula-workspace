import {redirect} from 'next/navigation';
import {getChatGPTUser,chatGPTSignInPath} from '@/app/chatgpt-auth';
import {accessRole} from '@/lib/team-access-server';
import Diagnostics from './workspace-diagnostics';
export const dynamic='force-dynamic';
export default async function Page(){
 const user=await getChatGPTUser();if(!user)redirect(chatGPTSignInPath('/workspace-diagnostics'));
 let owner=false;try{owner=await accessRole(user,'management',false)==='owner';}catch{/* Never link an account or record a sign-in here. */}
 if(!owner)return <main className="access-page"><h1>Diagnostics unavailable</h1><p>Sign in with the existing Owner account.</p><a href="/">Back to workspace</a></main>;
 return <Diagnostics accountId={user.userId}/>;
}
