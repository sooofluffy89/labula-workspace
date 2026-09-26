// Keep the API export and browser download check on the same explicit inventory.
// New persistent tables must be added here before they can be called backed up.
export const privateBackupTables = [
  'notebooks', 'kitchen_owner', 'notebook_commands', 'catalog_operations',
  'data_reviews', 'data_review_commands', 'review_actions', 'review_authority',
  'reviewed_entities', 'review_import_chunks', 'stock_items', 'stock_commands', 'ingredient_group_commands',
  'stock_catalog_effects', 'evening_checks', 'evening_answers', 'evening_versions',
  'morning_tasks', 'evening_commands', 'kitchen_team', 'kitchen_activity',
  'team_commands', 'check_rounds', 'round_state', 'round_timeline', 'round_commands',
] as const;

export type PrivateBackup = {
  format: 'Labula private database backup';
  version: 1;
  capturedAt: string;
  tables: Record<string, unknown[]>;
  counts: Record<string, number>;
};

export function isCompletePrivateBackup(value: unknown): value is PrivateBackup {
  if (typeof value !== 'object' || value === null) return false;
  const backup = value as Partial<PrivateBackup>;
  if (backup.format !== 'Labula private database backup' || backup.version !== 1 ||
      typeof backup.capturedAt !== 'string' || !Number.isFinite(Date.parse(backup.capturedAt)) ||
      typeof backup.tables !== 'object' || backup.tables === null ||
      typeof backup.counts !== 'object' || backup.counts === null) return false;
  return privateBackupTables.every(table =>
    Array.isArray(backup.tables?.[table]) &&
    Number.isSafeInteger(backup.counts?.[table]) &&
    backup.counts![table] === backup.tables![table].length
  );
}

// An older archive remains readable; absence of round metadata is explicitly legacy.
export function readPrivateBackup(value:unknown){
 if(isCompletePrivateBackup(value))return {backup:value,legacyRounds:false};
 if(typeof value!=='object'||!value)return null;
 const b=value as PrivateBackup;
 const added=['check_rounds','round_state','round_timeline','round_commands'];
 if(added.some(t=>b.tables?.[t]!==undefined))return null;
 const upgraded={...b,tables:{...b.tables},counts:{...b.counts}};
 for(const t of added){upgraded.tables[t]=[];upgraded.counts[t]=0;}
 return isCompletePrivateBackup(upgraded)?{backup:b,legacyRounds:true}:null;
}
