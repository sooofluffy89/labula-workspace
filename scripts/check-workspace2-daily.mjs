import assert from 'node:assert/strict';
import {harness} from './sync-harness.mjs';

// Synthetic SQLite and the real API/controller. No application or production data.
const NativeDate=Date;
let clock='2026-09-26T12:00:00.000Z';
const h=await harness();
globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return new NativeDate(clock).getTime();}};
const {m,db}=h;
try{
 db.function('strftime',(_format,value)=>value==='now'?clock:value);
 const load=async(morning=false)=>{const response=await m.api.GET(new Request(`http://test.local/api/evening?${morning?'morningDay='+h.targetDay:'day='+h.day}`));assert.equal(response.status,200);return response.json();};
 const post=async(command,status=200)=>{const response=await h.post(m.api,command),body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
 const confirm=snapshot=>h.command({kind:'confirm',checkId:h.day,revision:snapshot.check.revision,planRevision:snapshot.check.planRevision,notebookRevision:snapshot.notebookRevision});
 const notebook=JSON.parse(db.prepare("SELECT payload FROM notebooks WHERE id='kitchen'").get().payload);
 // Every house-made item has a recorded ingredient. This establishes absence
 // rather than relying on the conservative "composition unknown" scope.
 const part=itemId=>({itemId,amount:null,note:''});
 for(const item of notebook.items)if(item.kind==='prep')item.inputs=[part('item-79')];
 notebook.recipes=notebook.recipes.map((recipe,index)=>({...recipe,active:index<2,recorded:index<2,inputs:index===0?[part('item-0')]:index===1?notebook.items.slice(1).map(item=>part(item.id)):recipe.inputs}));
 const saveNotebook=value=>db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(value));
 saveNotebook(notebook);
 let snapshot=await load();
 assert.match(m.finishProblem(snapshot),/Unchecked|unchecked|check/i);
 await post(confirm(snapshot),409);
 assert.equal(db.prepare('SELECT count(*) n FROM evening_versions').get().n,0,'unchecked items cannot publish');
 const storage=h.storage(),client=new m.EveningController(h.owner.email,storage,{day:h.day},h.requester,false);
 await client.refresh();
 for(const answer of client.visibleCheck().answers)assert(client.answer(answer.itemId,['item-0','item-1'].includes(answer.itemId)?'missing':'have'));
 assert(await client.flush());
 snapshot=await load();assert.equal(m.finishProblem(snapshot),'');
 const publication=confirm(snapshot),first=await post(publication);
 const publishedVersion=db.prepare('SELECT payload FROM evening_versions WHERE check_id=? AND version=1').get(h.day).payload;
 assert.equal(JSON.parse(publishedVersion).planPolicyVersion,2);
 assert.equal((await load(true)).check.planPolicyVersion,2);
 assert.equal((await post(publication)).replayed,true,'exact retry after a lost acknowledgement is idempotent');
 assert.equal(db.prepare('SELECT count(*) n FROM evening_versions').get().n,1);
 assert.equal(first.publication.version,1);
 assert.deepEqual(first.plan.tasks.map(t=>t.itemId).sort(),['item-0','item-1']);
 await client.refresh({morningDay:h.targetDay});
 assert(client.toggleReady('item-1'));assert(await client.flush());
 const beforeMenu=await load(true),readyBefore=beforeMenu.check.tasks.find(t=>t.itemId==='item-1');
 const tasksBefore=db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all();
 // Disable the only dish containing item-0; future checks change, the published
 // shift retains its task, recorded instruction, Ready and authorship.
 clock='2026-09-26T13:00:00.000Z';
 const changed=structuredClone(notebook);changed.recipes[0].active=false;saveNotebook(changed);
 snapshot=await load(true);
 assert.equal(snapshot.check.planPolicyVersion,2);
 assert.equal(snapshot.check.tasks.some(t=>t.suspended),false);
 assert.equal(m.morningProgress({snapshot,pending:[]}).tasks.length,2);
 assert.deepEqual(db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all(),tasksBefore);
 assert.equal(db.prepare('SELECT payload FROM evening_versions WHERE check_id=? AND version=1').get(h.day).payload,publishedVersion);
 assert.equal(snapshot.planning.items.some(i=>i.itemId==='item-0'),false,'future scope sees the menu change');
 await client.refresh({morningDay:h.targetDay});
 assert(client.toggleReady('item-0'));assert(await client.flush());
 const localReady=client.visibleCheck().tasks.find(t=>t.itemId==='item-0');
 assert.equal(localReady.suspended,undefined,'fast-batch acknowledgement uses frozen publication policy');
 assert(client.toggleReady('item-0'));assert(await client.flush());
 assert.equal((await load(true)).check.tasks.find(t=>t.itemId==='item-0').ready,false,'Ready → Undo survives reload');
 // A stale Undo can never overwrite a newer cook's changes.
 snapshot=await load(true);const task=snapshot.check.tasks.find(t=>t.itemId==='item-0');
 const staleUndo=h.command({kind:'ready',checkId:h.day,itemId:task.itemId,revision:task.revision,value:true});
 globalThis.syncUser=h.cook;
 await post(h.command({kind:'ready',checkId:h.day,itemId:task.itemId,revision:task.revision,value:true}));
 await post(h.command({kind:'ready',checkId:h.day,itemId:task.itemId,revision:task.revision+1,value:false}));
 globalThis.syncUser=h.owner;await post(staleUndo,409);
 assert.equal((await load(true)).check.tasks.find(t=>t.itemId==='item-0').ready,false);
 // Incremental sync must not reinstate dynamic menu filtering.
 const cursor=(await load(true)).sync.cursor;
 snapshot=await load(true);const current=snapshot.check.tasks.find(t=>t.itemId==='item-0');
 await post(h.command({kind:'ready',checkId:h.day,itemId:current.itemId,revision:current.revision,value:true}));
 const deltaResponse=await m.sync.GET(new Request('http://test.local/api/evening/sync?morningDay='+h.targetDay+'&cursor='+encodeURIComponent(cursor)));
 assert.equal(deltaResponse.status,200);const delta=await deltaResponse.json();
 assert.equal(delta.tasks.find(t=>t.itemId==='item-0').suspended,undefined);
 // Menu removal becomes a visible explicit correction, never a read side effect.
 snapshot=await load();await post(h.command({kind:'correct',checkId:h.day,revision:snapshot.check.revision,planRevision:snapshot.check.planRevision}));
 snapshot=await load();assert.equal(snapshot.check.tasks.some(t=>t.suspended),false,'opening correction keeps current published work');
 assert.equal(snapshot.check.answers.find(a=>a.itemId==='item-0').suspended,true);
 assert.deepEqual(m.correctionDiff(snapshot.check).removed.map(t=>t.itemId),['item-0']);
 await post(confirm(snapshot));
 snapshot=await load(true);
 assert.equal(snapshot.check.version,2);
 assert.equal(snapshot.check.tasks.find(t=>t.itemId==='item-0').cancelled,true);
 assert.equal(snapshot.check.answers.find(a=>a.itemId==='item-0').suspended,true,'confirmed answer summary retains the published exclusion');
 assert.equal(snapshot.check.tasks.find(t=>t.itemId==='item-1').ready,true);
 assert.equal(snapshot.check.tasks.find(t=>t.itemId==='item-1').revision,readyBefore.revision);
 assert.equal(db.prepare("SELECT count(*) n FROM kitchen_activity WHERE category='morning' AND action='cancelled' AND item_id='item-0'").get().n,1,'explicit removal has one historical event');
 assert.equal(db.prepare('SELECT payload FROM evening_versions WHERE check_id=? AND version=1').get(h.day).payload,publishedVersion);
 saveNotebook(notebook);snapshot=await load(true);
 assert.equal(snapshot.check.answers.find(a=>a.itemId==='item-0').suspended,true,'restoring menu does not rewrite the confirmed answer summary');
 assert.equal(snapshot.check.tasks.find(t=>t.itemId==='item-0').cancelled,true,'restoring menu does not resurrect cancelled published work');
 // Legacy policy is preserved until deliberate correction; migration is not a
 // silent resurrection of historically paused tasks.
 db.prepare('UPDATE evening_checks SET plan_policy_version=1 WHERE id=?').run(h.day);
 const legacyBefore=db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all();
 const allOff=structuredClone(changed);allOff.recipes=allOff.recipes.map(recipe=>({...recipe,active:false}));saveNotebook(allOff);
 snapshot=await load(true);assert.equal(snapshot.check.tasks.find(t=>t.itemId==='item-1').suspended,true);
 assert.deepEqual(db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all(),legacyBefore);
 snapshot=await load();await post(h.command({kind:'correct',checkId:h.day,revision:snapshot.check.revision,planRevision:snapshot.check.planRevision}));
 snapshot=await load();assert.deepEqual(m.correctionDiff(snapshot.check).removed.map(t=>t.itemId),['item-1']);
 await post(confirm(snapshot));snapshot=await load(true);
 assert.equal(snapshot.check.planPolicyVersion,2);
 assert.equal(m.morningProgress({snapshot,pending:[]}).tasks.length,0,'an explicitly published zero-task plan is valid');
 client.dispose();
 console.log('PASS Workspace 2.0 daily: Unchecked guard, versioned frozen publication, exact retry, full/batch/delta agreement, Ready/Undo, stale peer revision, explicit menu-removal diff/activity, unchanged Ready/history, legacy policy preservation and zero-task publication.');
}finally{db.close();globalThis.Date=NativeDate;delete globalThis.syncDb;delete globalThis.syncUser;}
