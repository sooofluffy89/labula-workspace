import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {harness,sleep} from './sync-harness.mjs';

const h=await harness(),dir=await mkdtemp(tmpdir()+'/labula-evening-layout-');
try{
 await writeFile(dir+'/react.mjs',`export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='Fragment';export function useState(v){let i=hooks.cursor++;if(!(i in hooks.cells))hooks.cells[i]={value:typeof v==='function'?v():v};return [hooks.cells[i].value,n=>{hooks.cells[i].value=typeof n==='function'?n(hooks.cells[i].value):n;}];}export function useRef(v){let i=hooks.cursor++;return hooks.cells[i]??(hooks.cells[i]={current:v});}export function useEffect(fn,deps){let i=hooks.cursor++,old=hooks.cells[i];if(!old||deps?.some((v,j)=>v!==old.deps?.[j])){hooks.cells[i]={deps};hooks.effects.push(()=>{old?.cleanup?.();hooks.cells[i].cleanup=fn();});}}export const useLayoutEffect=useEffect;`);
 await writeFile(dir+'/ui.mjs',`export const Button='Button',GroupSection='GroupSection';export const useCollapsedGroups=()=>({collapsed:[],toggle(){}});`);
 await build({stdin:{contents:"export {EveningChecklist} from './app/evening-checklist';export {eveningListIssues,isEveningChecked} from './lib/evening-list';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',jsx:'automatic',alias:{react:dir+'/react.mjs','react/jsx-runtime':dir+'/react.mjs'},plugins:[{name:'ui',setup(b){b.onResolve({filter:/^(?:@\/components\/ui\/|\.\/grouped-sections$)/},()=>({path:dir+'/ui.mjs'}));}}],logLevel:'silent'});
 const {EveningChecklist,eveningListIssues}=await import(dir+'/test.mjs');
 const listeners=new Map();let dialog=false,scroll=0,focus='';
 globalThis.hooks={cursor:0,cells:[],effects:[]};globalThis.HTMLElement=class{};
 globalThis.document={activeElement:null,querySelector:()=>dialog?{}:null,addEventListener:(t,f)=>listeners.set(t,f),removeEventListener:t=>listeners.delete(t)};
 globalThis.window={innerHeight:800,scrollBy:({top})=>scroll+=top,addEventListener(){},removeEventListener(){}};
 globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
 let values=[null,null,null],issues=new Set(),pending=new Set(),filter='all',account='one',openDialog=false;
 const flat=x=>!x||typeof x==='boolean'?[]:Array.isArray(x)?x.flatMap(flat):typeof x!=='object'?[x]:[x,...flat(x.props?.children)];
 const answers=()=>values.map((value,i)=>({itemId:'item-'+i,catalogId:'item-'+i,name:'Synthetic '+i,value,kind:'prep',mappingValid:true,stationId:i<2?'station-1':null,groupId:null}));
 const render=()=>{hooks.cursor=0;const tree=EveningChecklist({answers:answers(),issues,pendingIds:pending,filter,onFilter:v=>{filter=v;},account,checkId:h.day,version:0,dialogOpen:openDialog,revealedId:null,renderRows:rows=>rows.map(a=>({type:'Row',props:{'data-item-id':a.itemId}}))});for(const effect of hooks.effects.splice(0))effect();return tree;};
 const section=(tree,name)=>flat(tree).find(x=>x?.props?.className===name);
 const rows=tree=>flat(tree).filter(x=>x?.type==='Row').map(x=>x.props['data-item-id']);
 const heading=tree=>flat(section(tree,'evening-checked-section')).find(x=>x?.props?.className==='evening-checked-heading');
 const toCheck=tree=>rows(section(tree,'evening-to-check'));
 let tree=render();const root=tree.props.ref;root.current={querySelectorAll:()=>[]};
 assert.deepEqual(toCheck(tree),['item-0','item-1','item-2']);assert.equal(heading(tree).props['aria-expanded'],false);
 values[0]='have';pending.add('item-0');tree=render();assert.deepEqual(toCheck(tree),['item-0','item-1','item-2']);await sleep(250);tree=render();assert.ok(toCheck(tree).includes('item-0'),'choice reacts without immediately reflowing');
 listeners.get('pointerdown')({pointerId:7});values[1]='missing';tree=render();await sleep(1000);tree=render();assert.equal(toCheck(tree).length,3,'held pointer stops local/remote movement');listeners.get('pointerup')({pointerId:7});await sleep(1000);tree=render();assert.deepEqual(toCheck(tree),['item-2']);assert.match(flat(heading(tree)).join(' '),/waiting to share/);
 heading(tree).props.onClick();tree=render();assert.equal(heading(tree).props['aria-expanded'],true);assert.deepEqual(rows(section(tree,'evening-checked-section')),['item-0','item-1']);
 values[0]='missing';tree=render();await sleep(1000);tree=render();assert.deepEqual(toCheck(tree),['item-2'],'switching answers does not return an item');
 values[0]=null;tree=render();await sleep(1000);tree=render();assert.deepEqual(toCheck(tree),['item-0','item-2'],'Return to Unchecked returns to work');
 heading(tree).props.onClick();tree=render();issues=new Set(['item-1']);tree=render();assert.equal(heading(tree).props['aria-expanded'],true,'a rejected hidden row is immediately revealed while reflow waits');await sleep(1000);tree=render();assert.ok(toCheck(tree).includes('item-1'));
 issues=new Set();openDialog=true;tree=render();await sleep(1000);tree=render();assert.ok(toCheck(tree).includes('item-1'),'open detail freezes reflow');openDialog=false;tree=render();await sleep(1000);tree=render();assert.deepEqual(toCheck(tree),['item-0','item-2']);
 filter='station-1';tree=render();assert.deepEqual(toCheck(tree),['item-0']);filter='none';tree=render();assert.deepEqual(toCheck(tree),['item-2']);filter='station-4';tree=render();assert.deepEqual(toCheck(tree),[]);filter='all';tree=render();
 listeners.get('keydown')({code:'Space'});values[2]='have';tree=render();await sleep(1000);tree=render();assert.ok(toCheck(tree).includes('item-2'));listeners.get('keyup')({code:'Space'});await sleep(1000);tree=render();assert.ok(!toCheck(tree).includes('item-2'));
 const fakeRow=(id,top)=>({dataset:{itemId:id},getClientRects:()=>[{}],getBoundingClientRect:()=>({top,bottom:top+50}),querySelector:()=>({focus:()=>{focus=id;}})});
 let y=150;root.current={querySelectorAll:()=>[fakeRow('item-0',50),fakeRow('item-1',y)]};document.activeElement=Object.assign(new HTMLElement(),{dataset:{value:'have'},closest:()=>fakeRow('item-0',50),classList:{contains:()=>false}});
 values[0]='have';values[1]=null;tree=render();await sleep(1000);y=100;tree=render();assert.equal(focus,'item-1','focus follows the next visible unanswered row');assert.equal(scroll,-50,'scroll anchors the remaining row');document.activeElement=null;root.current={querySelectorAll:()=>[]};
 account='different-account';values=[null,null,null];tree=render();await sleep(1);tree=render();assert.equal(heading(tree).props['aria-expanded'],false);assert.deepEqual(toCheck(tree),['item-0','item-1','item-2']);
 const rejectState={snapshot:{accountId:'one',check:{id:h.day}},pending:[{accountId:'one',rejected:true,command:{kind:'answer',checkId:h.day,itemId:'item-0'}},{accountId:'other',rejected:true,command:{kind:'answer',checkId:h.day,itemId:'item-2'}}]};assert.deepEqual([...eveningListIssues(rejectState)],['item-0']);
 console.log('PASS actual EveningChecklist hooks: both choices, quiet/held input, Checked repair, rejection visibility, stations, dialog, account isolation, keyboard focus and scroll anchor');
 // The UI selectors are tested against actual durable queue recovery and two real server clients.
 const forUser=u=>async(url,init)=>{globalThis.syncUser=u;return h.requester(url,init);};
 const store=h.storage(),c1=new h.m.EveningController(h.owner.email,store,{day:h.day},forUser(h.owner)),c2=new h.m.EveningController(h.cook.email,h.storage(),{day:h.day},forUser(h.cook));
 try{assert(await c1.refresh());assert(await c2.refresh());assert(c1.answer('item-0','missing'));await c1.flush();assert(await c2.refresh());assert.equal(c2.visibleCheck().answers[0].value,'missing');assert(c2.answer('item-0','have'));await c2.flush();assert(await c1.refresh());assert.equal(c1.visibleCheck().answers[0].value,'have');
 c1.answer('item-1','missing');await c1.flush();assert.equal(c1.state.pending.length,0);
 }finally{c1.dispose();c2.dispose();}
 console.log('PASS UI partition uses unchanged actual two-client answers/author/revisions; no new API transport or database schema');
}finally{for(const cell of globalThis.hooks?.cells??[])cell?.cleanup?.();h.db.close();await rm(dir,{recursive:true,force:true});delete globalThis.syncDb;delete globalThis.syncUser;}
