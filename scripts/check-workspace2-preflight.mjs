import assert from 'node:assert/strict';
import {mkdir,mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {createWorkspaceManifest,compareWorkspaceManifests,loadPreflightDomain} from './workspace2-preflight.mjs';

const domain=await loadPreflightDomain();
const options={environment:'synthetic-local',cutoverDay:'2026-10-15'};
const part=(itemId,amount=null,extra={})=>({itemId,amount,note:'',...extra});
const item=(id,kind='bought',extra={})=>({...domain.newItem('Synthetic '+id,kind),id,...extra});
const recipe=(id,menuId,inputs,active=true)=>({id,menuId,variant:'Standard',portions:2,inputs,notes:'Synthetic retained recipe note',active,recorded:true,weekdayPortions:null,busyPortions:null,reviewStatus:'unverified',reviewNote:''});
const production=(id,inputs,outputs)=>({id,name:'Synthetic '+id,inputs,outputs,method:'Keep this original method',activeMinutes:null,passiveMinutes:null,batchesPerWeek:null,externalUse:false,reviewStatus:'unverified',reviewNote:'',sourceReviewId:null});
const workspace=(itemId,kind,inputs)=>({itemId,kind,inputs,method:'Explicit product method',yieldAmount:null,reference:kind==='supplier'?'Synthetic supplier label':'',revision:12,updatedAt:'2026-10-15T08:00:00Z',source:kind==='supplier'?'supplier':'legacy',sourceLabel:'Retained source',sourceToken:'synthetic-token'});
function fixture(){
  const n={schemaVersion:4,dishes:[{id:'dish-a',name:'Synthetic bowl',category:'Main Dishes',state:'ready'},{id:'dish-b',name:'Synthetic side',category:'Starters',state:'ready'}],
    items:[item('salt','bought',{aliases:['Synthetic fine salt']}),item('water'),item('base','prep',{inputs:[part('salt',0.125,{unit:'g',note:'Exact decimal'})],yieldAmount:25}),item('single','prep'),item('multi-a','prep'),item('multi-b','prep'),item('approved','prep',{inputs:[part('salt',99)]}),item('own','prep',{inputs:[part('water',10)]}),item('supplier')],
    recipes:[recipe('variant-a','dish-a',[part('base',3.25),part('approved'),part('multi-a',1)]),recipe('variant-b','dish-b',[part('base',null),part('supplier',2)],false)],
    processes:[production('single-process',[part('water',5)],[part('single',5)]),production('shared-process',[part('water',50),part('salt',1)],[part('multi-a',35),part('multi-b',10)])],
    workspaceRecipes:[workspace('own','local',[part('salt',1)]),workspace('supplier','supplier',[part('water',null)])],
    distinctPairs:[['salt','water']],scenarios:[],equipment:{blastChiller:'unknown',notes:'Retained historical equipment fact'}};
  domain.validateNotebook(n);
  const quick={id:'approved-process',kind:'process',name:'Synthetic quick process',answers:{'QUICK-01':{facts:{kind:'A separate preparation',outputs:[{id:'output',itemId:'approved'}]}}}};
  const applied={entity:quick,dependencies:[],readiness:[],effective:'2026-10-15',notebookRevision:7,approvalId:'approval-1',staleDependencies:false};
  const tables=Object.fromEntries(domain.privateBackupTables.map(table=>[table,[]]));
  tables.notebooks=[{id:'kitchen',payload:JSON.stringify(n),revision:12,updated_at:'2026-10-15T08:00:00Z',updated_by:'synthetic-owner'}];
  tables.workspace_runtime_policy=[{id:'kitchen',write_paused:0,min_client_version:1,revision:0,updated_at:'initial-policy'}];
  tables.reviewed_entities=[{id:'applied-1',review_id:domain.REVIEW_ID,entity_id:quick.id,fingerprint:'synthetic',payload:JSON.stringify(applied),notebook_revision:7,effective:'2026-10-15',approval_id:'approval-1'},
    {id:'historical-other-campaign',review_id:'historical-campaign',payload:'Original historical format, retained without reinterpretation'}];
  tables.review_authority=[{id:'approval-1',kind:'approval',payload:'{"retained":"exact"}'}];
  tables.data_reviews=[{id:'kitchen',payload:'{"unfinished":"legacy review draft"}',source:'{"revision":"old"}',revision:4}];
  tables.data_review_commands=[{id:'review-command',before_payload:'{"old":true}',after_payload:'{"unfinished":true}',request:'{"operationId":"retained-receipt"}'}];
  tables.review_import_chunks=[{id:'archived-import',archive_id:'archive',part:0,payload:'original recovery text'}];
  tables.evening_checks=[{id:'live-plan',plan_day:'2026-10-15',target_day:'2026-10-14',stage:'confirmed',version:2,revision:3},{id:'old-plan',plan_day:'2026-10-14',target_day:'2026-10-13',stage:'confirmed',version:1,revision:1}];
  tables.morning_tasks=[{check_id:'live-plan',item_id:'base',ready:1,cancelled:0,revision:2,instruction_snapshot:'{"text":"Original instruction"}'},{check_id:'live-plan',item_id:'single',ready:0,cancelled:0,revision:0}];
  tables.evening_versions=[{check_id:'live-plan',version:2,payload:'{"answers":[{"itemId":"base","value":"need"}]}'}];
  tables.notebook_commands=[{id:'old-client-retry',kind:'save',fingerprint:'retained',before_revision:11,after_revision:12}];
  tables.prep_instructions=[{item_id:'base',text:'Synthetic original instruction',revision:2}];
  const bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jrZkAAAAASUVORK5CYII=','base64'),sha256=createHash('sha256').update(bytes).digest('hex');
  tables.user_photos=[{user_id:'synthetic-owner',revision:1,object_key:'synthetic-photo',sha256,size:bytes.length}];
  return {format:'Labula private database backup',version:1,stations:1,access:1,profiles:1,menuScope:1,capturedAt:'2026-10-15T08:00:00Z',tables,counts:Object.fromEntries(Object.entries(tables).map(([table,rows])=>[table,rows.length])),photos:[{userId:'synthetic-owner',revision:1,objectKey:'synthetic-photo',sha256,size:bytes.length,mime:'image/png',dataBase64:bytes.toString('base64')}]};
}
const backup=fixture(),original=JSON.stringify(backup),before=await createWorkspaceManifest(backup,options);
assert.equal(JSON.stringify(backup),original,'preflight must never mutate source backup');
const n=before.preservation.notebooks[0],byId=new Map(n.items.map(i=>[i.id,i]));
assert.equal(byId.get('base').authority.source,'legacy');
assert.equal(byId.get('single').authority.source,'process');
assert.equal(byId.get('multi-a').authority.status,'incomplete');
assert.deepEqual(byId.get('multi-a').authority.inputs,[],'shared production inputs cannot become product composition');
assert.equal(byId.get('approved').authority.source,'review');
assert.deepEqual(byId.get('approved').authority.inputs,[],'incomplete approval cannot fall back to retained old recipe');
assert.equal(byId.get('own').authority.source,'workspace');
assert.equal(byId.get('supplier').authority.source,'supplier');
assert.equal(n.edges.find(edge=>edge.ownerId==='base').amount,0.125,'preserve exact numeric quantities');
assert.equal(n.edges.find(edge=>edge.ownerId==='own'&&edge.kind==='workspace-composition').itemId,'salt');
assert.equal(n.variants.find(variant=>variant.id==='variant-b').active,false);
assert.equal(before.warnings.find(warning=>warning.code==='active-legacy-plan-policy').plans.length,1,'past plans stay historical; current legacy plan is explicit');
assert.match(before.boundaries.browserDrafts,/Not captured/);
assert.equal(before.boundaries.productionVerified,false);
assert.equal(compareWorkspaceManifests(before,await createWorkspaceManifest(backup,options)).preservationPassed,true,'repeatable read only manifest');

const additive=structuredClone(backup);additive.capturedAt='2026-10-15T08:05:00Z';additive.tables.evening_checks.forEach(check=>check.plan_policy_version=1);
for(const rows of Object.values(additive.tables))rows.reverse();
const after=await createWorkspaceManifest(additive,options);
assert.equal(compareWorkspaceManifests(before,after).preservationPassed,true,'only additive policy 1 and snapshot metadata are compatible');
assert.equal(compareWorkspaceManifests(before,after).releaseApproved,false,'equal snapshots do not authorize release');
const legacyPolicy=structuredClone(backup);delete legacyPolicy.tables.workspace_runtime_policy;delete legacyPolicy.counts.workspace_runtime_policy;
const legacyPolicyManifest=await createWorkspaceManifest(legacyPolicy,options),policyAddition=compareWorkspaceManifests(legacyPolicyManifest,before);
assert.equal(policyAddition.preservationPassed,true,'known additive release-control table is distinct from restaurant data');assert.equal(policyAddition.runtimePolicy.changed,true);assert.equal(policyAddition.releaseApproved,false);
const pausedPolicy=structuredClone(backup);pausedPolicy.tables.workspace_runtime_policy[0].write_paused=1;
assert.equal(compareWorkspaceManifests(before,await createWorkspaceManifest(pausedPolicy,options)).runtimePolicy.changed,true,'freeze state remains visible in comparison');
const auditAddition=structuredClone(backup);delete auditAddition.tables.workspace_runtime_policy_commands;delete auditAddition.counts.workspace_runtime_policy_commands;
assert.equal(compareWorkspaceManifests(await createWorkspaceManifest(auditAddition,options),before).preservationPassed,true,'only the explicit additive maintenance audit table is accepted as release control');
const audited=structuredClone(backup),operationId='77777777-7777-4777-8777-777777777777',recordedAt='2026-10-15T08:10:00Z';
audited.tables.workspace_runtime_policy_commands=[{operation_id:operationId,actor_id:'synthetic-owner',request:JSON.stringify({operationId,expectedRevision:0,action:'pause'}),action:'pause',expected_revision:0,prior_write_paused:0,prior_min_client_version:1,write_paused:1,min_client_version:1,revision:1,recorded_at:recordedAt}];audited.counts.workspace_runtime_policy_commands=1;
Object.assign(audited.tables.workspace_runtime_policy[0],{write_paused:1,revision:1,updated_at:recordedAt});
const auditManifest=await createWorkspaceManifest(audited,options),auditComparison=compareWorkspaceManifests(before,auditManifest);
assert.equal(auditComparison.preservationPassed,true);assert.equal(auditComparison.runtimeMaintenance.appended,1);assert.equal(auditComparison.runtimeMaintenance.changed,true);assert.equal(auditComparison.releaseApproved,false);
const erasedAudit=structuredClone(audited);erasedAudit.tables.workspace_runtime_policy_commands=[];erasedAudit.counts.workspace_runtime_policy_commands=0;
assert.equal(compareWorkspaceManifests(auditManifest,await createWorkspaceManifest(erasedAudit,options)).preservationPassed,false,'deleting existing release audit fails preservation');
const changedAudit=structuredClone(audited);changedAudit.tables.workspace_runtime_policy_commands[0].actor_id='another-owner';
assert.equal(compareWorkspaceManifests(auditManifest,await createWorkspaceManifest(changedAudit,options)).preservationPassed,false,'editing existing release audit fails preservation');
const brokenAudit=structuredClone(audited);brokenAudit.tables.workspace_runtime_policy_commands[0].prior_write_paused=1;
await assert.rejects(createWorkspaceManifest(brokenAudit,options),/maintenance audit transition/);
const downgradeAudit=structuredClone(audited),downgradeRow=downgradeAudit.tables.workspace_runtime_policy_commands[0];
Object.assign(downgradeRow,{action:'resume',prior_write_paused:1,prior_min_client_version:3,write_paused:0,min_client_version:2,request:JSON.stringify({operationId,expectedRevision:0,action:'resume'})});
Object.assign(downgradeAudit.tables.workspace_runtime_policy[0],{write_paused:0,min_client_version:2});
await assert.rejects(createWorkspaceManifest(downgradeAudit,options),/maintenance audit transition/,'a future minimum client version cannot be silently lowered');
const mismatchedPolicy=structuredClone(audited);mismatchedPolicy.tables.workspace_runtime_policy[0].revision=2;
await assert.rejects(createWorkspaceManifest(mismatchedPolicy,options),/does not match current policy/);
const markedMissingAudit=structuredClone(auditAddition);markedMissingAudit.runtimeMaintenance=1;
await assert.rejects(createWorkspaceManifest(markedMissingAudit,options),/incomplete/);

async function detected(change,label){const next=structuredClone(backup);change(next);next.counts=Object.fromEntries(Object.entries(next.tables).map(([table,rows])=>[table,rows.length]));assert.equal(compareWorkspaceManifests(before,await createWorkspaceManifest(next,options)).preservationPassed,false,label);}
function editNotebook(backup,change){const n=JSON.parse(backup.tables.notebooks[0].payload);change(n);backup.tables.notebooks[0].payload=JSON.stringify(n);}
await detected(b=>editNotebook(b,n=>{n.recipes[0].active=false;}),'active menu state cannot change during migration');
await detected(b=>editNotebook(b,n=>{n.items[2].inputs[0].amount=0.126;}),'same edge count with changed quantity must fail');
await detected(b=>editNotebook(b,n=>{n.items[0].aliases=[];}),'alias changes must fail');
await detected(b=>editNotebook(b,n=>{n.items[2].yieldAmount=26;}),'yield changes must fail');
await detected(b=>{b.tables.data_reviews[0].payload='{"unfinished":"changed"}';},'legacy review drafts must survive');
await detected(b=>{b.tables.review_authority=[];},'approval decisions must survive');
await detected(b=>{b.tables.notebook_commands=[];},'retry receipts must survive');
await detected(b=>{b.tables.morning_tasks[0].ready=0;},'Ready state must survive');
await detected(b=>{b.tables.evening_checks[0].plan_policy_version=2;},'bulk policy flip is not a preservation migration');
await detected(b=>{b.tables.evening_checks[0].plan_policy_version=null;},'null is not the absence of the old policy column');
await detected(b=>{b.tables.future_table=[];},'unknown schema additions need an explicit reviewed comparator update');
const unavailable=structuredClone(backup);editNotebook(unavailable,n=>{n.reviewSourceRevision='retained-approved-source';});unavailable.tables.reviewed_entities=[];unavailable.counts.reviewed_entities=0;
const missing=await createWorkspaceManifest(unavailable,options);assert.equal(missing.preservation.notebooks[0].items.find(i=>i.id==='approved').authority.source,'unavailable');assert.ok(missing.warnings.some(w=>w.code==='composition-needs-reconciliation'));
const broken=structuredClone(backup);broken.photos[0].dataBase64=Buffer.alloc(broken.photos[0].size).toString('base64');await assert.rejects(createWorkspaceManifest(broken,options),/checksum/);
const incomplete=structuredClone(backup);delete incomplete.tables.review_import_chunks;await assert.rejects(createWorkspaceManifest(incomplete,options),/incomplete/);
await assert.rejects(createWorkspaceManifest(backup,{...options,cutoverDay:'2026-02-30'}),/valid/);
await assert.rejects(createWorkspaceManifest(backup,{...options,environment:undefined}),/Declare/);

const dir=await mkdtemp(join(tmpdir(),'workspace2-preflight-'));
try{
  const source=join(dir,'synthetic-before.json'),target=join(dir,'synthetic-after.json'),out=join(dir,'report');
  await writeFile(source,original);await writeFile(target,JSON.stringify(additive));
  const args=['scripts/workspace2-preflight.mjs','--before',source,'--after',target,'--environment','synthetic-local','--cutover-day','2026-10-15','--out',out];
  const run=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(run.status,0,run.stderr);assert.match(run.stdout,/Preservation PASS/);assert.doesNotMatch(run.stdout,/Synthetic|synthetic-owner|legacy review draft/);
  assert.equal(JSON.parse(await readFile(join(out,'comparison.json'),'utf8')).preservationPassed,true);
  assert.equal((await stat(out)).mode&0o777,0o700);assert.equal((await stat(join(out,'before-manifest.json'))).mode&0o777,0o600);
  assert.equal(await readFile(source,'utf8'),original,'CLI must not overwrite input');
  const repeated=spawnSync(process.execPath,args,{encoding:'utf8'});assert.equal(repeated.status,1,'existing evidence directory cannot be overwritten');
  const changed=structuredClone(additive);changed.tables.morning_tasks[0].ready=1-changed.tables.morning_tasks[0].ready;await writeFile(target,JSON.stringify(changed));
  const failure=spawnSync(process.execPath,[...args.slice(0,-1),join(dir,'changed-report')],{encoding:'utf8'});assert.equal(failure.status,2,'nonzero exit code stops a cutover pipeline on preservation difference');
}finally{await rm(dir,{recursive:true,force:true});}
if(process.env.WORKSPACE2_PREFLIGHT_EVIDENCE_DIR){
  const evidence=process.env.WORKSPACE2_PREFLIGHT_EVIDENCE_DIR;
  await mkdir(evidence,{recursive:true,mode:0o700});
  for(const [name,value] of Object.entries({'preflight-synthetic-before-manifest.json':before,'preflight-synthetic-after-manifest.json':after,'preflight-synthetic-comparison.json':compareWorkspaceManifests(before,after),'preflight-test-result.json':{command:'node scripts/check-workspace2-preflight.mjs',node:process.version,status:'passed',data:'synthetic fixtures only',productionVerified:false,browserDraftsVerified:false}}))await writeFile(join(evidence,name),JSON.stringify(value,null,2)+'\n',{mode:0o600});
}
console.log('PASS Workspace 2.0 preflight: repeatable read-only manifests; identities, active variants, exact edges/quantities/authority, legacy drafts, receipts and Ready preserved; safe additive policy 1; photo bytes checked; corruption/change exits; private evidence files. Production and browser drafts remain explicit release gates.');
