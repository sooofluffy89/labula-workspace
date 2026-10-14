import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {harness} from './sync-harness.mjs';
import {fixture} from './review-v2-fixture.mjs';

const directory=await mkdtemp(path.join(tmpdir(),'labula-review-handoff-'));let h;
try{
 h=await harness();
 const outfile=path.join(directory,'handoff.mjs');
 await build({stdin:{contents:"export * as api from './app/api/review-workflow/route';export * as model from './lib/review-v2/model';export * as quick from './lib/quick-review/model';export * as proposals from './lib/review-v2/proposals';export * as handoff from './lib/review-production-handoff';export * as applied from './lib/review-v2/applied';export {validateProductionEdit} from './lib/production-edit-server';export {REVIEW_ID} from './lib/data-review';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,logLevel:'silent',alias:{'@/db':path.join(path.dirname(h.bundle),'db.ts'),'@/app/chatgpt-auth':path.join(path.dirname(h.bundle),'auth.ts')},define:{'import.meta.env.DEV':'false'}});
 const t=await import(pathToFileURL(outfile)),{db}=h,m=t.model;
 const f=fixture(m,h.m),{source,d,p,broth,water,coriander}=f;
 const part=(item,amount=100)=>({itemId:item.id,amount,note:'Synthetic exact quantity'});
 const task=(id,output)=>({id,name:'Recorded '+id,inputs:[part(water)],outputs:[part(output,1000)],method:'Original named method',activeMinutes:17,passiveMinutes:30,batchesPerWeek:2,externalUse:false,reviewStatus:'unverified',reviewNote:'Original source kept',sourceReviewId:null});
 source.notebook.processes=[task('local-process',broth)];source.notebook.items.find(i=>i.id===broth.id).inputs=[part(coriander,9)];
 db.prepare("UPDATE notebooks SET payload=?,revision=317 WHERE id='kitchen'").run(JSON.stringify(source.notebook));
 db.prepare('INSERT INTO data_reviews(id,source,payload,revision,updated_at,updated_by) VALUES(?,?,?,?,?,?)').run(t.REVIEW_ID,JSON.stringify(source),JSON.stringify(d),1,'2026-10-14T09:00:00Z',h.owner.email);
 const post=body=>h.post(t.api,{operationId:crypto.randomUUID(),...body},{headers:{'If-Match':'1'}});
 const json=async response=>{const data=await response.json();assert.equal(response.status,200,JSON.stringify(data));return data;};
 const current=()=>db.prepare("SELECT * FROM notebooks WHERE id='kitchen'").get();
 const update=transform=>{const row=current(),next=JSON.parse(row.payload);transform(next);db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(next));return next;};
 const snapshot=()=>Object.fromEntries(['notebooks','review_authority','review_actions','reviewed_entities','catalog_operations','data_reviews','stock_items','checking_station_items','evening_checks','prep_feedback'].map(table=>[table,db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()]));
 const preview=()=>post({action:'preview',entityIds:[p.id]}).then(json);
 const approval=shown=>post({action:'approve',entityIds:[p.id],fingerprint:shown.proposal.fingerprint,productionHandoff:shown.productionHandoff,effective:'2026-09-18',reason:'New information',evidence:'Synthetic observed process and explicit handoff'});

 let shown=await preview();assert.deepEqual(shown.productionHandoff.processes,source.notebook.processes);assert.deepEqual(shown.productionHandoff.outputNames,[{id:broth.id,name:broth.name}]);assert.deepEqual(shown.productionHandoff.conflicts,[]);
 let frozen=snapshot();let response=await post({action:'approve',entityIds:[p.id],fingerprint:shown.proposal.fingerprint,effective:'2026-09-18',reason:'New information',evidence:'Old client lacks visible handoff'});assert.equal(response.status,409);assert.deepEqual(snapshot(),frozen,'an old client cannot approve unseen task retirement');
 update(next=>{next.processes[0].activeMinutes=19;});frozen=snapshot();assert.equal((await approval(shown)).status,409);assert.deepEqual(snapshot(),frozen,'edits between preview and approval require another preview');
 shown=await preview();const approved=await json(await approval(shown));const approvalPayload=JSON.parse(db.prepare('SELECT payload FROM review_authority WHERE id=?').get(approved.approvalId).payload);assert.deepEqual(approvalPayload.productionHandoff,shown.productionHandoff);
 update(next=>{next.processes[0].method='New cook correction after approval';});frozen=snapshot();response=await post({action:'apply',approvalId:approved.approvalId});assert.equal(response.status,409);assert.equal((await response.json()).code,'production_handoff_conflict');assert.deepEqual(snapshot(),frozen,'a stale approval cannot retire changed work');
 shown=await preview();const fresh=await json(await approval(shown));
 update(next=>{next.equipment.notes='Independent newer kitchen edit';next.processes.push(task('unrelated-process',coriander));});
 const beforeApply=JSON.parse(current().payload),apply={operationId:crypto.randomUUID(),action:'apply',approvalId:fresh.approvalId};
 frozen=snapshot();h.fail(sql=>sql.startsWith('UPDATE notebooks SET payload='));const oldLog=console.error;try{console.error=()=>{};assert.equal((await post(apply)).status,503);}finally{console.error=oldLog;}assert.deepEqual(snapshot(),frozen,'handoff, authority, notebook and receipts roll back together');
 await json(await post(apply));const after=JSON.parse(current().payload);assert.deepEqual(after.processes,[beforeApply.processes[1]],'only the exact approved local task is retired');assert.deepEqual(after.items,beforeApply.items,'legacy item composition and profiles remain historical facts');assert.equal(after.equipment.notes,'Independent newer kitchen edit');assert.equal(after.reviewSourceRevision,fresh.approvalId,'zero-flat-patch approval advances scenario provenance');
 const archived=db.prepare('SELECT before_payload,after_payload FROM catalog_operations WHERE id=?').get(apply.operationId);assert.deepEqual(JSON.parse(archived.before_payload).processes,beforeApply.processes);assert.deepEqual(JSON.parse(archived.after_payload).processes,after.processes);
 frozen=snapshot();assert.equal((await json(await post(apply))).replayed,true);assert.deepEqual(snapshot(),frozen,'lost acknowledgements never retire another task');

 // A handoff must include every sibling output. Neither partial nor linked production is discarded.
 const multi=structuredClone(source.notebook);multi.processes[0].outputs.push(part(coriander));const proposed=t.proposals.proposal(source,d,[p.id]);let handoff=t.handoff.productionHandoff(multi,proposed,t.proposals.proposalDependencies(d,proposed,source));assert.match(handoff.conflicts.join(' '),/also produces Coriander/);assert.equal(t.handoff.productionHandoffMatches(handoff,handoff),false);
 const quickProposal={entities:[{...m.makeEntity('process','Limited task'),answers:{'QUICK-01':{facts:{outputs:[{itemId:broth.id}],coverage:'Some parts missing'}}}}],patches:[],fingerprint:'synthetic',warnings:[],readiness:[]};handoff=t.handoff.productionHandoff(source.notebook,quickProposal);assert.match(handoff.conflicts.join(' '),/partial or alternative/);
 const linked=structuredClone(source.notebook);linked.processes[0].sourceReviewId='existing-approved-source';assert.match(t.handoff.productionHandoff(linked,proposed,t.proposals.proposalDependencies(d,proposed,source)).conflicts.join(' '),/already linked/);
 const external=structuredClone(source.notebook);external.processes[0].externalUse=true;assert.match(t.handoff.productionHandoff(external,proposed,t.proposals.proposalDependencies(d,proposed,source)).conflicts.join(' '),/outside the menu/);external.items.find(item=>item.id===broth.id).externalUse=true;assert.deepEqual(t.handoff.productionHandoff(external,proposed,t.proposals.proposalDependencies(d,proposed,source)).conflicts,[],'explicit external output use survives removal of the old task');
 const future=structuredClone(proposed);future.entities[0].answers['PROC-01'].practice='Future plan';assert.match(t.handoff.productionHandoff(source.notebook,future,t.proposals.proposalDependencies(d,proposed,source)).conflicts.join(' '),/partial or alternative/,'future or historical methods cannot replace current work');
 const canonical=structuredClone(source.notebook),canonicalId='canonical-broth-after-reviewed-alias-merge';Object.assign(canonical.items.find(item=>item.id===broth.id),{id:canonicalId,name:'Canonical synthetic broth',aliases:[broth.name]});canonical.processes[0].outputs[0].itemId=canonicalId;const mapped=t.handoff.productionHandoff(canonical,proposed,t.proposals.proposalDependencies(d,proposed,source));assert.deepEqual(mapped.outputIds,[canonicalId]);assert.deepEqual(mapped.processes,canonical.processes,'a retained exact catalog identity maps retired Review source IDs to the current producer');

 // Old approval payloads without snapshots cannot retire tasks created after approval.
 const oldApproval=crypto.randomUUID(),oldPayload={proposal:proposed,effective:'2026-09-18'};db.prepare('INSERT INTO review_authority(id,review_id,kind,entity_id,fingerprint,payload,actor_id,actor_email,created_at) VALUES(?,?,?,?,?,?,?,?,?)').run(oldApproval,t.REVIEW_ID,'approval',p.id,proposed.fingerprint,JSON.stringify(oldPayload),h.owner.userId,h.owner.email,new Date().toISOString());update(next=>{next.processes.push(task('added-after-old-approval',broth));});frozen=snapshot();assert.equal((await post({action:'apply',approvalId:oldApproval})).status,409);assert.deepEqual(snapshot(),frozen);

 // The real endpoint rejects a partial shared-output replacement before any authority is written.
 update(next=>{next.processes=[task('shared-current',broth)];next.processes[0].outputs.push(part(coriander));});shown=await preview();assert.match(shown.productionHandoff.conflicts.join(' '),/also produces Coriander/);frozen=snapshot();assert.equal((await approval(shown)).status,409);assert.deepEqual(snapshot(),frozen);
 // Removing a valid explicit task must not expose a previously masked invalid legacy cycle.
 const masked=update(next=>{next.processes=[task('masked-legacy',broth)];next.items.find(item=>item.id===broth.id).inputs=[part(broth)];});h.m.validateNotebook(masked);shown=await preview();const maskedApproval=await json(await approval(shown));frozen=snapshot();response=await post({action:'apply',approvalId:maskedApproval.approvalId});assert.equal(response.status,409);assert.equal((await response.json()).code,'production_handoff_conflict');assert.deepEqual(snapshot(),frozen,'final projected graph is validated before the atomic write');

 // Real Quick approval handoff uses no invented recipe and immediately protects both UI and server.
 const quickNotebook=h.m.initialNotebook(),quick=t.quick;
 quickNotebook.items=quick.cases.flatMap(c=>c.items.map((id,index)=>({...h.m.newItem('Synthetic '+c.name+' '+index,'prep'),id})));
 const qSource={notebook:quickNotebook,revision:900,capturedAt:'2026-09-20T09:00:00Z'},qDraft=m.fresh(qSource);qDraft.quick=quick.emptyQuick();
 const qProcess=quick.emptyProcess(),qItem=quickNotebook.items[0];Object.assign(qProcess,{name:'Synthetic quick current task',kind:'A separate preparation',sharedScope:'All this work is local and separate',outputs:[{...quick.emptyOutput(qItem.id),stage:'Ready synthetic product',status:'estimate',amount:'2',unit:'kg'}],workStatus:'estimate',minutes:'15',crewMode:'One person',coverage:'Whole named task',fullStatus:'estimate',full:'6',topupStatus:'estimate',topups:'0',trigger:'A planned prep list',limits:['Equipment capacity'],limitBasis:'Observed here'});
 qDraft.quick.processes.push(qProcess);qDraft.quick.cases[0].processIds=[qProcess.id];qDraft.quick.week.days='6';qDraft.quick.cases[0].finished=quick.caseHash('garlic',qDraft.quick,qDraft,qSource);quickNotebook.processes=[{...task('quick-current',qItem),inputs:[]}];
 db.prepare('DELETE FROM reviewed_entities').run();db.prepare('UPDATE data_reviews SET source=?,payload=?,revision=1 WHERE id=?').run(JSON.stringify(qSource),JSON.stringify(qDraft),t.REVIEW_ID);db.prepare("UPDATE notebooks SET payload=?,revision=900 WHERE id='kitchen'").run(JSON.stringify(quickNotebook));
 const quickPreview=await json(await post({action:'preview',entityIds:['quick:'+qProcess.id]}));assert.equal(quickPreview.productionHandoff.processes.length,1);const qApproved=await json(await post({action:'approve',entityIds:['quick:'+qProcess.id],fingerprint:quickPreview.proposal.fingerprint,productionHandoff:quickPreview.productionHandoff,effective:'2026-09-20',reason:'Explicit current scope',evidence:'Synthetic estimate'}));await json(await post({action:'apply',approvalId:qApproved.approvalId}));
 const quickAfter=JSON.parse(current().payload);assert.deepEqual(quickAfter.processes,[]);assert.deepEqual(quickAfter.items,quickNotebook.items,'Quick does not invent a complete recipe');const records=db.prepare('SELECT payload FROM reviewed_entities').all().map(row=>JSON.parse(row.payload));assert(t.applied.appliedProductionItems(records).has(qItem.id),'Quick output-only evidence is still production authority');
 const illegal=structuredClone(quickAfter);illegal.processes=[{...task('parallel-quick-rewrite',qItem),inputs:[]}];await assert.rejects(()=>t.validateProductionEdit(quickAfter,illegal),/Reconcile it in Review/);
 const inactive=structuredClone(records);inactive[0].entity.answers['QUICK-01'].facts={products:[{itemId:qItem.id}],kind:'No longer used here'};assert.equal(t.applied.appliedProductionItems(inactive).has(qItem.id),false,'inactive scope is not an invented manufacturing authority');
 console.log('PASS Review production handoff: exact visible snapshots; preview/approve/apply stale guards; co-output and partial-scope retention; old-client safety; atomic archive/rollback/replay; unrelated work; source revision; real Quick handoff and server authority guard.');
}finally{if(h){h.db.close();await rm(path.dirname(h.bundle),{recursive:true,force:true});}await rm(directory,{recursive:true,force:true});}
