import {z} from 'zod';
import {type Notebook, recipeTitle, normalizeName} from './notebook';
import {type Field,type Answers,sessionFields,dishFields,itemFields,productionFields,storageFields,managerFields,visible,decimal} from './data-review-fields';
export const REVIEW_ID='vinohrady-cleanup-2026-09';
export const EXCLUDED_NAMES=['fried peanuts','braised beef shank','chili mayo','beef skewer'];
export type Followup={owner:string;due:string;method:string;reason:string;fields:string[]};
export type ReviewAnswer={values:Answers;confirmed:boolean;followup?:Followup};
export type ReviewData={schemaVersion:1;answers:Record<string,ReviewAnswer>;productions:{id:string;name:string}[];newItems:{id:string;name:string}[];submitted:boolean};
export type ReviewSource={notebook:Notebook;revision:number;capturedAt:string;quickCaseItems?:Record<string,string[]>;productionExcludedIds?:string[]};
export type ReviewRecord={source:ReviewSource;data:ReviewData;revision:number;updatedAt:string;updatedBy:string};
export type Card={id:string;section:'Start'|'Dishes'|'Items'|'Productions'|'Storage'|'Manager';title:string;fields:Field[];previous?:unknown;excluded?:boolean;itemId?:string};
export type Issue={path:string;message:string;hard?:boolean};
const text=z.string().max(6000);
const json:z.ZodType<unknown>=z.lazy(()=>z.union([text,z.number().finite(),z.boolean(),z.null(),z.array(json).max(200),z.record(json)]));
export const reviewSchema=z.object({schemaVersion:z.literal(1),answers:z.record(z.object({values:z.record(json),confirmed:z.boolean(),followup:z.object({owner:text,due:text,method:text,reason:text,fields:z.array(text).max(2000)}).optional()})),productions:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(160)})).max(200),newItems:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(160)})).max(200),submitted:z.boolean()}).strict();
export const emptyReview=():ReviewData=>({schemaVersion:1,answers:{},productions:[],newItems:[],submitted:false});
export const excluded=(name:string)=>EXCLUDED_NAMES.includes(normalizeName(name));
export function catalog(source:ReviewSource,data:ReviewData){return [...source.notebook.items.map(i=>({id:i.id,name:i.name})),...data.newItems];}
const targeted: {names:string[];fields:Field[]}[]=[
 {names:['labula beef broth'],fields:[{key:'legacyBroth',label:'What did the previously recorded “48 portions” refer to?',kind:'select',options:['One cooking batch','Total made in one day','Packing existing stock','Container capacity','Incorrect old value','Need to check']}]},
 {names:['labula beef base','sauce box 1','sauce box 2','sauce box 3','sauce box 4'],fields:[{key:'legacyBoxes',label:'What did “4 / 16 boxes” mean?',kind:'select',options:['4 boxes total','16 boxes total','4 sets of 16','Not my record','Need to check']},{key:'legacyBoxWork',label:'Did the base’s 30 minutes include preparing these boxes?',kind:'select',options:['All','Some — specify tasks below','None','Need to check']},{key:'legacyBoxTasks',label:'Identify the included tasks and which shared production owns them'}]},
 {names:['minced pork'],fields:[{key:'legacyBags',label:'How many filled bags did “3 / 3 bags” mean?',kind:'select',options:['3','9','Another count — specify below','Need to count']},{key:'receivedPork',label:'What meat do you receive today?',kind:'select',options:['Whole meat','Pre-minced meat','Finished cooked preparation','Need to check']}]},
 {names:['ginger garlic water'],fields:[{key:'legacyCubes',label:'How many containers did “2 / 2 cubes” mean?',kind:'select',options:['2','4','Another count — specify below','Need to count']}]},
 {names:['rice'],fields:[{key:'legacyRice',label:'What did “2 rice cookers” count?',kind:'select',options:['Machines','Cooking runs','Filled containers','Need to check']},{key:'riceEvents',label:'What did “2 per service” count?',kind:'select',options:['Full cooks','Top-ups','Reheating','Other event — specify below','Need to check']},{key:'riceState',label:'Which state did “dry, 2 days” describe?',kind:'select',options:['Raw dry rice','Cooked hot-held rice','Cooked chilled rice','Incorrect entry','Need to check']}]},
 {names:['fermented noodles'],fields:[{key:'noodleOperation',label:'Which operation produced the recorded 86 portions?',kind:'select',options:['Making noodles','Fermenting','Cooking bought noodles','Portioning bought noodles','Several steps — specify below','Need to check']}]},
 {names:['braised chicken feet'],fields:[{key:'feetRoutine',label:'What is the current routine?',kind:'select',options:['Every week','Every two weeks','Stock-triggered','No longer prepared','Need to check']},{key:'feetWork',label:'What did the recorded work include?',kind:'select',options:['Only additional feet work','Shared cooking work','Need to check']}]},
 {names:['beef shank cubes'],fields:[{key:'cubeWork',label:'What did 60 minutes describe?',kind:'select',options:['One full batch','Whole day','Elapsed cooking time','Work counted in another production','Need to check']}]},
 {names:['minced garlic'],fields:[{key:'garlicWork',label:'What did 15 minutes include?',kind:'select',options:['One batch including setup and cleanup','Mincing only','Whole-day total','Need to check']}]},
 {names:['chicken broth'],fields:[{key:'brothStored',label:'Is any cooked broth kept for later?',kind:'select',options:['Yes','No','Need to check']}]},
 {names:['woodear','marinated woodear','woodear maination sauce'],fields:[{key:'woodearRelation',label:'How are the marinated woodear and its sauce related?',kind:'select',options:['Woodear contains the sauce','Different recipes','Same finished product under two names','Need to check']}]},
 {names:['universal sauce 1','universal sauce 2'],fields:[{key:'sauceRoutine',label:'Which routine is true today?',kind:'select',options:['Twice weekly','Once weekly on Monday','Another schedule — specify below','Monday was only a suggestion','Need to check']}]},
 {names:['xiao mian base'],fields:[{key:'baseRelation',label:'How does this relate to Universal sauce 2?',kind:'select',options:['Same item','Component of it','Separate unused preparation','Separate used preparation','Need to check']}]},
 {names:['coriander'],fields:[{key:'corianderSix',label:'Which state did the six-hour quality period describe?',kind:'select',options:['Washed whole','Chopped chilled reserve','Chopped at service','Incorrect entry','Need to check']}]},
 {names:['mustard','yellow sauce','brown sauce'],fields:[{key:'planned',label:'Has the planned menu change actually happened?',kind:'select',options:['Still used','Already replaced / removed','Planned but not implemented','Need to check']}]},
 {names:['universal sauce 1','fermented chili','minced garlic','ginger garlic water','fermented noodles','seasonal veggies','universal sauce 2','chicken broth','mushroom'],fields:[{key:'effortConflict',label:'Do the older effort band and the newer minutes describe the same batch and tasks?',kind:'select',options:['Yes — one figure was wrong','Different batch sizes','Different tasks','Practice changed','Need to check']}]},
];
export function cards(source:ReviewSource,data:ReviewData):Card[]{
 const list:Card[]=[{id:'session',section:'Start',title:'People, period & current routine',fields:sessionFields}];
 for(const r of source.notebook.recipes)list.push({id:`dish:${r.id}`,section:'Dishes',title:recipeTitle(r,source.notebook),fields:data.answers[`dish:${r.id}`]?.values.status==='Removed'?dishFields.filter(f=>['status','statusDetail'].includes(f.key)):dishFields,previous:r});
 for(const item of catalog(source,data)){
  const original=source.notebook.items.find(i=>i.id===item.id),out=excluded(item.name);
  const fs=itemFields.map(field=>{
   if(out&&field.key==='productionMode')return {...field,options:['Outside production review']};
   if(out&&field.key==='incidents')return {...field,fields:field.fields?.filter(f=>!['minutes','people','workScope'].includes(f.key))};
   return field;
  });
  const identity=data.answers[`item:${item.id}`]?.values.identity;
  const itemFs=identity==='Alias of another item'||identity==='Seasonal / general placeholder'?fs.filter(f=>['identity','target','identityEvidence'].includes(f.key)):fs;
  const extras=targeted.filter(t=>t.names.includes(normalizeName(item.name))).flatMap(t=>t.fields);
  if(extras.length)itemFs.push(...extras,{key:'legacyResolution',label:'Explain the correction and link it to the current batch, tasks or product state'});
  list.push({id:`item:${item.id}`,itemId:item.id,section:'Items',title:item.name,fields:itemFs,excluded:out,previous:original});
  // Aliases/placeholder identities must be settled first; do not duplicate their storage records.
  const a=data.answers[`item:${item.id}`]?.values;
  if(a?.identity!=='Alias of another item'&&a?.identity!=='Seasonal / general placeholder')list.push({id:`storage:${item.id}`,itemId:item.id,section:'Storage',title:item.name,fields:storageFields,excluded:out,previous:original?.prepProfile});
 }
 for(const p of data.productions)list.push({id:`production:${p.id}`,section:'Productions',title:p.name,fields:productionFields});
 list.push({id:'manager',section:'Manager',title:'Manager follow-ups',fields:managerFields});return list;
}
export function initialValues(card:Card,source:ReviewSource):Answers{
 if(card.section==='Dishes'){const r=source.notebook.recipes.find(r=>`dish:${r.id}`===card.id);return {parts:r?.inputs.map(p=>({item:p.itemId}))??[]};}
 if(card.section==='Productions')return {name:card.title};return {};
}
function checkFields(fields:Field[],a:Answers,path:string,issues:Issue[]){
 for(const f of fields){if(!visible(f,a))continue;const p=path+f.key,v=a[f.key];
  if(v===undefined||v===null||(typeof v==='string'&&!v.trim())||(Array.isArray(v)&&!v.length)){if(!f.optional)issues.push({path:p,message:f.label+': answer needed'});continue;}
  if(f.kind==='rows'){
   if(!Array.isArray(v)){issues.push({path:p,message:f.label+': add rows',hard:true});continue;}
   v.forEach((row,i)=>{if(!row||typeof row!=='object'||Array.isArray(row))issues.push({path:p,message:'Invalid row',hard:true});else checkFields(f.fields??[],row as Answers,`${p}.${i}.`,issues);});
  }else if(f.kind==='number'){
   const num=decimal(v);if(num===null||(f.min!==undefined&&num<f.min)||(f.max!==undefined&&num>f.max)||(f.integer&&!Number.isInteger(num)))issues.push({path:p,message:f.label+': enter a valid '+(f.integer?'whole number':'number')+(f.min===0?' (zero only if confirmed)':''),hard:true});
  }else if(f.kind==='select'&&(!f.options?.includes(String(v))))issues.push({path:p,message:f.label+': choose an option',hard:true});
  else if(f.kind==='multi'&&(!Array.isArray(v)||v.some(x=>!f.options?.includes(String(x)))))issues.push({path:p,message:f.label+': select valid options',hard:true});
  else if(f.kind==='date'&&(typeof v!=='string'||!validDate(v)))issues.push({path:p,message:f.label+': enter a real date',hard:true});
  if(Array.isArray(v)&&v.includes('Need to check'))issues.push({path:p,message:f.label+': verification needed'});
  if(typeof v==='string'&&/^(Need to |Not known$|Not checked$|Not recorded$|Not counted$|Not established$|Another output needs|No documented rule|Follow-up needed$|Unknown$)/.test(v))issues.push({path:p,message:f.label+': verification needed'});
 }
}
export function validDate(v:string){return /^\d{4}-\d{2}-\d{2}$/.test(v)&&!Number.isNaN(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;}
export const rowList=(v:unknown):Answers[]=>Array.isArray(v)?v as Answers[]:[];
export function cardIssues(card:Card,source:ReviewSource,data:ReviewData):Issue[]{
 const a=data.answers[card.id]?.values??initialValues(card,source),issues:Issue[]=[];checkFields(card.fields,a,'',issues);
 const issue=(path:string,message:string,hard=false)=>issues.push({path,message,hard});
 const ids=new Set(catalog(source,data).map(i=>i.id));
 function references(fs:Field[],v:Answers,path=''){for(const f of fs){if(!visible(f,v))continue;const x=v[f.key];if(f.kind==='item'&&x&&!ids.has(String(x)))issue(path+f.key,'Choose an existing item',true);if(f.kind==='recipe'&&x&&!source.notebook.recipes.some(r=>r.id===x))issue(path+f.key,'Choose an existing recipe',true);if(f.kind==='production'&&x&&!data.productions.some(p=>p.id===x))issue(path+f.key,'Choose an existing production',true);if(f.kind==='rows')rowList(x).forEach((r,i)=>references(f.fields??[],r,`${path}${f.key}.${i}.`));}}references(card.fields,a);
 const today=new Date().toISOString().slice(0,10);
 if(card.id==='session'){
  for(const key of ['effective','interview','end'])if(typeof a[key]==='string'&&String(a[key])>today)issue(key,'Current practice and observations cannot be in the future',true);
  if(validDate(String(a.start))&&validDate(String(a.end))&&Date.parse(String(a.end))-Date.parse(String(a.start))!==13*86400000)issue('end','Use one closed 14-day reference period',true);
  if(a.end===today)issue('end','Use a completed period ending before today',true);
  if(a.changed==='Yes')issue('changed','Practice changed: separate the observations into comparable versions before calculating labour');
 }
 if(card.section==='Items'){
  const work=Array.isArray(a.work)?a.work:[];
  if(work.includes('No preparation')&&work.length>1)issue('work','No preparation cannot be combined with other tasks',true);
  if(a.target===card.itemId)issue('target','An item cannot refer to itself',true);
  if(a.source==='Made here'&&work.includes('No preparation'))issue('work','Made here requires the actual production tasks, or an explicit check',true);
  if(!card.excluded&&work.length&&!work.includes('No preparation')&&a.productionMode==='No production here')issue('productionMode','Link the actual work to a production, or mark it for checking',true);
  if(!card.excluded&&a.productionMode==='Outside production review')issue('productionMode','Only the four agreed preparations are outside production review',true);
  if(a.productionMode==='Link a production'){
   const p=data.answers[`production:${a.production}`]?.values;
   if(!rowList(p?.outputs).some(o=>o.item===card.itemId))issue('production','This item must be an output of the linked production');
  }
  if(a.identity==='Alias of another item'||a.identity==='Seasonal / general placeholder')issue('identity','Identity change needs manager review before applying it to recipes');
 }
 if(card.section==='Dishes'){
  const parts=rowList(a.parts),seen=new Set();if(a.status==='Served now'&&a.complete==='All listed'&&!parts.some(p=>p.use&&p.use!=='Not used'))issue('parts','A served dish needs at least one included component',true);for(const [i,p]of parts.entries()){if(seen.has(p.item))issue(`parts.${i}.item`,'Repeated component: specify one row per exact item',true);seen.add(p.item);}
  if(a.sameRecipe&&`dish:${a.sameRecipe}`===card.id)issue('sameRecipe','A duplicate must point to a different listing',true);
  if(a.status==='Same as another listing')issue('status','Duplicate listing needs manager confirmation and POS mapping');
 }
 if(card.section==='Productions'){
  const outs=rowList(a.outputs),inputs=rowList(a.inputs),session=data.answers.session?.values;
  if(a.capacity==='Known'&&decimal(a.minimum)!==null&&decimal(a.maximum)!==null&&decimal(a.minimum)!>decimal(a.maximum)!)issue('minimum','Minimum exceeds maximum in the same unit',true);
  for(const [i,o]of outs.entries())if(excluded(catalog(source,data).find(x=>x.id===o.item)?.name??'')&&o.scope!=='Outside review')issue(`outputs.${i}.scope`,'This output’s quantity is outside the agreed review',true);
  const duplicate=new Set();for(const [i,o]of outs.entries()){if(duplicate.has(o.item))issue(`outputs.${i}.item`,'List an output only once',true);duplicate.add(o.item);}
  if(outs.some(o=>o.scope==='Outside review')&&a.scope!=='Shared production outside this review')issue('scope','A shared output is outside review: mark the shared work accordingly',true);
  for(const [i,r]of inputs.entries())if(r.origin!=='Earlier batch'&&outs.some(o=>o.item===r.item))issue(`inputs.${i}.item`,'Self input requires a traceable earlier batch',true);
  for(const [i,r]of rowList(a.tasks).entries())if(r.scope==='Only one output'&&!outs.some(o=>o.item===r.output))issue(`tasks.${i}.output`,'Select an output of this production',true);
  for(const [i,r]of rowList(a.packages).entries())if(/\d/.test(String(r.type??'')))issue(`packages.${i}.type`,'Put the count in its number field, not the container name',true);
  const events=rowList(a.events),dates=new Set(events.map(e=>e.date));if(dates.size!==events.length)issue('events','A day is listed more than once',true);
  if(session?.start&&session?.end){for(let d=Date.parse(String(session.start));d<=Date.parse(String(session.end));d+=86400000)if(!dates.has(new Date(d).toISOString().slice(0,10)))issue('events','Some days in the reference period are not recorded');for(const e of events)if(String(e.date)<String(session.start)||String(e.date)>String(session.end))issue('events','An event is outside the shared reference period',true);}
  if(a.scope!=='Only products within this review')issue('scope','Full labour total unavailable: shared work is not fully in scope');
  for(const r of rowList(a.packages)){const o=outs.find(o=>o.item===r.item),c=decimal(r.count),net=decimal(r.content),output=decimal(o?.amount);if(o&&c!==null&&net!==null&&output!==null&&r.phase===o.phase){const normalized=(x:number,u:unknown)=>x*(u==='kg'||u==='l'?1000:1);const family=(u:unknown)=>u==='g'||u==='kg'?'mass':u==='ml'||u==='l'?'volume':'pieces';if(family(r.unit)===family(o.unit)&&Math.abs(normalized(c*net,r.unit)-normalized(output,o.unit))>0.01)issue('packages','Pack count × net content does not match the recorded output',true);}}
 }
 if(card.section==='Manager'){const seen=new Set<string>();for(const [i,row]of rowList(a.mapping).entries()){const key=JSON.stringify([row.code,row.modifiers,row.effective]);if(seen.has(key))issue(`mapping.${i}.code`,'This POS code and modifiers already identify another recipe in this period',true);seen.add(key);}}
 if(card.section==='Storage')for(const [i,s]of rowList(a.states).entries()){
  if((s.state==='Thawed'&&s.mode==='Frozen')||(s.state==='Frozen'&&s.mode!=='Frozen'))issue(`states.${i}.mode`,'Frozen and thawed must be separate storage states',true);
  if(['Supplier instruction','Approved kitchen procedure'].includes(String(s.rule)))issue(`states.${i}.rule`,'Documented rule collected; responsible person still needs to verify applicability');
  const clocks=Array.isArray(s.clocks)?s.clocks:[];if(clocks.includes('No additional rule documented')&&clocks.length>1)issue(`states.${i}.clocks`,'Choose documented clocks or no additional documented rule',true);
 }
 return [...new Map(issues.map(i=>[i.path+':'+i.message,i])).values()];
}
export function stateFor(card:Card,source:ReviewSource,data:ReviewData){const answer=data.answers[card.id],issues=cardIssues(card,source,data);if(!answer?.confirmed)return 'Draft';if(!issues.length)return 'Answered';const t=answer.followup;if(!issues.some(i=>i.hard)&&t&&t.owner.trim()&&validDate(t.due)&&t.method.trim()&&t.reason.trim()&&issues.every(i=>t.fields.includes(i.path)))return 'Needs checking';return 'Draft';}
export function integrityIssues(source:ReviewSource,data:ReviewData){
 const issues:string[]=[],names=new Set(source.notebook.items.map(i=>normalizeName(i.name))),ids=new Set<string>();
 for(const i of data.newItems){if(names.has(normalizeName(i.name)))issues.push('A new item duplicates an existing name.');names.add(normalizeName(i.name));if(ids.has(i.id))issues.push('Duplicate ID');ids.add(i.id);}
 const pids=new Set<string>();for(const p of data.productions){if(pids.has(p.id))issues.push('Duplicate production ID');pids.add(p.id);}
 const graph=new Map<string,string[]>(),outputOwners=new Map<string,string>();
 for(const item of catalog(source,data)){const a=data.answers[`item:${item.id}`]?.values;if(a?.identity==='Alias of another item'&&a.target)graph.set(item.id,[String(a.target)]);}
 for(const p of data.productions){const a=data.answers[`production:${p.id}`]?.values??{};for(const o of rowList(a.outputs)){if(outputOwners.has(String(o.item))&&outputOwners.get(String(o.item))!==p.id)issues.push('An output is assigned to multiple productions. Use separate physical stages or resolve the duplicate work.');outputOwners.set(String(o.item),p.id);const prior=graph.get(String(o.item))??[];graph.set(String(o.item),[...prior,...rowList(a.inputs).filter(i=>i.origin!=='Earlier batch').map(i=>String(i.item))]);}}
 const visiting=new Set<string>(),done=new Set<string>();function visit(id:string){if(visiting.has(id)){issues.push('Production inputs contain a cycle. Identify earlier-lot material separately.');return;}if(done.has(id))return;visiting.add(id);for(const next of graph.get(id)??[])visit(next);visiting.delete(id);done.add(id);}for(const id of graph.keys())visit(id);
 return [...new Set(issues)];
}
export function validateReview(source:ReviewSource,raw:unknown):ReviewData{
 const data=reviewSchema.parse(raw) as ReviewData;
 if(data.submitted){const integrity=integrityIssues(source,data);if(integrity.length)throw Error(integrity.join(' '));const pending=cards(source,data).filter(c=>stateFor(c,source,data)==='Draft');if(pending.length)throw Error(`Finish or assign precise follow-ups for ${pending.length} cards before submitting.`);}
 return data;
}

// Analysis export follows only visible branches. Raw answers remain alongside it for traceability.
export function analysisExport(source:ReviewSource,data:ReviewData){
 const normalize=(fs:Field[],a:Answers):Answers=>Object.fromEntries(fs.filter(f=>visible(f,a)&&a[f.key]!==undefined).map(f=>[f.key,f.kind==='number'?decimal(a[f.key]):f.kind==='rows'?rowList(a[f.key]).map(row=>normalize(f.fields??[],row)):a[f.key]]));
 return cards(source,data).map(c=>({id:c.id,title:c.title,section:c.section,status:stateFor(c,source,data),outsideProductionReview:!!c.excluded,answers:normalize(c.fields,data.answers[c.id]?.values??{}),checks:cardIssues(c,source,data),followup:data.answers[c.id]?.followup??null}));
}
