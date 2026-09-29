import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/labula-desktop-preferences-');
try{
 await build({entryPoints:['lib/personal-views.ts'],bundle:true,format:'esm',platform:'node',outfile:dir+'/preferences.mjs',logLevel:'silent'});
 const {defaultPreference,readPersonalViews,readListPreference,personalViewsKey}=await import(dir+'/preferences.mjs');
 const value={...defaultPreference,search:'garlic / 蒜',menu:['Starters','Specials'],instruction:'without',tracking:'untracked',sort:'desc'};
 const views=[{id:'one',name:'Missing instructions',value}];
 assert.deepEqual(readPersonalViews(JSON.stringify(views)),views);
 assert.deepEqual(readListPreference(JSON.stringify(value)),value);
 assert.notEqual(personalViewsKey('owner','manage'),personalViewsKey('manager','manage'));
 assert.notEqual(personalViewsKey('owner','round-daily'),personalViewsKey('owner','round-weekly'));
 assert.equal(personalViewsKey('Owner','manage'),personalViewsKey('owner','manage'));
 for(const raw of ['{bad','null','{}',JSON.stringify([{...views[0],value:{...value,menu:['invalid']}}]),JSON.stringify([{...views[0],value:{...value,tracking:'delete'}}])])assert.deepEqual(readPersonalViews(raw),[]);
 assert.equal(readListPreference(JSON.stringify({...value,sort:'arbitrary'})),null);
 assert.equal(readListPreference(JSON.stringify({...value,menu:'Starters'})),null);
 const polluted=JSON.stringify([{...views[0],value:{...value,itemIds:['other'],track:true,revision:99}}]);
 assert.deepEqual(readPersonalViews(polluted),views,'Personal views contain UI preferences only, never operational writes or item selection');
 console.log('PASS desktop preferences: account/scope isolation, round-trip Unicode and filters, corrupt storage fallback, unknown field stripping, no operational selection or writes.');
}finally{await rm(dir,{recursive:true,force:true});}
