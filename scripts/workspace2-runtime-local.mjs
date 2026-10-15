#!/usr/bin/env node
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {resolve} from 'node:path';
import {projectRoot} from './sites-env.mjs';

// There is deliberately no remote mode, database override, arbitrary SQL or
// production credential input. Production uses its separately authorized host.
export function runtimePolicyCommand(args){
 const mode=args[0];
 if(mode==='status'&&args.length===1)return "SELECT id,write_paused,min_client_version,revision,updated_at FROM workspace_runtime_policy WHERE id='kitchen';";
 if(mode==='pause'&&args.length===1)return "UPDATE workspace_runtime_policy SET write_paused=1,revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='kitchen' AND write_paused=0; SELECT id,write_paused,min_client_version,revision,updated_at FROM workspace_runtime_policy WHERE id='kitchen';";
 if(mode==='resume'&&args.length===3&&args[1]==='--min-client-version'&&['1','2'].includes(args[2]))return `UPDATE workspace_runtime_policy SET write_paused=0,min_client_version=${args[2]},revision=revision+1,updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id='kitchen' AND write_paused=1; SELECT id,write_paused,min_client_version,revision,updated_at FROM workspace_runtime_policy WHERE id='kitchen';`;
 throw Error('Use status, pause, or resume --min-client-version 1|2. This tool operates only on local .wrangler/state.');
}
export function localRuntimeArguments(args){return ['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state','--command',runtimePolicyCommand(args)];}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try{const result=spawnSync(process.execPath,localRuntimeArguments(process.argv.slice(2)),{cwd:projectRoot,stdio:'inherit'});if(result.error)throw result.error;process.exitCode=result.status??1;}catch(error){console.error(error instanceof Error?error.message:'Local runtime policy failed.');process.exitCode=1;}
}
