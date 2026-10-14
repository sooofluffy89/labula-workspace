import {ProfilePageBar} from '@/app/profile';
import {requireWorkspacePage} from '@/app/workspace-access';
import {canManage} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import Archive from './read-only';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireWorkspacePage('/review/archive');if(!await canManage(user))redirect('/review');return <><ProfilePageBar/><Archive/></>;}
