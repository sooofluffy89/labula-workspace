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
] as const;

export type PrivateBackup = {
  format: 'Labula private database backup';
  version: 1;
  stations?: 1;
  access?: 1;
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
