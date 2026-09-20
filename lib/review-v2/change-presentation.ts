import {groups,type Field,type Values} from './fields';
import {entity,values,list,options,type Draft,type Target} from './model';

export function changeField(target?:Target):{field?:Field;labels:string[];row:boolean}{
 const labels:string[]=[];let fs=groups.find(g=>g.id===target?.group)?.fields??[],field:Field|undefined,row=false;
 for(let i=0;i<(target?.path.length??0);i++){
  field=fs.find(f=>f.key===target!.path[i]);if(!field)break;labels.push(field.label);row=false;
  if(field.type==='rows'&&i<target!.path.length-1){i++;row=i===target!.path.length-1;fs=field.fields??[];}
 }
 return {field,labels,row};
}

function historicalName(ref:string,context:Record<string,unknown>|null):string|undefined{
 for(const [key,value] of Object.entries(context??{})){
  if((key===ref+':identity'||key.endsWith(':'+ref))&&value&&typeof value==='object'&&!Array.isArray(value)){
   const name=(value as Record<string,unknown>).name;if(typeof name==='string'&&name)return name;
  }
 }
 return undefined;
}

export function changeValue(d:Draft,value:unknown,target:Target|undefined,historical:boolean,context:Record<string,unknown>|null):{text:string;exact:boolean}{
 const {field,row}=changeField(target);
 if(value===undefined||value===null||value==='')return {text:row?'No row':'Not recorded',exact:true};
 if(row||typeof value==='object'&&!Array.isArray(value)){
  const name=(value as Values).name;
  return {text:typeof name==='string'&&name?`Recorded row: ${name}`:'Recorded details (open the topic to review)',exact:false};
 }
 if(Array.isArray(value))return {text:value.length?value.every(x=>typeof x==='string')?value.join(', '):'Recorded rows (open the topic to review)':'No entries',exact:value.every(x=>typeof x==='string')};
 if(field?.type==='ref'&&typeof value==='string'){
  if(historical){const name=historicalName(value,context);return {text:name??'Earlier reference — its name was not recorded in this confirmation',exact:!!name};}
  const record=target&&entity(d,target.entityId);let row=record&&values(record,target!.group);
  for(let i=0;row&&i<(target?.path.length??0)-1;i+=2)row=list(row,target!.path[i]).find(r=>r.id===target!.path[i+1]);
  const name=record&&row?options(d,record,field,row).find(o=>o.id===value)?.name:undefined;
  return {text:name??'Reference no longer available for this field',exact:!!name};
 }
 // Unmapped values may be identifiers. Never expose them as human-readable facts.
 if(!field)return {text:'Context updated; review the related topic',exact:false};
 return {text:typeof value==='boolean'?(value?'Yes':'No'):String(value),exact:true};
}
