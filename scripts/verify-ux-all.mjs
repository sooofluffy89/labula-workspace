/** Run browser scenarios sequentially; role changes must never overlap another scenario. */
import {spawnSync} from 'node:child_process';
for(const name of ['browser','scenarios','details','quick-browser','roles','comparison']){
 const script='scripts/verify-ux-'+name+'.mjs';
 const result=spawnSync(process.execPath,[script],{stdio:'inherit',env:process.env});
 if(result.status!==0)process.exit(result.status??1);
 console.log('PASS '+script);
}
