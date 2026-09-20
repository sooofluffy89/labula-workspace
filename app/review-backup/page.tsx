import {identity} from '@/lib/notebook-server';
import {getRawDb} from '@/db';
import {redirect} from 'next/navigation';
import Download from './download';
export const dynamic='force-dynamic';
export default async function Page(){const user=await identity();const row=await getRawDb().prepare('SELECT user_id FROM kitchen_owner WHERE id=?').bind('owner').first<{user_id:string}>();if(row?.user_id!==user.userId)redirect('/review');return <main style={{maxWidth:680,margin:'60px auto',padding:24}}><h1>Private owner backup</h1><p>Download the current notebook, all review answers, operation history, approvals and import archives. This reads saved data only and does not change any answer.</p><p>Keep the downloaded file private. Unsaved browser drafts remain in their own recovery files.</p><Download/><p><a href="/review">Back to review</a></p></main>;}
