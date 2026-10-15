import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const repo=process.cwd();
const dir=await mkdtemp(path.join(tmpdir(),'labula-review-fields-'));
try{
const react=path.join(dir,'react.mjs'),ui=path.join(dir,'ui.mjs');
await writeFile(react,`export const createContext=value=>({value,Provider:'Provider'}),useContext=context=>context.value;export const Fragment='Fragment';export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const useId=()=>Math.random().toString();export function useState(initial){const h=globalThis.hooks,i=h.cursor++;if(!(i in h.values))h.values[i]=typeof initial==='function'?initial():initial;return [h.values[i],v=>{h.values[i]=typeof v==='function'?v(h.values[i]):v;}];}`);
await writeFile(ui,`export const Button='Button',Input='Input',Textarea='Textarea',Checkbox='Checkbox',RadioGroup='RadioGroup',RadioGroupItem='RadioGroupItem',Choice='Choice',Field='Field',NumberField='NumberField';`);
const contents=await readFile(repo+'/app/prep-fields.tsx','utf8');
const outfile=path.join(dir,'fields.mjs');
await build({stdin:{contents:contents+'\nexport {StorageFields,TimeFields};export * from "../lib/prep-profile";export * from "../lib/prep-completion";export * from "../lib/prep-draft";',resolveDir:repo+'/app',loader:'tsx'},bundle:true,platform:'node',format:'esm',outfile,jsx:'automatic',logLevel:'silent',plugins:[{name:'primitives',setup(b){b.onResolve({filter:/^react(?:\/jsx-runtime)?$/},()=>({path:react}));b.onResolve({filter:/^@\/components\/ui\/|^\.\/recipe-ui$/},()=>({path:ui}));}}]});
const m=await import(outfile);
const flatten=n=>!n||typeof n==='boolean'?[]:Array.isArray(n)?n.flatMap(flatten):typeof n!=='object'?[n]:[n,...flatten(n.props?.children)];
const reset=()=>{globalThis.hooks={values:[],cursor:0};};
reset();let p={...m.emptyProfile(),storage:Array.from({length:12},(_,i)=>({...m.newStorageSetup(),container:'original '+i}))};const original=p.storage[0];
const render=()=>{hooks.cursor=0;return m.StorageSetups({value:p,onChange:v=>p=v});};
let tree=render();flatten(tree).find(n=>n?.props?.['aria-label']==='Remove storage setup 1').props.onClick();
tree=render();flatten(tree).find(n=>n?.type==='Button'&&n.props.children==='Add another storage setup').props.onClick();
tree=render();const blocked=flatten(tree).find(n=>n?.props?.['aria-label']==='Undo removal of storage setup 1');assert.equal(blocked.props.disabled,true);blocked.props.onClick();assert.equal(p.storage.length,12);
flatten(tree).find(n=>n?.props?.['aria-label']==='Remove storage setup 12').props.onClick();
tree=render();flatten(tree).find(n=>n?.props?.['aria-label']==='Undo removal of storage setup 1').props.onClick();assert.equal(p.storage.length,12);assert.deepEqual(p.storage[0],original);assert.equal(m.profileSchema.safeParse(p).success,true);console.log('PASS Undo free-space then recover original setup, exact content preserved');
// Old UI draft: saved batch estimate, change workflow without changing the derived field.
const base=m.cleanProfile({...m.emptyProfile(),workflow:'ahead',frequency:'daily',effort:'moderate',problems:'none',storage:[{...m.newStorageSetup(),states:['unknown'],pack:'unknown',mode:'immediate'}]});
const legacy={format:'labula-preparation-draft',version:1,account:'chef@test',queue:['item'],cursor:0,drafts:{item:{base,value:{...base,workflow:'order'},step:'preparation'}},pending:null};
const restored=m.readPrepDraft(JSON.stringify(legacy),'chef@test');const saved=m.cleanProfile(restored.drafts.item.value);assert.equal(saved.effort,null);assert.equal(m.profileCompletion(saved).complete,false);console.log('LEGACY DRAFT SEMANTICS',JSON.stringify({storedEffort:restored.drafts.item.value.effort,storedBasis:restored.drafts.item.value.effortBasis,workflow:restored.drafts.item.value.workflow,resultEffort:saved.effort,resultBasis:saved.effortBasis,complete:m.profileCompletion(saved).complete}));
for(const key of ['quality','rule']){const setup={...m.newStorageSetup(),states:['unknown'],pack:'unknown',mode:'immediate'};setup[key].value=-1;assert.equal(m.cleanProfile({...m.emptyProfile(),storage:[setup]}).storage[0][key].value,null);}
const invalid={...m.newStorageSetup(),states:['unknown'],pack:'unknown',mode:'chilled',temperature:200};assert.throws(()=>m.cleanProfile({...m.emptyProfile(),storage:[invalid]}));invalid.temperatureUnknown=true;assert.equal(m.cleanProfile({...m.emptyProfile(),storage:[invalid]}).storage[0].temperature,null);console.log('PASS hidden normalization clears only inapplicable/unknown numbers; relevant invalid temperature still rejected');
assert.deepEqual(restored.drafts.item.base,base);
const frozen=structuredClone(legacy);frozen.pending={id:crypto.randomUUID(),revision:1,command:{itemId:'item',base,next:{...base,workflow:'order',frequency:null,effortBasis:'one-order'}}};
const replay=m.readPrepDraft(JSON.stringify(frozen),'chef@test');assert.deepEqual(replay.pending,frozen.pending);assert.deepEqual(replay.drafts.item,frozen.drafts.item);console.log('PASS old-draft correction leaves confirmed base and pending receipt/draft exactly unchanged');

// Actual workflow selection resets only when its basis changes.
reset();p=structuredClone(base);tree=m.PreparationFields({value:p,onChange:v=>p=v});flatten(tree).find(n=>n?.props?.label==='How do you use this item?').props.onChange('order');assert.equal(p.effort,null);assert.equal(p.effortBasis,'one-order');
reset();p=structuredClone(base);tree=m.PreparationFields({value:p,onChange:v=>p=v});flatten(tree).find(n=>n?.props?.label==='How do you use this item?').props.onChange('ahead');assert.equal(p.effort,'moderate');
console.log('PASS actual workflow selection and preserved same-basis estimate.');
}finally{await rm(dir,{recursive:true,force:true});}
