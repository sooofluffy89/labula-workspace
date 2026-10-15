import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/labula-ux-behavior-');
try{
 await build({stdin:{contents:"export * from './lib/workspace-navigation';export * from './lib/recipe-undo';export * from './lib/ux-controls';export {prepFieldIssues,emptyProfile,newStorageSetup} from './lib/prep-profile';export {initialNotebook,newItem} from './lib/notebook';export {defaultCalendar} from './lib/operating-calendar';export {blockingStepGaps,quickStepFor} from './lib/quick-review/ux';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',logLevel:'silent'});
 const m=await import(dir+'/test.mjs');
 // URL preferences round-trip without consuming the detail stack or unrelated parameters.
 const base=new URL('https://example.test/?source=bookmark#info=ingredient:garlic');
 const route={view:'recipes',dish:'m2',variant:'m2-v3'};
 const href=m.workspaceUrl(base,route);assert.equal(href.hash,base.hash);assert.equal(href.searchParams.get('source'),'bookmark');assert.deepEqual(m.readWorkspaceRoute(href),route);
 assert.equal(m.readWorkspaceRoute(new URL('https://example.test/?view=invalid')).view,'insights');
 assert.equal(m.readWorkspaceRoute(new URL('https://example.test/'),'evening').view,'evening');
 assert.equal(m.readWorkspaceRoute(new URL('https://example.test/?view=operations#ops=history&check=2026-10-14')).view,'operations');
 assert.equal(m.readWorkspaceRoute(new URL('https://example.test/?view=morning&day=2026-02-30')).day,undefined);
 const daily={view:'morning',day:'2026-10-15'};assert.deepEqual(m.readWorkspaceRoute(m.workspaceUrl(base,daily)),daily);
 const catalog={view:'catalog',query:'蒜 / chilli & coriander',kind:'review',scope:'all'};assert.deepEqual(m.readWorkspaceRoute(m.workspaceUrl(href,catalog)),catalog);
 assert.equal(m.workspaceUrl(new URL('https://example.test/#ops=history&check=old'),route).hash,'');
 assert(m.sameWorkspaceRoute({view:'catalog'},{view:'catalog',query:'',kind:'all'}));
 // Undo is an inverse patch; it must never restore an obsolete recipe snapshot.
 const n=m.initialNotebook(),a=m.newItem('Sauce'),b=m.newItem('Tofu'),c=m.newItem('Coriander');n.items=[a,b,c];n.recipes[0]={...n.recipes[0],recorded:true,ingredientsReviewed:true,reviewStatus:'verified',inputs:[{itemId:a.id,amount:10,note:'original'},{itemId:b.id,amount:null,note:''}]};
 const removed=m.removeRecipeInput(n,n.recipes[0].id,a.id);assert(removed.ticket);assert(!removed.notebook.recipes[0].recorded);assert.equal(removed.notebook.recipes[0].ingredientsReviewed,false);
 assert.deepEqual(m.restoreRecipeInput(removed.notebook,removed.ticket).notebook,n);
 const newer=structuredClone(removed.notebook);newer.recipes[0].notes='Newer colleague note';newer.recipes[0].inputs.push({itemId:c.id,amount:null,note:'new'});
 const restored=m.restoreRecipeInput(newer,removed.ticket);assert(restored.restored);assert.equal(restored.notebook.recipes[0].notes,'Newer colleague note');assert.equal(restored.notebook.recipes[0].inputs.length,3);assert.equal(restored.notebook.recipes[0].recorded,false);assert.equal(restored.notebook.recipes[0].ingredientsReviewed,false);
 assert.equal(m.restoreRecipeInput(restored.notebook,removed.ticket).restored,false);const deleted=structuredClone(newer);deleted.items=deleted.items.filter(i=>i.id!==a.id);assert.equal(m.restoreRecipeInput(deleted,removed.ticket).restored,false);
 // Mixed and unassigned are different states; opening a bulk editor is not a change.
 assert.equal(m.commonStation([{stationId:'station-1'},{stationId:'station-1'}]),'station-1');assert.equal(m.commonStation([{stationId:null},{stationId:null}]),null);assert.equal(m.commonStation([{stationId:'station-1'},{stationId:'station-2'}]),undefined);
 // Calendar review covers changed values, removed exceptions, notes and cutoff day.
 const before=m.defaultCalendar(),after=structuredClone(before);before.exceptions=[{day:'2026-11-01',open:false,note:'old'}];before.deadlineExceptions=[{day:'2026-11-02',evening:'23:00',eveningOffset:0,morning:'09:00'}];after.deadlines[2].morning='09:30';after.deadlines[2].eveningOffset=1;
 const diff=m.calendarChanges(before,after).join('\n');assert.match(diff,/Tuesday morning deadline: Unset → 09:30/);assert.match(diff,/evening cutoff day: Same calendar day → Next calendar day/);assert.match(diff,/Opening exception 2026-11-01: Closed · old → Removed/);assert.match(diff,/Deadline exception 2026-11-02:.*09:00.*Removed/);assert.deepEqual(m.calendarChanges(after,structuredClone(after)),[]);
 // Local validation points to the offending field; unknown is a valid answer.
 const p=m.emptyProfile(),setup=m.newStorageSetup();setup.quality.value=2;p.storage=[setup];let issues=m.prepFieldIssues(p);assert.deepEqual(issues[0].path,['storage',0,'quality','start']);setup.quality.start='unknown';assert.equal(m.prepFieldIssues(p).length,0);setup.quality.value=-1;assert.deepEqual(m.prepFieldIssues(p)[0].path,['storage',0,'quality','value']);
 const gaps=[{topic:'scope',message:'scope',unknown:false},{topic:'output:one',message:'output',unknown:false},{topic:'work',message:'measurement',unknown:true},{topic:'limits',message:'limit',unknown:false}];
 assert.deepEqual(m.blockingStepGaps(gaps,1),[gaps[1]]);assert.equal(m.quickStepFor('limits'),2);assert.equal(m.quickStepFor('scope'),0);
 console.log('PASS UX behavior: URL round-trips and detail compatibility; inverse Undo preserves later edits; explicit mixed station state; complete calendar diff; precise validation paths; step validation accepts unknowns.');
}finally{await rm(dir,{recursive:true,force:true});}
