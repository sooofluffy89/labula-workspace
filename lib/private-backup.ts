// Keep the API export and browser download check on the same explicit inventory.
// New persistent tables must be added here before they can be called backed up.
export const privateBackupTables = [
  'notebooks', 'kitchen_owner', 'notebook_commands', 'catalog_operations',
  'data_reviews', 'data_review_commands', 'review_actions', 'review_authority',
  'reviewed_entities', 'review_import_chunks', 'stock_items', 'stock_commands', 'ingredient_group_commands',
  'stock_catalog_effects', 'evening_checks', 'evening_answers', 'evening_versions',
  'morning_tasks', 'evening_commands', 'kitchen_team', 'kitchen_activity',
  'operating_calendar_versions', 'operating_commands', 'operating_outcomes',
  'prep_instructions', 'prep_instruction_versions', 'prep_note_commands', 'prep_feedback',
  'team_commands', 'check_rounds', 'round_state', 'round_timeline', 'round_commands',
  'checking_station_items', 'checking_station_commands', 'access_write_guards', 'team_access_state',
  'user_photos', 'user_photo_commands', 'user_photo_uploads',
] as const;

export type PrivateBackup = {
  format: 'Labula private database backup';
  version: 1;
  stations?: 1;
  access?: 1;
  profiles?: 1;
  photos?: {userId:string;revision:number;objectKey:string;sha256:string;size:number;mime:'image/png';dataBase64:string}[];
  capturedAt: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

export function isCompletePrivateBackup(value: unknown): value is PrivateBackup {
  if (typeof value !== 'object' || value === null) return false;
  const backup = value as Partial<PrivateBackup>;
  if (backup.format !== 'Labula private database backup' || backup.version !== 1 || backup.stations !== 1 || backup.access !== 1 ||
      typeof backup.capturedAt !== 'string' || !Number.isFinite(Date.parse(backup.capturedAt)) ||
      typeof backup.tables !== 'object' || backup.tables === null ||
      typeof backup.counts !== 'object' || backup.counts === null) return false;
  if(backup.profiles!==1||!Array.isArray(backup.photos)||!Array.isArray(backup.tables.user_photos))return false;
  if(!backup.tables.user_photos.every(row=>typeof row==='object'&&row!==null&&
    typeof (row as Record<string,unknown>).user_id==='string'&&
    Number.isSafeInteger((row as Record<string,unknown>).revision)&&
    ((row as Record<string,unknown>).object_key===null||typeof (row as Record<string,unknown>).object_key==='string'))||
    !backup.photos.every(photo=>typeof photo==='object'&&photo!==null))return false;
  const references=backup.tables.user_photos as {user_id:string;revision:number;object_key:string|null;sha256:string;size:number}[];
  const current=references.filter(row=>row.object_key);
  if(current.length!==backup.photos.length||new Set(backup.photos.map(p=>p.userId)).size!==current.length)return false;
  if(!current.every(row=>backup.photos!.some(p=>p.userId===row.user_id&&p.revision===row.revision&&p.objectKey===row.object_key&&p.sha256===row.sha256&&p.size===row.size&&p.mime==='image/png'&&p.size>0&&p.size<=350*1024&&/^[a-f0-9]{64}$/.test(p.sha256)&&typeof p.dataBase64==='string'&&p.dataBase64.length===Math.ceil(p.size/3)*4)))return false;
  return privateBackupTables.every(table =>
    Array.isArray(backup.tables?.[table]) &&
    Number.isSafeInteger(backup.counts?.[table]) &&
    backup.counts![table] === backup.tables![table].length
  );
}

// Complete historical exports stay readable, without pretending absent metadata was recorded.
export function readPrivateBackup(value:unknown){
 if(isCompletePrivateBackup(value))return {backup:value,legacyRounds:false,legacyOperations:false,legacyNotes:false,legacyStations:false};
 if(typeof value!=='object'||!value)return null;
 const b=value as PrivateBackup;
 const upgraded={...b,tables:{...b.tables},counts:{...b.counts}};
 const photos=['user_photos','user_photo_commands','user_photo_uploads'];
 const missingPhotos=b.profiles===undefined&&b.photos===undefined&&photos.every(t=>b.tables?.[t]===undefined);
 if(missingPhotos){for(const t of photos){upgraded.tables[t]=[];upgraded.counts[t]=0;}upgraded.profiles=1;upgraded.photos=[];}
 const access=['access_write_guards','team_access_state'];
 const missingAccess=b.access===undefined&&access.every(t=>b.tables?.[t]===undefined);
 if(b.access===1&&access.some(t=>b.tables?.[t]===undefined))return null;
 if(missingAccess){for(const t of access){upgraded.tables[t]=[];upgraded.counts[t]=0;}upgraded.access=1;}
 const stations=['checking_station_items','checking_station_commands'];
 const missingStations=b.stations===undefined&&stations.every(t=>b.tables?.[t]===undefined);
 if(b.stations===1&&stations.some(t=>b.tables?.[t]===undefined))return null;
 if(missingStations){for(const t of stations){upgraded.tables[t]=[];upgraded.counts[t]=0;}upgraded.stations=1;}
 const notes=['prep_instructions','prep_instruction_versions','prep_note_commands','prep_feedback'];
 const missingNotes=notes.every(t=>b.tables?.[t]===undefined);
 if(missingNotes)for(const t of notes){upgraded.tables[t]=[];upgraded.counts[t]=0;}
 const rounds=['check_rounds','round_state','round_timeline','round_commands'];
 const operations=['operating_calendar_versions','operating_commands','operating_outcomes'];
 const missingRounds=rounds.every(t=>b.tables?.[t]===undefined),missingOperations=operations.every(t=>b.tables?.[t]===undefined);
 if(missingRounds)for(const t of rounds){upgraded.tables[t]=[];upgraded.counts[t]=0;}
 if(missingOperations)for(const t of operations){upgraded.tables[t]=[];upgraded.counts[t]=0;}
 return isCompletePrivateBackup(upgraded)?{backup:b,legacyRounds:missingRounds,legacyOperations:missingOperations,legacyNotes:missingNotes,legacyStations:missingStations}:null;
}

// Verify actual bytes, not just presence of SQL pointers or a manifest.
export async function verifyPrivateBackupPhotos(value:PrivateBackup){
 if(!isCompletePrivateBackup(value))return false;
 for(const photo of value.photos!){try{const binary=atob(photo.dataBase64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));if(bytes.length!==photo.size)return false;const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');if(hash!==photo.sha256)return false;}catch{return false;}}return true;
}
