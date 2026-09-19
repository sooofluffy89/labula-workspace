import {getRawDb} from '@/db';
import {identity,owner,respond,failure} from '@/lib/notebook-server';
import {REVIEW_ID} from '@/lib/data-review';
import {migrate,entity,taskHash} from '@/lib/review-v2/model';
import {groups} from '@/lib/review-v2/fields';
import {summaryProgress} from '@/lib/review-v2/progress';
import {resume} from '@/lib/review-v2/navigation';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await identity();const row=await getRawDb().prepare('SELECT source,payload,revision FROM data_reviews WHERE id=?').bind(REVIEW_ID).first<{source:string;payload:string;revision:number}>();if(!row)return respond({started:false});const source=JSON.parse(row.source),d=migrate(source,JSON.parse(row.payload)),role=await owner(user)?'owner':'cook',progress=summaryProgress(d,source,role),position=resume(d,source,role);return respond({started:true,closed:d.interviewClosed,revision:row.revision,isOwner:role==='owner',openChecks:d.tasks.filter(t=>!t.closedHash||t.closedHash!==taskHash(d,t)).length,confirmed:progress.confirmed,topics:progress.topics,missing:progress.unassigned,record:position?entity(d,position.entityId)?.name:undefined,topic:groups.find(g=>g.id===position?.group)?.title});}catch(e){return failure(e);}}
