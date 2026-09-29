import {getRawDb} from '@/db';
import type {ChatGPTUser} from '@/app/chatgpt-auth';
import {RequestError} from './notebook-server';
import {eventStatement} from './activity-server';
import {syncMember} from './evening-sync-server';
import {prepNoteCommandSchema,noteContextSchema,type PrepNoteCommand,type NotesPage,type PrepComment,type InstructionVersion,type PrepInstruction} from './prep-notes';

export function instructionSnapshotSql(catalog:string){return `json_object('catalogId',${catalog},'revision',coalesce((SELECT revision FROM prep_instructions WHERE item_id=${catalog}),0),'text',coalesce((SELECT text FROM prep_instructions WHERE item_id=${catalog}),''))`;}
export const noteColumns=(alias:string)=>`${alias}.*,(SELECT count(*) FROM prep_feedback f WHERE f.check_id=${alias}.check_id AND f.item_id=${alias}.item_id AND f.catalog_id=${alias}.catalog_id) AS feedback_count`;
async function isOwner(user:ChatGPTUser){return !!await getRawDb().prepare("SELECT 1 FROM kitchen_owner WHERE id='owner' AND user_id=?").bind(user.userId).first();}
export async function readPrepNotes(user:ChatGPTUser,q:URLSearchParams):Promise<NotesPage>{
 await syncMember(user);const db=getRawDb(),canEdit=await isOwner(user),base={account:user.email,accountId:user.userId,supported:1 as const,canEdit,comments:[] as PrepComment[],versions:[] as InstructionVersion[],next:null as string|null};
 if(!q.has('context')&&!q.has('ingredient'))return base;
 const cursor=q.get('cursor');let after:unknown[]=[];if(cursor){try{after=JSON.parse(cursor);}catch{throw new RequestError('Invalid feedback page.');}if(!Array.isArray(after)||after.length!==2||after.some(v=>typeof v!=='string'||v.length>100))throw new RequestError('Invalid feedback page.');}
 let where:string,args:unknown[],instruction:PrepInstruction|null|undefined;
 if(q.has('ingredient')){
  if(!canEdit)throw new RequestError('Only the owner can read ingredient feedback across services.',403);
  const id=q.get('ingredient')!;if(!id||id.length>160)throw new RequestError('Invalid ingredient.');
  instruction=await db.prepare('SELECT * FROM prep_instructions WHERE item_id=?').bind(id).first<PrepInstruction>();where='catalog_id=?';args=[id];
  const before=Number(q.get('versionsBefore')??Number.MAX_SAFE_INTEGER);if(!Number.isSafeInteger(before)||before<0)throw new RequestError('Invalid instruction history page.');
  const vs=(await db.prepare('SELECT * FROM prep_instruction_versions WHERE item_id=? AND revision<? ORDER BY revision DESC LIMIT 21').bind(id,before).all<InstructionVersion>()).results;
  base.versions=vs.slice(0,20);Object.assign(base,{versionsNext:vs.length>20?base.versions.at(-1)!.revision:null});
 }else{
  let context;try{context=noteContextSchema.parse(JSON.parse(q.get('context')!));}catch{throw new RequestError('Invalid service feedback link.');}
  // Historical context must have existed in this check, not merely in the catalog.
  const current=await db.prepare("SELECT a.catalog_id FROM evening_answers a JOIN evening_checks e ON e.id=a.check_id WHERE a.check_id=? AND a.item_id=? AND e.version>=? AND json_extract(a.instruction_snapshot,'$.revision') IS ?").bind(context.checkId,context.itemId,context.version,context.instructionRevision).first<{catalog_id:string}>();
  const historic=await db.prepare("SELECT 1 FROM evening_versions v,json_each(v.payload,'$.answers') j WHERE v.check_id=? AND v.version=? AND json_extract(j.value,'$.itemId')=? AND json_extract(j.value,'$.catalogId')=? AND json_extract(j.value,'$.instruction.revision') IS ?").bind(context.checkId,context.version,context.itemId,context.catalogId,context.instructionRevision).first();
  if(current?.catalog_id!==context.catalogId&&!historic)throw new RequestError('This item is not part of this service.',404);
  where='check_id=? AND item_id=? AND catalog_id=?';args=[context.checkId,context.itemId,context.catalogId];
 }
 if(after.length){where+=' AND (created_at<? OR (created_at=? AND id<?))';args.push(after[0],after[0],after[1]);}
 const rows=(await db.prepare(`SELECT * FROM prep_feedback WHERE ${where} ORDER BY created_at DESC,id DESC LIMIT 21`).bind(...args).all<PrepComment>()).results;
 base.comments=rows.slice(0,20);const last=base.comments.at(-1);base.next=rows.length>20&&last?JSON.stringify([last.created_at,last.id]):null;
 return {...base,...(instruction!==undefined?{instruction}:{})};
}
// Owner-only, one read for the list. Versions and service feedback stay on the detail endpoint.
export async function readInstructionIndex(user:ChatGPTUser){
 await syncMember(user);
 if(!await isOwner(user))throw new RequestError('Only the owner can manage prep instructions.',403);
 const instructions=(await getRawDb().prepare('SELECT item_id,text,revision,updated_at,updated_by FROM prep_instructions').all<PrepInstruction>()).results;
 return {account:user.email,accountId:user.userId,supported:1 as const,instructions};
}
export async function prepNoteCommand(user:ChatGPTUser,raw:unknown){
 const c:PrepNoteCommand=prepNoteCommandSchema.parse(raw),db=getRawDb(),member=await syncMember(user);
 if(c.actorId!==user.userId)throw new RequestError('Sign in with the account that wrote this note before retrying.',403);
 if(c.kind==='instruction'&&!await isOwner(user))throw new RequestError('Only the owner can change prep instructions.',403);
 const request=JSON.stringify(c),now=new Date().toISOString(),args=[c.id,user.userId,request];
 const replay=async()=>{const r=await db.prepare('SELECT * FROM prep_note_commands WHERE id=?').bind(c.id).first<{actor_id:string;request:string;applied:number}>();if(!r)return false;if(r.actor_id!==user.userId||r.request!==request)throw new RequestError('This operation ID belongs to another note.',409,'command_mismatch');if(!r.applied)throw Error('Incomplete note receipt');return true;};
 if(await replay())return {operationId:c.id,accountId:user.userId,account:user.email};
 const gate='EXISTS(SELECT 1 FROM prep_note_commands WHERE id=? AND actor_id=? AND request=? AND applied=0)';
 const writes:ReturnType<typeof db.prepare>[]=[];let condition:string,conditionArgs:unknown[];
 if(c.kind==='instruction'){
  condition="coalesce((SELECT revision FROM prep_instructions WHERE item_id=?),0)=? AND EXISTS(SELECT 1 FROM kitchen_owner WHERE id='owner' AND user_id=?) AND EXISTS(SELECT 1 FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen' AND json_extract(j.value,'$.id')=?)";conditionArgs=[c.itemId,c.revision,user.userId,c.itemId];
  writes.push(eventStatement(user,member.name,c,now,{category:'stock',action:'prep-instruction',itemId:'a.id',itemName:'a.name',itemKind:'a.kind',before:"(SELECT json_object('text',text,'revision',revision) FROM prep_instructions WHERE item_id=a.id)",after:'?',from:`FROM (SELECT json_extract(j.value,'$.id') AS id,json_extract(j.value,'$.name') AS name,json_extract(j.value,'$.kind') AS kind FROM notebooks n,json_each(n.payload,'$.items') j WHERE n.id='kitchen') a WHERE a.id=? AND ${gate}`,args:[JSON.stringify({text:c.text,revision:c.revision+1}),c.itemId,...args]}));
  writes.push(db.prepare(`INSERT INTO prep_instructions(item_id,text,revision,updated_at,updated_by,actor_id) SELECT ?,?,?,?,?,? WHERE ${gate} ON CONFLICT(item_id) DO UPDATE SET text=excluded.text,revision=excluded.revision,updated_at=excluded.updated_at,updated_by=excluded.updated_by,actor_id=excluded.actor_id`).bind(c.itemId,c.text,c.revision+1,now,member.name,user.userId,...args));
  writes.push(db.prepare(`INSERT INTO prep_instruction_versions(id,item_id,text,revision,actor_id,actor_name,created_at) SELECT ?,?,?,?,?,?,? WHERE ${gate}`).bind(c.id,c.itemId,c.text,c.revision+1,user.userId,member.name,now,...args));
 }else{
  const x=c.context,table=x.phase==='evening'?'evening_answers':'morning_tasks';
  condition=`EXISTS(SELECT 1 FROM ${table} a JOIN evening_checks e ON e.id=a.check_id WHERE a.check_id=? AND a.item_id=? AND a.catalog_id=? AND json_extract(a.instruction_snapshot,'$.revision') IS ? AND e.version>=? AND ${x.phase==='evening'?'a.superseded_by IS NULL':'a.cancelled=0 AND e.version>0 AND ?>0'})`;
  conditionArgs=[x.checkId,x.itemId,x.catalogId,x.instructionRevision,x.version,...(x.phase==='morning'?[x.version]:[])];
  writes.push(db.prepare(`INSERT INTO prep_feedback(id,check_id,item_id,catalog_id,version,instruction_revision,phase,text,actor_id,actor_name,actor_email,created_at,client_at) SELECT ?,?,?,?,?,?,?,?,?,?,?,?,? WHERE ${gate}`).bind(c.id,x.checkId,x.itemId,x.catalogId,x.version,x.instructionRevision,x.phase,c.text,user.userId,member.name,user.email,now,c.meta?.occurredAt??null,...args));
  writes.push(eventStatement(user,member.name,c,now,{category:x.phase,action:'prep-feedback',itemId:'a.item_id',itemName:'a.name',itemKind:'a.kind',checkId:'a.check_id',targetDay:'e.target_day',after:'?',from:`FROM ${table} a JOIN evening_checks e ON e.id=a.check_id WHERE a.check_id=? AND a.item_id=? AND ${gate}`,args:[JSON.stringify({text:c.text,catalogId:x.catalogId,instructionRevision:x.instructionRevision,version:x.version}),x.checkId,x.itemId,...args]}));
 }
 const receipt=db.prepare(`INSERT INTO prep_note_commands(id,actor_id,request,applied,created_at) SELECT ?,?,?,0,? WHERE (${condition}) AND EXISTS(SELECT 1 FROM kitchen_team WHERE user_id=? AND active=1) ON CONFLICT(id) DO NOTHING`).bind(...args,now,...conditionArgs,user.userId);
 await db.batch([receipt,...writes,db.prepare(`UPDATE prep_note_commands SET applied=1 WHERE id=? AND actor_id=? AND request=? AND applied=0`).bind(...args)]);
 if(!await replay())throw new RequestError(c.kind==='instruction'?'The shared instruction changed. Your text is kept. Load the latest instruction before making a new change.':'This item or its instruction changed. Your feedback is kept. Review the original service before continuing.',409,'note_conflict');
 return {operationId:c.id,accountId:user.userId,account:user.email};
}
