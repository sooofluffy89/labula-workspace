import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/workspace2-navigation-');
try{
 await build({stdin:{contents:"export * from './lib/workspace-navigation';export * from './lib/workspace-device-draft';export {makeNotebookDraft} from './lib/notebook-draft';export {initialNotebook} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',logLevel:'silent'});
 const m=await import(dir+'/test.mjs');
 const base=new URL('https://kitchen.test/?source=bookmark#info=ingredient:existing');
 const nested={view:'recipes',dish:'dish:one',variant:'variant one',item:'garlic',itemPath:['sauce','paste'],query:'chilli & garlic',scope:'all',kind:'prep'};
 const next=m.workspaceUrl(base,nested);
 assert.deepEqual(m.readWorkspaceRoute(next),nested);assert.equal(next.hash,base.hash);assert.equal(next.searchParams.get('source'),'bookmark');
 assert.equal(m.sameWorkspaceRoute(nested,{...nested,itemPath:['sauce','other']}),false);
 assert.deepEqual(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=manage')),{view:'catalog',scope:'all',checkedOnly:true});
 assert.equal(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=insights')).view,'morning');
 assert.equal(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=overview')).view,'recipes');
 assert.equal(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=operations#ops=history&check=2026-10-15')).view,'history');
 assert.equal(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=unknown')).view,'morning');
 assert.equal(m.readWorkspaceRoute(new URL('https://kitchen.test/?view=morning&day=2026-02-30')).day,undefined);
 const daily=m.workspaceUrl(next,{view:'evening',day:'2026-10-14'});assert.equal(daily.searchParams.get('item'),null);assert.equal(daily.searchParams.get('trail'),null);assert.equal(daily.searchParams.get('day'),'2026-10-14');
 assert.deepEqual(['morning','evening','history'].map(m.workspaceArea),['today','today','today']);
 assert.deepEqual(['recipes','catalog'].map(m.workspaceArea),['menu','menu']);
 assert.deepEqual(['data','team','calendar'].map(m.workspaceArea),['settings','settings','settings']);
 // Durable notebook copies remain account-bound, separate per tab, and include exact uncertain receipts.
 const n=m.initialNotebook(),payload=JSON.stringify(n),account='chef@example.test';
 const draft=m.makeNotebookDraft(n,{revision:5,notebook:n},account,[],{id:'00000000-0000-4000-8000-000000000001',revision:5,payload,localPayload:payload},null,null);
 const data=new Map(),storage={get length(){return data.size},key:i=>[...data.keys()][i]??null,getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
 data.set(m.workspaceDraftPrefix(account)+'tab-a',JSON.stringify(draft));data.set(m.workspaceDraftPrefix(account)+'tab-b',JSON.stringify(draft));
 data.set(m.workspaceDraftPrefix('other@example.test')+'tab-a',JSON.stringify({...draft,actorEmail:'other@example.test'}));
 let copies=m.readDeviceNotebookDrafts(storage,account);assert.equal(copies.length,2);assert.equal(copies[0].draft.recovery.receipt.id,draft.recovery.receipt.id);assert.equal(copies[0].draft.recovery.receipt.payload,payload);
 data.delete(m.workspaceDraftPrefix(account)+'tab-a');assert.equal(m.readDeviceNotebookDrafts(storage,account).length,1);
 data.set(m.workspaceDraftPrefix(account)+'mismatch',JSON.stringify({...draft,actorEmail:'other@example.test'}));assert.throws(()=>m.readDeviceNotebookDrafts(storage,account),/does not match/);assert(data.has(m.workspaceDraftPrefix(account)+'mismatch'));
 data.set(m.workspaceDraftPrefix(account)+'malformed','{broken');
 let scanned=await m.readReviewedDeviceNotebookDrafts(storage,account);assert.equal(scanned.issues.length,2);assert.equal(scanned.drafts.length,1,'a damaged copy cannot disable independent good copies');
 const reviewed=scanned.drafts[0],originalRaw=reviewed.raw;
 await m.acknowledgeDeviceNotebookDraft(storage,reviewed);
 assert.equal(data.get(reviewed.key),originalRaw,'review never deletes another tab source');
 assert.equal((await m.readReviewedDeviceNotebookDrafts(storage,account)).drafts[0].reviewed,true);
 const newerRaw=JSON.stringify({...draft,exportedAt:'2026-10-16T10:00:00.000Z'});data.set(reviewed.key,newerRaw);
 await m.acknowledgeDeviceNotebookDraft(storage,reviewed); // tab B finishes reviewing an older snapshot after tab A edits.
 scanned=await m.readReviewedDeviceNotebookDrafts(storage,account);assert.equal(scanned.drafts[0].reviewed,false);assert.equal(data.get(reviewed.key),newerRaw,'later edits survive stale review');
 console.log('PASS Workspace 2.0 navigation and recovery: nested URL context, legacy mappings, one area, exact account-bound receipts, independent tab copies, malformed-copy isolation and non-destructive concurrent review.');
}finally{await rm(dir,{recursive:true,force:true});}
