import {getRawDb} from '@/db';
import {identity,owner,respond,failure} from '@/lib/notebook-server';
import {REVIEW_ID} from '@/lib/data-review';
import {migrate} from '@/lib/review-v2/model';
import {quickProgress,cases} from '@/lib/quick-review/model';
export const dynamic='force-dynamic';
export async function GET(){try{const user=await identity();const row=await getRawDb().prepare('SELECT source,payload,revision FROM data_reviews WHERE id=?').bind(REVIEW_ID).first<{source:string;payload:string;revision:number}>();if(!row)return respond({started:false,total:8,answered:0,remaining:8,openChecks:0});const source=JSON.parse(row.source),d=migrate(source,JSON.parse(row.payload));return respond({started:!!d.quick,revision:row.revision,isOwner:await owner(user),...quickProgress(d,source),record:cases.find(c=>c.id===d.quick?.position.caseId)?.name});}catch(e){return failure(e);}}
