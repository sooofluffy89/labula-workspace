import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {harness,sleep} from './sync-harness.mjs';

const h=await harness(),dir=await mkdtemp(tmpdir()+'/labula-morning-layout-');
try{
 await writeFile(dir+'/react.mjs',`export const jsx=(type,props)=>({type,props}),jsxs=jsx,Fragment='Fragment';export function useState(v){let i=hooks.cursor++;if(!(i in hooks.cells))hooks.cells[i]={value:typeof v==='function'?v():v};return [hooks.cells[i].value,n=>{hooks.cells[i].value=typeof n==='function'?n(hooks.cells[i].value):n;}];}export function useRef(v){let i=hooks.cursor++;return hooks.cells[i]??(hooks.cells[i]={current:v});}export function useEffect(fn,deps){let i=hooks.cursor++,old=hooks.cells[i];if(!old||deps?.some((v,j)=>v!==old.deps?.[j])){hooks.cells[i]={deps};hooks.effects.push(()=>{old?.cleanup?.();hooks.cells[i].cleanup=fn();});}}export const useLayoutEffect=useEffect;`);
 await writeFile(dir+'/ui.mjs',`export const Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',StockRow='StockRow',Checkbox='Checkbox',Button='Button',GroupSection='GroupSection';export const PrepInstructionLine='PrepInstructionLine',ServiceFeedback='ServiceFeedback',noteContext=()=>({}),useInformation=()=>null,useSavePulse=()=>false,useCollapsedGroups=()=>({collapsed:[],toggle(){}});`);
 await build({stdin:{contents:"export {MorningList} from './app/morning-list';export {defaultCalendar} from './lib/operating-calendar';",resolveDir:process.cwd()},bundle:true,format:'esm',platform:'node',outfile:dir+'/test.mjs',jsx:'automatic',alias:{react:dir+'/react.mjs','react/jsx-runtime':dir+'/react.mjs'},plugins:[{name:'ui',setup(b){b.onResolve({filter:/^(?:@\/components\/ui\/|\.\/(?:prep-notes|information-context|stock-motion|grouped-sections)$)/},args=>args.importer.includes('/app/')||args.path.startsWith('@/components/')?{path:dir+'/ui.mjs'}:undefined);}}],logLevel:'silent'});
 const {MorningList,defaultCalendar}=await import(dir+'/test.mjs');
 const store=new Map(),listeners=new Map();
 globalThis.hooks={cursor:0,cells:[],effects:[]};
 globalThis.HTMLElement=class{};
 globalThis.document={activeElement:null,addEventListener(type,fn){listeners.set(type,fn)},removeEventListener(type){listeners.delete(type)},getElementById(){return null}};
 globalThis.window={innerHeight:800,scrollBy(){},addEventListener(){},removeEventListener(){}};
 globalThis.getComputedStyle=()=>({getPropertyValue:()=>''});
 globalThis.sessionStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 let state=null,clicked=[],day=h.targetDay,continued=[],manageHandler=undefined,managed=0;
 const flat=x=>!x||typeof x==='boolean'?[]:Array.isArray(x)?x.flatMap(flat):typeof x!=='object'?[x]:[x,...flat(x.props?.children)];
 const render=()=>{hooks.cursor=0;const tree=MorningList({state,day,onReady:id=>{clicked.push(id);return true;},onContinue:date=>continued.push(date),onManage:manageHandler,onCorrect(){},correctDisabled:false});for(const effect of hooks.effects.splice(0))effect();return tree;};
 const listRows=tree=>flat(tree).filter(x=>x?.type==='StockRow');
 const readySection=tree=>flat(tree).find(x=>x?.type==='section'&&x.props.className==='morning-ready-section');
 const readyIds=tree=>{const section=readySection(tree);return section?listRows(section).map(x=>x.props['data-item-id']):[];};
 const row= (tree,id)=>listRows(tree).find(x=>x.props['data-item-id']===id);
 const checkbox=(tree,id)=>flat(row(tree,id)).find(x=>x?.type==='Checkbox');
 const snapshot=(values,scope='one')=>({snapshot:{accountId:scope,check:{id:h.day,targetDay:h.targetDay,version:1,stage:'confirmed',grouped:false,confirmedBy:'Synthetic Cook',confirmedAt:new Date().toISOString(),tasks:values.map((ready,i)=>({itemId:'item-'+i,catalogId:'item-'+i,name:'Synthetic '+i,kind:i%2?'bought':'prep',position:i,ready,cancelled:false,revision:0,updatedAt:new Date().toISOString(),updatedBy:'Synthetic Cook',mappingValid:true,groupId:null}))},checks:[],trackedCount:3},pending:[],loading:false,saving:false,error:'',unauthorized:false,notice:'',lastVerifiedAt:Date.now()});
 state=snapshot([false,false,false]);let tree=render();const root=tree;root.props.ref.current={querySelectorAll:()=>[]};
 assert.deepEqual(readyIds(tree),[]);
 checkbox(tree,'item-0').props.onCheckedChange();state=snapshot([true,false,false]);tree=render();assert.deepEqual(readyIds(tree),[],'the pressed row stays put while input settles');assert.equal(listRows(tree).length,3);
 await sleep(1000);tree=render();assert.deepEqual(readyIds(tree),['item-0']);assert.equal(readySection(tree).props.children[0].props['aria-expanded'],false);
 readySection(tree).props.children[0].props.onClick();tree=render();assert.equal(readySection(tree).props.children[0].props['aria-expanded'],true);
 checkbox(tree,'item-0').props.onCheckedChange();state=snapshot([false,false,false]);tree=render();assert.deepEqual(readyIds(tree),['item-0'],'Undo does not move beneath an active control');await sleep(1000);tree=render();assert.deepEqual(readyIds(tree),[]);assert.equal(listRows(tree).length,3);
 root.props.onPointerDownCapture({pointerId:7});checkbox(tree,'item-1').props.onCheckedChange();state=snapshot([false,true,false]);tree=render();await sleep(1000);tree=render();assert.deepEqual(readyIds(tree),[],'remote or local state cannot reflow under a held pointer');listeners.get('pointerup')({pointerId:7});await sleep(1000);tree=render();assert.deepEqual(readyIds(tree),['item-1']);assert.deepEqual(clicked,['item-0','item-0','item-1']);
 tree.props.onKeyDownCapture({code:'Space',repeat:false});checkbox(tree,'item-2').props.onCheckedChange();state=snapshot([false,true,true]);tree=render();await sleep(1000);tree=render();assert.deepEqual(readyIds(tree),['item-1'],'held Space cannot replace the focused row');listeners.get('keyup')({code:'Space'});await sleep(1000);tree=render();assert.deepEqual(readyIds(tree).sort(),['item-1','item-2']);
 state=snapshot([false,false,false],'different-account');tree=render();await sleep(1);tree=render();assert.deepEqual(readyIds(tree),[],'another account cannot inherit a presented Ready row');
 checkbox(tree,'item-0').props.onCheckedChange();state.snapshot.check.tasks[0].ready=true;state.snapshot.check.tasks[0].revision=1;tree=render();const externalUndo=t=>flat(t).find(x=>x?.type==='Button'&&x.props.children==='Undo last change');assert(externalUndo(tree),'last Ready has an Undo outside the moved row');state.snapshot.check.tasks[0].revision=2;tree=render();assert.equal(externalUndo(tree),undefined,'a newer peer revision invalidates the old Undo');
 console.log('PASS actual MorningList hooks: quiet reflow, collapsed Ready, Undo, held pointer/Space safety and account isolation');
 // A missing plan points to the actual previous open evening, including closures.
 day='2026-09-29';const config=defaultCalendar();config.exceptions=[{day:'2026-09-27',open:false,note:'Synthetic closure'}];
 const empty={accountId:'no-plan',check:null,checks:[],trackedCount:3,calendar:{versions:[{revision:1,effectiveDay:'2026-01-01',config,createdAt:'2026-01-01T00:00:00Z',createdBy:'synthetic'}]}};
 state={...snapshot([]),snapshot:empty};tree=render();
 const buttonLabel=node=>flat(node.props.children).filter(value=>typeof value==='string'||typeof value==='number').join('');
 const buttons=()=>flat(tree).filter(node=>node?.type==='Button');
 buttons().find(node=>buttonLabel(node)==='Open evening check for this plan').props.onClick();assert.equal(continued.at(-1),'2026-09-26','Monday is normally closed and Sunday is an explicit closure');
 state.snapshot={...empty,checks:[{id:'2026-09-25',targetDay:day,stage:'draft',version:0}]};tree=render();assert(!buttons().some(node=>buttonLabel(node)==='Open evening check for this plan'));buttons().find(node=>buttonLabel(node).startsWith('Continue check')).props.onClick();assert.equal(continued.at(-1),'2026-09-25','an existing draft keeps its recorded source evening');
 state.snapshot={...empty,trackedCount:0};tree=render();assert(!buttons().some(node=>buttonLabel(node)==='Manage checklist'),'Cook is not offered a management callback');assert(!buttons().some(node=>buttonLabel(node)==='Open evening check for this plan'));assert(flat(tree).some(value=>typeof value==='string'&&value.includes('Ask a Manager')));
 manageHandler=()=>managed++;tree=render();buttons().find(node=>buttonLabel(node)==='Manage checklist').props.onClick();assert.equal(managed,1,'manager gets the supplied management action');manageHandler=undefined;
 state={...state,snapshot:empty,loading:true};tree=render();assert(!buttons().some(node=>buttonLabel(node)==='Open evening check for this plan'),'loading is not a missing-plan decision');state={...state,loading:false,error:'Synthetic offline'};tree=render();assert(!buttons().some(node=>buttonLabel(node)==='Open evening check for this plan'),'failed reads are not a missing-plan decision');
 console.log('PASS Morning missing-plan handlers: previous open evening with closure, exact draft date, Cook/Manager checklist guard, and no provisional CTA during loading/error');

}finally{for(const cell of globalThis.hooks?.cells??[])cell?.cleanup?.();h.db.close();await rm(dir,{recursive:true,force:true});delete globalThis.syncDb;delete globalThis.syncUser;}
