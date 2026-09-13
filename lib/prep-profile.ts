import {z} from 'zod';

export const workflowOptions=[['supplied','Use as supplied','Straight from the pack, no preparation in our kitchen.'],['ahead','Prep ahead','Prepare before service, use later.'],['order','Prepare to order','Start when an order arrives.'],['hybrid','Prep ahead + finish to order','Some work ahead, finishing during service.'],['unknown','Not sure','']] as const;
export const frequencyOptions=[['several','Several times a day'],['daily','Once a day'],['less','Less than daily'],['irregular','No regular pattern'],['unknown','Not sure']] as const;
export const effortOptions=[['quick','Quick prep','Up to 5 minutes'],['moderate','Moderate prep','Over 5 to 15 minutes'],['labor','Labor-intensive prep','Over 15 minutes'],['unknown','Not sure','']] as const;
export const problemOptions=[['repeat','Repeated small batches','Preparing it','batch'],['setup','Time-consuming setup / cleanup','Preparing it','prep'],['minimum','Difficult to make small batches','Preparing it','batch'],['equipment','Equipment bottleneck','Preparing it','prep'],['cook','Specific cook required','Preparing it','prep'],['runout','Runs out during service','During service','all'],['replenish','Slow to replenish','During service','all'],['waste','Excess leftovers / waste','Stock & quality','all'],['quality','Quality loss','Stock & quality','all'],['space','Limited storage space','Stock & quality','all']] as const;
export const stateOptions=[['whole','Whole'],['cut','Cut'],['washed','Washed / trimmed'],['raw','Raw'],['cooked','Cooked'],['marinated','Marinated'],['thawed','Thawed'],['other','Other'],['unknown','Not sure']] as const;
export const packOptions=[['unopened','Unopened original pack'],['opened','Opened original pack'],['container','Transferred to another container'],['na','Not applicable'],['unknown','Not sure']] as const;
export const modeOptions=[['chilled','Chilled'],['frozen','Frozen'],['dry','Dry storage'],['immediate','Used immediately — not stored'],['other','Other'],['unknown','Not sure']] as const;
export const sourceOptions=[['manufacturer','Manufacturer / supplier instructions'],['procedure','Written kitchen procedure'],['experience','Experience only'],['unknown','Not sure']] as const;
export const startOptions=[['prepared','Preparation completed'],['opened','Pack opened'],['thawed','Thawing completed'],['other','Other'],['unknown','Not sure']] as const;
export const ruleOptions=[['duration','A duration'],['packdate','Follow the date on each pack'],['text','Text instructions'],['unknown','Not sure']] as const;
const short=z.string().max(600),note=z.string().max(2000),duration=z.number().finite().positive().max(100000).nullable();
export const timeSchema=z.object({value:duration,unit:z.enum(['hours','days']),unknown:z.boolean(),start:z.enum(['prepared','opened','thawed','other','unknown']).nullable(),startOther:short}).strict();
export const storageSetupSchema=z.object({id:z.string().uuid(),states:z.array(z.enum(['whole','cut','washed','raw','cooked','marinated','thawed','other','unknown'])).max(9),stateOther:short,pack:z.enum(['unopened','opened','container','na','unknown']).nullable(),mode:z.enum(['chilled','frozen','dry','immediate','other','unknown']).nullable(),temperature:z.number().finite().min(-100).max(150).nullable(),temperatureUnknown:z.boolean(),container:short,quality:timeSchema,source:z.enum(['manufacturer','procedure','experience','unknown']).nullable(),ruleKind:z.enum(['duration','packdate','text','unknown']).nullable(),rule:timeSchema,reference:short,ruleText:note}).strict();
export const profileSchema=z.object({version:z.literal(1),workflow:z.enum(['supplied','ahead','order','hybrid','unknown']).nullable(),frequency:z.enum(['several','daily','less','irregular','unknown']).nullable(),effort:z.enum(['quick','moderate','labor','unknown']).nullable(),effortBasis:z.enum(['usual-batch','ahead-batch','one-order']).nullable(),problems:z.enum(['none','yes','unknown']).nullable(),issues:z.array(z.enum(['repeat','setup','minimum','equipment','cook','runout','replenish','waste','quality','space'])).max(10),note,storage:z.array(storageSetupSchema).max(12)}).strict();
const editableTime=timeSchema.extend({value:z.number().finite().nullable()});
export const editableProfileSchema=profileSchema.extend({storage:z.array(storageSetupSchema.extend({temperature:z.number().finite().nullable(),quality:editableTime,rule:editableTime})).max(12)});
export type PrepProfile=z.infer<typeof profileSchema>;
export type StorageSetup=z.infer<typeof storageSetupSchema>;
export type PrepTime=z.infer<typeof timeSchema>;
export const emptyTime=():PrepTime=>({value:null,unit:'hours',unknown:false,start:null,startOther:''});
export const emptyProfile=():PrepProfile=>({version:1,workflow:null,frequency:null,effort:null,effortBasis:null,problems:null,issues:[],note:'',storage:[]});
export const newStorageSetup=():StorageSetup=>({id:crypto.randomUUID(),states:[],stateOther:'',pack:null,mode:null,temperature:null,temperatureUnknown:false,container:'',quality:emptyTime(),source:null,ruleKind:null,rule:emptyTime(),reference:'',ruleText:''});
export const prepAhead=(w:PrepProfile['workflow'])=>w==='ahead'||w==='hybrid';
export const effortBasis=(w:PrepProfile['workflow']):PrepProfile['effortBasis']=>w==='ahead'?'usual-batch':w==='hybrid'?'ahead-batch':w==='order'?'one-order':null;
export const relevantProblems=(w:PrepProfile['workflow'])=>problemOptions.filter(p=>p[3]==='all'||w!=='supplied'&&(p[3]!=='batch'||w!=='order'));
export const documentedSource=(s:StorageSetup['source'])=>s==='manufacturer'||s==='procedure';
function cleanTime(t:PrepTime){if(t.unknown)t.value=null;if(t.start!=='other')t.startOther='';}
export function cleanProfile(raw:PrepProfile):PrepProfile{
 const p=structuredClone(editableProfileSchema.parse(raw));
 if(!prepAhead(p.workflow))p.frequency=null;
 const basis=effortBasis(p.workflow);if(p.effortBasis&&p.effortBasis!==basis)p.effort=null;
 p.effortBasis=basis;if(!p.effortBasis)p.effort=null;
 const allowed=new Set(relevantProblems(p.workflow).map(o=>o[0]));p.issues=p.problems==='yes'?[...new Set(p.issues)].filter(i=>allowed.has(i)).sort():[];
 for(const s of p.storage){s.states=[...new Set(s.states)].sort();if(!s.states.includes('other'))s.stateOther='';if(s.temperatureUnknown)s.temperature=null;
  cleanTime(s.quality);cleanTime(s.rule);
  if(!documentedSource(s.source)){s.ruleKind=null;s.rule=emptyTime();s.reference='';s.ruleText='';}
  if(s.ruleKind!=='duration')s.rule=emptyTime();
  if(s.mode==='immediate'){s.temperature=null;s.temperatureUnknown=false;s.container='';s.quality=emptyTime();s.source=null;s.ruleKind=null;s.rule=emptyTime();s.reference='';s.ruleText='';}
 }
 return profileSchema.parse(p);
}
export function prepValidationMessage(error:unknown){
 if(!(error instanceof z.ZodError))return error instanceof Error?error.message:'Could not save these answers. Your draft is kept.';
 const issue=error.issues[0],path=issue.path;
 if(path.length===1&&path[0]==='storage')return 'Use no more than 12 storage setups. Remove a setup before adding or restoring another.';
 const labels:Record<string,string>={temperature:'Storage temperature',value:'duration',start:'starting event',startOther:'starting event description',quality:'Quality estimate',rule:'Duration in the rule',reference:'Product / document reference',ruleText:'Exact wording and conditions'};
 const at=path[0]==='storage'&&typeof path[1]==='number'?`Storage setup ${path[1]+1}: `:'';
 const field=path.slice(at?2:0).map(p=>labels[String(p)]??String(p)).join(' — ');
 return `${at}${field||'Answer'}: ${issue.message}. Your input is kept.`;
}
export function profileProblems(raw:PrepProfile):string[]{
 const p=cleanProfile(raw),errors:string[]=[];
 if(p.problems==='yes'&&!p.issues.length)errors.push('Choose at least one recurring problem, choose Not sure, or skip this item.');
 const ids=new Set<string>();for(const [i,s] of p.storage.entries()){
  const at=`Storage setup ${i+1}: `;if(ids.has(s.id))errors.push(at+'repeated setup.');ids.add(s.id);
  if(s.states.includes('raw')&&s.states.includes('cooked')||s.states.includes('whole')&&s.states.includes('cut')||s.states.includes('unknown')&&s.states.length>1)errors.push(at+'choose compatible food states.');
  if(s.states.includes('other')&&!s.stateOther.trim())errors.push(at+'describe the other food state.');
  for(const [label,t] of [['Quality duration',s.quality],['Duration in the rule',s.rule]] as const){if(t.value!==null&&!t.start)errors.push(at+label+' needs a starting event or Not sure.');if(t.start==='other'&&!t.startOther.trim())errors.push(at+label+' needs a description of when time starts.');}
  if(documentedSource(s.source)&&(s.rule.value!==null||s.ruleKind==='packdate'||s.ruleText.trim())&&!s.reference.trim())errors.push(at+'add a product or document reference for the stated rule.');
 }
 return errors;
}
export function validateProfile(raw:unknown):PrepProfile{const p=profileSchema.parse(raw),clean=cleanProfile(p);if(JSON.stringify(p)!==JSON.stringify(clean))throw Error('Some preparation answers do not apply. Review this item before saving.');const errors=profileProblems(p);if(errors.length)throw Error(errors[0]);return p;}
export const profileEmpty=(p:PrepProfile)=>JSON.stringify(cleanProfile(p))===JSON.stringify(emptyProfile());
export function sameProfile(a:PrepProfile,b:PrepProfile){return JSON.stringify(a)===JSON.stringify(b);}
export function toggleFoodState(states:StorageSetup['states'],value:StorageSetup['states'][number]):StorageSetup['states']{if(states.includes(value))return states.filter(v=>v!==value);if(value==='unknown')return ['unknown'];const opposite:Record<string,string>={raw:'cooked',cooked:'raw',whole:'cut',cut:'whole'};return [...states.filter(v=>v!=='unknown'&&v!==opposite[value]),value];}
export const optionLabel=(options:readonly (readonly string[])[],v:string|null)=>v===null?'Not answered':options.find(o=>o[0]===v)?.[1]??v;

export function equivalentProfiles(a:PrepProfile,b:PrepProfile){
 const semantic=(p:PrepProfile)=>({...p,storage:p.storage.map(({id:_,...s})=>JSON.stringify(s)).sort()});
 return JSON.stringify(semantic(a))===JSON.stringify(semantic(b));
}
