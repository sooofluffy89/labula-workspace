import {identity,owner} from '@/lib/notebook-server';
import {redirect} from 'next/navigation';
import Archive from './read-only';
export const dynamic='force-dynamic';
export default async function Page(){const user=await identity();if(!await owner(user))redirect('/review');return <Archive/>;}
