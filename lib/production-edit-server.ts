import {getRawDb} from '@/db';
import {RequestError} from './access-context';
import {REVIEW_ID} from './data-review';
import {privateExcludedIds} from './review-metadata-server';
import {appliedProductionItems,productionExcluded,type AppliedRecord} from './review-v2/applied';
import type {Notebook} from './notebook';
import {approvedProduction} from './approved-production';

/** Notebook production is a distinct evidence source. An ordinary save cannot replace Review authority. */
export async function validateProductionEdit(before:Notebook,after:Notebook):Promise<void>{
 if(JSON.stringify(before.processes)===JSON.stringify(after.processes))return;
 const previous=new Map(before.processes.map(process=>[process.id,process])),next=new Map(after.processes.map(process=>[process.id,process]));
 const changed=[...new Set([...previous.keys(),...next.keys()])].filter(id=>JSON.stringify(previous.get(id))!==JSON.stringify(next.get(id)));
 const rows=await getRawDb().prepare('SELECT payload FROM reviewed_entities WHERE review_id=?').bind(REVIEW_ID).all<{payload:string}>();
 const records=rows.results.map(row=>{const value=JSON.parse(row.payload);if(!value?.entity||!Array.isArray(value.dependencies))throw Error('Approved production metadata could not be checked.');return value as AppliedRecord;});
 const held=new Set([...appliedProductionItems(records),...approvedProduction(before,records).held,...approvedProduction(after,records).held]);
 for(const id of changed){const old=previous.get(id),current=next.get(id),outputs=[...new Set([...(old?.outputs??[]),...(current?.outputs??[])].map(output=>output.itemId))];
  if(old?.sourceReviewId||current?.sourceReviewId||outputs.some(itemId=>held.has(itemId)||productionExcluded(before,itemId,privateExcludedIds)||productionExcluded(after,itemId,privateExcludedIds)))throw new RequestError('This production has an approved or shared source. Reconcile it in Review before changing its composition, outputs or work. Your draft is kept.',400,'production_authority_conflict');
 }
}
