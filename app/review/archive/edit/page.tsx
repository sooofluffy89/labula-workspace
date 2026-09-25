import {requireWorkspacePage} from '@/app/workspace-access';
import {owner} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import DataReview from '../../review';
export const dynamic='force-dynamic';
export default async function Page(){const user=await requireWorkspacePage('/review/archive/edit');if(!await owner(user))redirect('/review');return <DataReview legacy/>;}
