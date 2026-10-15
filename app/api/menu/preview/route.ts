import {protectedApi} from '@/lib/protected-api';
import {identity,readWrite,respond,failure,RequestError,type Row} from '@/lib/notebook-server';
import {getRawDb} from '@/db';
import {migrateNotebook} from '@/lib/notebook';
import {workspaceApprovedRecords} from '@/lib/workspace-menu-server';
import {workspaceMenuPreviewSchema,workspaceMenuImpact,proposedWorkspaceMenu} from '@/lib/workspace-menu';
import {legacyPlanScopeGuard} from '@/lib/published-plan-guard';

export const dynamic='force-dynamic';
async function POSTHandler(request:Request){try{
 await identity();const {revision,body}=await readWrite(request),command=workspaceMenuPreviewSchema.parse(body),row=await getRawDb().prepare('SELECT payload,revision,updated_at,updated_by FROM notebooks WHERE id=?').bind('kitchen').first<Row>();
 if(!row)throw new RequestError('The shared menu is not available.',404,'menu_not_available');
 if(row.revision!==revision)throw new RequestError('The shared menu changed. Refresh its preview before confirming.',409,'revision_conflict');
 const notebook=migrateNotebook(JSON.parse(row.payload)),records=await workspaceApprovedRecords();
 try{const impact=workspaceMenuImpact(notebook,records,command);let legacyPlanBlock:string|undefined;try{await legacyPlanScopeGuard(notebook,proposedWorkspaceMenu(notebook,command),{beforeRecords:records,afterRecords:records});}catch(error){if(error instanceof RequestError&&error.code==='legacy_plan_scope')legacyPlanBlock=error.message;else throw error;}return respond({revision,...impact,...(legacyPlanBlock?{legacyPlanBlock}:{})});}catch(error){if(error instanceof RequestError)throw error;throw new RequestError(error instanceof Error?error.message:'Check the proposed menu change.',400,'invalid_menu_change');}
 }catch(error){return failure(error);}}
// This endpoint computes a preview only; it has no receipt, settings or menu writes.
export const POST=protectedApi('management',POSTHandler);
