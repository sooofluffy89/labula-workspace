import {ProfilePageBar} from '@/app/profile';
import DataReview from './review';
import {requireWorkspacePage} from '../workspace-access';
export const dynamic='force-dynamic';
export default async function Page(){await requireWorkspacePage('/review');return <><ProfilePageBar/><DataReview/></>;}
