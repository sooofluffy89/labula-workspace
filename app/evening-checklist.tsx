'use client';
import {useState,type ReactNode} from 'react';
import type {CheckAnswer} from '@/lib/evening';
import {stationGroups,matchesStation,stationLabel,type StationFilter} from '@/lib/checking-stations';
import {isEveningChecked} from '@/lib/evening-list';
import {Button} from '@/components/ui/button';
import {GroupSection,useCollapsedGroups} from './grouped-sections';
import {useEveningLayout} from './evening-layout';

export function EveningChecklist({answers,filter,onFilter,renderRows,account,checkId,version,issues,pendingIds,dialogOpen,revealedId}:{answers:CheckAnswer[];filter:StationFilter;onFilter:(v:StationFilter)=>void;renderRows:(rows:CheckAnswer[])=>ReactNode;account:string;checkId:string;version:number;issues:ReadonlySet<string>;pendingIds:ReadonlySet<string>;dialogOpen:boolean;revealedId:string|null}){
 const scope=`${account}:${checkId}:${version}`;
 const [expanded,setExpanded]=useState({scope,open:false});
 const {checkedSet,root,checkedHeading}=useEveningLayout(scope,answers.map(a=>a.itemId),answers.filter(a=>isEveningChecked(a,issues)).map(a=>a.itemId),dialogOpen);
 const collapse=useCollapsedGroups(account,'evening-stations',checkId);
 const groups=stationGroups(answers),visible=answers.filter(a=>matchesStation(a,filter));
 const toCheck=visible.filter(a=>!checkedSet.has(a.itemId)),checked=visible.filter(a=>checkedSet.has(a.itemId));
 const eligible=answers.filter(a=>isEveningChecked(a,issues)),remaining=answers.length-eligible.length;
 const selectedDone=visible.filter(a=>isEveningChecked(a,issues)).length;
 const attention=answers.filter(a=>!a.mappingValid||issues.has(a.itemId));
 const checkedAttention=checked.some(a=>!a.mappingValid||issues.has(a.itemId));
 const open=expanded.scope===scope&&expanded.open||checkedAttention||!!revealedId&&checked.some(a=>a.itemId===revealedId);
 const waiting=checked.filter(a=>pendingIds.has(a.itemId)).length;
 const sectionRows=(rows:CheckAnswer[],section:string)=>filter!=='all'?renderRows(rows):<div className="ingredient-groups">{stationGroups(rows).filter(g=>g.rows.length).map(g=>section==='checked'?<div className="evening-checked-station" key={g.id??'none'}><h3>{g.label} · {g.rows.length}</h3>{renderRows(g.rows)}</div>:<GroupSection key={g.id??'none'} id={g.id} sectionId={`evening-${section}`} label={g.label} meta={`${g.rows.length} ${g.rows.length===1?'item':'items'}`} alert={g.rows.some(a=>!a.mappingValid||issues.has(a.itemId))} open={g.rows.some(a=>!a.mappingValid||issues.has(a.itemId))||!collapse.collapsed.includes(g.id??'unassigned')} onToggle={()=>collapse.toggle(g.id??'unassigned')}>{renderRows(g.rows)}</GroupSection>)}</div>;
 return <div className="evening-checklist" ref={root}>
  <div className="station-tabs" role="group" aria-label="Checking station"><Button variant={filter==='all'?'default':'outline'} aria-pressed={filter==='all'} onClick={()=>onFilter('all')}>All<span>{eligible.length}/{answers.length}</span></Button>{groups.filter(g=>g.id!==null||g.rows.length>0||filter==='none').map(g=><Button key={g.id??'none'} variant={filter===(g.id??'none')?'default':'outline'} aria-pressed={filter===(g.id??'none')} onClick={()=>onFilter(g.id??'none')}>{g.label}<span>{g.rows.filter(a=>isEveningChecked(a,issues)).length}/{g.rows.length}</span></Button>)}</div>
  <p className="evening-list-counts">{filter==='all'?'Shared check':stationLabel(filter==='none'?null:filter)} · {selectedDone} of {visible.length} checked{filter!=='all'&&` · Shared check: ${eligible.length} of ${answers.length}`}</p>
  {answers.some(a=>a.stationId===undefined)&&<p className="muted small">Station assignments were not recorded for some items in this check. They remain in Not assigned.</p>}
  {attention.length>0&&<p className="notice" role="alert">{attention.length} {attention.length===1?'item needs':'items need'} review.{attention.some(a=>!matchesStation(a,filter))&&<> Some are in other stations. <button className="click-link" onClick={()=>onFilter('all')}>Show all items to review</button></>}</p>}
  {filter!=='all'&&visible.length>0&&selectedDone===visible.length&&<p className="evening-station-done" role="status">{stationLabel(filter==='none'?null:filter)} checked · {remaining?`${remaining} ${remaining===1?'item remains':'items remain'} in other stations.`:'All stations checked. Review Finish to confirm the shared check.'}</p>}
  <section className="evening-to-check" aria-label="To check"><h2 className="evening-list-heading">To check · {toCheck.length}</h2>{toCheck.length?sectionRows(toCheck,'to-check'):<p className="muted small">{visible.length?(selectedDone===visible.length?'All items in this view are checked.':'Updating the list…'):filter==='all'?'No items in this check.':'No items in this station for this check.'}</p>}</section>
  <section className="evening-checked-section"><button type="button" className="evening-checked-heading" ref={checkedHeading} aria-expanded={open} aria-controls="evening-checked-items" onClick={()=>setExpanded({scope,open:!open})}><span aria-hidden="true">{open?'▾':'▸'}</span><strong>Checked · {checked.length}</strong>{waiting>0&&<small>{waiting} waiting to share</small>}{checkedAttention&&<small>Needs review</small>}<small>{open?'Hide':'Show'} answers</small></button>
   <div id="evening-checked-items" hidden={!open}>{open&&(checked.length?sectionRows(checked,'checked'):<p className="muted small">Answered items will appear here.</p>)}</div>
  </section>
 </div>;
}
