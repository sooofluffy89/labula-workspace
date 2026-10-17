'use client';
import {useEffect,useRef,useState} from 'react';
import {Download} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {FormDraftStore,type FormDraftCopy,formDraftPrefix} from '@/lib/workspace-form-draft';
import {validationMessage} from '@/lib/notebook';
import {downloadJson} from '@/lib/download';
function validDraftShape(expected:unknown,value:unknown):boolean{if(expected===null)return value===null||typeof value==='number'||typeof value==='object';if(Array.isArray(expected))return Array.isArray(value)&&value.length<=150;if(typeof expected==='object'){if(!value||typeof value!=='object'||Array.isArray(value))return false;return Object.entries(expected as Record<string,unknown>).every(([key,entry])=>validDraftShape(entry,(value as Record<string,unknown>)[key]));}if(typeof expected==='number')return value===null||typeof value==='number'&&Number.isFinite(value);return typeof expected===typeof value&&(typeof value!=='string'||value.length<=50000);}
let formWriterId:string|undefined;
const formStores=new Map<string,FormDraftStore<unknown>>();
export function useLocalForm<T>(account:string,id:string,initial:()=>T){
 const identity=formDraftPrefix(account,id),resumeKey=identity+'.resume';
 const [value,setValue]=useState(initial),[ready,setReady]=useState(false),[restored,setRestored]=useState(false),[error,setError]=useState(''),[unreadable,setUnreadable]=useState<string|null>(null),[copies,setCopies]=useState<FormDraftCopy<T>[]>([]);
 const current=useRef(value),store=useRef<FormDraftStore<T>|null>(null);current.current=value;
 const remember=()=>{try{if(store.current)sessionStorage.setItem(resumeKey,store.current.currentKey);}catch{/* The copy remains discoverable even if a reload preference cannot be stored. */}};
 const refreshCopies=()=>{if(store.current)setCopies(store.current.copies());};
 useEffect(()=>{let active=true;try{
  formWriterId??=crypto.randomUUID();let existing=formStores.get(identity);if(!existing){existing=new FormDraftStore<unknown>(localStorage,account,id,formWriterId);formStores.set(identity,existing);}const owned=existing as FormDraftStore<T>;store.current=owned;
  const own=owned.read();let recovered=own.value;
  if(recovered===null&&!own.closed){const available=owned.copies();let resume:string|null=null;try{resume=sessionStorage.getItem(resumeKey);}catch{}const candidate=resume?available.find(copy=>copy.key===resume):undefined;
   if(candidate){if(!validDraftShape(initial(),candidate.value))throw Error('This earlier draft has an unreadable shape. Download its original copy before discarding it.');recovered=owned.loadCopy(candidate.key);remember();}}
  if(recovered!==null){if(!validDraftShape(initial(),recovered))throw Error('This saved draft could not be read. Its original copy is kept.');current.current=recovered;setValue(recovered);setRestored(true);}
  setCopies(owned.copies());const bad=owned.unreadable();if(bad.length){setUnreadable(JSON.stringify(bad));setError('Some earlier draft copies could not be read. Download them to keep their original text.');}setReady(true);
 }catch(e){setError(validationMessage(e));try{setUnreadable(JSON.stringify(store.current?.unreadable()??[]));}catch{}setReady(false);}
 const changed=(event:StorageEvent)=>{if(active&&event.key?.startsWith(identity+'.')){try{refreshCopies();}catch(e){setError(validationMessage(e));}}};window.addEventListener('storage',changed);return()=>{active=false;window.removeEventListener('storage',changed);};},[identity,account,id,resumeKey]);
 const update=(next:T)=>{try{if(!store.current)throw Error();store.current.write(next);remember();current.current=next;setValue(next);setError('');refreshCopies();return true;}catch{setError('Browser storage is unavailable. This edit was not accepted. Download your existing draft and free browser space before continuing.');return false;}};
 const clear=()=>{try{if(!store.current)throw Error();store.current.clear();remember();setRestored(false);setUnreadable(null);refreshCopies();return true;}catch{setError('Could not close this local draft. Other copies are kept. Retry before leaving.');return false;}};
 const loadCopy=(key:string)=>{try{const copy=store.current?.copies().find(copy=>copy.key===key);if(!copy||!validDraftShape(initial(),copy.value))throw Error('This saved copy could not be read. Download it before discarding it.');const next=store.current!.loadCopy(key);remember();current.current=next;setValue(next);setRestored(true);setReady(true);setError('');refreshCopies();}catch(e){setError(validationMessage(e));}};
 return {value,ready,restored,error,unreadable,copies,loadCopy,update,clear,download:()=>downloadJson('workspace-2.0-local-form-copies.json',{account,id,current:current.current,copies:store.current?.copies()??[],unreadable:store.current?.unreadable()??unreadable})};
}
export function LocalDraftNote({form}:{form:{restored:boolean;error:string;download:()=>void;copies:FormDraftCopy<unknown>[];loadCopy:(key:string)=>void}}){
 const [selected,setSelected]=useState('');const label=(copy:FormDraftCopy<unknown>)=>{const value=copy.value as {method?:string;name?:string;draft?:{name?:string}};return [copy.updatedAt?new Date(copy.updatedAt).toLocaleString('en-GB'):'Earlier copy',(value.method??value.name??value.draft?.name??'').slice(0,65)].filter(Boolean).join(' · ');};
 return <>{form.restored&&<p className="wm-draft-note" role="status">Restored draft on this device. Other copies are kept separately.</p>}{form.copies.length>0&&<details className="wm-draft-copies"><summary>Other draft copies ({form.copies.length})</summary><p>Opening a copy keeps both the original and your current work.</p><label>Draft copy to open<select aria-label="Draft copy to open" value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Choose a saved copy</option>{form.copies.map(copy=><option value={copy.key} key={copy.key}>{label(copy)}</option>)}</select></label><Button type="button" variant="outline" disabled={!form.copies.some(copy=>copy.key===selected)} onClick={()=>{form.loadCopy(selected);setSelected('');}}>Open draft copy</Button></details>}{form.error&&<div className="wm-alert" role="alert"><p>{form.error}</p><Button type="button" variant="outline" onClick={form.download}><Download size={16}/>Download draft copies</Button></div>}</>;
}
