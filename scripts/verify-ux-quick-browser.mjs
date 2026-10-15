import {build} from 'esbuild';
import {mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
/** Local synthetic browser verification. Supply PLAYWRIGHT_MODULE / UX_CHROMIUM when not installed locally. */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.UX_BASE_URL??'http://localhost:5173';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Synthetic verification is loopback-only');
const output=path.resolve(process.env.UX_EVIDENCE_DIR??'/tmp/labula-ux-verification');await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
const browser=await chromium.launch({executablePath:process.env.UX_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Europe/Prague'}),page=await context.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(60000);
const results=[],metrics=[],errors=[];page.on('pageerror',e=>errors.push(e.message));
const names={insights:'Preparation analysis',recipes:'Dish recipes',catalog:'Ingredients',overview:'Menu analysis',review:'Kitchen review',manage:'Checklist settings',evening:'Evening check',morning:'Morning prep',rounds:'Check rounds',history:'Operations history',operations:'Operations overview',calendar:'Calendar & deadlines',team:'Team & access'};
async function shot(name,fullPage=false){await page.screenshot({path:path.join(output,'screenshots',name+'.png'),fullPage});}
async function go(view){if(await page.locator('#workspace-destination').isVisible())await page.locator('#workspace-destination').selectOption(view);else await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:names[view],exact:true}).click();await page.waitForFunction(view=>new URL(location.href).searchParams.get('view')===view,view);await page.waitForTimeout(200);}
async function test(name,fn){if(process.env.UX_TEST_PATTERN&&!new RegExp(process.env.UX_TEST_PATTERN).test(name))return;await fn();results.push({name,status:'passed'});console.log('PASS '+name);}
async function snapshot(){const r=await page.request.get(base+'/api/notebook');assert.equal(r.status(),200);const b=await r.json();assert.equal(b.user,'seedy@sites.test','Local synthetic owner only');return b;}
const temp=await mkdtemp(path.join(tmpdir(),'labula-ux-quick-browser-'));
try{
 await build({stdin:{contents:"export {fresh} from './lib/review-v2/model';export {emptyQuick,emptyProcess,emptyOutput} from './lib/quick-review/model';",resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',outfile:temp+'/model.mjs',logLevel:'silent'});const model=await import(temp+'/model.mjs');
 await page.goto(base+'/signin-with-chatgpt?return_to=/');const envelope=await(await page.request.get(base+'/api/review-workflow')).json();assert.equal(envelope.user,'seedy@sites.test');
 const source={notebook:envelope.notebook.data,revision:envelope.notebook.revision,capturedAt:'2026-10-14T12:00:00Z',quickCaseItems:{garlic:[envelope.notebook.data.items[0].id]}},data=model.fresh(source),task=model.emptyProcess();task.kind='A separate preparation';task.name='Synthetic sauce batch';task.sharedScope='All this work is local and separate';task.outputs=[model.emptyOutput(source.quickCaseItems.garlic[0])];data.quick=model.emptyQuick();data.quick.processes=[task];data.quick.cases[0].processIds=[task.id];data.quick.position={view:'case',caseId:'garlic',processId:task.id,step:1};
 const fixture={...envelope,record:{source,data,revision:1,updatedAt:source.capturedAt,updatedBy:envelope.user}};
 await page.route('**/api/review-workflow',route=>{if(route.request().method()==='GET')return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)});const command=route.request().postDataJSON();if(command.action!=='save2')return route.abort();fixture.record.data=command.data;fixture.record.revision++;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({operationId:command.operationId,revision:fixture.record.revision})});});
 await page.goto(base+'/?view=review');await page.locator('.quick-steps').waitFor({timeout:60000});
 await test('Quick review blocks an incomplete step and links to the missing field (browser fixture)',async()=>{
  await page.setViewportSize({width:390,height:844});const continuation=page.locator('.quick-footer').getByRole('button',{name:'Continue',exact:true});await continuation.click();await page.getByRole('alert').filter({hasText:'Check these answers before continuing'}).waitFor();assert.equal(await page.locator('.quick-steps [aria-current=step]').innerText(),'2. One usual batch');const issue=page.getByRole('alert').getByRole('button').first();await issue.click();await page.waitForTimeout(180);assert(await page.evaluate(()=>!!document.activeElement?.closest('[data-quick-topic]')));assert(await page.getByText('Output',{exact:true}).isVisible());await shot('after-quick-review-errors',true);
  const style=await page.locator('.quick-panel input').filter({visible:true}).first().evaluate(e=>({border:getComputedStyle(e).borderColor,background:getComputedStyle(e).backgroundColor}));metrics.push({quickInputStyle:style});
 });
 await test('Quick review step exposes Output, Work and Frequency groups',async()=>{for(const label of ['Output','Work','Frequency'])assert(await page.locator('.quick-step-section>summary').getByText(label,{exact:true}).isVisible());assert.equal(context.pages().length,1);});
 await test('Quick review has no runtime exceptions',async()=>assert.deepEqual(errors,[]));
}catch(error){results.push({name:'Failure',status:'failed',error:error.stack});console.error(error);await shot('quick-failure').catch(()=>{});process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'quick-results.json'),JSON.stringify({results,metrics,errors},null,2));await browser.close();await fs.rm(temp,{recursive:true,force:true});}
