import {privateExcludedIds} from '@/lib/review-metadata-server';
import {protectedApi} from '@/lib/protected-api';
import {getRawDb} from '@/db';
import {identity,respond,failure} from '@/lib/notebook-server';
import {REVIEW_ID} from '@/lib/data-review';
import {same,type Entity,type Readiness,type Authority} from '@/lib/review-v2/model';
import {storageAuthorityChanged,type AppliedRecord} from '@/lib/review-v2/applied';
export const dynamic='force-dynamic';
async function GETHandler(){try{const user=await identity();const db=getRawDb();const rows=await db.prepare('SELECT entity_id,payload,notebook_revision,effective,approval_id FROM reviewed_entities WHERE review_id=? ORDER BY entity_id').bind(REVIEW_ID).all<{entity_id:string;payload:string;notebook_revision:number;effective:string;approval_id:string}>();const records=rows.results.map(r=>({...JSON.parse(r.payload),effective:r.effective,notebookRevision:r.notebook_revision,approvalId:r.approval_id})) as {entity:Entity;readiness:Readiness[];dependencies:Entity[];effective:string;notebookRevision:number;approvalId:string}[];
const checks=await db.prepare("SELECT entity_id,fingerprint,payload,actor_email,created_at FROM review_authority WHERE review_id=? AND kind='storage' ORDER BY created_at DESC, rowid DESC").bind(REVIEW_ID).all<{entity_id:string;fingerprint:string;payload:string;actor_email:string;created_at:string}>();const authority:Authority[]=checks.results.map(a=>({kind:'storage',entityId:a.entity_id,fingerprint:a.fingerprint,payload:JSON.parse(a.payload),actor:a.actor_email,at:a.created_at}));
return respond({account:user.email,productionExcludedIds:privateExcludedIds,records:records.map(r=>({...r,staleDependencies:storageAuthorityChanged(r as AppliedRecord,authority)||r.dependencies.some(dep=>{const current=records.find(x=>x.entity.id===dep.id);return !!current&&!same(current.entity,dep);})})),scope:'Approved and applied records only. Each run is one observation; shared steps are not multiplied by output.'});}catch(e){return failure(e);}}

export const GET=protectedApi('workspace',GETHandler);
