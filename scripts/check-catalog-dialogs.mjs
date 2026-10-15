// Exercise the real portal-dialog handlers with isolated React hooks.
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const dir=await mkdtemp(path.join(tmpdir(),'labula-catalog-dialogs-'));
try{
 const react=path.join(dir,'react.mjs'),ui=path.join(dir,'ui.mjs'),outfile=path.join(dir,'dialogs.mjs');
 await writeFile(react,`export function useEffect(){};export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],value=>{h.values[i]=typeof value==='function'?value(h.values[i]):value;}];}`);
 await writeFile(ui,`export const AlertDialog='AlertDialog',AlertDialogContent='AlertDialogContent',AlertDialogHeader='AlertDialogHeader',AlertDialogTitle='AlertDialogTitle',AlertDialogDescription='AlertDialogDescription',AlertDialogFooter='AlertDialogFooter',AlertDialogCancel='AlertDialogCancel',AlertDialogAction='AlertDialogAction';export const Button='Button',Input='Input',Textarea='Textarea',NumberField='NumberField',Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription',DialogFooter='DialogFooter',Field='Field',Choice='Choice',ProfileSummary='ProfileSummary';`);
 await build({stdin:{contents:"export {CreateItemDialog,ItemEditor} from './app/catalog-editor';export {newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',alias:{react,'react/jsx-runtime':react},plugins:[{name:'primitives',setup(b){b.onResolve({filter:/^(?:@\/components\/ui\/|\.\/(?:recipe-ui|prep-fields)$)/},()=>({path:ui}));}}],logLevel:'silent'});
 const {CreateItemDialog,ItemEditor,newItem}=await import(outfile);
 const flatten=node=>!node||typeof node==='boolean'?[]:Array.isArray(node)?node.flatMap(flatten):typeof node!=='object'?[node]:[node,...flatten(node.props?.children)];
 const label=node=>flatten(node.props?.children).filter(x=>typeof x==='string'||typeof x==='number').join('');
 let tree,component,props,closed=0,sent=[];
 const render=()=>{hooks.cursor=0;tree=component(props);return tree;};
 const reset=(next,values)=>{globalThis.hooks={values:[],cursor:0};component=next;props=values;closed=0;sent=[];render();};
 const nodes=type=>flatten(tree).filter(node=>node?.type===type);
 const button=text=>nodes('Button').find(node=>label(node)===text);
 const fill=name=>{nodes('Input')[0].props.onChange({target:{value:name}});render();};
 const alerts=()=>nodes('p').filter(node=>node.props.role==='alert').map(label).join(' ');
 const settle=()=>new Promise(resolve=>setImmediate(resolve));

 // A timeout while Create is already open must preserve both name and type.
 reset(CreateItemDialog,{name:'House sauce',items:[],pending:false,onClose:()=>closed++,onCreate:item=>sent.push(item)});
 fill('House sauce with ginger');nodes('Choice')[0].props.onChange('prep');render();
 props.pending=true;render();assert.equal(nodes('Input')[0].props.disabled,true);assert.equal(nodes('fieldset')[0].props.disabled,true);assert.equal(button('Create item').props.disabled,true);
 assert.ok(flatten(tree).some(node=>typeof node==='string'&&node.includes('Your input is kept here')));
 button('Create item').props.onClick();fill('Must not replace the draft');nodes('Choice')[0].props.onChange('bought');render();
 assert.equal(sent.length,0);assert.equal(closed,0);assert.equal(nodes('Input')[0].props.value,'House sauce with ginger');assert.equal(nodes('Choice')[0].props.value,'prep');
 let release,retries=0;props.onRetryPending=async()=>{retries++;await new Promise(resolve=>release=resolve);props.pending=false;};render();
 button('Retry earlier save').props.onClick();render();assert.equal(button('Create item').props.disabled,true);assert.equal(button('Checking earlier save…').props.disabled,true);release();await settle();render();
 assert.equal(retries,1);assert.equal(nodes('Input')[0].props.value,'House sauce with ginger');assert.equal(nodes('Choice')[0].props.value,'prep');assert.equal(button('Create item').props.disabled,false);
 button('Create item').props.onClick();assert.equal(sent.length,1);assert.equal(sent[0].name,'House sauce with ginger');assert.equal(sent[0].kind,'prep');

 // Both exact reuse and fuzzy suggestions are guarded while pending.
 const garlic=newItem('Garlic cloves');
 for(const name of ['Garlic cloves','Garlic clovs']){
  reset(CreateItemDialog,{name,items:[garlic],pending:true,onClose:()=>closed++,onCreate:item=>sent.push(item)});
  const reuse=button(name==='Garlic cloves'?'Use existing item':'Use Garlic cloves');assert.ok(reuse);assert.equal(reuse.props.disabled,true);reuse.props.onClick();assert.equal(sent.length,0);assert.equal(closed,0);
 }

 // A newly pending hook can reject before portal props rerender: catch and keep input.
 for(const name of ['Garlic cloves','Brand new sauce']){
  reset(CreateItemDialog,{name,items:[garlic],pending:false,onClose:()=>closed++,onCreate:()=>{throw Error('Finish or retry the pending change first.');}});
  assert.doesNotThrow(()=>button(name==='Garlic cloves'?'Use existing item':'Create item').props.onClick());render();
  assert.match(alerts(),/pending change/);assert.equal(nodes('Input')[0].props.value,name);assert.equal(closed,0);
 }

 // Editing has the same freeze, and ordinary validation/guard errors never close it.
 reset(ItemEditor,{item:garlic,pending:false,onClose:()=>closed++,onSave:item=>{sent.push(item);return null;}});
 fill('Peeled garlic cloves');props.pending=true;render();assert.equal(nodes('Input')[0].props.disabled,true);assert.equal(button('Save item').props.disabled,true);button('Save item').props.onClick();assert.equal(sent.length,0);assert.equal(closed,0);
 props.onRetryPending=async()=>{throw Error('Still waiting for the earlier save.');};render();button('Retry earlier save').props.onClick();await settle();render();assert.match(alerts(),/Still waiting/);assert.equal(nodes('Input')[0].props.value,'Peeled garlic cloves');assert.equal(closed,0);
 props.pending=false;props.onSave=()=>{throw Error('Finish or retry the pending change first.');};render();assert.doesNotThrow(()=>button('Save item').props.onClick());render();assert.match(alerts(),/pending change/);assert.equal(closed,0);
 props.onSave=()=> 'That name already exists.';render();button('Save item').props.onClick();render();assert.match(alerts(),/already exists/);assert.equal(closed,0);
 props.onSave=item=>{sent.push(item);return null;};render();button('Save item').props.onClick();assert.equal(closed,1);assert.equal(sent[0].name,'Peeled garlic cloves');
 // Accidental dismissal of a dirty create form is an explicit, reversible choice.
 reset(CreateItemDialog,{name:'',items:[],pending:false,onClose:()=>closed++,onCreate:item=>sent.push(item)});
 fill('Unshared sauce');nodes('Dialog')[0].props.onOpenChange(false);render();
 assert.equal(closed,0);assert.equal(nodes('AlertDialog')[0].props.open,true);
 nodes('AlertDialog')[0].props.onOpenChange(false);render();assert.equal(nodes('Input')[0].props.value,'Unshared sauce');
 nodes('Dialog')[0].props.onOpenChange(false);render();nodes('AlertDialogAction')[0].props.onClick();assert.equal(closed,1);
 // Optional operational setup is an explicit manager choice and survives a pending save.
 reset(CreateItemDialog,{name:'Synthetic stock item',items:[],canConfigureStock:true,pending:false,onClose:()=>closed++,onCreate:(item,configureStock)=>sent.push({item,configureStock})});assert.equal(nodes('input')[0].props.checked,false);nodes('input')[0].props.onChange({target:{checked:true}});render();props.pending=true;render();nodes('input')[0].props.onChange({target:{checked:false}});render();assert.equal(nodes('input')[0].props.checked,true,'pending save retains the setup choice');button('Create item').props.onClick();assert.equal(sent.length,0);props.pending=false;render();button('Create item').props.onClick();assert.equal(sent.length,1);assert.equal(sent[0].configureStock,true);assert.equal(sent[0].item.name,'Synthetic stock item');
 reset(CreateItemDialog,{name:'Synthetic plain item',items:[],canConfigureStock:false,onClose:()=>closed++,onCreate:(item,configureStock)=>sent.push({item,configureStock})});assert.equal(nodes('input').length,0);button('Create item').props.onClick();assert.equal(sent[0].configureStock,false,'non-manager creation cannot request setup');
 reset(CreateItemDialog,{name:garlic.name,items:[garlic],canConfigureStock:true,onClose:()=>closed++,onCreate:(item,configureStock)=>sent.push({item,configureStock})});nodes('input')[0].props.onChange({target:{checked:true}});render();button('Use existing item').props.onClick();assert.equal(sent[0].item.id,garlic.id);assert.equal(sent[0].configureStock,true,'existing reuse routes setup to its preserved identity');props.canConfigureStock=false;render();button('Use existing item').props.onClick();assert.equal(sent[1].configureStock,false,'changed permissions cannot carry a stale configuration request');
 console.log('Passed stock setup choice: explicit manager opt-in, pending retention, exact new/reused identity and role-safe routing.');
 console.log('Passed portal recovery: create/edit input retention; frozen new/existing/suggested actions; retry without closing; stale-prop guard rejection; caught validation errors.');
}finally{await rm(dir,{recursive:true,force:true});}
