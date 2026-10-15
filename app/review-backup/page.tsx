import {ProfilePageBar} from '@/app/profile';
import {requireWorkspacePage} from '@/app/workspace-access';
import {canManage} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import Download from './download';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireWorkspacePage('/review-backup');if(!await canManage(user))redirect('/');return <><ProfilePageBar/><main style={{maxWidth:680,margin:'60px auto',padding:24}}><p className="eyebrow">Workspace 2.0 · Data &amp; backup</p><h1>Complete workspace backup</h1><p>Download the saved menu, recipes, all review answers, operation history, approvals, profiles and import archives. This reads saved data only and does not change any answer.</p><p>This complete backup is different from a view’s CSV or a notebook draft. Keep it private. Unsaved browser drafts remain in their own recovery files and are not included.</p><Download/><p><a href="/?view=data">Back to Data &amp; backup</a></p></main></>;}
