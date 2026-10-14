// English interview content. Values are explicit; no factual answer is selected by default.
export type Answers = Record<string, unknown>;
export type Field = {key:string;label:string;kind?:'text'|'date'|'number'|'select'|'multi'|'rows'|'items'|'item'|'production'|'recipe';options?:string[];fields?:Field[];help?:string;optional?:boolean;when?:[string,string[]];integer?:boolean;min?:number;max?:number};
const f=(key:string,label:string,kind:Field['kind']='text',extra:Partial<Field>={}):Field=>({key,label,kind,...extra});
const pick=(key:string,label:string,options:string[],extra:Partial<Field>={})=>f(key,label,'select',{options,...extra});
const rows=(key:string,label:string,fields:Field[],extra:Partial<Field>={})=>f(key,label,'rows',{fields,...extra});
const n=(key:string,label:string,extra:Partial<Field>={})=>f(key,label,'number',{min:0.000001,...extra});
export const yes=['Yes','No','Need to check'];
export const units=['g','kg','ml','l','pieces'];
export const phases=['Raw','Washed','Cut','Cooked','Drained','Frozen','Thawed','Ready to serve'];
const amount=[n('amount','Net amount'),pick('unit','Unit',units),pick('phase','State',phases)];
const basis=pick('basis','Evidence',['Measured','Current written standard','Estimate','Need to check']);
const dateEvidence=f('evidence','Evidence: date, who measured, sample count or exact procedure reference','text',{help:'For an estimate, explain what the estimate is based on.'});
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
export const sessionFields:Field[]=[
 f('name','Who is confirming these answers?'),pick('role','Role',['Chef','Head chef','Manager','Chef and manager together']),f('interview','Interview date','date'),f('effective','This way of working has been normal since','date'),
 pick('changed','Did the practice change during the reference period?',yes),f('change','What changed and on which date?','text',{when:['changed',['Yes']]}),
 f('start','Reference period: first day','date'),f('end','Reference period: last day','date'),pick('typical','Was this a normal period?',['Typical','Unusually quiet','Unusually busy','Menu changed','Need to check']),f('exceptions','Affected dates and reason','text',{when:['typical',['Unusually quiet','Unusually busy','Menu changed']]}),
 f('days','Open days','multi',{options:weekdays}),rows('services','Services',[f('name','Service name'),f('days','Days','multi',{options:weekdays})]),f('prepDays','Days when advance preparation takes place','multi',{options:weekdays}),
 pick('planning','How is tomorrow’s preparation decided?',['Evening stock check','Morning stock check','Fixed prep list','Visual judgement during service','No consistent routine','Other']),f('handover','Who checks, when, where is the list, and who takes over?'),
];
export const dishFields:Field[]=[
 pick('status','Is this exact variant served now?',['Served now','Temporarily unavailable','Removed','Same as another listing','Rotating dish','Need to check']),
 f('statusDetail','Effective date and current version / change','text',{when:['status',['Temporarily unavailable','Removed','Same as another listing','Rotating dish']]}),
 f('sameRecipe','Which exact listing is the same dish?','recipe',{when:['status',['Same as another listing']]}),
 rows('parts','One plated serving: check every component',[
 f('item','Ingredient / preparation','item'),pick('use','How is it included?',['Always included','Optional extra','Alternative choice','Not used']),
 f('alternative','Choice group name','text',{when:['use',['Alternative choice']]}),n('choiceCount','How many items from this group go on one plate?',{integer:true,when:['use',['Alternative choice']]}),
 pick('amountKnown','Do you know the amount per plated serving?',['Yes','Need to measure'],{when:['use',['Always included','Optional extra','Alternative choice']]}),
 ...amount.map(x=>({...x,when:['amountKnown',['Yes']] as [string,string[]]})),{...basis,when:['amountKnown',['Yes']]},{...dateEvidence,when:['amountKnown',['Yes']]},
 ]),
 pick('complete','Are all oils, sauces, sides and garnishes listed?',['All listed','Need to check']),
 rows('finish','Work after the order arrives',[f('task','Task'),f('station','Station / equipment'),n('minutes','Hands-on minutes'),n('people','People',{integer:true}),n('servings','Servings handled together',{integer:true}),n('wait','Unattended waiting minutes',{min:0}),pick('service','Service conditions',['Quiet','Busy','Same in both']),basis,dateEvidence]),
];
export const itemFields:Field[]=[
 pick('identity','What does this name refer to?',['Physical product','Kit of separate containers','Alias of another item','Seasonal / general placeholder','Need to check']),
 f('target','Which actual item?','item',{when:['identity',['Alias of another item','Seasonal / general placeholder']]}),
 f('identityEvidence','Explain the same product and processing state, or the current seasonal version','text',{when:['identity',['Alias of another item','Seasonal / general placeholder']]}),
 rows('kit','Separate physical components',[f('item','Component','item'),n('count','Number',{integer:true})],{when:['identity',['Kit of separate containers']]}),
 pick('source','How does it reach this kitchen?',['Bought ready to use','Bought and processed here','Made here','Prepared elsewhere and delivered','Need to check']),
 f('supplier','Supplier / cook, received state and available product specification','text',{when:['source',['Bought ready to use','Prepared elsewhere and delivered']]}),
 f('work','What do you do to it here?','multi',{options:['No preparation','Wash','Soak','Peel','Cut or mince','Mix','Marinate','Cook','Cool','Freeze','Thaw','Portion','Pack and label','Other']}),
 f('workOther','Describe the other task','text',{when:['work',['Other']]}),
 pick('productionMode','Which production makes or changes it?',['Link a production','No production here','Outside production review','Need to check']),
 f('production','Shared production','production',{when:['productionMode',['Link a production']]}),
 pick('otherUses','Where else is it used?',['Only in the listed dishes','Other local uses','Need to check']),f('uses','Other dishes, extras, staff meals or other local use','text',{when:['otherUses',['Other local uses']]}),
 pick('routine','Can another cook reproduce it?',['Current written procedure','Experience only','Only one person makes it','Not checked']),f('procedure','Procedure reference, or cook / backup and what is missing'),
 pick('problems','Problems in the reference period',['Happened','Did not happen in this period','No longer happens','Only a future improvement idea','Need to check']),
 f('resolved','Since when and what changed?','text',{when:['problems',['No longer happens']]}),
 rows('incidents','Actual incidents',[f('date','Date / exact service'),pick('type','Type',['Repeated prep','Ran out','Emergency top-up','Setup / cleanup','Equipment queue','Storage space','Quality loss','Missing procedure','Other']),f('detail','What happened?'),pick('countKnown','Count known?',['Yes','Not counted']),n('count','Occurrences',{min:1,integer:true,when:['countKnown',['Yes']]}),pick('workScope','Extra work',['Already counted in a production','Additional work','Need to check']),n('minutes','Extra active minutes',{when:['workScope',['Additional work']]}),n('people','People',{integer:true,when:['workScope',['Additional work']]}),n('delay','Service delay in minutes',{min:0,optional:true})],{when:['problems',['Happened']]}),
 pick('unused','Unused product in the reference period',['No unused product observed','Movements recorded below','Not recorded']),
 rows('movements','Stock movements',[f('date','Date','date'),f('lot','Batch or lot'),pick('type','Movement',['Kept as usable stock','Into another preparation','Staff meals','Discarded finished stock','Production loss']),...amount,f('destination','Destination / reason')],{when:['unused',['Movements recorded below']]}),
];
export const productionFields:Field[]=[
 f('name','Production name'),pick('assembly','Does this step only portion, pack or assemble existing products?',yes),
 pick('scope','Does it share work with a product outside this review?',['Only products within this review','Shared production outside this review','Need to check']),
 f('outside','Name the shared product / work outside this review','text',{when:['scope',['Shared production outside this review']]}),
 rows('inputs','Inputs for this one production',[f('item','Ingredient or finished preparation','item'),pick('purpose','Purpose',['Kept in the product','Processing medium']),pick('origin','Origin',['New input','Earlier batch']),f('lot','Earlier lot reference','text',{when:['origin',['Earlier batch']]}),pick('known','Input quantity',['Known','Need to measure']),...amount.map(x=>({...x,when:['known',['Known']] as [string,string[]]})),f('fate','Where does the processing medium go?','text',{when:['purpose',['Processing medium']]})]),
 rows('outputs','All outputs of this same production',[f('item','Output','item'),pick('type','Output type',['Usable output','Carry-over material','Discarded material']),pick('scope','Output quantity',['Within review','Outside review','Need to measure']),...amount.map(x=>({...x,when:['scope',['Within review']] as [string,string[]]})),{...basis,when:['scope',['Within review']]},{...dateEvidence,when:['scope',['Within review']]},f('use','Next use / destination')]),
 pick('outputsComplete','Are all outputs listed?',['All outputs listed','Another output needs identifying']),
 pick('batch','Which single batch are you describing?',['Recent real batch','Written standard batch','Estimate of a normal batch','Need to observe']),f('batchRef','Batch date, or exact written standard / basis of estimate'),
 pick('size','Batch type',['Typical full batch','Small top-up','Unusual large batch']),pick('variation','Is the size fixed?',['Fixed','Varies']),f('varies','What determines size, and does the recorded work apply to this size?','text',{when:['variation',['Varies']]}),
 pick('packs','Do you count filled containers, cubes or portions?',['No, total net quantity only','Yes','Need to check']),
 rows('packages','Conversion for each output / type of pack',[f('item','Output','item'),f('type','Container type (no numbers)'),n('count','Filled containers / portions',{integer:true}),n('content','Net content of ONE'),pick('unit','Content unit',units),pick('phase','State',phases),basis],{when:['packs',['Yes']]}),
 rows('tasks','Hands-on work, counted once',[pick('task','Task',['Setup','Ingredient preparation','Attended cooking','Portioning','Packing / labelling','Cleanup','Other']),f('detail','What is included?'),n('minutes','Active minutes'),n('people','People',{integer:true}),pick('scope','Work applies to',['Shared across all outputs','Only one output']),f('output','Which output?','item',{when:['scope',['Only one output']]})]),
 pick('labourBasis','Basis for all labour figures',['Timed during this batch','Current written procedure','Estimated','Need to measure']),f('labourEvidence','Date, observer / procedure reference, and which tasks are covered'),
 pick('passiveKnown','Unattended waiting',['No unattended waiting','Waiting recorded below','Need to check']),
 rows('passive','Waiting and equipment',[pick('task','Step',['Cooking','Soaking','Marinating','Cooling','Freezing','Thawing','Other']),n('minutes','Elapsed minutes'),f('equipment','Equipment / location'),n('places','Occupied containers / places',{integer:true}),pick('overlap','Timing',['Sequential','Overlaps another step']),f('overlapWith','Which step?','text',{when:['overlap',['Overlaps another step']]})],{when:['passiveKnown',['Waiting recorded below']]}),
 pick('trigger','What triggers a batch today?',['Fixed schedule','Stock threshold','Customer order','Schedule plus top-ups','Emergency shortage','Need to check']),f('triggerDetail','Current days / interval, stock threshold with unit, or visual judgement'),
 rows('events','Actual production during the reference period',[f('date','Day','date'),pick('recorded','Counts on this day',['Recorded','Not recorded']),n('full','Full batches',{min:0,integer:true,when:['recorded',['Recorded']]}),n('topups','Small top-ups',{min:0,integer:true,when:['recorded',['Recorded']]}),n('other','Reheating / repacking events',{min:0,integer:true,when:['recorded',['Recorded']]})],{help:'Include every day, including closed days. Enter 0 only when confirmed. Missing days stay incomplete.'}),
 f('last','Last actual batch date','date',{optional:true}),f('previous','Previous actual batch date','date',{optional:true}),
 pick('capacity','Useful minimum and practical maximum',['Known','Not known']),n('minimum','Minimum net output',{when:['capacity',['Known']]}),n('maximum','Maximum net output',{when:['capacity',['Known']]}),pick('capacityUnit','Unit',units,{when:['capacity',['Known']]}),pick('capacityPhase','State',phases,{when:['capacity',['Known']]}),pick('capacityBasis','Capacity evidence',['Tried in practice','Estimate'],{when:['capacity',['Known']]}),f('limit','Limiting equipment, staff, cooling, storage, shelf life or demand','text',{when:['capacity',['Known']]}),
];
export const storageFields:Field[]=[
 rows('states','One separate card for every actual storage state',[
 pick('state','Product state',['Received unopened','Opened','Washed whole','Cut raw','Cooked','Marinated','Frozen','Thawed','Ready for service','Used immediately','Other']),f('stateOther','Describe this state','text',{when:['state',['Other']]}),
 pick('mode','Storage',['Chilled','Frozen','Dry storage','Hot holding','Used immediately','Other','Need to check']),f('place','Container type, sealed / open, fill level and exact location'),
 f('flow','Describe the immediate flow to service; confirm no stock is held','text',{when:['mode',['Used immediately']]}),
 n('temperature','Temperature °C',{min:-100,max:100,when:['mode',['Chilled','Frozen','Dry storage','Hot holding','Other']]}),pick('temperatureBasis','Temperature evidence',['Measured product','Measured storage','Equipment setting','Estimate','Need to measure'],{when:['mode',['Chilled','Frozen','Dry storage','Hot holding','Other']]}),f('temperatureRef','Date / location of measurement or setting','text',{when:['mode',['Chilled','Frozen','Dry storage','Hot holding','Other']]}),
 pick('quality','Required quality period',['Known','Used immediately','Not established']),n('qualityValue','Quality duration',{when:['quality',['Known']]}),pick('qualityUnit','Quality unit',['hours','days','weeks'],{when:['quality',['Known']]}),pick('qualityStart','Quality clock starts at',['Preparation','Opening','Thawing','Other named event'],{when:['quality',['Known']]}),f('qualityEvidence','Exact starting event and basis: observed, procedure, supplier or estimate','text',{when:['quality',['Known']]}),
 pick('rule','Documented use-by rule',['Supplier instruction','Approved kitchen procedure','No documented rule available','Need to find it']),f('reference','Exact product / procedure, version or date, and accessible link or document location','text',{when:['rule',['Supplier instruction','Approved kitchen procedure']]}),pick('ruleType','Type of rule',['Duration','Printed lot date','Procedure conditions'],{when:['rule',['Supplier instruction','Approved kitchen procedure']]}),n('ruleValue','Use-by duration',{when:['ruleType',['Duration']]}),pick('ruleUnit','Use-by unit',['hours','days','weeks'],{when:['ruleType',['Duration']]}),f('ruleStart','Exact starting event','text',{when:['ruleType',['Duration']]}),f('lotDate','Printed date','date',{when:['ruleType',['Printed lot date']]}),f('lot','Exact supplier lot','text',{when:['ruleType',['Printed lot date']]}),f('conditions','Applicable product, state and conditions','text',{when:['rule',['Supplier instruction','Approved kitchen procedure']]}),
 f('clocks','Other limits that continue to apply','multi',{options:['Original production limit','Original supplier date','After opening','After thawing','No additional rule documented','Need to check']}),f('clockDetail','Lot / rule references, or how absence of additional rules was checked'),
 pick('cooling','Cooling, freezing or thawing at this stage',['Written procedure','No written procedure','No such step','Need to check']),f('coolingDetail','Procedure, equipment, containers, measured times / temperatures and responsible person','text',{when:['cooling',['Written procedure','No written procedure']]}),pick('chiller','Blast chiller',['Available and used','Available but not used here','Not available','Unknown'],{when:['cooling',['Written procedure','No written procedure']]}),
 ]),
];
export const managerFields:Field[]=[
 pick('pos','Current POS mapping',['Available','Follow-up needed']),rows('mapping','POS mappings',[f('recipe','Exact recipe / variant','recipe'),f('code','POS item code'),f('modifiers','Modifiers that distinguish this variant'),f('effective','Valid from','date'),f('availability','Unavailable dates, or explicitly none')],{when:['pos',['Available']]}),
 pick('stock','Stock and movements from this same period',['Available','Follow-up needed']),f('stockRef','Exact stock / production / transfer / waste record location','text',{when:['stock',['Available']]}),
 pick('cost','Current purchasing and labour costs',['Available','Follow-up needed']),f('costRef','Dated sources and shared-cost treatment','text',{when:['cost',['Available']]}),
 f('owner','Person responsible for these follow-ups'),f('due','Follow-up date','date'),
];
export function visible(field:Field,a:Answers){if(!field.when)return true;const v=a[field.when[0]];return field.when[1].some(x=>Array.isArray(v)?v.includes(x):v===x);}
export function decimal(value:unknown){if(typeof value==='number')return Number.isFinite(value)?value:null;if(typeof value!=='string'||!/^[-+]?\d+(?:[.,]\d+)?$/.test(value.trim()))return null;const n=Number(value.trim().replace(',','.'));return Number.isFinite(n)?n:null;}
