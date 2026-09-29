import {requireWorkspacePage} from '@/app/workspace-access';
import {canManage} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import Download from './download';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireWorkspacePage('/review-backup');if(!await canManage(user))redirect('/review');return <main style={{maxWidth:680,margin:'60px auto',padding:24}}><h1>Private backup</h1><p>Download the current notebook, all review answers, operation history, approvals and import archives. This reads saved data only and does not change any answer.</p><p>Keep the downloaded file private. Unsaved browser drafts remain in their own recovery files.</p><Download/><p><a href="/review">Back to review</a></p></main>;}
