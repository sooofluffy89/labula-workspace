'use client';
import {useEffect,useRef,useState} from 'react';
import {Input} from '@/components/ui/input';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from '@/components/ui/dialog';
import type {Item,RecipeInput} from '@/lib/notebook';
import {inputUnit,baseInputAmount,measurement,type InputUnit} from '@/lib/recipe-quantity';

type DraftChange=(pending:boolean)=>void;
type QuantityProps={label:string;value:number|null;disabled:boolean;onChange:(value:number|null)=>boolean|void;onDraftChange?:DraftChange;min?:number;placeholder?:string};
const quantityError=(min?:number)=>min===undefined?'Enter a quantity greater than 0 and no more than 1,000,000,000, or leave it not set.':`Enter a number from ${min} to 1,000,000,000, or leave it not set.`;
/** Keeps invalid or rejected text local, visible, and out of persisted calculations. */
export function QuantityValue({label,value,disabled,onChange,onDraftChange,min,placeholder='Not set'}:QuantityProps){
 const [draft,setDraft]=useState(value===null?'':String(value)),[error,setError]=useState('');
 const editing=useRef(false),edited=useRef(false),pending=useRef(false),notify=useRef(onDraftChange);notify.current=onDraftChange;
 useEffect(()=>{if((!editing.current||!edited.current)&&!pending.current)setDraft(value===null?'':String(value));},[value]);
 useEffect(()=>()=>notify.current?.(false),[]);
 const report=(next:boolean)=>{pending.current=next;notify.current?.(next);};
 const apply=(text:string)=>{
  if(disabled)return false;
  const source=text.trim();let amount:number|null=null;
  if(source){
   if(!/^(?:\d+(?:[.,]\d*)?|[.,]\d+)$/.test(source)){setError(quantityError(min));report(true);return false;}
   amount=Number(source.replace(',','.'));
   if(!Number.isFinite(amount)||amount>1e9||(min===undefined?amount<=0:amount<min)){setError(quantityError(min));report(true);return false;}
  }
  try{if(amount!==value&&onChange(amount)===false){setError('This value could not be applied. It is kept here; check the save notice and try again.');report(true);return false;}}
  catch{setError('This value could not be applied. It is kept here; check the save notice and try again.');report(true);return false;}
  setError('');report(false);return true;
 };
 return <span className="recipe-quantity-field"><Input aria-label={label} aria-invalid={!!error} inputMode="decimal" value={draft} placeholder={placeholder} disabled={disabled} onFocus={()=>{editing.current=true;edited.current=false;}} onChange={e=>{if(disabled)return;editing.current=true;edited.current=true;setDraft(e.target.value);apply(e.target.value);}} onBlur={()=>{editing.current=false;if(!pending.current){setDraft(value===null?'':String(value));}edited.current=false;}}/>{error&&<span className="recipe-quantity-error" role="alert">{error}<button type="button" className="recipe-quantity-cancel" disabled={disabled} onClick={()=>{setDraft(value===null?'':String(value));setError('');editing.current=false;edited.current=false;report(false);}}>Reset value</button></span>}</span>;
}

export function RecipeUnit({item,part,disabled,onChange,onDraftChange}:{item:Item;part:RecipeInput;disabled:boolean;onChange:(part:RecipeInput)=>boolean|void;onDraftChange?:DraftChange}){
 const unit=inputUnit(part,item),[next,setNext]=useState<InputUnit|null>(null),[amount,setAmount]=useState<number|null>(null),[amountInvalid,setAmountInvalid]=useState(false),[amountSeed,setAmountSeed]=useState(0),[unknown,setUnknown]=useState(false),[error,setError]=useState('');
 const select=useRef<HTMLSelectElement|null>(null),notify=useRef(onDraftChange);notify.current=onDraftChange;
 useEffect(()=>{notify.current?.(next!==null);},[next]);useEffect(()=>()=>notify.current?.(false),[]);
 const close=()=>{setNext(null);setError('');setAmountInvalid(false);};
 const recorded=next&&part.amount!==null&&part.conversion?.from===unit&&part.conversion.to===next?part.amount*part.conversion.factor:null;
 return <><select ref={select} aria-label={`Unit for ${item.name}`} value={unit} disabled={disabled} onChange={e=>{
  if(disabled)return;const target=e.target.value as InputUnit;if(target===unit)return;
  if(part.amount===null){try{if(onChange({...part,unit:target,conversion:null})===false)setError('The unit could not be changed. Check the save notice and try again.');else setError('');}catch{setError('The unit could not be changed. Check the save notice and try again.');}}
  else{setNext(target);setAmount(null);setUnknown(false);setAmountInvalid(false);setError('');}
 }}>{(['g','ml','pcs'] as const).map(u=><option key={u}>{u}</option>)}</select>{!next&&error&&<span className="recipe-quantity-error" role="alert">{error}</span>}
 <Dialog open={!!next} onOpenChange={open=>{if(!open)close();}}><DialogContent onCloseAutoFocus={e=>{e.preventDefault();if(select.current?.isConnected)select.current.focus({preventScroll:true});}}><DialogHeader><DialogTitle>Change unit for {item.name}</DialogTitle><DialogDescription>The saved {part.amount} {unit} stays unchanged until you enter an amount in {next}, or explicitly choose that the new quantity is not set.</DialogDescription></DialogHeader>
 <QuantityValue key={`${next}:${unknown}:${amountSeed}`} label={`New amount of ${item.name} (${next})`} value={amount} disabled={disabled||unknown} onChange={value=>{setAmount(value);setError('');}} onDraftChange={setAmountInvalid}/>
 {recorded!==null&&Number.isFinite(recorded)&&recorded>0&&recorded<=1e9&&<Button type="button" variant="outline" disabled={disabled} onClick={()=>{setUnknown(false);setAmount(recorded);setAmountSeed(seed=>seed+1);setAmountInvalid(false);setError('');}}>Use recorded conversion: {recorded} {next}</Button>}
 <label className="review-unit-unknown"><input type="checkbox" checked={unknown} disabled={disabled} onChange={e=>{setUnknown(e.target.checked);setAmount(null);setAmountInvalid(false);setError('');}}/>Quantity not set for the new unit</label>
 <p className="error" role="alert" hidden={!error}>{error}</p><div className="actions"><Button type="button" disabled={disabled||amountInvalid||amount===null&&!unknown} onClick={()=>{if(disabled||!next||amountInvalid||amount===null&&!unknown)return;try{if(onChange({...part,amount:unknown?null:amount,unit:next,conversion:null})===false){setError('The change could not be applied. Your amount is kept here; resolve the save notice and try again.');return;}close();}catch{setError('The change could not be applied. Your amount is kept here; resolve the save notice and try again.');}}}>Save new unit</Button><Button type="button" variant="outline" onClick={close}>Cancel</Button></div></DialogContent></Dialog></>;
}

export function MeasurementDetails({item,part,disabled,onChange,onClose,onDraftChange,onReturnFocus}:{item:Item;part:RecipeInput;disabled:boolean;onChange:(part:RecipeInput)=>boolean|void;onClose:()=>void;onDraftChange?:DraftChange;onReturnFocus?:()=>void}){
 const unit=inputUnit(part,item);const [meaning,setMeaning]=useState(part.pieceMeaning??''),[factor,setFactor]=useState(part.conversion?.factor??null),[factorInvalid,setFactorInvalid]=useState(false),[error,setError]=useState('');
 const notify=useRef(onDraftChange);notify.current=onDraftChange;useEffect(()=>{notify.current?.(true);return ()=>notify.current?.(false);},[]);
 return <Dialog open onOpenChange={open=>{if(!open)onClose();}}><DialogContent onCloseAutoFocus={onReturnFocus?e=>{e.preventDefault();onReturnFocus();}:undefined}><DialogHeader><DialogTitle>{item.name} · measurement</DialogTitle><DialogDescription>These details apply to this recipe. Catalog base unit: {item.unit}.</DialogDescription></DialogHeader>{unit==='pcs'&&<label className="field"><span>What is one piece?</span><Input aria-label="Meaning of one piece" value={meaning} maxLength={300} disabled={disabled} placeholder="e.g. one medium eggplant, one 20 g slice" onChange={e=>{setMeaning(e.target.value);setError('');}}/></label>}{unit!==item.unit?<><label className="field"><span>Explicit conversion: 1 {unit} = … {item.unit}</span><QuantityValue label={`Base units per ${unit}`} value={factor} disabled={disabled} onChange={value=>{setFactor(value);setError('');}} onDraftChange={setFactorInvalid}/></label><p className="muted small">Enter only a known conversion. Without it, the recipe is saved in {unit}; totals in {item.unit} remain incomplete.</p></>:<p className="muted small">Entered and catalog units match. No conversion is needed.</p>}<p className="small">{baseInputAmount(part,item)===null?'Base-unit amount not available.':`Current base-unit amount: ${baseInputAmount(part,item)} ${item.unit}`}</p><p className="error" role="alert" hidden={!error}>{error}</p><div className="actions"><Button type="button" disabled={disabled||factorInvalid} onClick={()=>{if(disabled||factorInvalid)return;const next={...part,unit,pieceMeaning:meaning.trim(),conversion:unit!==item.unit&&factor!==null?{from:unit,to:item.unit,factor}:null};try{if(JSON.stringify(measurement(part,item))!==JSON.stringify(measurement(next,item))&&onChange(next)===false){setError('These measurements could not be applied. Your entries are kept here; check the save status or values and try again.');return;}onClose();}catch{setError('These measurements could not be applied. Your entries are kept here; check the save status or values and try again.');}}}>Save measurement</Button><Button type="button" variant="outline" onClick={onClose}>Cancel</Button></div></DialogContent></Dialog>;
}

/** Uses the same per-recipe metadata as the measurement dialog. No weight is inferred. */
export function PieceMeaning({item,part,disabled,onChange,onDraftChange}:{item:Item;part:RecipeInput;disabled:boolean;onChange:(meaning:string)=>boolean|void;onDraftChange?:DraftChange}){
 const [draft,setDraft]=useState(part.pieceMeaning??''),[failed,setFailed]=useState(false),notify=useRef(onDraftChange);notify.current=onDraftChange;
 useEffect(()=>{if(!failed)setDraft(part.pieceMeaning??'');},[part.pieceMeaning,failed]);useEffect(()=>()=>notify.current?.(false),[]);
 if(inputUnit(part,item)!=='pcs'&&!failed)return null;
 return <label className="review-piece-meaning"><span>1 pc =</span><Input aria-label={`Meaning of one piece of ${item.name}`} aria-invalid={failed} value={draft} maxLength={300} disabled={disabled} placeholder="Describe one piece" title={draft||undefined} onChange={e=>{if(disabled)return;const value=e.target.value;setDraft(value);try{const rejected=value!==(part.pieceMeaning??'')&&onChange(value)===false;setFailed(rejected);notify.current?.(rejected);}catch{setFailed(true);notify.current?.(true);}}}/>{failed&&<span className="recipe-quantity-error" role="alert">This description could not be applied.<button type="button" className="recipe-quantity-cancel" onClick={()=>{setDraft(part.pieceMeaning??'');setFailed(false);notify.current?.(false);}}>Reset value</button></span>}</label>;
}
