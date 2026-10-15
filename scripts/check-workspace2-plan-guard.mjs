import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {harness} from './sync-harness.mjs';

const NativeDate=Date,directory=await mkdtemp(join(tmpdir(),'workspace-plan-guard-'));
let clock='2026-09-26T12:00:00.000Z',h;
try{
 h=await harness();const {db,m}=h;
 globalThis.Date=class extends NativeDate{constructor(...args){super(...(args.length?args:[clock]));}static now(){return new NativeDate(clock).getTime();}};
 db.function('strftime',(_format,value)=>value==='now'?clock:value);
 await writeFile(join(directory,'db.ts'),`import {accessContext,guardDatabase} from '@/lib/access-context';export const getRawDb=()=>{const context=accessContext.getStore();return context?guardDatabase(globalThis.syncDb,context):globalThis.syncDb;};export const getAppAccessMode=()=> 'application';`);
 await build({stdin:{contents:"export * as notebook from './app/api/notebook/route';export * as menu from './app/api/menu/route';export * as preview from './app/api/menu/preview/route';export * as catalog from './app/api/catalog/route';export {menuFingerprint} from './lib/production';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:join(directory,'test.mjs'),alias:{'@/lib/access-context':join(process.cwd(),'lib/access-context.ts'),'@/db':join(directory,'db.ts'),'@/app/chatgpt-auth':join(dirname(h.bundle),'auth.ts')},define:{'import.meta.env.DEV':'false'},logLevel:'silent'});
 const api=await import(join(directory,'test.mjs'));
 const part=itemId=>({itemId,amount:null,note:''});
 const notebook=JSON.parse(db.prepare("SELECT payload FROM notebooks WHERE id='kitchen'").get().payload);
 for(const item of notebook.items)if(item.kind==='prep')item.inputs=[part(item.id==='item-0'?'item-1':'item-3')];
 notebook.recipes.forEach((recipe,index)=>{recipe.active=index===0;recipe.recorded=index===0;if(!index)recipe.inputs=[part('item-0')];});
 db.prepare("UPDATE notebooks SET payload=?,revision=revision+1 WHERE id='kitchen'").run(JSON.stringify(notebook));
 const json=async(response,status=200,code)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));if(code)assert.equal(body.code,code);return body;};
 const load=async()=>json(await m.api.GET(new Request('http://test.local/api/evening?day='+h.day)));
 const confirm=snapshot=>h.command({kind:'confirm',checkId:h.day,revision:snapshot.check.revision,planRevision:snapshot.check.planRevision,notebookRevision:snapshot.notebookRevision});
 const client=new m.EveningController(h.owner.email,h.storage(),{day:h.day},h.requester,false);
 await client.refresh();for(const answer of client.visibleCheck().answers)if(!answer.suspended)assert(client.answer(answer.itemId,'missing'));assert(await client.flush());
 let snapshot=await load();await json(await h.post(m.api,confirm(snapshot)));
 assert.deepEqual((await load()).check.tasks.filter(task=>!task.cancelled).map(task=>task.itemId),['item-0','item-1']);
 // Reproduce a retained legacy publication. Only an explicit correction may
 // adopt the frozen policy; a new menu writer cannot silently alter its work.
 db.prepare('UPDATE evening_checks SET plan_policy_version=1 WHERE id=?').run(h.day);
 const before=db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'").get(),tasks=db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all();
 const off=structuredClone(notebook);off.recipes.forEach(recipe=>recipe.active=false);
 const request=(path,method,body,revision=before.revision,extra={})=>new Request('http://test.local/api/'+path,{method,headers:{Origin:'http://test.local','Content-Type':'application/json','If-Match':String(revision),'X-Labula-Workspace-Version':'2',...extra},body:JSON.stringify(body)});
 const ordinary=()=>api.notebook.PUT(request('notebook','PUT',off));
 const saveId=crypto.randomUUID(),receipt=()=>api.notebook.PUT(request('notebook','PUT',off,before.revision,{'X-Operation-Id':saveId}));
 const preview=await json(await api.preview.POST(request('menu/preview','POST',{recipeIds:[]})));
 assert.match(preview.legacyPlanBlock,/27 Sept? 2026/);assert.match(preview.legacyPlanBlock,/Correct check/);
 await json(await ordinary(),409,'legacy_plan_scope');await json(await receipt(),409,'legacy_plan_scope');
 const menu=await json(await api.menu.GET(new Request('http://test.local/api/menu')));
 const composition={operationId:crypto.randomUUID(),itemId:'item-0',baseToken:menu.items.find(item=>item.id==='item-0').composition.token,inputs:[part('item-3')],method:'New recipe',yieldAmount:null,reference:'Synthetic recipe decision',confirmed:true};
 await json(await api.menu.PUT(request('menu','PUT',composition)),409,'legacy_plan_scope');
 const scenario={operationId:crypto.randomUUID(),operation:{kind:'apply-menu',fingerprint:api.menuFingerprint(notebook),recipeIds:[],changes:[]}};
 await json(await api.catalog.POST(request('catalog','POST',scenario)),409,'legacy_plan_scope');
 assert.deepEqual(db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'").get(),before);
 assert.deepEqual(db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all(),tasks);
 for(const id of [saveId,composition.operationId,scenario.operationId])assert.equal(db.prepare('SELECT count(*) n FROM notebook_commands WHERE id=? UNION ALL SELECT count(*) n FROM catalog_operations WHERE id=?').all(id,id).reduce((total,row)=>total+row.n,0),0,'A blocked change never leaves a receipt');
 // Descriptive edits remain possible even while a legacy plan needs adoption.
 const notes=structuredClone(notebook);notes.recipes[0].notes='An unrelated instruction note';
 await json(await api.notebook.PUT(request('notebook','PUT',notes)));
 db.prepare("UPDATE notebooks SET payload=?,revision=? WHERE id='kitchen'").run(before.payload,before.revision);
 // The SQL predicate, not just a pre-read, stops a concurrent legacy plan.
 db.prepare('UPDATE evening_checks SET plan_policy_version=2 WHERE id=?').run(h.day);
 let armed=true;h.fail(sql=>{if(armed&&sql.startsWith('INSERT INTO notebook_commands')){armed=false;db.prepare('UPDATE evening_checks SET plan_policy_version=1 WHERE id=?').run(h.day);}return false;});
 await json(await receipt(),409,'legacy_plan_scope');assert.equal(armed,false);
 assert.deepEqual(db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'").get(),before);
 assert.equal(db.prepare('SELECT count(*) n FROM notebook_commands WHERE id=?').get(saveId).n,0);
 // The old client remains compatible before the explicit min-version cutover.
 await json(await api.notebook.PUT(request('notebook','PUT',off,before.revision,{'X-Labula-Workspace-Version':'1'})));
 assert.equal((await load()).check.tasks.every(task=>task.suspended),true);
 db.prepare("UPDATE notebooks SET payload=?,revision=? WHERE id='kitchen'").run(before.payload,before.revision);
 // Historical legacy plans are not rewritten or unnecessarily blocked.
 clock='2026-09-28T12:00:00.000Z';await json(await ordinary());
 assert.deepEqual(db.prepare('SELECT * FROM morning_tasks ORDER BY item_id').all(),tasks);
 db.prepare("UPDATE notebooks SET payload=?,revision=? WHERE id='kitchen'").run(before.payload,before.revision);clock='2026-09-26T12:00:00.000Z';
 // Deliberate Correct → Finish adopts policy 2, after which menu changes are
 // safe and the existing shift remains exactly the published task roster.
 snapshot=await load();await json(await h.post(m.api,h.command({kind:'correct',checkId:h.day,revision:snapshot.check.revision,planRevision:snapshot.check.planRevision})));
 snapshot=await load();await json(await h.post(m.api,confirm(snapshot)));assert.equal((await load()).check.planPolicyVersion,2);
 await json(await receipt());assert.equal((await load()).check.tasks.some(task=>task.suspended),false);
 assert.deepEqual((await load()).check.tasks.filter(task=>!task.cancelled).map(task=>task.itemId),['item-0','item-1']);
 client.dispose();
 console.log('PASS legacy-plan scope guard: real Menu/ordinary notebook/receipt/catalog APIs, dated preview, no receipt or task mutations, unrelated edits, atomic concurrent-publication barrier, pre-cutover legacy client, historical plans, explicit correction adoption and safe frozen plan.');
}finally{globalThis.Date=NativeDate;if(h){h.db.close();await rm(dirname(h.bundle),{recursive:true,force:true});}await rm(directory,{recursive:true,force:true});delete globalThis.syncDb;delete globalThis.syncUser;}
