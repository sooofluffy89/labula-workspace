/* eslint-disable react-hooks/rules-of-hooks -- Deterministic hook scheduler tests repeated renders and cleanup outside a DOM renderer. */
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'esbuild';
const dir=await mkdtemp(tmpdir()+'/labula-motion-hooks-');
try{
 await writeFile(dir+'/react.mjs',`export function useRef(initial){const h=globalThis.motionHooks,i=h.cursor++;return h.cells[i]??(h.cells[i]={current:initial})}export function useState(initial){const h=globalThis.motionHooks,i=h.cursor++;if(!(i in h.cells))h.cells[i]={value:initial};return [h.cells[i].value,v=>{h.cells[i].value=v;h.dirty=true}]}export function useEffect(fn,deps){const h=globalThis.motionHooks,i=h.cursor++,prev=h.cells[i];if(!prev||deps.some((v,j)=>v!==prev.deps[j])){h.cells[i]={deps};h.effects.push(()=>{prev?.cleanup?.();h.cells[i].cleanup=fn()})}}`);
 await writeFile(dir+'/ui.mjs',`export const jsx=()=>null,jsxs=jsx;export const Dialog={Content:'dialog'};export const DialogPortal='portal',DialogOverlay='overlay';`);
 await build({stdin:{contents:"export {useSavePulse} from './app/stock-motion';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:dir+'/test.mjs',alias:{'react/jsx-runtime':dir+'/ui.mjs',react:dir+'/react.mjs','radix-ui':dir+'/ui.mjs','@/components/ui/dialog':dir+'/ui.mjs'},logLevel:'silent'});
 const {useSavePulse}=await import(dir+'/test.mjs');let next=0;const timers=new Map();globalThis.window={setTimeout(fn,ms){assert.equal(ms,220);timers.set(++next,fn);return next},clearTimeout(id){timers.delete(id)}};
 const h=globalThis.motionHooks={cells:[],cursor:0,dirty:false,effects:[]};
 const render=(token,eligible=true,context='chef:day')=>{let result;for(let i=0;i<10;i++){h.cursor=0;h.dirty=false;result=useSavePulse(token,eligible,context);for(const effect of h.effects.splice(0))effect();if(!h.dirty)return result}throw Error('effect loop')};
 assert.equal(render('historical'),false);assert.equal(timers.size,0);
 assert.equal(render('A'),true);assert.equal(timers.size,1);
 assert.equal(render('A',false),false);assert.equal(timers.size,0);assert.equal(render('A',true),false,'discarding a later intent cannot replay A');
 assert.equal(render('B',false),false);assert.equal(render('B',true),false,'ACK while another intent is pending is consumed');
 assert.equal(render('C',true),true);assert.equal(render('C',true),true,'rerender does not restart timer');assert.equal(timers.size,1);
 for(const [id,fn] of timers){timers.delete(id);fn()}assert.equal(render('C'),false);
 assert.equal(render('new-context-ACK',true,'other:day'),false);assert.equal(render('new-context-ACK',true,'chef:next-day'),false);
 assert.equal(render('D',true,'chef:next-day'),true);for(const cell of h.cells)cell?.cleanup?.();assert.equal(timers.size,0,'unmount clears presentation timer');
 console.log('PASS actual useSavePulse lifecycle: mount/history, new ACK, pending invalidation, discard, polling rerender, timeout cleanup, identity/day switches and unmount');
}finally{delete globalThis.window;delete globalThis.motionHooks;await rm(dir,{recursive:true,force:true})}
