#!/usr/bin/env node
/** Read-only preservation evidence. This tool never connects to D1, R2 or the network. */
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
let domainPromise;
export function loadPreflightDomain(){
  domainPromise??=build({stdin:{contents:`export {privateBackupTables,isCompletePrivateBackup,verifyPrivateBackupPhotos} from './lib/private-backup';
export {validateNotebook,newItem,initialNotebook} from './lib/notebook';
export {REVIEW_ID} from './lib/data-review';
export {workspaceComposition} from './lib/workspace-menu';`,resolveDir:root,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'})
    .then(result=>import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64')));
  return domainPromise;
}

// Object member order and the order returned by SELECT are not data changes.
// Array order, null, omitted values, quantities and strings retain their meaning.
export function canonical(value){
  if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
  if(value&&typeof value==='object')return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical(value[key])).join(',')+'}';
  return JSON.stringify(value);
}
export function digest(value){return createHash('sha256').update(canonical(value)).digest('hex');}
function sorted(values){return [...values].sort((a,b)=>canonical(a).localeCompare(canonical(b),'en'));}
function strictDay(day){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day??'')||new Date(day+'T12:00:00Z').toISOString().slice(0,10)!==day)throw Error('Supply a valid --cutover-day YYYY-MM-DD in the kitchen calendar.');
  return day;
}
function rowKey(row){
  return ['id','check_id','version','item_id','user_id','review_id','entity_id','seq','part','revision'].filter(key=>Object.hasOwn(row,key)).map(key=>[key,row[key]]);
}
function retainedRow(table,row){
  // 0021 is additive: historical rows get policy 1, which is the old behavior.
  // No other added columns, changed values or rows are silently accepted.
  return table==='evening_checks'&&!Object.hasOwn(row,'plan_policy_version')?{...row,plan_policy_version:1}:row;
}
function parsePayload(row,table){
  try{return JSON.parse(row.payload);}catch{throw Error(`Invalid JSON in ${table}; preservation cannot be established.`);}
}
function recordIdentity(record,kind){return {kind,id:record.id,digest:digest(record)};}
function inputsFor(records,kind){
  return records.flatMap(record=>(record.inputs??[]).map((input,position)=>({kind,ownerId:record.id,position,...input})));
}

export async function createWorkspaceManifest(backup,{environment,cutoverDay}={}){
  if(!['synthetic-local','protected-production'].includes(environment))throw Error('Declare --environment synthetic-local or protected-production. Production files must stay in their protected source environment.');
  strictDay(cutoverDay);
  const domain=await loadPreflightDomain();
  const policyCaptured=Array.isArray(backup?.tables?.workspace_runtime_policy);
  const auditCaptured=Array.isArray(backup?.tables?.workspace_runtime_policy_commands);
  // Historical exports predate the additive release-control table. Its known
  // addition is reported separately; no restaurant data or receipts are ignored.
  if(!policyCaptured&&backup?.runtimePolicy===undefined&&backup?.tables&&backup?.counts)backup={...backup,tables:{...backup.tables,workspace_runtime_policy:[]},counts:{...backup.counts,workspace_runtime_policy:0}};
  if(!auditCaptured&&backup?.runtimeMaintenance===undefined&&backup?.tables&&backup?.counts)backup={...backup,tables:{...backup.tables,workspace_runtime_policy_commands:[]},counts:{...backup.counts,workspace_runtime_policy_commands:0}};
  if(!domain.isCompletePrivateBackup(backup)||!await domain.verifyPrivateBackupPhotos(backup))throw Error('The backup is incomplete or a referenced photo failed its byte checksum. Use the complete private backup, not a notebook draft or CSV.');
  const tableNames=Object.keys(backup.tables).sort();
  if(tableNames.some(table=>!Array.isArray(backup.tables[table])||backup.counts[table]!==backup.tables[table].length))throw Error('Backup table counts do not match rows.');
  const policyRows=backup.tables.workspace_runtime_policy;
  if(policyRows.length>1||policyRows.some(row=>row.id!=='kitchen'||![0,1].includes(row.write_paused)||!Number.isSafeInteger(row.min_client_version)||row.min_client_version<1||!Number.isSafeInteger(row.revision)||row.revision<0))throw Error('Invalid runtime policy control state.');
  const auditRows=[...backup.tables.workspace_runtime_policy_commands].sort((a,b)=>a.revision-b.revision);
  for(let index=0;index<auditRows.length;index++){
    const row=auditRows[index],previous=auditRows[index-1];
    if(typeof row.operation_id!=='string'||typeof row.actor_id!=='string'||typeof row.request!=='string'||!Number.isSafeInteger(row.expected_revision)||row.expected_revision<0||row.revision!==row.expected_revision+1||![0,1].includes(row.prior_write_paused)||!Number.isSafeInteger(row.prior_min_client_version)||row.prior_min_client_version<1||!((row.action==='pause'&&row.prior_write_paused===0&&row.write_paused===1&&row.min_client_version===row.prior_min_client_version)||(row.action==='resume'&&row.prior_write_paused===1&&row.prior_min_client_version<=2&&row.write_paused===0&&row.min_client_version===2))||!Number.isFinite(Date.parse(row.recorded_at)))throw Error('Invalid runtime maintenance audit transition.');
    let request;try{request=JSON.parse(row.request);}catch{throw Error('Invalid runtime maintenance audit request.');}
    if(request.operationId!==row.operation_id||request.action!==row.action||request.expectedRevision!==row.expected_revision)throw Error('Runtime maintenance audit request does not match its transition.');
    if(previous&&(row.expected_revision!==previous.revision||row.prior_write_paused!==previous.write_paused||row.prior_min_client_version!==previous.min_client_version))throw Error('Runtime maintenance audit chain is inconsistent.');
  }
  if(new Set(auditRows.map(row=>row.operation_id)).size!==auditRows.length)throw Error('Duplicate maintenance operation ID.');
  const lastAudit=auditRows.at(-1),currentPolicy=policyRows[0];
  if(lastAudit&&(!currentPolicy||lastAudit.revision!==currentPolicy.revision||lastAudit.write_paused!==currentPolicy.write_paused||lastAudit.min_client_version!==currentPolicy.min_client_version||lastAudit.recorded_at!==currentPolicy.updated_at))throw Error('Runtime maintenance audit does not match current policy.');
  const tableInventory=tableNames.filter(table=>!['workspace_runtime_policy','workspace_runtime_policy_commands'].includes(table)).map(table=>{
    const rows=sorted(backup.tables[table].map(row=>retainedRow(table,row)));
    return {table,count:rows.length,digest:digest(rows),rows:rows.map(row=>({key:rowKey(row),digest:digest(row)}))};
  });
  const records=sorted(backup.tables.reviewed_entities.filter(row=>row.review_id===domain.REVIEW_ID)).map(row=>parsePayload(row,'reviewed_entities'));
  const warnings=[];
  const notebooks=sorted(backup.tables.notebooks).map(row=>{
    const raw=parsePayload(row,'notebooks');
    // Validation is read-only. The raw row digest below still includes every
    // field, including optional legacy data the current schema doesn't project.
    let notebook;try{notebook=domain.validateNotebook(raw);}catch{throw Error('A saved notebook failed schema or relationship validation. Keep the source and reconcile it in the protected environment; no records were modified.');}
    const items=notebook.items.map(item=>{
      let composition;
      try{composition=domain.workspaceComposition(notebook,records,item.id);}catch{throw Error('A composition authority could not be resolved safely. Keep the source backup and reconcile its recorded authority.');}
      const authority={itemId:item.id,source:composition.source,status:composition.status,sourceLabel:composition.sourceLabel,token:composition.token,reference:composition.reference??null,inputs:composition.inputs,gaps:composition.gaps};
      if(composition.status==='incomplete'||composition.source==='unavailable')warnings.push({code:'composition-needs-reconciliation',notebookId:row.id,itemId:item.id,source:composition.source,gaps:composition.gaps});
      return {id:item.id,kind:item.kind,aliases:item.aliases,unit:item.unit,yieldAmount:item.yieldAmount,externalUse:item.externalUse,digest:digest(raw.items.find(value=>value.id===item.id)),authority};
    });
    return {
      id:row.id,revision:row.revision,schemaVersion:raw.schemaVersion,rawPayloadDigest:digest(raw),
      dishes:notebook.dishes.map(dish=>({...recordIdentity(dish,'dish'),state:dish.state})),
      variants:notebook.recipes.map(recipe=>({...recordIdentity(recipe,'variant'),dishId:recipe.menuId,active:recipe.active,portions:recipe.portions})),
      items,processes:notebook.processes.map(process=>({...recordIdentity(process,'process'),sourceReviewId:process.sourceReviewId,outputs:process.outputs})),
      edges:[...inputsFor(notebook.recipes,'dish-variant'),...inputsFor(notebook.items,'legacy-item'),...inputsFor(notebook.processes,'shared-process'),
        ...notebook.processes.flatMap(process=>process.outputs.map((output,position)=>({kind:'process-output',ownerId:process.id,position,...output}))),
        ...(raw.workspaceRecipes??[]).flatMap(composition=>(composition.inputs??[]).map((input,position)=>({kind:'workspace-composition',ownerId:composition.itemId,position,...input})))],
      distinctPairs:raw.distinctPairs,equipmentDigest:digest(raw.equipment),
    };
  });
  if(!notebooks.some(notebook=>notebook.id==='kitchen'))warnings.push({code:'current-menu-not-recorded',detail:'No saved kitchen notebook; a repository seed is not proof of the restaurant menu.'});
  const legacyPlans=backup.tables.evening_checks.filter(row=>row.plan_day&&row.plan_day>=cutoverDay&&(row.plan_policy_version??1)<2).map(row=>({checkId:row.id,planDay:row.plan_day,stage:row.stage,version:row.version,planPolicyVersion:row.plan_policy_version??1,unfinishedTasks:backup.tables.morning_tasks.filter(task=>task.check_id===row.id&&!task.cancelled&&!task.ready).length}));
  if(legacyPlans.length)warnings.push({code:'active-legacy-plan-policy',plans:legacyPlans});
  const photos=sorted(backup.photos.map(photo=>({userId:photo.userId,revision:photo.revision,objectKey:photo.objectKey,sha256:photo.sha256,size:photo.size,mime:photo.mime})));
  const preservation={tables:tableInventory,notebooks,photos};
  return {
    format:'Workspace 2.0 preservation manifest',version:1,environment,cutoverDay,capturedAt:backup.capturedAt,
    preservation,digest:digest(preservation),runtimePolicy:{captured:policyCaptured,rows:policyRows,digest:digest(policyRows)},runtimeMaintenance:{captured:auditCaptured,rows:auditRows,digest:digest(auditRows)},warnings,
    boundaries:{readOnly:true,compositionReviewId:domain.REVIEW_ID,knownTables:domain.privateBackupTables.length,unknownTables:tableNames.filter(table=>!domain.privateBackupTables.includes(table)),
      browserDrafts:'Not captured by the server backup. Inventory each browser and export unsaved recovery files before cutover; preserve existing keys.',
      releaseApproval:'This report does not grant deployment or production migration approval.',
      productionVerified:environment==='protected-production'?'Only the supplied backup content; no live endpoint or write-freeze verification.':false},
  };
}

export function compareWorkspaceManifests(before,after){
  if(before.format!=='Workspace 2.0 preservation manifest'||after.format!==before.format||before.version!==1||after.version!==1)throw Error('Unsupported preservation manifest.');
  if(before.environment!==after.environment||before.cutoverDay!==after.cutoverDay)throw Error('Compare the same environment and cutover day.');
  const changes=[];
  const beforeAudit=before.runtimeMaintenance?.rows??[],afterAudit=after.runtimeMaintenance?.rows??[];
  const retainedAudit=new Map(afterAudit.map(row=>[row.operation_id,row]));
  if(beforeAudit.some(row=>digest(row)!==digest(retainedAudit.get(row.operation_id)??null)))changes.push({kind:'runtime-maintenance-history',detail:'A pre-existing maintenance audit row was changed or removed.'});
  const aTables=new Map(before.preservation.tables.map(table=>[table.table,table]));
  const bTables=new Map(after.preservation.tables.map(table=>[table.table,table]));
  for(const table of [...new Set([...aTables.keys(),...bTables.keys()])].sort()){
    const a=aTables.get(table),b=bTables.get(table);
    if(a?.digest!==b?.digest)changes.push({kind:'table',table,beforeCount:a?.count??null,afterCount:b?.count??null,beforeDigest:a?.digest??null,afterDigest:b?.digest??null});
  }
  for(const section of ['notebooks','photos'])if(digest(before.preservation[section])!==digest(after.preservation[section]))changes.push({kind:'projection',section});
  return {format:'Workspace 2.0 preservation comparison',version:1,environment:after.environment,cutoverDay:after.cutoverDay,
    preservationPassed:changes.length===0,beforeDigest:before.digest,afterDigest:after.digest,changes,
    runtimePolicy:{before:before.runtimePolicy,after:after.runtimePolicy,changed:digest(before.runtimePolicy)!==digest(after.runtimePolicy),explanation:'Known release-control state is reported separately from restaurant data. Check the freeze and client-version gates; preservation equality never authorizes resuming writes.'},
    runtimeMaintenance:{before:before.runtimeMaintenance??null,after:after.runtimeMaintenance??null,changed:digest(before.runtimeMaintenance??null)!==digest(after.runtimeMaintenance??null),appended:afterAudit.filter(row=>!beforeAudit.some(old=>old.operation_id===row.operation_id)).length,explanation:'Only this explicit immutable Owner release-control audit is separate from restaurant data. Existing rows must remain identical; valid appended transitions and current policy are always reported for review. Frozen deployment comparison should have zero appended actions.'},
    exceptions:[...after.warnings],
    remainingReleaseGates:['Verify the current protected production snapshot and retain a verified full backup.','Resolve or acknowledge each data exception without changing the preserved menu silently.','Inventory unsaved browser drafts and preserve account-scoped recovery.','Pause writes server-side and close old clients; verify delayed commands cannot write during cutover.','Decide each live legacy plan policy explicitly; do not bulk flip plan_policy_version.','Verify the new schema, authenticated roles and production smoke checks before reopening writes.'],
    releaseApproved:false};
}

function usage(){return 'node scripts/workspace2-preflight.mjs --before BACKUP.json [--after BACKUP.json] --environment synthetic-local|protected-production --cutover-day YYYY-MM-DD --out DIRECTORY';}
export async function main(argv=process.argv.slice(2)){
  if(argv.includes('--help')){console.log(usage());return;}
  const allowed=new Set(['--before','--after','--environment','--cutover-day','--out']);const flags={};
  for(let index=0;index<argv.length;index+=2){const flag=argv[index],value=argv[index+1];if(!allowed.has(flag)||!value||value.startsWith('--')||Object.hasOwn(flags,flag))throw Error(usage());flags[flag]=value;}
  if(!flags['--before']||!flags['--out'])throw Error(usage());
  const options={environment:flags['--environment'],cutoverDay:flags['--cutover-day']};
  const before=await createWorkspaceManifest(JSON.parse(await readFile(resolve(flags['--before']),'utf8')),options);
  const after=flags['--after']?await createWorkspaceManifest(JSON.parse(await readFile(resolve(flags['--after']),'utf8')),options):null;
  const comparison=after?compareWorkspaceManifests(before,after):null;
  // Create a new private report directory. Refuse to overwrite prior evidence
  // or the input, and never echo private identities or source payloads to stdout.
  const out=resolve(flags['--out']);await mkdir(out,{mode:0o700});
  const save=(name,value)=>writeFile(resolve(out,name),JSON.stringify(value,null,2)+'\n',{mode:0o600,flag:'wx'});
  await save('before-manifest.json',before);
  if(after)await save('after-manifest.json',after);
  if(comparison)await save('comparison.json',comparison);
  console.log(comparison?`Preservation ${comparison.preservationPassed?'PASS':'FAIL'}; ${comparison.changes.length} changed sections. Release approval is separate.`:'Manifest created. Supply --after for a preservation comparison. Release approval is separate.');
  if(comparison&&!comparison.preservationPassed)process.exitCode=2;
}

if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
  try{await main();}catch(error){console.error('Preflight failed: '+(error instanceof Error?error.message:'Unknown error.'));process.exitCode=1;}
}
