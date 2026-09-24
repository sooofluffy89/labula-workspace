import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';

const dir = await mkdtemp(tmpdir() + '/labula-backup-validator-');
try {
  await build({entryPoints: ['lib/private-backup.ts'], bundle: true, platform: 'node',
    format: 'esm', outfile: dir + '/backup.mjs', logLevel: 'silent'});
  const {privateBackupTables, isCompletePrivateBackup} = await import(dir + '/backup.mjs');
  const tables = Object.fromEntries(privateBackupTables.map(name => [name, []]));
  const counts = Object.fromEntries(privateBackupTables.map(name => [name, 0]));
  const complete = {format: 'Labula private database backup', version: 1,
    capturedAt: '2026-09-24T12:00:00.000Z', tables, counts};

  assert.equal(isCompletePrivateBackup(complete), true);
  assert.equal(isCompletePrivateBackup({...complete, tables: {...tables, notebooks: [{}]},
    counts: {...counts, notebooks: 1}}), true);
  for (const omitted of ['kitchen_team', 'kitchen_activity', 'team_commands']) {
    const incompleteTables = {...tables};
    delete incompleteTables[omitted];
    assert.equal(isCompletePrivateBackup({...complete, tables: incompleteTables}), false,
      `missing ${omitted} must block the download`);
  }
  assert.equal(isCompletePrivateBackup({...complete, counts: {...counts, notebooks: 1}}), false);
  assert.equal(isCompletePrivateBackup({...complete, format: 'unknown'}), false);
  assert.equal(isCompletePrivateBackup({...complete, version: 2}), false);
  console.log('PASS private backup download: complete current inventory accepted; missing new tables and inconsistent counts rejected.');
} finally {
  await rm(dir, {recursive: true, force: true});
}
