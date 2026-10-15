import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {accessContext,RequestError} from './access-context';
import {canManage,notebookPayload,readNotebook,type Row} from './notebook-server';
import {migrateNotebook,type Notebook} from './notebook';
import {REVIEW_ID} from './data-review';
import {same,type Authority} from './review-v2/model';
import {storageAuthorityChanged,type AppliedRecord} from './review-v2/applied';
import {workspaceMenu,workspaceMenuCommandSchema,applyWorkspaceMenuCommand} from './workspace-menu';
import {approvedProduction} from './approved-production';
import {operationalDay} from './evening';
import {legacyPlanScopeGuard} from './published-plan-guard';

type ApprovedRow={payload:string;notebook_revision:number;effective:string;approval_id:string};
type StorageRow={entity_id:string;fingerprint:string;payload:string;actor_email:string;created_at:string};
const approvedSql='SELECT payload,notebook_revision,effective,approval_id FROM reviewed_entities WHERE review_id=? ORDER BY entity_id';
const storageSql="SELECT entity_id,fingerprint,payload,actor_email,created_at FROM review_authority WHERE review_id=? AND kind='storage' ORDER BY created_at DESC,rowid DESC";
function approvedRecords(rows:ApprovedRow[],authorityRows:StorageRow[]):AppliedRecord[]{
 const records=rows.map(row=>({...JSON.parse(row.payload),notebookRevision:row.notebook_revision,effective:row.effective,approvalId:row.approval_id})) as AppliedRecord[];
 if(records.some(record=>!record.entity||!Array.isArray(record.dependencies)))throw new RequestError('The authoritative recipe source could not be read. Retry without replacing it.',503,'composition_unavailable');
 const authorities:Authority[]=authorityRows.map(row=>({kind:'storage',entityId:row.entity_id,fingerprint:row.fingerprint,payload:JSON.parse(row.payload),actor:row.actor_email,at:row.created_at}));
 return records.map(record=>({...record,staleDependencies:storageAuthorityChanged(record,authorities)||record.dependencies.some(dependency=>{const current=records.find(r=>r.entity.id===dependency.id);return !!current&&!same(current.entity,dependency);})}));
}
export async function workspaceApprovedRecords():Promise<AppliedRecord[]>{const db=getRawDb(),results=await db.batch([db.prepare(approvedSql).bind(REVIEW_ID),db.prepare(storageSql).bind(REVIEW_ID)]);return approvedRecords(results[0].results as ApprovedRow[],results[1].results as StorageRow[]);}

export async function readWorkspaceMenu(user:ChatGPTUser){
 const role=accessContext.getStore()?.role;if(!role)throw new RequestError('A verified access context is required.',403);
 const manage=await canManage(user);
 // Cook reads are SELECT-only: opening a recipe cannot initialize or migrate a notebook.
 const db=getRawDb(),results=await db.batch([
  db.prepare('SELECT payload,revision,updated_at,updated_by FROM notebooks WHERE id=?').bind('kitchen'),db.prepare(approvedSql).bind(REVIEW_ID),db.prepare(storageSql).bind(REVIEW_ID),
  db.prepare('SELECT item_id FROM stock_items WHERE included=1 AND track=1'),
  db.prepare('SELECT DISTINCT t.catalog_id AS item_id FROM morning_tasks t JOIN evening_checks c ON c.id=t.check_id WHERE t.cancelled=0 AND c.plan_day>=? AND c.plan_revision>0').bind(operationalDay()),
 ]),row=results[0].results[0] as Row|undefined;
 if(!row){if(!manage)throw new RequestError('The kitchen menu is not available yet. Ask a Manager to add it.',404,'menu_not_available');await readNotebook(user);return readWorkspaceMenu(user);}
 const notebook=migrateNotebook(JSON.parse(row.payload)),records=approvedRecords(results[1].results as ApprovedRow[],results[2].results as StorageRow[]),external=new Set(notebook.items.filter(item=>item.externalUse).map(item=>item.id));
 for(const process of notebook.processes)if(process.externalUse)for(const output of process.outputs)external.add(output.itemId);
 for(const task of approvedProduction(notebook,records).tasks.values())if(task.external)for(const id of task.outputs)external.add(id);
 const operationalItemIds=[...(results[3].results as {item_id:string}[]).filter(row=>external.has(row.item_id)),...(results[4].results as {item_id:string}[])].map(row=>row.item_id);
 return workspaceMenu(notebook,records,{revision:row.revision,updatedAt:row.updated_at,accountId:user.userId,role:role==='manager'&&!manage?'cook':role,canManage:manage,operationalItemIds});
}

type MenuReceipt={id:string;request:string;actor_id:string;before_revision:number;after_revision:number};
export async function writeWorkspaceMenu(user:ChatGPTUser,revision:number,body:unknown){
 if(!await canManage(user))throw new RequestError('Only the owner or an active Manager can change product recipes.',403,'role_restricted');
 const command=workspaceMenuCommandSchema.parse(body),request=JSON.stringify(command),db=getRawDb();
 const replay=async()=>{const previous=await db.prepare("SELECT id,request,actor_id,before_revision,after_revision FROM catalog_operations WHERE id=?").bind(command.operationId).first<MenuReceipt>();if(!previous)return false;if(previous.actor_id!==user.userId||previous.before_revision!==revision||previous.request!==request)throw new RequestError('This request ID belongs to a different recipe change.',409,'command_mismatch');return true;};
 if(await replay())return {...await readWorkspaceMenu(user),operationId:command.operationId,replayed:true};
 const before=await readNotebook(user);if(before.revision!==revision){if(await replay())return {...await readWorkspaceMenu(user),operationId:command.operationId,replayed:true};throw new RequestError('The shared menu changed. Your draft is kept; load the current recipe and compare before saving.',409,'revision_conflict');}
 const notebook=migrateNotebook(JSON.parse(before.payload)),records=await workspaceApprovedRecords(),now=new Date().toISOString();let next:Notebook;
 try{next=applyWorkspaceMenuCommand(notebook,records,command,revision+1,now);}catch(error){const message=error instanceof Error?error.message:'Check this product recipe.';throw new RequestError(message,/changed|unavailable|could not be loaded/.test(message)?409:400,/changed/.test(message)?'composition_conflict':'invalid_composition');}
 const payload=notebookPayload(next),item=notebook.items.find(item=>item.id===command.itemId)!,planGuard=await legacyPlanScopeGuard(notebook,next,{beforeRecords:records,afterRecords:records});
 const result=await db.batch([
  db.prepare("INSERT INTO catalog_operations (id,kind,request,actor_id,actor_email,before_revision,after_revision,before_payload,after_payload,summary,created_at,retired_id,undo_of) SELECT ?,'workspace-recipe',?,?,?,revision,revision+1,payload,?,?,?,NULL,NULL FROM notebooks WHERE id=? AND revision=? AND "+planGuard.sql).bind(command.operationId,request,user.userId,user.email,payload,'Updated product recipe: '+item.name,now,'kitchen',revision,...planGuard.args),
  db.prepare('UPDATE notebooks SET payload=?,revision=revision+1,updated_at=?,updated_by=? WHERE id=? AND revision=? AND EXISTS (SELECT 1 FROM catalog_operations WHERE id=? AND before_revision=?)').bind(payload,now,user.email,'kitchen',revision,command.operationId,revision),
 ]);
 if(!result[0].meta.changes||!result[1].meta.changes){if(await replay())return {...await readWorkspaceMenu(user),operationId:command.operationId,replayed:true};await legacyPlanScopeGuard(notebook,next,{beforeRecords:records,afterRecords:records});throw new RequestError('The shared recipe changed during saving. Your draft is kept.',409,'revision_conflict');}
 return {...await readWorkspaceMenu(user),operationId:command.operationId,replayed:false};
}
