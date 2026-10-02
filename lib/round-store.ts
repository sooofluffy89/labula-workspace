import {readCalendarVersions} from './calendar-server';
import {calendarVersion} from './operating-calendar';
import {getRawDb} from '@/db';
import {roundIds,type RoundId,type Timeline,calendarObligation,type RoundReason} from './check-rounds';
import {operationalDay} from './evening';
import type {Notebook} from './notebook';
export async function initializeRounds(){
 const db=getRawDb(),now=new Date().toISOString();
 await db.batch([
  ...roundIds.map(id=>db.prepare('INSERT INTO check_rounds(id,days,revision,updated_at,updated_by) VALUES(?,?,0,?,?) ON CONFLICT(id) DO NOTHING').bind(id,JSON.stringify(id==='daily'?[0,1,2,3,4,5,6]:id==='weekly'?[0]:[1,4]),now,'system:round-activation')),
  db.prepare("INSERT INTO round_state(id,revision,activated_at) VALUES('kitchen',1,?) ON CONFLICT(id) DO NOTHING").bind(now),
 ]);
}
export type PlanningItem={itemId:string;name:string;kind:'bought'|'prep';groupId:string|null;roundId:RoundId|null;track:boolean;included:boolean;round:RoundReason};
export async function readPlanning(day:string){
 const db=getRawDb(),calendar=await readCalendarVersions();const r=await db.batch([
  db.prepare("SELECT * FROM round_state WHERE id='kitchen'"),db.prepare('SELECT * FROM check_rounds'),db.prepare('SELECT * FROM stock_items'),
  db.prepare('SELECT * FROM round_timeline ORDER BY seq'),db.prepare("SELECT payload,revision FROM notebooks WHERE id='kitchen'"),
  db.prepare("SELECT json_extract(a.value,'$.catalogId') AS item_id,max(v.check_id) AS last_day,max(CASE WHEN v.check_id<=? THEN v.check_id ELSE NULL END) AS through_day FROM evening_versions v JOIN evening_checks c ON c.id=v.check_id AND c.version=v.version,json_each(v.payload,'$.answers') a WHERE json_extract(a.value,'$.value') IS NOT NULL AND json_extract(a.value,'$.supersededBy') IS NULL GROUP BY json_extract(a.value,'$.catalogId')").bind(day),
 ]);
 const state=r[0].results[0] as {revision:number;activated_at:string};
 const rounds=(r[1].results as {id:RoundId;days:string;revision:number;updated_at:string;updated_by:string}[]).map(x=>({id:x.id,days:JSON.parse(x.days) as number[],revision:x.revision,updatedAt:x.updated_at,updatedBy:x.updated_by}));
 const timeline=(r[3].results as {seq:number;item_id:string;round_id:RoundId|null;days:string;schedule_revision:number;active:number;recorded_at:string;source:string}[]).map(x=>({seq:x.seq,itemId:x.item_id,roundId:x.round_id,days:JSON.parse(x.days),scheduleRevision:x.schedule_revision,active:!!x.active,recordedAt:x.recorded_at,source:x.source} as Timeline));
 const published=r[5].results as {item_id:string;last_day:string;through_day:string|null}[];
 const coverage=new Map(published.map(r=>[r.item_id,r.last_day])),coveredThrough=new Map(published.filter(r=>r.through_day).map(r=>[r.item_id,r.through_day!]));
 const notebook=r[4].results[0] as {payload:string;revision:number},catalog=(JSON.parse(notebook.payload) as Notebook).items;
 const stock=r[2].results as {item_id:string;round_id:RoundId|null;included:number;track:number;group_id:string|null}[];
 const legacy=day<operationalDay(new Date(state.activated_at));
 const items:PlanningItem[]=catalog.flatMap<PlanningItem>(i=>{const s=stock.find(s=>s.item_id===i.id);if(!s?.included||!s.track)return [];
  const round=rounds.find(r=>r.id===s.round_id),last=coverage.get(i.id)??null;
  const due=calendarObligation(timeline.filter(e=>e.itemId===i.id),day,coveredThrough.get(i.id)??null,calendar);
  const config=calendarVersion(day,calendar)?.config;const scheduleNeedsReview=!!config&&s.round_id!=='daily'&&!!round?.days.some(d=>!config.openDays.includes(d));
  return [{itemId:i.id,name:i.name,kind:i.kind,groupId:s.group_id,roundId:s.round_id,track:true,included:true,round:{scheduleNeedsReview,roundId:s.round_id,days:round?.days??[],scheduleRevision:round?.revision??0,reason:due&&due.first<day?'overdue':'scheduled',firstDue:due?.first??(legacy?day:null),lastDue:due?.last??(legacy?day:null),lastConfirmed:last,planningRevision:state.revision}}];
 }).sort((a,b)=>a.name.localeCompare(b.name,'en')||a.itemId.localeCompare(b.itemId));
 return {stockRows:r[2].results,revision:state.revision,activatedAt:state.activated_at,rounds,timeline,coverage,coveredThrough,items,due:items.filter(i=>i.round.firstDue),notebookRevision:notebook.revision,legacy};
}
