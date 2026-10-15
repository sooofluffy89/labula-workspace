import {getChatGPTUser} from '../chatgpt-auth';
import {AccessPage} from '../access-page';
import {accessRole} from '@/lib/team-access-server';
import {WorkspaceMaintenance} from './workspace-maintenance';
export const dynamic='force-dynamic';
export default async function MaintenancePage(){
 const user=await getChatGPTUser();if(!user)return <AccessPage/>;
 try{if(await accessRole(user,'management',false)!=='owner')throw Error('Only the existing Owner can control maintenance.');}
 catch{return <AccessPage user={user} error="Only the existing Owner can control maintenance."/>;}
 return <WorkspaceMaintenance accountId={user.userId}/>;
}
