import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
const dir=await mkdtemp(join(tmpdir(),'maintenance-client-')),oldFetch=globalThis.fetch,oldWindow=globalThis.window,oldCustomEvent=globalThis.CustomEvent;
try{
 await writeFile(join(dir,'hooks.mjs'),`export function useState(initial){const h=globalThis.maintenanceHooks,i=h.cursor++;if(!(i in h.cells))h.cells[i]=initial;return [h.cells[i],v=>h.cells[i]=typeof v==='function'?v(h.cells[i]):v];}export function useCallback(fn,deps){const h=globalThis.maintenanceHooks,i=h.cursor++,prior=h.cells[i];if(!prior||deps.some((v,j)=>v!==prior.deps[j]))h.cells[i]={deps,fn};return h.cells[i].fn;}export function useEffect(fn,deps){const h=globalThis.maintenanceHooks,i=h.cursor++,prior=h.cells[i];if(!prior||deps.some((v,j)=>v!==prior[j])){h.cells[i]=deps;h.effects.push(fn);}}`);
 await writeFile(join(dir,'jsx.mjs'),`export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='fragment';`);
 await build({stdin:{contents:`export {WorkspaceMaintenance} from './app/workspace-maintenance/workspace-maintenance';export * from './lib/access-client';`,resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:join(dir,'test.mjs'),alias:{react:join(dir,'hooks.mjs'),'react/jsx-runtime':join(dir,'jsx.mjs')},logLevel:'silent'});
 const m=await import(join(dir,'test.mjs')),values=new Map();globalThis.window=new EventTarget();window.localStorage={setItem:(k,v)=>values.set(k,v)};
 if(!globalThis.CustomEvent)globalThis.CustomEvent=class extends Event{constructor(type,init){super(type);this.detail=init?.detail;}};
 let lost=0;window.addEventListener('labula:access-lost',()=>lost++);
 const render=()=>{const h=globalThis.maintenanceHooks;h.cursor=0;const tree=m.WorkspaceMaintenance({accountId:'owner'});for(const effect of h.effects.splice(0))effect();return tree;};
 const settle=()=>new Promise(resolve=>setTimeout(resolve,5));
 const mount=()=>{globalThis.maintenanceHooks={cursor:0,cells:[],effects:[]};m.configureClientAccess('owner');return render();};
 const nodes=tree=>Array.isArray(tree)?tree.flatMap(nodes):tree&&typeof tree==='object'?[tree,...nodes(tree.props?.children)]:[];
 const button=(tree,text)=>nodes(tree).find(n=>n.type==='button'&&n.props.children===text);
 const body=(paused=0,revision=0)=>({accountId:'owner',policy:{write_paused:paused,min_client_version:1,revision,updated_at:'synthetic'},audit:[]});
 const response=(data,status=200,id='owner')=>Response.json(data,{status,headers:{'X-Labula-Account-Id':id}});
 // Root's configured account reaches the real UI transport; transient failure
 // retains the exact maintenance operation and can retry through the latch.
 const calls=[];let fail=true;
 globalThis.fetch=async(url,init)=>{assert.equal(url,'/api/workspace-maintenance');assert.equal(new Headers(init.headers).get('X-Labula-Account-Id'),'owner');calls.push(init);return init.method?(fail?response({error:'Retry safely.',code:'maintenance_unavailable'},503):response(body(1,1))):response(body());};
 mount();await settle();let tree=render();const probe=nodes(tree).find(node=>node.type==='form');assert.equal(probe.props.method,'POST');assert.equal(probe.props.action,'/api/catalog');assert.equal(probe.props.target,'_blank');assert.equal(probe.props.rel,'noopener');assert.equal(probe.props.onSubmit,undefined,'probe uses native browser form submission');const fields=nodes(probe).filter(node=>node.type==='input');assert.deepEqual(fields.map(node=>[node.props.type,node.props.name,node.props.value]),[['hidden','maintenance_guard_probe','legacy-client']]);assert(button(probe,'Check legacy-client block'));button(tree,'Pause writes').props.onClick();await settle();tree=render();
 assert.equal(lost,0);assert(button(tree,'Retry the same pending action'));assert.equal(button(tree,'Pause writes').props.disabled,true);
 const original=calls.find(c=>c.method).body;fail=false;button(tree,'Retry the same pending action').props.onClick();await settle();tree=render();
 assert.equal(calls.filter(c=>c.method).length,2);assert.equal(calls.filter(c=>c.method)[1].body,original);assert.equal(button(tree,'Pause writes').props.disabled,true);assert.equal(button(tree,'Resume writes — client version 2').props.disabled,false);
 // A changed account response is refused before maintenance controls appear.
 let requests=0;globalThis.fetch=async()=>{requests++;return response({...body(),accountId:'other'},200,'other');};mount();await settle();tree=render();assert.equal(button(tree,'Pause writes'),undefined);assert.equal(lost,1);await assert.rejects(m.accessFetch('/api/workspace-maintenance'),m.AccessLostError);assert.equal(requests,1);
 // Owner revocation uses the same durable latch as the rest of the application.
 requests=0;globalThis.fetch=async()=>{requests++;return response({code:'access_revoked',error:'Owner access changed.'},403);};mount();await settle();tree=render();assert.equal(button(tree,'Pause writes'),undefined);assert.equal(lost,2);assert.equal(values.get(m.accessBlockedKey('owner')),'1');await assert.rejects(m.accessFetch('/api/workspace-maintenance'),m.AccessLostError);assert.equal(requests,1);
 console.log('PASS actual maintenance client: shared account transport; transient failure retains exact operation retry; changed-account and revoked Owner responses withhold controls, preserve durable access latch, and prevent further HTTP.');
}finally{globalThis.fetch=oldFetch;if(oldWindow===undefined)delete globalThis.window;else globalThis.window=oldWindow;if(oldCustomEvent===undefined)delete globalThis.CustomEvent;else globalThis.CustomEvent=oldCustomEvent;delete globalThis.maintenanceHooks;await rm(dir,{recursive:true,force:true});}
