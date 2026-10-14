import assert from 'node:assert/strict';
import {harness} from './sync-harness.mjs';
const h=await harness();
try{
 const before={};for(const table of ['notebooks','stock_items','check_rounds','evening_answers','morning_tasks'])before[table]=JSON.stringify(h.db.prepare('SELECT * FROM '+table).all());
 const initial=await h.requester('/api/prep-instructions');assert.equal(initial.res.status,200);assert.deepEqual(initial.body.instructions,[]);assert(!('comments'in initial.body));
 const c=new h.m.PrepNotesController(h.owner.email,h.storage(),h.requester);assert(await c.initialize());
 for(const itemId of ['item-0','item-1']){assert(c.enqueue({kind:'instruction',itemId,revision:0,text:'Prepare 兩盤\nTop up to <b>2</b> — synthetic'}));assert(await c.flush());}
 const index=await h.requester('/api/prep-instructions');assert.equal(index.body.instructions.length,2);assert.equal(h.m.matchesInstruction('item-0','with',index.body.instructions),true);assert.equal(h.m.matchesInstruction('item-2','without',null),false);assert.equal(h.m.matchesInstruction('item-2','without',index.body.instructions),true);
 c.saveDraft('instruction.item-2','Unsent draft',0);assert.equal(h.m.matchesInstruction('item-2','without',index.body.instructions),true);
 for(const table of Object.keys(before))assert.equal(JSON.stringify(h.db.prepare('SELECT * FROM '+table).all()),before[table],table+' changed during instruction save');
 // A lost response retries precisely the existing operation; no second version.
 let lost=true;const store=h.storage(),uncertain=new h.m.PrepNotesController(h.owner.email,store,async(url,init)=>{const r=await h.requester(url,init);if(init?.method==='POST'&&lost){lost=false;throw Error('Lost ACK');}return r;});await uncertain.initialize();assert(uncertain.enqueue({kind:'instruction',itemId:'item-0',revision:1,text:''}));assert.equal(await uncertain.flush(),false);assert(uncertain.state.pending.length);assert(await uncertain.flush());assert.equal(h.db.prepare("SELECT count(*) n FROM prep_instruction_versions WHERE item_id='item-0'").get().n,2);assert.equal(h.m.matchesInstruction('item-0','without',(await h.requester('/api/prep-instructions')).body.instructions),true);
 // Stale editor cannot overwrite acknowledged text.
 assert(c.enqueue({kind:'instruction',itemId:'item-0',revision:1,text:'stale'}));assert.equal(await c.flush(),false);assert(c.state.pending[0].rejected);assert.equal(h.db.prepare("SELECT text FROM prep_instructions WHERE item_id='item-0'").get().text,'');
 const rounds=(await h.requester('/api/check-rounds')).body;const move=await h.post(h.m.rounds,{kind:'members',id:crypto.randomUUID(),actorId:h.owner.userId,revision:rounds.revision,roundId:'weekly',itemIds:['item-1']});assert.equal(move.status,200);assert.equal(h.db.prepare("SELECT revision FROM prep_instructions WHERE item_id='item-1'").get().revision,1);assert(c.draft('instruction.item-2'));
 // Storage failure retains the exact text and refuses leaving until recovery works.
 const failed=h.storage(),set=failed.setItem;const d=new h.m.PrepNotesController(h.owner.email,failed,h.requester);await d.initialize();failed.setItem=()=>{throw Error('Disk full');};assert.throws(()=>d.saveDraft('instruction.item-5','Unlost',7));assert.equal(d.keepDrafts(),false);assert.equal(d.draft('instruction.item-5').text,'Unlost');failed.setItem=set;assert(d.keepDrafts());assert.equal(d.state.unsafeDrafts,0);assert.equal(d.draft('instruction.item-5').revision,7);
 const prefs=h.storage(),key=h.m.roundViewKey('owner','daily'),v=h.m.initialRoundView();assert.equal(v.filters.current,'this');v.filters.search='synthetic';v.filters.menu=['Starters','Main Dishes'];v.instruction='without';v.scroll=400;h.m.keepRoundView(key,v,prefs);assert.deepEqual(h.m.readRoundView(key,prefs),v);assert.equal(h.m.readRoundView(h.m.roundViewKey('cook','daily'),prefs).filters.search,'');
 globalThis.syncUser=h.cook;assert.equal((await h.requester('/api/prep-instructions')).res.status,403);
 h.db.prepare("UPDATE kitchen_team SET access_role='legacy' WHERE id='cook'").run();assert.equal((await h.requester('/api/prep-instructions')).res.status,403);
 for(const x of [c,d,uncertain])x.dispose();console.log('PASS Edit items: real bulk route, owner/Cook/legacy gates, independent saves, literal text/clear, confirmed-only filtering, stale CAS, lost ACK replay, draft storage failure, membership independence and scoped view recovery.');
}finally{h.db.close();}
