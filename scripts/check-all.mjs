import {spawnSync} from 'node:child_process';
import {readdirSync} from 'node:fs';
const scripts=readdirSync(new URL('.',import.meta.url)).filter(name=>/^check-.*\.mjs$/.test(name)&&name!=='check-all.mjs').sort();
for(const script of scripts){const result=spawnSync(process.execPath,['scripts/'+script],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);console.log('PASS '+script);}
console.log(`All ${scripts.length} regression scripts passed.`);
