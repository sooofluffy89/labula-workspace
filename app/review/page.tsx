import {redirect} from 'next/navigation';
import {requireWorkspacePage} from '../workspace-access';
export const dynamic='force-dynamic';
export default async function Page({searchParams}:{searchParams:Promise<Record<string,string|string[]|undefined>>}){
 await requireWorkspacePage('/review');
 const params=await searchParams,view=params.view;
 redirect('/?view=review'+(view==='checks'||view==='summary'?'&reviewView='+view:''));
}
