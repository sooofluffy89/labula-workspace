import {getRawDb} from '@/db';
import {identity,respond,failure} from '@/lib/notebook-server';
import {REVIEW_ID} from '@/lib/data-review';
import {migrate,entity,taskHash} from '@/lib/review-v2/model';
import {groups} from '@/lib/review-v2/fields';
export const dynamic='force-dynamic';
export async function GET(){try{await identity();const row=await getRawDb().prepare('SELECT source,payload,revision FROM data_reviews WHERE id=?').bind(REVIEW_ID).first<{source:string;payload:string;revision:number}>();if(!row)return respond({started:false});const d=migrate(JSON.parse(row.source),JSON.parse(row.payload));return respond({started:true,closed:d.interviewClosed,revision:row.revision,openChecks:d.tasks.filter(t=>!t.closedHash||t.closedHash!==taskHash(d,t)).length,record:entity(d,d.position.entityId)?.name,topic:groups.find(g=>g.id===d.position.group)?.title});}catch(e){return failure(e);}}
