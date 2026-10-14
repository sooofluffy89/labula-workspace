'use client';
import {useEffect,useState} from 'react';
import {Button} from '@/components/ui/button';
import {Progress} from '@/components/ui/progress';
import {preparationProgress,missingAnswerText} from '@/lib/prep-completion';
import {resumePreparation,changedPrepEntry,type PrepDraft} from '@/lib/prep-draft';
import type {Notebook} from '@/lib/notebook';

export function PreparationPrompt({notebook,draft,account,draftError,onOpen}:{notebook:Notebook;draft:PrepDraft|null;account:string;draftError:boolean;onOpen:(options?:{startItemId?:string;itemId?:string;remaining?:boolean})=>void}){
 const progress=preparationProgress(notebook),resume=resumePreparation(notebook,draft);
 const [expanded,setExpanded]=useState(false),[limit,setLimit]=useState(10);
 const preferenceKey='labula-preparation-completed-scope:'+account.toLowerCase();
 const [completedBefore,setCompletedBefore]=useState<string[]>(()=>{try{const ids=JSON.parse(localStorage.getItem(preferenceKey)??'[]');return Array.isArray(ids)?ids.filter((id:unknown)=>typeof id==='string'):[];}catch{return [];}});
 const scope=JSON.stringify(progress.items.map(i=>i.item.id));
 useEffect(()=>{let active=true;if(progress.total&&progress.filled===progress.total){try{localStorage.setItem(preferenceKey,scope);}catch{/* This optional view preference never determines completion. */}void Promise.resolve().then(()=>{if(active)setCompletedBefore(old=>JSON.stringify(old)===scope?old:JSON.parse(scope));});}return()=>{active=false;};},[preferenceKey,scope,progress.total,progress.filled]);
 const changed=draft?Object.keys(draft.drafts).filter(id=>changedPrepEntry(draft.drafts[id])):[];
 const recoveryId=resume?.itemId??changed[changed.length-1];
 const recoveryName=notebook.items.find(i=>i.id===recoveryId)?.name??'earlier item';
 if(!progress.remaining.length)return (recoveryId||draftError)?<div className="prep-draft-reminder"><p>{draft?.pending?'A preparation save still needs confirmation.':draftError?'A preparation draft on this device could not be read.':'Preparation changes are kept on this device.'}</p><Button variant="outline" onClick={()=>onOpen(recoveryId?{itemId:recoveryId}:{})}>{draft?.pending?'Retry preparation save':draftError?'Open draft recovery':'Continue draft'}</Button></div>:null;
 const onlyNew=completedBefore.length>0&&progress.remaining.every(i=>!completedBefore.includes(i.item.id));
 const action=draft?.pending?'Retry preparation save':resume?'Continue filling in':onlyNew?(progress.remaining.length===1?'Fill in new item':'Fill in new items'):progress.filled===0?'Start filling in':'Continue filling in';
 return <section className="prep-completion-banner" aria-labelledby="preparation-prompt-title">
  <div className="prep-completion-grid"><div><h2 id="preparation-prompt-title">Complete preparation & storage</h2><p className="muted">Tell us how each ingredient is prepared and stored. Fill it in once for all dishes using it.</p></div><div><div className="prep-completion-count"><strong>{progress.filled} of {progress.total} items filled in</strong><span>{progress.remaining.length} left</span></div><Progress value={progress.filled/progress.total*100} aria-label="Saved preparation and storage forms filled in" aria-valuetext={`${progress.filled} of ${progress.total} items filled in`}/><p className="muted small">Ingredients used in the active menu · Saved answers only</p></div></div>
  <div className="actions"><Button onClick={()=>onOpen({remaining:true})}>{action}</Button><Button variant="ghost" aria-expanded={expanded} aria-controls="preparation-remaining-list" onClick={()=>setExpanded(v=>!v)}>{expanded?'Hide remaining items':'View remaining items'}</Button></div>
  {resume&&<p className="muted small prep-resume">{resume.pending?'Save confirmation needed: ':'Resume: '}{recoveryName} · {resume.step==='batch'?'Batch details':resume.step==='storage'?'Storage':'Preparation'}{!resume.pending&&' · Draft on this device'}</p>}
  {!resume&&recoveryId&&<div className="prep-draft-reminder"><p>A draft for {recoveryName} is kept outside the active menu.</p><Button variant="outline" onClick={()=>onOpen({itemId:recoveryId})}>Continue draft</Button></div>}
  {draftError&&<p className="notice">A local preparation draft could not be read. Open the form to download it before replacing it.</p>}
  {expanded&&<div id="preparation-remaining-list" className="prep-remaining"><h3>Items still to fill in</h3>{progress.remaining.slice(0,limit).map(({item,count,missing})=><div className="prep-remaining-item" key={item.id}><div><strong className="overflow-name">{item.name}</strong><p className="muted small">{count} active {count===1?'dish':'dishes'}</p><p className="small">To answer: {missingAnswerText(missing)}</p></div><Button variant="outline" aria-label={`Fill in ${item.name}`} onClick={()=>onOpen({remaining:true,startItemId:item.id})}>Fill in</Button></div>)}{limit<progress.remaining.length&&<Button variant="outline" onClick={()=>setLimit(v=>v+10)}>Show more items ({progress.remaining.length-limit} left in this list)</Button>}</div>}
 </section>;
}
