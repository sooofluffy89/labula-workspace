import assert from 'node:assert/strict';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {fixture} from './review-v2-fixture.mjs';
const dir=await mkdtemp(tmpdir()+'/labula-p2-'),root=process.cwd();
try{
 await build({stdin:{contents:`export * as m from './lib/review-v2/model';export * as n from './lib/notebook';export * as c from './lib/review-v2/confirmation';export * as nav from './lib/review-v2/navigation';export * as g from './lib/review-v2/guidance';export * as r from './lib/review-v2/recovery-resolution';export {groups} from './lib/review-v2/fields';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';import {TopicStatus} from './app/review/ux';export const renderTopic=p=>renderToStaticMarkup(createElement(TopicStatus,p));`,resolveDir:root},bundle:true,platform:'node',format:'cjs',outfile:dir+'/domain.cjs',logLevel:'silent'});
 const {m,n,c,nav,g,r,groups,renderTopic}=await import(dir+'/domain.cjs'),f=fixture(m,n),{source,water,run}=f;
 for(const [id,content] of [['RUN-04',/pack.*contains/],['RUN-05',/inputs, outputs/],['RUN-06',/hands-on step/],['RUN-08',/Waiting time and active work/],['STORE-05',/before and after/]]){assert.match(g.topicGuide(id).summary,content);if(id.startsWith('RUN'))assert.equal(g.topicGuide(id,true),undefined);}
 assert.match(g.fieldGuide('RUN-07',['steps','any-stable-row','intervals','crew-id','people']).summary,/person-minutes/);
 assert.equal(g.fieldGuide('RUN-07',['evidence','row','people']),undefined);
 assert.equal(g.fieldGuide('ITEM-02',['phase']),undefined);
 assert(g.fieldGuide('ITEM-02',['sources','source-id','phase']));
 assert.equal(g.fieldGuide('RUN-07',['steps','row','intervals','interval','people'],true),undefined);
 let d=c.upgradeUX(structuredClone(f.d),source),e=m.entity(d,water.id),before=JSON.stringify(d);
 assert(c.confirmationStatus(d,e,'ITEM-01',source).valid);assert.deepEqual(c.confirmationChanges(d,e,'ITEM-01',source),[]);
 const html=renderTopic({data:d,record:e,group:groups.find(g=>g.id==='ITEM-01'),source});assert(html.includes('Confirmed'));assert(!html.includes('Why this needs another confirmation'));assert.equal(JSON.stringify(d),before);
 e.answers['ITEM-01'].name='Changed legacy';assert(!c.confirmationStatus(d,e,'ITEM-01',source).valid);assert.match(c.confirmationChanges(d,e,'ITEM-01',source)[0].detail,/captured when the review was upgraded/);
 d=c.confirmTopic(c.upgradeUX(structuredClone(f.d),source),water.id,'ITEM-03',source);e=m.entity(d,water.id);e.answers['ITEM-03'].actions=['Wash'];let change=c.confirmationChanges(d,e,'ITEM-03',source)[0];assert.equal(change.before,'Nothing');assert.equal(change.after,'Wash');assert.match(change.title,/Local work/);assert(change.exact);
 d=c.confirmTopic(c.upgradeUX(structuredClone(f.d),source),water.id,'ITEM-02',source);e=m.entity(d,water.id);e.answers['ITEM-02'].sources[0].phase=e.answers['ITEM-01'].stages[1].id;
 change=c.confirmationChanges(d,e,'ITEM-02',source).find(x=>x.target?.path.at(-1)==='phase');assert.equal(change.before,'Raw');assert.match(change.after,/Ready/);assert.match(change.title,/State at receipt/);assert(change.exact);
 // A currently renamed stage must not be presented as the historical name.
 e.answers['ITEM-01'].stages[0].name='Renamed now';change=c.confirmationChanges(d,e,'ITEM-02',source).find(x=>x.target?.path.at(-1)==='phase');assert.equal(change.before,'Raw');
 const dep=JSON.parse(d.ux.confirmations[e.id]['ITEM-02'].dependencies);d.ux.confirmations[e.id]['ITEM-02'].dependencies=JSON.stringify(dep.filter(([k])=>!k.endsWith(':'+e.answers['ITEM-01'].stages[0].id)));
 change=c.confirmationChanges(d,e,'ITEM-02',source).find(x=>x.target?.path.at(-1)==='phase');assert.match(change.before,/name was not recorded/);assert(!change.exact);
 d=c.confirmTopic(c.upgradeUX(structuredClone(f.d),source),water.id,'ITEM-01',source);e=m.entity(d,water.id);e.answers['ITEM-01'].stages.reverse();assert(c.confirmationChanges(d,e,'ITEM-01',source).some(x=>/different order/.test(x.after)));
 e.answers['ITEM-01'].stages.pop();assert(c.confirmationChanges(d,e,'ITEM-01',source).some(x=>x.after==='No row'));e.answers['ITEM-01'].stages.push({id:'new-stable',name:'New stage',specification:'New'});assert(c.confirmationChanges(d,e,'ITEM-01',source).some(x=>x.before==='No row'));
 d=c.confirmTopic(c.upgradeUX(structuredClone(f.d),source),run.id,'RUN-02',source);d.position={entityId:run.id,group:'RUN-02'};e=m.entity(d,water.id);e.answers['ITEM-01'].stages[0].specification='Changed';
 const reason=c.confirmationChanges(d,m.entity(d,run.id),'RUN-02',source).find(x=>x.target?.entityId===water.id&&x.target.path.at(-1)==='specification');assert(reason);const answers=JSON.stringify(d.entities),origin={...d.position};
 let visit=nav.visitRelated(d,reason.target,source);assert.equal(visit.ux.returns.length,1);assert(!visit.ux.returns[0].ref);assert.deepEqual(JSON.parse(JSON.stringify(visit.entities)),JSON.parse(answers));assert.equal(nav.visitRelated(visit,reason.target,source).ux.returns.length,1);
 visit=nav.visitRelated(visit,{entityId:f.broth.id,group:'ITEM-01',path:[]},source);assert.equal(visit.ux.returns.length,2);visit=m.parseDraft(JSON.parse(JSON.stringify(visit)));visit=nav.finishRelated(visit,source);assert.equal(visit.position.entityId,water.id);visit=nav.finishRelated(visit,source);assert.deepEqual(visit.position,origin);assert.deepEqual(JSON.parse(JSON.stringify(visit.entities)),JSON.parse(answers));
 visit=nav.visitRelated(d,reason.target,source);m.entity(visit,run.id).archived=true;visit=nav.finishRelated(visit,source);assert.equal(visit.ux.returns.length,0);assert(!m.entity(visit,visit.position.entityId).archived);
 // Unrelated changes do not invalidate a confirmation or create explanations.
 d=c.confirmTopic(c.upgradeUX(structuredClone(f.d),source),water.id,'ITEM-03',source);m.entity(d,f.coriander.id).name='Unrelated';assert(c.confirmationStatus(d,m.entity(d,water.id),'ITEM-03',source).valid);
 const map=new Map(),storage={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},raw=JSON.stringify({current:'C'}),shared=structuredClone(d);
 await r.rememberRecoveryMerge(storage,raw,'u','campaign','archive-1');assert(!await r.recoveryWasSaved(storage,raw,'u','campaign',shared));shared.imports.push({id:'archive-1',at:'now',sourceRevision:317,label:'test'});assert(await r.recoveryWasSaved(storage,raw,'u','campaign',shared));
 assert(!await r.recoveryWasSaved(storage,raw+' ','u','campaign',shared));assert(!await r.recoveryWasSaved(storage,raw,'other','campaign',shared));assert(!await r.recoveryWasSaved(storage,raw,'u','other',shared));
 await assert.rejects(()=>r.rememberRecoveryMerge({getItem:()=>null,setItem:()=>{throw Error('quota');}},raw,'u','campaign','archive-1'),/quota/);
 // Mount the real guide with hook state and throwing storage acquisition/methods.
 await writeFile(dir+'/react.mjs',`export const jsx=(type,props)=>({type,props});export const jsxs=jsx;export const Fragment='Fragment';export const useState=init=>{const i=globalThis.cursor++;globalThis.state[i]??={v:typeof init==='function'?init():init};return [globalThis.state[i].v,v=>globalThis.state[i].v=v];};`);
 await writeFile(dir+'/ui.mjs',`export const Button='Button',Dialog='Dialog',DialogClose='DialogClose',DialogContent='DialogContent',DialogDescription='DialogDescription',DialogFooter='DialogFooter',DialogHeader='DialogHeader',DialogTitle='DialogTitle',DialogTrigger='DialogTrigger';`);
 await build({stdin:{contents:'export {ReviewGuide} from "./app/review/guide";',resolveDir:root},bundle:true,platform:'node',format:'esm',outfile:dir+'/guide.mjs',jsx:'automatic',alias:{react:dir+'/react.mjs','react/jsx-runtime':dir+'/react.mjs'},plugins:[{name:'ui',setup(b){b.onResolve({filter:/^@\/components\/ui\//},()=>({path:dir+'/ui.mjs'}));}}],logLevel:'silent'});
 const {ReviewGuide}=await import(dir+'/guide.mjs'),flat=x=>!x||typeof x==='boolean'?[]:Array.isArray(x)?x.flatMap(flat):typeof x!=='object'?[x]:[x,...flat(x.props?.children)];
 for(const mode of ['getter','methods','corrupt','ssr']){globalThis.state=[];globalThis.window=mode==='getter'?Object.defineProperty({},'localStorage',{get(){throw new DOMException('Denied','SecurityError');}}):{localStorage:{getItem:()=>{if(mode==='methods')throw Error('read');return 'broken';},setItem:()=>{throw Error('quota');}}};if(mode==='ssr')delete globalThis.window;const render=()=>{globalThis.cursor=0;return ReviewGuide({userId:'test',autoOffer:true});};let tree=render();assert(tree.props.open);flat(tree).find(x=>x.type==='Button'&&x.props.children==='Skip for now').props.onClick();assert(!render().props.open);flat(tree).find(x=>x.type==='Button'&&x.props.children==='Help & examples').props.onClick();assert(render().props.open);render().props.onOpenChange(false);assert(!render().props.open);}
 delete globalThis.window;delete globalThis.state;delete globalThis.cursor;
 console.log('PASS six P2 domains: contextual field paths, valid legacy status, readable and honest changes, nested no-link return/reload, blocked storage getter and recovery evidence isolation.');
}finally{await rm(dir,{recursive:true,force:true});}
