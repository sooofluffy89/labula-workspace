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
try{
 await page.clock.setFixedTime(new Date('2026-10-14T20:32:00Z'));
 await page.goto(base+'/signin-with-chatgpt?return_to=/');const current=await snapshot();const small=structuredClone(current);small.data.items=small.data.items.filter(i=>!i.name.startsWith('QA catalog item '));assert.equal(small.data.items.length,12);
 // Keep the current protected 100-item database intact. Only the browser's GET
 // response is reduced to the original 12 synthetic identities for comparison.
 await page.route('**/api/notebook',route=>route.request().method()==='GET'?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(small)}):route.abort());
 await test('Same-data before/after screenshots use the original 12 synthetic identities',async()=>{
  await page.goto(base+'/?view=insights');await page.getByRole('heading',{name:'Preparation analysis',exact:true}).waitFor({timeout:60000});await page.setViewportSize({width:390,height:844});await page.waitForTimeout(150);await shot('comparison-after-home-390');
  await go('catalog');await page.getByRole('button',{name:'All items 12',exact:true}).click();assert.equal(await page.locator('.catalog-item-link').count(),12);const prepY=await page.locator('.catalog-work-actions .prep-launch').evaluate(e=>e.getBoundingClientRect().top);assert(prepY<350);metrics.push({fixture:'12 original synthetic items; browser GET only',prepY});await shot('comparison-after-catalog-390');
  await go('recipes');await shot('comparison-after-recipes-390');await page.setViewportSize({width:1100,height:900});await page.getByRole('button',{name:'Review menu',exact:true}).click();await page.locator('.review-panel-detail').waitFor();await shot('comparison-after-detail-1100');await page.locator('.menu-review-panel').getByRole('button',{name:'Close',exact:true}).click();
  await page.goto(base+'/?view=morning&day=2026-10-15');await page.locator('.morning-row').first().waitFor();await page.setViewportSize({width:390,height:844});await page.evaluate(()=>scrollTo(0,0));await shot('comparison-after-morning-390');
 });
 await test('Comparison fixtures produce no browser exceptions',async()=>assert.deepEqual(errors,[]));
}catch(error){results.push({name:'Failure',status:'failed',error:error.stack});console.error(error);process.exitCode=1;}
finally{await fs.writeFile(path.join(output,'comparison-results.json'),JSON.stringify({results,metrics,errors},null,2));await browser.close();}
