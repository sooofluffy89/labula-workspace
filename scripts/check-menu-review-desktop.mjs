import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

// Exercise handlers and resulting notebook changes. Real DOM/layout/focus checks
// are performed separately in browser QA; these checks do not assert CSS/source.
const dir=await mkdtemp(tmpdir()+'/labula-review-desktop-');
try{
 const react=dir+'/react.mjs',ui=dir+'/ui.mjs',outfile=dir+'/test.mjs';
 await writeFile(react,`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export function useState(initial){const h=globalThis.reviewHooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return[h.values[i],value=>{const next=typeof value==='function'?value(h.values[i]):value;if(next!==h.values[i]){h.values[i]=next;h.dirty=true;}}];}export function useRef(initial){const h=globalThis.reviewHooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export function useId(){const h=globalThis.reviewHooks,i=h.cursor++;return h.values[i]??(h.values[i]='synthetic-review-'+i);}export function useEffect(fn,deps){const h=globalThis.reviewHooks,i=h.cursor++;if(!h.values[i]||deps.some((value,j)=>value!==h.values[i][j])){h.values[i]=deps;h.effects.push(fn);}}export const useLayoutEffect=useEffect;`);
 await writeFile(ui,`export const Input='Input',Textarea='Textarea',Button='Button',Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',Select='Select',SelectTrigger='SelectTrigger',SelectContent='SelectContent',SelectItem='SelectItem',SelectValue='SelectValue',Field='Field',NumberField='NumberField',Plus='Plus',Trash2='Trash2',ArrowRight='ArrowRight',Sun='Sun',Flame='Flame',Layers='Layers',Download='Download',CheckCircle2='CheckCircle2';`);
 await build({stdin:{contents:"export {ReviewOverview} from './app/menu-review-editor';export {initialNotebook,newItem,validateNotebook} from './lib/notebook';export {emptyWorkshop} from './lib/menu-review';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',logLevel:'silent',plugins:[{name:'primitive-hooks',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},()=>({path:react}));b.onResolve({filter:/^@\/components\/ui\//},()=>({path:ui}));b.onResolve({filter:/(?:recipe-ui$|^lucide-react$)/},()=>({path:ui}));}}]});
 const m=await import(outfile);
 globalThis.window={addEventListener(){},removeEventListener(){}};
 const flatten=node=>Array.isArray(node)?node.flatMap(flatten):node&&typeof node==='object'&&'props'in node?[node,...flatten(node.props.children)]:node==null||typeof node==='boolean'?[]:[node];
 const text=node=>flatten(node).filter(value=>typeof value==='string'||typeof value==='number').join('');
 let tree,component,props;
 const render=()=>{for(let attempt=0;attempt<12;attempt++){const h=globalThis.reviewHooks;h.cursor=0;h.dirty=false;tree=component(props);for(const effect of h.effects.splice(0))effect();if(!h.dirty)return;}throw Error('review render loop');};
 const reset=(fn,next)=>{globalThis.reviewHooks={cursor:0,values:[],effects:[],dirty:false};component=fn;props=next;render();};
 const nodes=type=>flatten(tree).filter(node=>node?.type===type);
 const button=label=>nodes('Button').find(node=>text(node)===label);
 const composer=()=>nodes('form').find(node=>node.props.className?.includes('review-decision-composer'));
 const decisionNodes=()=>flatten(tree).filter(node=>typeof node?.type==='function'&&node.type.name==='DecisionRow');

 let notebook=m.initialNotebook();
 const item={...m.newItem('Synthetic reviewed ingredient'),id:'desktop-ingredient'};
 notebook.items.push(item);
 const base={...notebook.recipes[0],inputs:[{itemId:item.id,amount:5,unit:'g',note:'Cut evenly',pieceMeaning:'',conversion:null}],recorded:true,ingredientsReviewed:true,reviewStatus:'unverified',workshop:{...m.emptyWorkshop(),steps:[{id:'desktop-step',phase:'before',text:'Historical procedure'}],beforeMinutes:12,decisions:[]}};
 notebook.recipes[0]=base;
 const alternate={...structuredClone(base),id:'desktop-alternate',variant:'Less spicy',workshop:{...structuredClone(base.workshop),decisions:[{id:'desktop-existing',kind:'decision',text:'Use milder chilli',done:false}]}};
 notebook.recipes.push(alternate);notebook=m.validateNotebook(notebook);
 const dirty=[],opened=[];let reject=false,writes=0;
 const overviewProps={notebook,mode:'decisions',disabled:false,canManage:true,selectedDish:base.menuId,selectedRecipe:alternate.id,onDraftChange:value=>dirty.push(value),onDish:(...args)=>opened.push(args),onCompare(){},onChange:change=>{writes++;if(reject)return false;notebook=m.validateNotebook(change(notebook));props.notebook=notebook;return true;}};
 reset(m.ReviewOverview,overviewProps);
 const decisions=tree;
 assert.equal(typeof decisions.type,'function');
 reset(decisions.type,decisions.props);
 assert.equal(composer().props.hidden,true,'existing follow-ups show before the new-item form');
 assert.equal(nodes('select').find(node=>node.props['aria-label']==='Recipe for new decision').props.value,alternate.id,'new items use the exact selected variant');
 const existing=decisionNodes().find(node=>node.props.decision.id==='desktop-existing');
 existing.props.onOpen();assert.deepEqual(opened.at(-1),[base.menuId,alternate.id],'Open dish carries the follow-up variant');
 button('Add item').props.onClick();render();assert.equal(composer().props.hidden,false);
 nodes('Textarea').find(node=>node.props['aria-label']==='New decision or kitchen test').props.onChange({target:{value:'A draft for the less spicy variant'}});render();assert.equal(dirty.at(-1),true);
 button('Hide draft').props.onClick();render();assert.equal(composer().props.hidden,true);
 assert.equal(nodes('Textarea').find(node=>node.props['aria-label']==='New decision or kitchen test').props.value,'A draft for the less spicy variant','hiding preserves the draft');
 button('Resume draft').props.onClick();render();assert.equal(composer().props.hidden,false);
 // A refreshed selection must not silently move an existing draft to a variant.
 props.selectedRecipe=base.id;render();
 assert.equal(nodes('select').find(node=>node.props['aria-label']==='Recipe for new decision').props.value,alternate.id);
 reject=true;composer().props.onSubmit({preventDefault(){}});render();
 assert.equal(writes,1);assert.equal(dirty.at(-1),true);
 assert.equal(nodes('Textarea').find(node=>node.props['aria-label']==='New decision or kitchen test').props.value,'A draft for the less spicy variant','rejected save keeps the whole draft');
 reject=false;const before=structuredClone(notebook);composer().props.onSubmit({preventDefault(){}});render();
 assert.equal(writes,2);assert.equal(composer().props.hidden,true);assert.equal(dirty.at(-1),false);
 const saved=notebook.recipes.find(recipe=>recipe.id===alternate.id);
 assert(saved.workshop.decisions.some(decision=>decision.text==='A draft for the less spicy variant'));
 assert.deepEqual(notebook.recipes.find(recipe=>recipe.id===base.id),before.recipes.find(recipe=>recipe.id===base.id),'saving a follow-up leaves other variants unchanged');
 assert.deepEqual(saved.inputs,alternate.inputs);assert.deepEqual(saved.workshop.steps,alternate.workshop.steps);assert.equal(saved.workshop.beforeMinutes,12);assert.equal(saved.ingredientsReviewed,true);
 assert.equal(nodes('select').find(node=>node.props['aria-label']==='Recipe for new decision').props.value,base.id,'after saving, an empty composer follows the new selected variant');
 button('Add item').props.onClick();render();nodes('Textarea')[0].props.onChange({target:{value:'Explicit discard'}});render();button('Discard draft').props.onClick();render();assert.equal(nodes('Textarea')[0].props.value,'');assert.equal(dirty.at(-1),false);

 reset(m.ReviewOverview,{...overviewProps,notebook,canManage:false});const readOnly=tree;reset(readOnly.type,readOnly.props);
 assert.equal(composer(),undefined);assert.equal(button('Add item'),undefined);
 assert(decisionNodes().every(node=>node.props.disabled),'non-managers can inspect follow-ups without editable controls');
 const beforeView=structuredClone(notebook);decisionNodes().find(node=>node.props.decision.id==='desktop-existing').props.onOpen();assert.deepEqual(opened.at(-1),[base.menuId,alternate.id]);assert.deepEqual(notebook,beforeView);
 console.log('PASS desktop review interactions: collapsed/resumable composer, exact variant navigation, rejected-save draft retention, scoped save, explicit discard and read-only controls.');
}finally{delete globalThis.window;delete globalThis.reviewHooks;await rm(dir,{recursive:true,force:true});}
