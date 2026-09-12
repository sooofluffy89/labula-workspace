'use client';
import { useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select,SelectTrigger,SelectContent,SelectItem,SelectValue } from '@/components/ui/select';
import { Combobox,ComboboxInput,ComboboxContent,ComboboxList,ComboboxItem,ComboboxEmpty } from '@/components/ui/combobox';
import { Plus,Trash2 } from 'lucide-react';
import type { Item,RecipeInput } from '@/lib/notebook';

export function Field({label,hint,children}:{label:string;hint?:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}{hint&&<span className="muted small" style={{fontWeight:400}}>{hint}</span>}</label>;}
export function NumberField({label,value,onChange,unit,min=0,placeholder='Unknown'}:{label:string;value:number|null;onChange:(n:number|null)=>void;unit?:string;min?:number;placeholder?:string}){return <Field label={unit?`${label} (${unit})`:label}><Input aria-label={unit?`${label} (${unit})`:label} type="number" inputMode="decimal" min={min} step="any" value={value??''} placeholder={placeholder} onChange={e=>{const x=e.target.value===''?null:Number(e.target.value);if(x===null||Number.isFinite(x))onChange(x);}}/></Field>;}
export function Choice({label,value,onChange,options}:{label:string;value:string;onChange:(v:string)=>void;options:readonly (readonly [string,string])[]}){return <div className="field"><span>{label}</span><Select value={value} onValueChange={onChange}><SelectTrigger aria-label={label} className="!w-full"><SelectValue/></SelectTrigger><SelectContent>{options.map(([v,t])=><SelectItem key={v} value={v}>{t}</SelectItem>)}</SelectContent></Select></div>;}
export function Notes({label,value,onChange,placeholder}:{label:string;value:string;onChange:(s:string)=>void;placeholder?:string}){return <Field label={label}><Textarea value={value} onChange={e=>onChange(e.target.value)} placeholder={placeholder}/></Field>;}
export type CreateItem=(name:string,done:(item:Item)=>void)=>void;
export function IngredientRows({items,inputs,onChange,onCreate,onEdit,excluded=[]}:{items:Item[];inputs:RecipeInput[];onChange:(parts:RecipeInput[])=>void;onCreate:CreateItem;onEdit?:(id:string)=>void;excluded?:string[]}){
 const [query,setQuery]=useState('');const choices=items.filter(i=>!excluded.includes(i.id)&&!inputs.some(p=>p.itemId===i.id));
 const add=(item:Item)=>{onChange([...inputs,{itemId:item.id,amount:null,note:''}]);setQuery('');};
 return <div>{inputs.length===0&&<div className="empty-panel" style={{marginBottom:16}}><h3>Every ingredient counts.</h3><p className="muted small" style={{marginTop:6}}>Include oil, water, salt, sauces and garnishes used in this dish.</p></div>}
 {inputs.map((part,index)=>{const item=items.find(i=>i.id===part.itemId);if(!item)return null;return <div key={part.itemId} className="item-row"><div><button className="item-name overflow-name" type="button" onClick={()=>onEdit?.(item.id)} disabled={!onEdit}>{item.name}</button><div><span className={'badge '+(item.kind==='prep'?'prep':'')}>{item.kind==='prep'?'House-made prep':'Bought ingredient'}</span></div></div><Button type="button" variant="ghost" size="icon" aria-label={`Remove ${item.name} from recipe`} onClick={()=>onChange(inputs.filter((_,j)=>j!==index))}><Trash2 size={17}/></Button></div>;})}
 <div className="picker" style={{marginTop:16}}><Combobox items={choices.map(i=>i.name)} value={null} inputValue={query} onInputValueChange={setQuery} onValueChange={value=>{const item=choices.find(i=>i.name===value);if(item)add(item);}}><ComboboxInput aria-label="Find an existing ingredient or prep" placeholder="Find an existing ingredient or prep…"/><ComboboxContent><ComboboxEmpty>No matching item. Create it below.</ComboboxEmpty><ComboboxList>{name=><ComboboxItem key={name} value={name}>{name}</ComboboxItem>}</ComboboxList></ComboboxContent></Combobox><Button type="button" variant="outline" onClick={()=>onCreate(query,add)}><Plus size={16}/>Create new item</Button></div>
 <p className="muted small" style={{marginTop:10}}>Reuse the same item whenever it appears in another dish.</p></div>;
}
