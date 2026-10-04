import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
const dir=await mkdtemp(tmpdir()+'/labula-access-client-');
const originalFetch=globalThis.fetch,originalWindow=globalThis.window,originalCustomEvent=globalThis.CustomEvent;
const values=new Map(),storage={get length(){return values.size},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
const events=new EventTarget();globalThis.window=events;window.localStorage=storage;
if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,options){super(type);this.detail=options?.detail;}};
let eventsLost=0;events.addEventListener('labula:access-lost',()=>eventsLost++);
const controllers=[],failures=[];let cases=0;
const test=async(name,run)=>{cases++;try{await run();console.log('PASS '+name);}catch(e){failures.push(name+': '+e.message);console.error('FAIL '+name+': '+e.message);}};
const settle=()=>new Promise(resolve=>setTimeout(resolve,10));
const response=(body={},status=200,id='account-a')=>Response.json(body,{status,headers:id?{'X-Labula-Account-Id':id}:{}});
const snapshot=(id='account-a',email='a@example.test')=>({scope:'kitchen',accountId:id,account:email,notebookRevision:0,trackedCount:1,catalog:[{id:'item-a',name:'Synthetic prep',kind:'prep'}],checks:[],check:{id:'2026-10-04',targetDay:'2026-10-05',stage:'draft',revision:1,planRevision:0,version:0,confirmedAt:null,confirmedBy:null,grouped:false,answers:[{itemId:'item-a',catalogId:'item-a',name:'Synthetic prep',kind:'prep',position:0,value:'missing',revision:1,updatedAt:'synthetic',updatedBy:'Synthetic cook',firstActor:id,firstDevice:null,firstSequence:null,supersededBy:null,mappingValid:true,currentName:'Synthetic prep',groupId:null}],tasks:[]}});
try{
 await build({stdin:{contents:"export * from './lib/access-client';export * from './lib/request-json';export * from './lib/team-client';export * from './lib/evening-client';export * from './lib/prep-notes-client';export * from './lib/finish-intent';export * from './lib/finish-journal';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',logLevel:'silent'});
 const m=await import(dir+'/test.mjs');
 await test('expected stable account header and requestJson station compatibility',async()=>{
  m.configureClientAccess('account-a');let seen;
  globalThis.fetch=async(url,init)=>{seen={url,headers:new Headers(init.headers)};return response({ok:true});};
  await m.requestJson('/api/evening?day=2026-10-04',{headers:{'X-Test':'kept','X-Labula-Account-Id':'forged'}});
  assert.equal(seen.headers.get('X-Labula-Account-Id'),'account-a');assert.equal(seen.headers.get('X-Labula-Stations'),'4');assert.equal(seen.headers.get('X-Test'),'kept');
 });
 await test('all membership 403 codes latch access loss and stop further HTTP',async()=>{
  for(const code of ['access_not_granted','access_revoked','access_not_linked','role_restricted','account_changed','identity_conflict']){
   m.configureClientAccess('account-a');let sent=0;globalThis.fetch=async()=>{sent++;return response({code,error:'Synthetic access lost'},403);};
   assert.equal((await m.accessFetch('/api/notebook')).status,403);await assert.rejects(m.accessFetch('/api/evening'),m.AccessLostError);assert.equal(sent,1,code);assert.equal(storage.getItem('labula.access-blocked.v1.account-a'),'1');m.configureClientAccess('account-a');assert.equal(storage.getItem('labula.access-blocked.v1.account-a'),'1','configuration must preserve review marker');
  }
 });
 await test('401 latches; ordinary domain conflict does not revoke membership',async()=>{
  m.configureClientAccess('account-a');let sent=0;globalThis.fetch=async()=>{sent++;return response({error:'Domain permission'},403);};
  await m.accessFetch('/api/prep-notes');await m.accessFetch('/api/prep-notes');assert.equal(sent,2);
  globalThis.fetch=async()=>response({error:'Sign in'},401);await m.accessFetch('/api/evening');await assert.rejects(m.accessFetch('/api/evening'),m.AccessLostError);
 });
 await test('response for a changed server account is refused before application state',async()=>{
  m.configureClientAccess('account-a');globalThis.fetch=async()=>response({private:'other account'},200,'account-b');await assert.rejects(m.accessFetch('/api/evening'),m.AccessLostError);await assert.rejects(m.accessFetch('/api/evening'),m.AccessLostError);
 });
 await test('late successful response from old account is ignored after account switch',async()=>{
  m.configureClientAccess('account-a');let release;globalThis.fetch=()=>new Promise(resolve=>release=resolve);
  const old=m.accessFetch('/api/evening');const oldResult=assert.rejects(old,m.AccessLostError);m.configureClientAccess('account-b');const before=eventsLost;release(response({private:'old account'}));await oldResult;assert.equal(eventsLost,before);
  globalThis.fetch=async()=>response({ok:true},200,'account-b');assert.equal((await m.accessFetch('/api/evening')).status,200);
 });
 await test('late rejected response from old account cannot revoke the new account',async()=>{
  m.configureClientAccess('account-a');let release;globalThis.fetch=()=>new Promise(resolve=>release=resolve);
  const old=m.accessFetch('/api/evening');const oldResult=assert.rejects(old,m.AccessLostError);m.configureClientAccess('account-b');const before=eventsLost;release(response({code:'access_revoked'},403));await oldResult;assert.equal(eventsLost,before);
  globalThis.fetch=async()=>response({},200,'account-b');assert.equal((await m.accessFetch('/api/evening')).status,200);
 });
 await test('account switch during denied body parsing cannot revoke new account',async()=>{
  m.configureClientAccess('account-a');let release,parsing=false;
  globalThis.fetch=async()=>({status:403,headers:new Headers({'X-Labula-Account-Id':'account-a'}),clone:()=>({json:()=>{parsing=true;return new Promise(resolve=>release=resolve);}})});
  const old=m.accessFetch('/api/evening'),oldResult=assert.rejects(old,m.AccessLostError);await settle();assert(parsing);m.configureClientAccess('account-b');const before=eventsLost;release({code:'access_revoked',error:'Old account denied'});await oldResult;assert.equal(eventsLost,before);
  globalThis.fetch=async()=>response({},200,'account-b');assert.equal((await m.accessFetch('/api/evening')).status,200);
 });
 await test('Team original outbox preserved across revocation, retry and account switch',async()=>{
  values.clear();m.configureClientAccess('account-a');let sent=0;
  const directory={accountId:'account-a',email:'a@example.test',canManage:true,isOwner:false,members:[],accessMode:'application'};
  globalThis.fetch=async(url,init)=>{sent++;return init?.method?response({code:'access_revoked',error:'Access lost'},403):response(directory);};
  const c=new m.TeamController('a@example.test',storage,()=>{});controllers.push(c);await c.refresh();const command={id:crypto.randomUUID(),kind:'add',email:'new@example.test',name:''};assert.equal(await c.save(command),false);
  const key=c.state.pending[0].key,original=storage.getItem(key),count=sent;assert(original);assert.equal(await c.save(command,key),false);assert.equal(sent,count);assert.equal(storage.getItem(key),original);
  m.configureClientAccess('account-b');globalThis.fetch=async()=>{sent++;return response({...directory,accountId:'account-b',email:'b@example.test'},200,'account-b');};assert.equal(await c.save(command,key),false);assert.match(c.state.error,/account changed/i);assert.equal(storage.getItem(key),original);c.dispose();
 });
 await test('Evening accepted answer and feedback draft/outbox preserved without more HTTP',async()=>{
  values.clear();m.configureClientAccess('account-a');let sent=0;
  globalThis.fetch=async(url,init)=>{sent++;if(init?.method)return response({code:'access_revoked',error:'Access lost'},403);return response(url.startsWith('/api/prep-notes')?{account:'a@example.test',accountId:'account-a',supported:1,canEdit:false,comments:[],versions:[],next:null}:snapshot());};
  const c=new m.EveningController('a@example.test',storage,{day:'2026-10-04'},undefined,false),notes=new m.PrepNotesController('a@example.test',storage);controllers.push(c,notes);await c.refresh();await notes.initialize();notes.saveDraft('synthetic-context','Unsent feedback',0);
  assert(c.answer('item-a','have'));await settle();assert.equal(c.state.pending.length,1);assert.equal(c.state.unauthorized,true);const pending=c.state.pending[0],key='labula-evening-v1:account-a:kitchen:'+pending.command.id,original=storage.getItem(key),count=sent;
  assert(original);assert.equal(await c.retry(),false);assert.equal(await notes.initialize(),false);assert.equal(sent,count);assert.equal(storage.getItem(key),original);assert.equal(JSON.parse(storage.getItem('labula.prep-notes.v1.account-a.draft.synthetic-context')).text,'Unsent feedback');c.dispose();notes.dispose();
 });
 await test('feedback accepted command survives revoked write and cannot cross account',async()=>{
  values.clear();m.configureClientAccess('account-a');let posts=0;
  globalThis.fetch=async(url,init)=>{if(init?.method){posts++;return response({code:'access_revoked',error:'Access lost'},403);}return response({account:'a@example.test',accountId:'account-a',supported:1,canEdit:false,comments:[],versions:[],next:null});};
  const c=new m.PrepNotesController('a@example.test',storage);controllers.push(c);assert(await c.initialize());assert(c.enqueue({kind:'feedback',context:{checkId:'2026-10-04',itemId:'item-a',catalogId:'item-a',version:0,instructionRevision:null,phase:'evening'},text:'Accepted feedback'}));await settle();assert.equal(c.state.pending.length,1);const command=c.state.pending[0].command,key='labula.prep-notes.v1.account-a.pending.'+command.id,original=storage.getItem(key);assert(original);assert.equal(await c.flush(),false);assert.equal(posts,1);
  m.configureClientAccess('account-b');globalThis.fetch=async()=>response({account:'b@example.test',accountId:'account-b',supported:1,canEdit:false,comments:[],versions:[],next:null},200,'account-b');assert.equal(await c.initialize(),false);assert.equal(storage.getItem(key),original);assert.equal(posts,1);c.dispose();
 });
 await test('restored original account rechecks access and does not auto-submit old Finish',async()=>{
  values.clear();m.configureClientAccess('account-a');const approved=snapshot(),id=crypto.randomUUID(),f={protocol:1,id,accountId:'account-a',account:'a@example.test',checkId:approved.check.id,targetDay:approved.check.targetDay,generation:0,createdAt:new Date().toISOString(),approved,fingerprint:m.finishFingerprint(approved),dependencies:[],phase:'offline'};
  storage.setItem(m.finishJournalPrefix('account-a')+id,JSON.stringify(f));storage.setItem('labula.access-blocked.v1.account-a','1');let reads=0,posts=0;
  globalThis.fetch=async(url,init)=>{if(init?.method){posts++;return response({code:'access_revoked'},403);}reads++;return response(approved);};
  const c=new m.EveningController('a@example.test',storage,{day:approved.check.id},undefined,false);controllers.push(c);assert(await c.refresh());await settle();assert(reads>=1);assert.equal(posts,0);assert.equal(c.state.finish?.phase,'attention');assert(storage.getItem(m.finishJournalPrefix('account-a')+id));assert(storage.getItem('labula.access-blocked.v1.account-a'));const changed=structuredClone(approved);changed.check.revision++;changed.check.answers[0].revision++;changed.check.answers[0].value='have';globalThis.fetch=async(url,init)=>{if(init?.method){posts++;return response({},200);}reads++;return response(changed);};assert.equal(await c.retry(),false);assert.equal(posts,0,'explicit retry must review a changed shared state before publishing');assert.equal(c.state.finish?.phase,'attention');assert(storage.getItem('labula.access-blocked.v1.account-a'));c.dispose();
 });
 await test('ordinary offline Finish retains established automatic recovery',async()=>{
  values.clear();m.configureClientAccess('account-a');const approved=snapshot(),id=crypto.randomUUID(),f={protocol:1,id,accountId:'account-a',account:'a@example.test',checkId:approved.check.id,targetDay:approved.check.targetDay,generation:0,createdAt:new Date().toISOString(),approved,fingerprint:m.finishFingerprint(approved),dependencies:[],phase:'offline'};
  storage.setItem(m.finishJournalPrefix('account-a')+id,JSON.stringify(f));let posts=0;globalThis.fetch=async(url,init)=>{if(init?.method){posts++;return response({code:'access_revoked'},403);}return response(approved);};
  const c=new m.EveningController('a@example.test',storage,{day:approved.check.id},undefined,false);controllers.push(c);assert(await c.refresh());await settle();assert.equal(posts,1);assert(storage.getItem(m.finishJournalPrefix('account-a')+id));assert.equal(storage.getItem('labula.access-blocked.v1.account-a'),'1','real revoked Finish records durable review marker');c.dispose();
 });
 await test('AccessBoundary keeps children mounted and hides body portals on loss',async()=>{
  const boundary=await readFile('app/access-boundary.tsx','utf8'),css=await readFile('app/globals.css','utf8');assert.match(boundary,/hidden=\{!!reason\}/);assert.match(boundary,/inert=\{!!reason\}/);assert.match(boundary,/\{children\}/);assert.match(boundary,/document\.body\.dataset\.appAccess='blocked'/);assert.match(css,/body\[data-app-access='blocked'\].*display: none !important/);
  const request=await readFile('lib/request-json.ts','utf8');assert.match(request,/await accessFetch\(/);assert(!/await fetch\(/.test(request));
  // Raw browser HTTP must not bypass the common access latch. Server-only
  // modules are excluded because their dispatch does not run in the browser.
  const scan=async(path)=>{const found=[];for(const f of await readdir(path,{withFileTypes:true})){const p=path+'/'+f.name;if(f.isDirectory())found.push(...await scan(p));else if(/\.[jt]sx?$/.test(f.name))found.push(p);}return found;};
  for(const file of await scan('app')){if(file.startsWith('app/api/')||file==='app/chatgpt-auth.ts')continue;const source=await readFile(file,'utf8');assert(!/\bfetch\s*\(/.test(source),'raw browser fetch: '+file);}
 });
 if(failures.length)throw Error(failures.join('\n'));
 console.log(`PASS application access client: ${cases} focused cases; identity header, latch, stable outboxes, switched-account and stale-response rejection, restored Finish review, original offline recovery, mounted private UI and portal hiding.`);
}finally{
 for(const c of controllers)c.dispose();globalThis.fetch=originalFetch;if(originalWindow===undefined)delete globalThis.window;else globalThis.window=originalWindow;if(originalCustomEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=originalCustomEvent;await rm(dir,{recursive:true,force:true});
}
