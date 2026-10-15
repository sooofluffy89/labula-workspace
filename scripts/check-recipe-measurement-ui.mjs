import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/labula-measurement-ui-');
try{
 const react=dir+'/react.mjs',ui=dir+'/ui.mjs',outfile=dir+'/test.mjs';
 await writeFile(react,`export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export function useState(initial){const h=globalThis.measurementHooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],v=>{const next=typeof v==='function'?v(h.values[i]):v;if(next!==h.values[i]){h.values[i]=next;h.dirty=true;}}];}export function useRef(initial){const h=globalThis.measurementHooks,i=h.cursor++;return h.values[i]??(h.values[i]={current:initial});}export function useEffect(fn,deps){const h=globalThis.measurementHooks,i=h.cursor++;if(!h.values[i]||deps.some((x,j)=>x!==h.values[i][j])){h.values[i]=deps;h.effects.push(fn);}}export const createContext=value=>({value,Provider:'Provider'});export const useContext=context=>context.value;export const useId=()=>'field-id';export const cloneElement=(node,props)=>({...node,props:{...node.props,...props}});export const isValidElement=node=>!!node&&typeof node==='object'&&'type' in node;`);
 await writeFile(ui,`export const Input='Input',Button='Button',Dialog='Dialog',DialogContent='DialogContent',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogDescription='DialogDescription';`);
 await build({stdin:{contents:"export * from './app/recipe-measurement';export {newItem} from './lib/notebook';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',logLevel:'silent',plugins:[{name:'primitives',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},()=>({path:react}));b.onResolve({filter:/^@\/components\/ui\//},()=>({path:ui}));}}]});
 const m=await import(outfile),flatten=node=>Array.isArray(node)?node.flatMap(flatten):node&&typeof node==='object'&&'props'in node?[node,...flatten(node.props.children)]:node==null||typeof node==='boolean'?[]:[node],text=node=>flatten(node).filter(v=>['string','number'].includes(typeof v)).join('');
 let tree,component,props;
 const reset=(fn,next)=>{globalThis.measurementHooks={cursor:0,values:[],effects:[],dirty:false};component=fn;props=next;render();};
 const render=()=>{for(let attempt=0;attempt<10;attempt++){const h=globalThis.measurementHooks;h.cursor=0;h.dirty=false;tree=component(props);for(const effect of h.effects.splice(0))effect();if(!h.dirty)return;}throw Error('measurement render loop');};
 const nodes=type=>flatten(tree).filter(n=>n?.type===type),button=label=>nodes('Button').find(n=>text(n)===label),input=()=>nodes('Input')[0];
 let saved=[],dirty=[];
 reset(m.QuantityValue,{label:'Synthetic quantity',value:2,disabled:false,onChange:value=>{saved.push(value);props.value=value;},onDraftChange:value=>dirty.push(value)});
 for(const invalid of ['0','-1','NaN','1e3','1,2,3','1000000001']){input().props.onChange({target:{value:invalid}});render();assert.equal(input().props.value,invalid);assert.equal(input().props['aria-invalid'],true);assert.equal(saved.length,0);input().props.onBlur();render();assert.equal(input().props.value,invalid,'blur cannot erase an invalid local draft');assert(dirty.at(-1));}
 input().props.onChange({target:{value:'0,5'}});render();assert.deepEqual(saved,[0.5]);assert.equal(input().props['aria-invalid'],false);input().props.onBlur();render();assert.equal(input().props.value,'0.5');assert.equal(dirty.at(-1),false);
 input().props.onChange({target:{value:''}});render();assert.deepEqual(saved,[0.5,null]);
 props.onChange=()=>false;render();input().props.onChange({target:{value:'3'}});render();assert.equal(input().props.value,'3');assert.equal(input().props['aria-invalid'],true);assert.match(text(tree),/could not be applied/);nodes('button').find(n=>text(n)==='Reset value').props.onClick();render();assert.equal(input().props.value,'');assert.equal(input().props['aria-invalid'],false);
 // Field-level validation reaches the actual input rendered inside QuantityValue.
 props['aria-invalid']=true;props['aria-describedby']='synthetic-field-error';render();assert.equal(input().props['aria-invalid'],true);assert.equal(input().props['aria-describedby'],'synthetic-field-error');delete props['aria-invalid'];delete props['aria-describedby'];render();
 // A focused but untouched field must not turn a newer peer value into an edit.
 let peerWrites=[];
 reset(m.QuantityValue,{label:'Peer quantity',value:5,disabled:false,onChange:value=>peerWrites.push(value)});
 input().props.onFocus();props.value=9;render();input().props.onBlur();render();
 assert.deepEqual(peerWrites,[],'leaving an untouched focused quantity must not overwrite a refreshed peer value');
 assert.equal(input().props.value,'9','the refreshed value remains visible after leaving the field');
 // Invalid local text survives a peer refresh and can be reset to its new base.
 reset(m.QuantityValue,{label:'Peer quantity',value:5,disabled:false,onChange:value=>peerWrites.push(value)});
 input().props.onFocus();input().props.onChange({target:{value:'invalid local'}});render();props.value=9;render();
 assert.equal(input().props.value,'invalid local');input().props.onBlur();render();assert.equal(input().props.value,'invalid local');
 assert.deepEqual(peerWrites,[]);nodes('button').find(n=>text(n)==='Reset value').props.onClick();render();assert.equal(input().props.value,'9');
 reset(m.QuantityValue,{label:'Peer quantity',value:5,disabled:false,onChange:value=>{peerWrites.push(value);props.value=value;}});
 input().props.onFocus();input().props.onChange({target:{value:'7'}});render();props.value=9;render();input().props.onBlur();render();
 assert.deepEqual(peerWrites,[7],'blur does not reapply an earlier valid edit over a peer refresh');assert.equal(input().props.value,'9');
 const item={...m.newItem('Synthetic unit item'),id:'measure-ui-item'},part={itemId:item.id,amount:2,unit:'g',pieceMeaning:'',conversion:null,note:'Keep note'};let writes=[],scopeDirty=[];
 reset(m.RecipeUnit,{item,part,disabled:false,onChange:value=>writes.push(value),onDraftChange:value=>scopeDirty.push(value)});
 nodes('select')[0].props.onChange({target:{value:'pcs'}});render();assert.equal(writes.length,0,'unit selection alone cannot reinterpret existing amount');assert.equal(button('Save new unit').props.disabled,true);assert.equal(scopeDirty.at(-1),true);
 const quantity=flatten(tree).find(n=>typeof n?.type==='function'&&n.type.name==='QuantityValue');quantity.props.onChange(0.5);render();assert.equal(button('Save new unit').props.disabled,false);button('Save new unit').props.onClick();render();assert.deepEqual(writes,[{...part,amount:0.5,unit:'pcs',conversion:null}]);assert.equal(scopeDirty.at(-1),false);
 reset(m.RecipeUnit,{item,part,disabled:false,onChange:value=>writes.push(value),onDraftChange:value=>scopeDirty.push(value)});nodes('select')[0].props.onChange({target:{value:'ml'}});render();const unknown=nodes('input').find(n=>n.props.type==='checkbox');unknown.props.onChange({target:{checked:true}});render();assert.equal(button('Save new unit').props.disabled,false);button('Save new unit').props.onClick();render();assert.equal(writes.at(-1).amount,null);assert.equal(writes.at(-1).unit,'ml','unknown must be an explicit choice');
 const converted={...part,amount:0.5,unit:'pcs',pieceMeaning:'one vegetable',conversion:{from:'pcs',to:'g',factor:240}};
 reset(m.RecipeUnit,{item,part:converted,disabled:false,onChange:value=>writes.push(value)});nodes('select')[0].props.onChange({target:{value:'g'}});render();button('Use recorded conversion: 120 g').props.onClick();render();button('Save new unit').props.onClick();render();assert.equal(writes.at(-1).amount,120);assert.equal(writes.at(-1).unit,'g');
 let closed=0,attempts=0;
 reset(m.MeasurementDetails,{item,part:converted,disabled:false,onChange:()=>{attempts++;return false;},onClose:()=>closed++});button('Save measurement').props.onClick();assert.equal(closed,1);assert.equal(attempts,0,'saving unchanged measurement is a no-op');
 const factor=flatten(tree).find(n=>typeof n?.type==='function'&&n.type.name==='QuantityValue');factor.props.onChange(250);render();button('Save measurement').props.onClick();render();assert.equal(closed,1);assert.equal(attempts,1);assert.match(text(tree),/could not be applied/);assert.equal(flatten(tree).find(n=>typeof n?.type==='function'&&n.type.name==='QuantityValue').props.value,250,'rejected values stay visible');
 console.log('PASS measurement UI: invalid input and rejected drafts retained, decimal comma, explicit new-unit amount/unknown choice, recorded conversion, no-op save and failed commit.');
}finally{await rm(dir,{recursive:true,force:true});}
