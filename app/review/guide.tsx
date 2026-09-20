'use client';

import {useState} from 'react';
import {Button} from '@/components/ui/button';
import {Dialog,DialogClose,DialogContent,DialogDescription,DialogFooter,DialogHeader,DialogTitle,DialogTrigger} from '@/components/ui/dialog';
import {guideExamples,guideIntroduction,readGuidePreference,topicGuide,writeGuidePreference,type GuideEntry,type GuideExample,type GuidePreference} from '@/lib/review-v2/guidance';

const localGuidePreference=(userId:string)=>readGuidePreference(userId,typeof window==='undefined'?undefined:window.localStorage);
const saveLocalGuidePreference=(userId:string,value:GuidePreference)=>writeGuidePreference(userId,value,typeof window==='undefined'?undefined:window.localStorage);

function Example({id}:{id:GuideExample}){const example=guideExamples[id];return <section className="guide-example"><p className="guide-example-label">Illustrative example — not your recorded answer</p><h3>{example.title}</h3><ol>{example.steps.map(step=><li key={step}>{step}</li>)}</ol><p>{example.note}</p></section>;}

function GuideBody({section,setSection}:{section:'intro'|'examples'|GuideExample;setSection:(section:'intro'|'examples'|GuideExample)=>void}){
 if(section==='intro')return <><DialogHeader><DialogTitle>Before you start</DialogTitle><DialogDescription>This short guide explains what to record and what happens to your answers.</DialogDescription></DialogHeader><ol className="guide-intro">{guideIntroduction.map(line=><li key={line}>{line}</li>)}</ol><div className="review-actions"><Button variant="outline" onClick={()=>setSection('examples')}>See examples</Button></div></>;
 if(section==='examples')return <><DialogHeader><DialogTitle>Choose an example</DialogTitle><DialogDescription>Examples explain the structure only. They never become answers.</DialogDescription></DialogHeader><div className="guide-example-list"><button onClick={()=>setSection('coriander')}><strong>Product, stage and local work</strong><span>Coriander received → washed → chopped</span></button><button onClick={()=>setSection('shared-output')}><strong>One process, two outputs</strong><span>Shared cooking work plus output-specific work</span></button><button onClick={()=>setSection('evidence')}><strong>Measurement, standard or estimate</strong><span>Keep the source of a value truthful</span></button><button onClick={()=>setSection('checks')}><strong>Assigning a useful CHECK</strong><span>An assignment is not a result</span></button><button onClick={()=>setSection('status')}><strong>What each status means</strong><span>Saved, confirmed, approved and applied</span></button></div><Button variant="ghost" onClick={()=>setSection('intro')}>Back to introduction</Button></>;
 return <><DialogHeader><DialogTitle>{guideExamples[section].title}</DialogTitle><DialogDescription>This example is separate from the shared review and is never saved as an answer.</DialogDescription></DialogHeader><Example id={section}/><Button variant="ghost" onClick={()=>setSection('examples')}>Back to examples</Button></>;
}

export function ReviewGuide({userId,autoOffer=false,triggerLabel='Help & examples',startSection='intro'}:{userId:string;autoOffer?:boolean;triggerLabel?:string;startSection?:'intro'|'examples'}){
 const [open,setOpen]=useState(()=>autoOffer&&!localGuidePreference(userId)),[section,setSection]=useState<'intro'|'examples'|GuideExample>(startSection);
 const close=(preference:GuidePreference)=>{saveLocalGuidePreference(userId,preference);setOpen(false);};
 return <Dialog open={open} onOpenChange={next=>{setOpen(next);if(!next&&open)saveLocalGuidePreference(userId,'seen');}}><DialogTrigger asChild><Button variant="ghost" onClick={()=>{setSection(startSection);setOpen(true);}}>{triggerLabel}</Button></DialogTrigger><DialogContent className="review-guide-dialog"><GuideBody section={section} setSection={setSection}/><DialogFooter><Button variant="ghost" onClick={()=>close('skipped')}>Skip for now</Button><DialogClose asChild><Button onClick={()=>saveLocalGuidePreference(userId,'seen')}>Start filling</Button></DialogClose></DialogFooter></DialogContent></Dialog>;
}

export function WelcomeGuidance({userId}:{userId:string}){return <section className="welcome-guidance" aria-label="How to complete this review"><h2>How to answer without guessing</h2><ol className="guide-intro">{guideIntroduction.map(line=><li key={line}>{line}</li>)}</ol><ReviewGuide userId={userId} triggerLabel="Open examples" startSection="examples"/></section>;}

function ContextDialog({entry}:{entry:GuideEntry}){const [open,setOpen]=useState(false);return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><button type="button" className="review-help-link">{entry.example?'Show an example':'What does this mean?'}</button></DialogTrigger><DialogContent className="review-guide-dialog"><DialogHeader><DialogTitle>{entry.summary}</DialogTitle><DialogDescription>{entry.detail}</DialogDescription></DialogHeader>{entry.example&&<Example id={entry.example}/>}<DialogFooter showCloseButton/></DialogContent></Dialog>;}

export function TopicGuidance({groupId,productionOutsideReview=false}:{groupId:string;productionOutsideReview?:boolean}){const entry=topicGuide(groupId,productionOutsideReview);if(!entry)return null;return <aside className="topic-guidance"><p>{entry.summary}</p><ContextDialog entry={entry}/></aside>;}

export function FieldGuidance({entry}:{entry?:GuideEntry}){if(!entry)return null;return <div className="field-guidance"><span>{entry.summary}</span><ContextDialog entry={entry}/></div>;}
