import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
const dir=await mkdtemp(tmpdir()+'/labula-review-context-');
try {
 await build({stdin:{contents:`export * as m from './lib/review-v2/model';export * as nav from './lib/review-v2/navigation';export * as c from './lib/review-v2/confirmation';export * as s from './lib/review-v2/save';export * as n from './lib/notebook';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:dir+'/test.mjs',logLevel:'silent'});
 const {m,nav,c,s,n}=await import(dir+'/test.mjs');
 const source={notebook:{...n.initialNotebook(),items:[],recipes:[]},revision:13,capturedAt:'2026-10-01T00:00:00Z',productionExcludedIds:['synthetic-protected']};
 const d=m.fresh(source),item=m.makeEntity('item','Renamed product',undefined,'synthetic-protected'),proc=m.makeEntity('process','Synthetic process',undefined,'synthetic-process'),run=m.makeEntity('run','Synthetic run',proc.id,'synthetic-run');
 proc.answers['PROC-03']={outputs:[{id:'synthetic-output',item:item.id,type:'Usable product'}]};
 run.answers['RUN-01']={process:proc.id,scope:'Whole process'};run.answers['RUN-04']={packages:[{id:'synthetic-pack',count:'3',content:'1',unit:'kg'}]};
 d.entities.push(item,proc,run);d.position={entityId:run.id,group:'RUN-01'};
 const task={id:'synthetic-check',targets:[{entityId:run.id,group:'RUN-04',path:['packages']}],owner:'',due:'',method:'',reason:'',result:'Observed',evidence:'Synthetic check',performedBy:'Synthetic user',performedOn:'2026-10-01',nextStep:''};
 task.closedHash=m.taskHash(d,task);d.tasks.push(task);
 assert.equal(m.fieldValue(d,task.targets[0]),undefined,'Protected manufacturing stays outside the review after renaming');
 const verify=(x,label)=>{assert.equal(m.taskHash(x,x.tasks[0]),task.closedHash,label+' preserves a previously closed check');assert(m.excluded(x,item.id),label+' retains the source exclusion');};
 verify(m.parseDraft(d),'parse');verify(m.migrate(source,JSON.parse(JSON.stringify(d))),'reload');
 verify(s.mergeCandidate(d,[],{}),'recovery merge');verify(c.upgradeUX(d,source),'UX upgrade');verify(c.confirmTopic(d,run.id,'RUN-01',source),'confirm');
 verify(nav.restoreWork(s.mergeCandidate(d,[],{}),d,source),'restore position');verify(nav.go(d,run,'RUN-01',source),'navigate');verify(nav.setAnswer(d,{entityId:run.id,group:'RUN-01',path:['scope']},'Whole process'),'edit');
 const queue=new s.SaveQueue({source,data:d,revision:0,updatedAt:'',updatedBy:''},()=>{},()=>{});queue.edit(structuredClone(d));verify(queue.current,'queue edit');
 await queue.save(async p=>({operationId:p.operationId,revision:p.revision+1}));verify(queue.acknowledged,'save ACK');
 const other=m.migrate({...source,productionExcludedIds:[]},JSON.parse(JSON.stringify(d)));
 assert.equal(m.excluded(other,item.id),false,'Independent source cannot inherit another account/snapshot exclusions');verify(d,'original after second source');
 assert(!JSON.stringify(d).includes('productionExcludedIds'),'Private metadata is not serialized into chef answers');
 console.log('PASS review source context: protected production, old closed checks, recovery, navigation, save ACK and isolated sources');
} finally {await rm(dir,{recursive:true,force:true});}
