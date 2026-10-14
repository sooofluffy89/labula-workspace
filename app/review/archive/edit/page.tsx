import {ProfilePageBar} from '@/app/profile';
import {requireWorkspacePage} from '@/app/workspace-access';
import {canManage} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import DataReview from '../../review';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireWorkspacePage('/review/archive/edit');if(!await canManage(user))redirect('/review');return <><ProfilePageBar/><DataReview legacy/></>;}
