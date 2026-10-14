import {spawnSync} from 'node:child_process';
const run=spawnSync(process.execPath,['scripts/check-review-workflow.mjs','--manager'],{stdio:'inherit'});if(run.status!==0)process.exit(run.status??1);console.log('PASS Manager review: actual verify, approve, explicit apply, rollback, exact retry and immutable Manager authorship.');
