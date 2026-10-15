/**
 * Workspace 2.0 browser regression suite. Uses a loopback development server and
 * synthetic data only. Real API mutation scenarios require the expected local
 * identity; fixtures used for faults/large data are reported as emulated.
 *
 * PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs UX_CHROMIUM=/usr/bin/chromium \
 * UX_EVIDENCE_DIR=/tmp/workspace2 node scripts/verify-workspace2-browser.mjs
 */
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const {chromium}=await import(process.env.PLAYWRIGHT_MODULE??'playwright');
const base=process.env.UX_BASE_URL??'http://localhost:5173';
assert(['localhost','127.0.0.1','[::1]'].includes(new URL(base).hostname),'Synthetic browser verification is loopback-only');
const output=path.resolve(process.env.UX_EVIDENCE_DIR??'/tmp/labula-workspace2-verification');
await fs.mkdir(path.join(output,'screenshots'),{recursive:true});
const browser=await chromium.launch({executablePath:process.env.UX_CHROMIUM,headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
const context=await browser.newContext({viewport:{width:1440,height:844},timezoneId:'Europe/Prague',...(process.env.UX_COMPILED_PREVIEW==='1'?{extraHTTPHeaders:{'oai-authenticated-user-id':'local_seedy','oai-authenticated-user-email':'seedy@sites.test','oai-authenticated-user-fullname':'Seedy','oai-authenticated-user-full-name-encoding':'percent-encoded-utf-8'}}:{})});
const page=await context.newPage();page.setDefaultTimeout(20000);page.setDefaultNavigationTimeout(90000);
const results=[],metrics=[],errors=[];
page.on('pageerror',error=>errors.push(error.message));
async function shot(name,fullPage=false){await page.screenshot({path:path.join(output,'screenshots',name+'.png'),fullPage});}
async function test(name,basis,fn){if(process.env.UX_TEST_PATTERN&&!new RegExp(process.env.UX_TEST_PATTERN).test(name))return;try{await fn();results.push({name,basis,status:'passed'});console.log('PASS '+name);}catch(error){results.push({name,basis,status:'failed',error:error.stack});console.error('FAIL '+name+'\n'+error.stack);process.exitCode=1;await shot('failure-'+results.length).catch(()=>{});}}
async function go(view,extra={}){const errorStart=errors.length;const url=new URL(base);url.search=new URLSearchParams({view,...extra}).toString();await page.goto(url.href,{waitUntil:'domcontentloaded'});const expected=['recipes','catalog','overview','manage'].includes(view)?'Menu':['morning','insights'].includes(view)?'Morning prep':view==='evening'?'Evening check':({data:'Data & backup',rounds:'Round days',calendar:'Calendar & deadlines',team:'Team & access',history:'Operations history',operations:'Operations history'}[view]??null);if(expected)await page.getByRole('heading',{name:expected,exact:true,level:1}).waitFor({timeout:60000});else await page.locator('main h1').filter({visible:true}).first().waitFor();await page.waitForTimeout(150);assert.equal(errors.length,errorStart,'Runtime/hydration error: '+errors.slice(errorStart).join('\n'));}
async function json(url,options){const response=await page.request.fetch(base+url,options);const body=await response.json();assert(response.ok(),url+': '+response.status()+' '+JSON.stringify(body));return body;}
async function notebook(){const value=await json('/api/notebook');assert.equal(value.user,'seedy@sites.test','Only synthetic loopback identity is permitted');return value;}
const visible=selector=>page.locator(selector).filter({visible:true});
const luminance=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
const ratio=(a,b)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);};
async function fieldStyle(field,state){const style=await field.evaluate(e=>{const s=getComputedStyle(e),dialog=e.closest('[role="dialog"]');return{border:s.borderColor,background:s.backgroundColor,outer:dialog?getComputedStyle(dialog).backgroundColor:'rgb(255, 255, 255)',outline:s.outlineColor,outlineStyle:s.outlineStyle,outlineWidth:s.outlineWidth,color:s.color,opacity:s.opacity,invalid:e.getAttribute('aria-invalid'),disabled:e.matches(':disabled')};});const m={state,...style,borderContrast:ratio(style.border,style.background),textContrast:ratio(style.color,style.background),outlineContrast:ratio(style.outline,style.outer)};assert(m.borderContrast>=3,JSON.stringify(m));if(state==='focus')assert(style.outlineStyle!=='none'&&parseFloat(style.outlineWidth)>=2&&m.outlineContrast>=3,JSON.stringify(m));if(state==='invalid')assert.equal(style.invalid,'true');if(state==='disabled')assert(style.disabled);metrics.push({fieldAppearance:m});return m;}

try{
 await page.goto(base+(process.env.UX_COMPILED_PREVIEW==='1'?'/?view=morning&day=2026-10-15':'/signin-with-chatgpt?return_to=/'),{waitUntil:'domcontentloaded'});
 await page.locator('main h1').filter({visible:true}).first().waitFor({timeout:90000});
 const source=await notebook();
 const fixtureHash=createHash('sha256').update(JSON.stringify(source.data)).digest('hex');
 await fs.writeFile(path.join(output,'notebook-envelope.json'),JSON.stringify(source,null,2));
 await fs.writeFile(path.join(output,'fixture-summary.json'),JSON.stringify({basis:'Existing synthetic local fixture, no production imports',revision:source.revision,dataSha256:fixtureHash,itemIds:source.data.items.map(item=>item.id),dishIds:source.data.dishes.map(dish=>dish.id),items:source.data.items.length,dishes:source.data.dishes.length,recipes:source.data.recipes.length},null,2));
 if(process.env.UX_COMPILED_PREVIEW==='1')await test('Compiled CSS Today, Menu and editor smoke','Built Worker on loopback; explicit synthetic identity headers; no writes, not production auth',async()=>{
  if(process.env.UX_COMPILED_PREVIEW!=='1')return;
  for(const width of [390,1100,1440]){
   await page.setViewportSize({width,height:844});await go('morning',{day:'2026-10-15'});await visible('.morning-row').first().waitFor();let m=await visible('.morning-row').first().evaluate(e=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,firstRow:e.getBoundingClientRect().top,bottom:e.getBoundingClientRect().bottom}));assert(m.scrollWidth<=width+1);if(width===390)assert(m.firstRow<=360&&m.bottom<783);metrics.push({compiledMorning:m});await shot('compiled-morning-'+width);
   await go('recipes');await page.locator('.wm-list-row').first().click();await page.locator('.wm-detail').waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.wm-save-status')].some(e=>e.getClientRects().length&&/Autosaved|Shared/.test(e.textContent)));m=await page.locator('.wm-detail').evaluate(e=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,detailWidth:e.getBoundingClientRect().width,contentWidth:e.clientWidth,contentScrollWidth:e.scrollWidth}));assert(m.scrollWidth<=width+1&&m.contentScrollWidth<=m.contentWidth+1);metrics.push({compiledMenu:m});await shot('compiled-menu-detail-'+width);
   const opener=page.getByRole('button',{name:'Edit recipe',exact:true});await opener.click();const d=page.getByRole('dialog');await d.waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('[role=dialog]')].every(e=>!e.getAnimations().some(animation=>animation.playState==='running')));m=await d.evaluate(e=>{const r=e.getBoundingClientRect();return{width:innerWidth,left:r.left,right:r.right,editorWidth:r.width,layoutWidth:parseFloat(getComputedStyle(e).width),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clipped:[...e.querySelectorAll('input,select,textarea,button')].filter(c=>c.getClientRects().length).filter(c=>{const b=c.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1}).map(c=>c.getAttribute('aria-label')||c.textContent)};});assert(m.scrollWidth<=m.clientWidth+1&&!m.clipped.length&&m.left>=-1&&m.right<=width+1,JSON.stringify(m));metrics.push({compiledEditor:m});await shot('compiled-editor-'+width);await page.keyboard.press('Escape');await d.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Edit recipe',{},{timeout:1000});
  }
 });
 await test('Two destinations, original logo and new product title','real rendered application',async()=>{
  assert.match(await page.title(),/Workspace 2\.0/);
  const nav=page.getByRole('navigation',{name:'Main navigation'});
  assert(await nav.getByRole('button',{name:'Today',exact:true}).isVisible());
  assert(await nav.getByRole('button',{name:'Menu',exact:true}).isVisible());
  assert.equal(await nav.getByRole('button').count(),2);
  assert(await page.getByText('LABULA',{exact:true}).first().isVisible());
  const skip=page.getByRole('link',{name:'Skip to content',exact:true});await page.keyboard.press('Tab');assert(await skip.evaluate(e=>e===document.activeElement),'Skip to content is the first keyboard stop');await page.keyboard.press('Enter');assert(await page.locator('#workspace-content').evaluate(e=>e===document.activeElement));
 });
 await test('Responsive Today/Menu layout and one visible heading','Chromium viewport emulation',async()=>{
  for(const width of [320,360,390,767,768,1023,1024,1100,1119,1120,1280,1440]){
   await page.setViewportSize({width,height:844});
   for(const view of ['morning','evening','recipes','catalog']){
    await go(view,view==='morning'?{day:'2026-10-15'}:{});
    if(view==='morning')await visible('.morning-row').first().waitFor();if(['recipes','catalog'].includes(view)){await page.locator('.wm-list-row').first().waitFor();await page.waitForFunction(()=>[...document.querySelectorAll('.wm-save-status')].some(e=>e.getClientRects().length&&/Autosaved|Shared|Read-only menu/.test(e.textContent)),{},{timeout:60000});}if(view==='evening')await page.waitForFunction(()=>[...document.querySelectorAll('.stock-sync-bar')].some(e=>e.getClientRects().length&&!/Loading|Updating shared check/.test(e.textContent)));
    const m=await page.evaluate(()=>({view:new URL(location.href).searchParams.get('view'),width:innerWidth,scrollWidth:document.documentElement.scrollWidth,headings:[...document.querySelectorAll('main h1')].filter(e=>e.getClientRects().length).map(e=>({text:e.textContent,top:e.getBoundingClientRect().top})),firstRow:[...document.querySelectorAll('.morning-row,.evening-row,.wm-list-row')].find(e=>e.getClientRects().length)?.getBoundingClientRect().top,firstRowBottom:[...document.querySelectorAll('.morning-row,.evening-row,.wm-list-row')].find(e=>e.getClientRects().length)?.getBoundingClientRect().bottom,mobileNavTop:document.querySelector('.ws-mobile-nav')?.getBoundingClientRect().top}));
    metrics.push(m);assert(m.scrollWidth<=width+1,JSON.stringify(m));assert.equal(m.headings.length,1,JSON.stringify(m));assert(m.headings[0].top<350,JSON.stringify(m));
    if(width===390&&view==='morning'){assert(m.firstRow<=360,'First task starts within 360 px: '+JSON.stringify(m));assert(m.firstRowBottom<Math.min(844,m.mobileNavTop??844),'First task is entirely above navigation: '+JSON.stringify(m));}
    if([390,1100,1440].includes(width))await shot(view+'-'+width);
   }
  }
 });
 await test('Menu search, 100-item catalog, no results and reset','real synthetic API dataset',async()=>{
  await page.setViewportSize({width:390,height:844});await go('catalog');
  await page.getByRole('combobox',{name:'Show',exact:true}).selectOption('all');
  await page.locator('.wm-catalog-item').nth(99).waitFor({state:'attached'});
  assert.equal(await page.locator('.wm-catalog-item').count(),100);
  const search=page.getByRole('textbox',{name:'Search ingredients & prep',exact:true});
  await search.fill('zzzz-synthetic-no-match');await page.getByRole('heading',{name:'No items match',exact:true}).waitFor();
  await page.reload();await page.getByRole('heading',{name:'No items match',exact:true}).waitFor();
  assert.equal(await search.inputValue(),'zzzz-synthetic-no-match');await shot('catalog-no-results');
  await page.getByRole('button',{name:'Reset filters',exact:true}).first().click();
  await page.locator('.wm-catalog-item').first().waitFor();assert.equal(await search.inputValue(),'');
 });
 await test('Menu URL selection, Back, Forward, Refresh and focus','real rendered application',async()=>{
  await page.setViewportSize({width:1280,height:844});await go('recipes');
  await page.locator('.wm-list-row').first().click();await page.locator('.wm-detail').waitFor();
  const detailUrl=page.url(),name=await page.locator('.wm-detail h2').first().innerText();
  assert(new URL(detailUrl).searchParams.get('dish'));
  await page.reload();await page.locator('.wm-detail').waitFor();assert.equal(await page.locator('.wm-detail h2').first().innerText(),name);
  await page.getByRole('navigation',{name:'Main navigation'}).getByRole('button',{name:'Today',exact:true}).click();
  await page.getByRole('heading',{name:/Morning prep|Evening check/}).waitFor();
  await page.goBack();await page.locator('.wm-detail').waitFor();assert.equal(page.url(),detailUrl);
  await page.goForward();await page.getByRole('heading',{name:/Morning prep|Evening check/}).waitFor();
  assert(await page.locator('#workspace-content').evaluate(e=>e===document.activeElement||e.contains(document.activeElement)));
 });
 await test('Back restores a focused row without removing its keyboard stop','Real browser history and keyboard navigation',async()=>{
  await page.setViewportSize({width:1280,height:844});await go('recipes');const row=page.locator('.wm-list-row').first();await row.waitFor();await row.focus();const name=await row.innerText();assert.equal(await row.evaluate(e=>e.tabIndex),0);await row.click();await page.locator('.wm-detail').waitFor();await page.goBack();await page.waitForFunction(()=>document.activeElement?.classList.contains('wm-list-row'));assert.equal(await row.innerText(),name);assert.equal(await row.evaluate(e=>e.tabIndex),0);await page.keyboard.press('Tab');assert(!await row.evaluate(e=>e===document.activeElement));await page.keyboard.press('Shift+Tab');assert(await row.evaluate(e=>e===document.activeElement));
 });
 await test('Ingredient Correct type opens the existing safe preview for that item','Rendered ingredient entry and nested review dialogs; no save',async()=>{
  await page.setViewportSize({width:390,height:844});await go('catalog',{item:'audit-item-1',scope:'all'});await page.locator('summary').filter({hasText:'Name, type & duplicates'}).click();const trigger=page.getByRole('button',{name:'Correct type',exact:true});await trigger.click();const d=page.getByRole('dialog',{name:'Correct item type',exact:true});await d.waitFor();assert(await d.getByText('Chilli garlic sauce',{exact:true}).isVisible());assert(await d.getByText(/Affected dish recipes: [1-9]/).isVisible());assert(await d.getByRole('button',{name:'Confirm type correction',exact:true}).isVisible());await shot('correct-type-safe-preview');await d.getByRole('button',{name:'Cancel',exact:true}).click();await d.waitFor({state:'hidden'});await page.getByRole('dialog',{name:'Shared item management',exact:true}).waitFor();await page.keyboard.press('Escape');await page.getByRole('dialog',{name:'Shared item management',exact:true}).waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Correct type',{},{timeout:1000});
 });
 await test('New item draft survives Escape, close, reload and restores trigger focus','real browser local draft storage; no item created',async()=>{
  await go('catalog');const opener=page.getByRole('button',{name:'Add item',exact:true});await opener.click();
  const dialog=page.getByRole('dialog'),field=dialog.getByRole('textbox',{name:'Item name',exact:true});
  await field.fill('Synthetic unsaved Workspace 2.0 sauce');await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
  const focusWaitStart=Date.now();await page.waitForFunction(()=>document.activeElement?.textContent?.trim()==='Add item',{},{timeout:1000});metrics.push({dialogFocusRestoreAfterHiddenMs:Date.now()-focusWaitStart});assert(await opener.evaluate(e=>e===document.activeElement));await opener.click();assert.equal(await field.inputValue(),'Synthetic unsaved Workspace 2.0 sauce');
  await dialog.getByRole('button',{name:'Close — keep draft',exact:true}).click();await page.reload();await opener.click();
  assert.equal(await field.inputValue(),'Synthetic unsaved Workspace 2.0 sauce');assert(await dialog.getByText(/^Restored draft on this device/).isVisible());await shot('restored-new-item-draft');
  await dialog.getByRole('button',{name:'Discard draft',exact:true}).click();await dialog.locator('.wm-alert').getByRole('button',{name:'Discard draft',exact:true}).click();await dialog.waitFor({state:'hidden'});
  await opener.click();assert.equal(await field.inputValue(),'');await dialog.getByRole('button',{name:'Close',exact:true}).click();
 });
 await test('Two tabs keep separate item drafts through reload, discard and recovery','Real shared browser localStorage and independent tabs; no server data saved',async()=>{
  const other=await context.newPage();other.setDefaultTimeout(20000);other.on('pageerror',e=>errors.push(e.message));const names=['QA tab A method - keep separately','QA tab B method - keep separately'];
  const open=async(p,reload=false)=>{if(reload)await p.reload();else await p.goto(base+'/?view=catalog&scope=all&item=audit-item-1');await p.getByRole('heading',{level:2,name:'Chilli garlic sauce',exact:true}).waitFor();await p.getByRole('button',{name:'Edit item',exact:true}).click();await p.getByRole('dialog').getByRole('textbox',{name:'Method',exact:true}).waitFor();};
  const field=p=>p.getByRole('dialog').getByRole('textbox',{name:'Method',exact:true});const close=async p=>p.getByRole('dialog').getByRole('button',{name:'Close — keep draft',exact:true}).click();
  const discard=async p=>{const d=p.getByRole('dialog');await d.getByRole('button',{name:'Discard draft',exact:true}).click();await d.locator('.wm-alert').getByRole('button',{name:'Discard draft',exact:true}).click();await d.waitFor({state:'hidden'});};
  try{
   await open(page);await field(page).fill(names[0]);await open(other);await field(other).fill(names[1]);assert.equal(await field(page).inputValue(),names[0]);assert.equal(await field(other).inputValue(),names[1]);await close(page);await close(other);
   await open(page,true);await open(other,true);assert.equal(await field(page).inputValue(),names[0]);assert.equal(await field(other).inputValue(),names[1]);await discard(page);assert.equal(await field(other).inputValue(),names[1]);await close(other);await open(other,true);assert.equal(await field(other).inputValue(),names[1]);
   await page.getByRole('button',{name:'Edit item',exact:true}).click();assert.notEqual(await field(page).inputValue(),names[1]);const copies=page.getByRole('dialog').locator('details.wm-draft-copies');await copies.locator('summary').click();const select=copies.getByRole('combobox',{name:'Draft copy to open',exact:true});const key=await select.locator('option').evaluateAll((options,name)=>options.find(option=>option.textContent.includes(name))?.value,names[1]);assert(key);await select.selectOption(key);await copies.getByRole('button',{name:'Open draft copy',exact:true}).click();assert.equal(await field(page).inputValue(),names[1]);await field(page).fill('QA recovered copy edited independently');assert.equal(await field(other).inputValue(),names[1]);await shot('two-tab-draft-recovery');await discard(page);assert.equal(await field(other).inputValue(),names[1]);await discard(other);
  }finally{await other.close();}
 });
 await test('New item intent and original receipt survive a failed save and reload','Browser PUT fault emulation with real recovery UI; all writes intercepted',async()=>{
  const fault=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Europe/Prague'});await fault.addCookies(await context.cookies());const p=await fault.newPage();p.setDefaultTimeout(30000);p.on('dialog',d=>d.accept());p.on('pageerror',e=>errors.push(e.message));const writes=[],name='QA pending creation kept across reload';
  await p.route('**/api/notebook',async r=>{if(r.request().method()!=='PUT')return r.continue();const req=r.request();const intent=await p.evaluate(name=>Object.entries(localStorage).flatMap(([key,raw])=>{try{const value=JSON.parse(raw);return key.startsWith('labula.workspace2.form.v1.')&&value.value?.name===name&&!value.closed?[{key,...value.value}]:[];}catch{return[];}}),name);writes.push({operation:req.headers()['x-operation-id'],revision:req.headers()['if-match'],body:req.postData(),intent});await r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic uncertain save; original request must be kept'})});});
  try{
   await p.goto(base+'/?view=catalog');await p.getByRole('button',{name:'Add item',exact:true}).click();let d=p.getByRole('dialog');await d.getByRole('textbox',{name:'Item name',exact:true}).fill(name);await d.getByRole('button',{name:'Create item',exact:true}).click();const retry=d.getByRole('button',{name:'Retry original save',exact:true});await retry.waitFor();await p.waitForFunction(()=>[...document.querySelectorAll('[role="dialog"] button')].some(e=>e.textContent==='Retry original save'&&!e.disabled));assert.equal(writes.length,1);const original=writes[0],id=JSON.parse(original.body).items.find(i=>i.name===name)?.id;assert(id&&original.operation);assert(original.intent.some(v=>v.id===id&&v.submittedId===id),'Durable creation intent exists before the request');assert(await d.getByRole('textbox',{name:'Item name',exact:true}).isDisabled());assert(await d.getByRole('button',{name:'Discard draft',exact:true}).isDisabled());await retry.click();await p.waitForFunction(()=>[...document.querySelectorAll('[role="dialog"] button')].some(e=>e.textContent==='Retry original save'&&!e.disabled));assert.equal(writes.length,2);assert.equal(writes[1].operation,original.operation);assert.equal(writes[1].body,original.body);
   await p.waitForFunction(operation=>Object.entries(localStorage).some(([key,raw])=>{try{return key.startsWith('labula-workspace2-device-draft:')&&JSON.parse(raw).recovery?.receipt?.id===operation;}catch{return false;}}),original.operation);await d.getByRole('button',{name:'Close — keep draft',exact:true}).click();await p.reload();await p.getByRole('button',{name:'Add item',exact:true}).click();d=p.getByRole('dialog');assert.equal(await d.getByRole('textbox',{name:'Item name',exact:true}).inputValue(),name);assert(await d.getByRole('textbox',{name:'Item name',exact:true}).isDisabled());assert(await d.getByRole('button',{name:'Discard draft',exact:true}).isDisabled());await d.getByRole('button',{name:'Close — keep draft',exact:true}).click();await p.getByRole('button',{name:'Settings',exact:true}).click();await p.getByRole('button',{name:'Review this draft',exact:true}).first().click();d=p.getByRole('dialog');await d.getByRole('button',{name:'Check earlier save & review',exact:true}).click();await d.getByRole('button',{name:'Retry saving',exact:true}).waitFor();assert.equal(writes.length,3);assert.equal(writes[2].operation,original.operation);assert.equal(writes[2].revision,original.revision);assert.equal(writes[2].body,original.body);await p.screenshot({path:path.join(output,'screenshots','new-item-original-receipt-recovery.png')});metrics.push({creationRecovery:{writesIntercepted:3,intentBeforeRequest:true,reusedOperationAfterReload:true,payloadUnchanged:true,sharedWrites:0}});
  }finally{await fault.close();}
  assert.equal(createHash('sha256').update(JSON.stringify((await notebook()).data)).digest('hex'),fixtureHash,'Synthetic fault did not modify shared notebook');
 });
 await test('Reduced motion, real close target and field boundary contrast','Chromium reduced-motion emulation and computed styles',async()=>{
  await go('catalog');await page.emulateMedia({reducedMotion:'reduce'});await page.getByRole('button',{name:'Add item',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.waitFor();
  const field=dialog.getByRole('textbox',{name:'Item name',exact:true});await dialog.getByRole('heading').click();await fieldStyle(field,'normal');await field.focus();await fieldStyle(field,'focus');const box=await dialog.getByRole('button',{name:'Close',exact:true}).boundingBox();assert(box.width>=44&&box.height>=44);
  await dialog.getByRole('heading').click();const style=await dialog.evaluate(e=>({animation:getComputedStyle(e).animationName,background:getComputedStyle(e).backgroundColor,border:getComputedStyle(e.querySelector('input')).borderColor}));assert.equal(style.animation,'none');
  const lum=c=>{const rgb=c.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};const a=lum(style.background),b=lum(style.border),contrast=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);assert(contrast>=3,JSON.stringify({style,contrast}));metrics.push({closeTarget:box,inputContrast:contrast});
  await dialog.getByRole('button',{name:'Close',exact:true}).click();await page.emulateMedia({reducedMotion:'no-preference'});
 });
 await test('Recipe validation points to a field and protects draft','real rendered form, invalid input only',async()=>{
  await go('recipes');await page.locator('.wm-list-row').first().click();await page.getByRole('button',{name:'Edit recipe',exact:true}).click();const dialog=page.getByRole('dialog');
  for(const width of [320,390,768,1024,1100,1280,1440]){await page.setViewportSize({width,height:844});await page.waitForFunction(()=>{const e=document.querySelector('[role=dialog]');if(!e)return false;e.getBoundingClientRect();return !e.getAnimations().some(animation=>animation.playState==='running');});const m=await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return{width:innerWidth,left:r.left,right:r.right,editorWidth:r.width,layoutWidth:parseFloat(getComputedStyle(e).width),clientWidth:e.clientWidth,scrollWidth:e.scrollWidth,clipped:[...e.querySelectorAll('input,select,textarea,button')].filter(c=>c.getClientRects().length).filter(c=>{const b=c.getBoundingClientRect();return b.left<r.left-1||b.right>r.right+1}).map(c=>c.getAttribute('aria-label')||c.textContent)}});assert(m.scrollWidth<=m.clientWidth+1&&!m.clipped.length&&m.left>=-1&&m.right<=width+1,JSON.stringify(m));metrics.push({recipeEditor:m});}await page.setViewportSize({width:390,height:844});
  const remove=dialog.getByRole('button',{name:/^Remove /}).first(),removed=await remove.getAttribute('aria-label');const ingredientsBefore=await dialog.locator('.wm-edit-input-heading strong').allTextContents();await remove.click();const remainingAmount=dialog.getByRole('textbox',{name:/^Amount of /}).first();if(await remainingAmount.count()){await remainingAmount.fill('123');const changedName=await remainingAmount.getAttribute('aria-label');await dialog.getByRole('button',{name:'Undo removal',exact:true}).click();assert.deepEqual(await dialog.locator('.wm-edit-input-heading strong').allTextContents(),ingredientsBefore);assert.equal(await dialog.getByRole('textbox',{name:changedName,exact:true}).inputValue(),'123');}else{await dialog.getByRole('button',{name:'Undo removal',exact:true}).click();assert.deepEqual(await dialog.locator('.wm-edit-input-heading strong').allTextContents(),ingredientsBefore);}assert(await dialog.getByRole('button',{name:removed,exact:true}).isVisible());
  const amount=dialog.getByRole('textbox',{name:/^Amount of /}).first();await amount.fill('-4');assert.equal(await amount.getAttribute('aria-invalid'),'true');assert(await amount.getAttribute('aria-describedby'));await fieldStyle(amount,'invalid');
  await dialog.getByRole('button',{name:'Save recipe',exact:true}).click();assert(await amount.evaluate(e=>e===document.activeElement));assert.equal(await dialog.getByRole('button',{name:'Load latest shared answers',exact:true}).count(),0);
  await shot('recipe-field-validation');await dialog.getByRole('button',{name:'Close — keep draft',exact:true}).click();await page.reload();await page.getByRole('button',{name:'Edit recipe',exact:true}).click();assert.equal(await amount.inputValue(),'-4');
  await dialog.getByRole('button',{name:'Discard draft',exact:true}).click();await dialog.locator('.wm-alert').getByRole('button',{name:'Discard draft',exact:true}).click();
 });
 await test('Bulk checks prefill current station and require intentional change','real settings read; no settings changed',async()=>{
  await go('catalog');for(const name of ['Chicken broth','Chilli garlic sauce'])await page.getByRole('checkbox',{name:'Select '+name,exact:true}).check();
  await page.getByRole('button',{name:'Set daily checks',exact:true}).click();const dialog=page.getByRole('dialog');
  assert.equal(await dialog.getByRole('combobox',{name:'Station',exact:true}).inputValue(),'station-1');assert(await dialog.getByRole('button',{name:'Save 2 items',exact:true}).isDisabled());
  await dialog.getByRole('combobox',{name:'Station',exact:true}).selectOption('none');assert(await dialog.getByRole('button',{name:'Save 2 items',exact:true}).isEnabled());await shot('bulk-station-explicit-unassign');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();const confirmation=page.getByRole('alertdialog');await confirmation.getByRole('button',{name:'Keep editing',exact:true}).click();assert.equal(await dialog.getByRole('combobox',{name:'Station',exact:true}).inputValue(),'none');await dialog.getByRole('button',{name:'Cancel',exact:true}).click();await confirmation.getByRole('button',{name:'Discard changes',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>document.activeElement?.textContent?.includes('Set daily checks'),{},{timeout:1000});
 });
 await test('Deep preparation tree, explicit batch basis and parent Back','Synthetic /api/menu read projection emulation; no writes',async()=>{
  const fixture=structuredClone(await json('/api/menu'));
  const chain=['audit-item-1','audit-item-6','audit-item-9','audit-item-7'];
  fixture.items.find(item=>item.id==='audit-item-1').name='Synthetic house-made chilli sauce with carefully roasted spices and a deliberately long descriptive name for kitchen layout testing';
  fixture.items.find(item=>item.id==='audit-item-7').name='Synthetic fresh coriander washed, picked and very finely sliced for the complete nested preparation';
  for(let i=0;i<chain.length-1;i++){const item=fixture.items.find(v=>v.id===chain[i]);assert(item);item.composition={source:'legacy',sourceLabel:'Synthetic nested recipe',status:'recorded',gaps:[],reference:'QA only',token:'qa-'+i,inputs:[{itemId:chain[i+1],amount:i===1?null:200,note:''}]};item.yieldAmount=i===1?null:1000;}
  await page.route('**/api/menu',route=>route.request().method()==='GET'?route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}):route.abort());
  try{
   await page.setViewportSize({width:390,height:844});await go('recipes',{dish:'s1'});await page.locator('.wm-detail').waitFor();
   const names=chain.map(id=>fixture.items.find(item=>item.id===id).name);
   await page.locator('.wm-detail').getByRole('button',{name:'Expand '+names[0],exact:true}).click();assert(await page.locator('.wm-detail').getByText('For a 1000 g batch',{exact:true}).isVisible());
   await page.locator('.wm-detail').getByRole('button',{name:names[0],exact:true}).click();
   for(const name of names.slice(1)){await page.locator('.wm-detail').getByRole('button',{name,exact:true}).click();await page.locator('.wm-detail h2').getByText(name,{exact:true}).waitFor();}
   const leafUrl=page.url();await page.reload();await page.locator('.wm-detail h2').getByText(names.at(-1),{exact:true}).waitFor();assert.equal(page.url(),leafUrl);
   await shot('deep-recipe-mobile');assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=390);
   await page.locator('.wm-detail-top').getByRole('button',{name:/^Back/}).click();await page.locator('.wm-detail h2').getByText(names[2],{exact:true}).waitFor();
   await page.locator('.wm-detail-top').getByRole('button',{name:/^Back/}).click();await page.locator('.wm-detail h2').getByText(names[1],{exact:true}).waitFor();assert(await page.locator('.wm-detail').getByText('Full batch · yield not recorded',{exact:true}).isVisible());assert(await page.locator('.wm-detail').getByText('Amount not recorded',{exact:true}).isVisible());
   for(const width of [320,390,768,1024,1100,1280,1440]){await page.setViewportSize({width,height:844});const m=await page.locator('.wm-detail').evaluate(e=>({width:innerWidth,detailWidth:e.getBoundingClientRect().width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,documentWidth:document.documentElement.scrollWidth}));metrics.push({deepDetail:m});assert(m.scrollWidth<=m.clientWidth+1&&m.documentWidth<=width+1,JSON.stringify(m));if(width===1440)await shot('deep-recipe-desktop');}
  }finally{await page.unroute('**/api/menu');await go('morning',{day:'2026-10-15'});}
 });
 await test('Touch targets, narrow height and 200-percent reflow','Coarse-pointer and double-scale half-viewport Chromium emulation',async()=>{
  const touch=await browser.newContext({viewport:{width:1024,height:768},hasTouch:true,deviceScaleFactor:1,timezoneId:'Europe/Prague'});await touch.addCookies(await context.cookies());const p=await touch.newPage();
  try{await p.goto(base+'/?view=morning&day=2026-10-15');await p.locator('.morning-row').filter({visible:true}).first().waitFor();assert(await p.evaluate(()=>matchMedia('(pointer:coarse)').matches));const targets=await p.locator('.stock-work-nav button,.morning-toggle').filter({visible:true}).evaluateAll(es=>es.map(e=>({name:e.getAttribute('aria-label')||e.textContent,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert(targets.every(t=>t.width>=44&&t.height>=44),JSON.stringify(targets));metrics.push({coarsePointerTargets:targets});await p.screenshot({path:path.join(output,'screenshots','touch-tablet.png')});}finally{await touch.close();}
  await page.setViewportSize({width:390,height:480});await go('morning',{day:'2026-10-15'});assert.equal(await page.locator('.ws-mobile-nav').evaluate(e=>getComputedStyle(e).position),'static');await shot('short-height');
  const zoom=await browser.newContext({viewport:{width:720,height:422},deviceScaleFactor:2,timezoneId:'Europe/Prague'});await zoom.addCookies(await context.cookies());const z=await zoom.newPage();
  try{for(const view of ['morning','recipes','catalog']){await z.goto(base+'/?view='+view+'&day=2026-10-15');await z.getByRole('heading',{level:1,name:view==='morning'?'Morning prep':'Menu',exact:true}).waitFor();if(view==='morning')await z.locator('.morning-row').filter({visible:true}).first().waitFor();else await z.locator('.wm-list-row').first().waitFor();assert((await z.evaluate(()=>document.documentElement.scrollWidth))<=720);await z.screenshot({path:path.join(output,'screenshots','reflow-200-percent-'+view+'.png')});}}finally{await zoom.close();}
 });
 await test('Loading, actual empty menu and failed read are distinct','Browser read-response emulation; no data writes',async()=>{
  const normalMenu=await json('/api/menu');
  let release;const held=new Promise(resolve=>{release=resolve;});
  await page.route('**/api/menu',async route=>{await held;return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(normalMenu)});});
  try{await go('recipes');await page.getByText('Loading the menu…',{exact:true}).waitFor();await shot('menu-loading');release();await page.locator('.wm-list-row').first().waitFor();}finally{release();await page.unroute('**/api/menu');}
  await page.route('**/api/menu',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic menu request failed'})}));
  try{await go('recipes');await page.getByRole('heading',{name:'The menu could not be loaded',exact:true}).waitFor();assert.equal(await page.getByRole('heading',{name:'No dishes yet',exact:true}).count(),0);await shot('menu-request-error');}finally{await page.unroute('**/api/menu');}
  await page.getByRole('button',{name:'Retry',exact:true}).click();await page.locator('.wm-list-row').first().waitFor();
  const emptyNotebook={...source,data:{...source.data,dishes:[],recipes:[],items:[],processes:[],scenarios:[]}},emptyMenu={...normalMenu,dishes:[],recipes:[],items:[]};
  await page.route('**/api/notebook',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(emptyNotebook)}):r.abort());await page.route('**/api/menu',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(emptyMenu)}):r.abort());
  try{await go('recipes');await page.getByRole('heading',{name:'No dishes yet',exact:true}).waitFor();await shot('menu-empty');await go('catalog');await page.getByRole('heading',{name:'No ingredients yet',exact:true}).waitFor();}finally{await page.unroute('**/api/notebook');await page.unroute('**/api/menu');}
 });
 await test('Settings, old links, Round days return and export access','Real rendered routes, synthetic CSV download and backup endpoint read',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(const view of ['data','calendar','rounds','team','history']){await go(view);const headings=await visible('main h1').allTextContents();assert.equal(headings.length,1,view+': '+headings.join(','));assert((await page.evaluate(()=>document.documentElement.scrollWidth))<=390,view);}
  await go('rounds');await page.getByRole('heading',{name:'Round days',exact:true}).waitFor();await page.locator('.round-cards article').nth(2).waitFor();assert.equal(await page.locator('.round-cards article').count(),3);await page.reload();await page.getByRole('heading',{name:'Round days',exact:true}).waitFor();await page.getByRole('button',{name:'← Schedule',exact:true}).click();await page.waitForURL(/view=calendar/);
  for(const [old,next] of [['insights','morning'],['overview','recipes'],['manage','catalog'],['operations','history']]){await go(old);const destination=['recipes','catalog'].includes(next)?'Menu':next==='morning'?'Morning prep':'Operations history';assert(await page.getByRole('heading',{level:1,name:destination,exact:true}).isVisible());if(next==='catalog')assert(await page.getByRole('checkbox',{name:'Checked items',exact:true}).isChecked());}
  await go('data');const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Current menu CSV',exact:true}).click();const download=await downloadPromise;assert.match(download.suggestedFilename(),/current-menu\.csv$/);const csv=await fs.readFile(await download.path(),'utf8');assert(csv.includes(source.data.dishes[0].name));assert(csv.split('\n').length>20);
  assert.equal(await page.getByRole('link',{name:'Open full workspace backup',exact:true}).getAttribute('href'),'/review-backup');const backup=await page.request.get(base+'/api/private-backup');assert.equal(backup.status(),200);assert.match(backup.headers()['content-disposition'],/backup/);
  await page.getByRole('button',{name:'Review archive',exact:true}).click();await page.getByRole('button',{name:'Back to Data & backup',exact:true}).waitFor();assert.equal(context.pages().length,1);await page.getByRole('button',{name:'Back to Data & backup',exact:true}).click();await page.getByRole('heading',{name:'Data & backup',exact:true}).waitFor();
  await shot('settings-data-exports');
 });
 await test('History preserved filters remain visible and reset from empty results','Real synthetic history API and session preference storage',async()=>{
  await page.setViewportSize({width:390,height:844});await go('history');await page.getByRole('button',{name:/^More filters/}).click();await page.getByRole('combobox',{name:'Round',exact:true}).selectOption('weekly');await page.getByRole('searchbox',{name:'Ingredient / alternative name',exact:true}).fill('zzzz-no-kitchen-item');await page.getByRole('button',{name:'More filters (1)',exact:true}).click();await page.getByRole('heading',{name:'No records for these filters',exact:true}).waitFor();await page.reload();await page.getByRole('heading',{name:'No records for these filters',exact:true}).waitFor();assert(await page.getByRole('button',{name:'Remove Round filter',exact:true}).isVisible());assert(await page.getByRole('button',{name:'Remove Search filter',exact:true}).isVisible());assert(await page.getByRole('button',{name:'More filters (1)',exact:true}).isVisible());await shot('history-active-filters');await page.getByRole('button',{name:'Reset all filters',exact:true}).last().click();await page.getByRole('button',{name:'Remove Round filter',exact:true}).waitFor({state:'hidden'});assert.equal(await page.getByRole('searchbox',{name:'Ingredient / alternative name',exact:true}).inputValue(),'');
 });
 await test('Calendar preview includes weekdays, deadlines, removed exceptions and effective date','Synthetic calendar GET fixture; preview only, no settings saved',async()=>{
  const key='labula-calendar-draft-v1:local_seedy',prior=await page.evaluate(key=>localStorage.getItem(key),key);await page.evaluate(key=>localStorage.removeItem(key),key);
  const config={openDays:[0,2,3,4,5,6],deadlines:Array.from({length:7},(_,weekday)=>({weekday,evening:null,eveningOffset:0,morning:null})),exceptions:[{day:'2027-03-20',open:false,note:'Synthetic closure'}],deadlineExceptions:[{day:'2027-03-21',evening:'22:00',eveningOffset:0,morning:'09:00'}]};
  const fixture={accountId:'local_seedy',account:'seedy@sites.test',isOwner:true,canManage:true,revision:1,versions:[{revision:1,effectiveDay:'2026-01-01',createdAt:'2026-01-01T12:00:00Z',createdBy:'seedy@sites.test',config}],impacts:[{id:'2027-03-24',targetDay:'2027-03-25',stage:'confirmed'}]};
  await page.route('**/api/operating-calendar',r=>r.request().method()==='GET'?r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(fixture)}):r.abort());
  try{
   await go('calendar');await page.getByText('Open weekdays',{exact:true}).waitFor();const editor=page.locator('.operating-calendar-editor');
   await editor.getByRole('button',{name:/^Mon(day)?$/,exact:true}).click();await editor.getByLabel('Changes apply from',{exact:true}).fill('2027-03-22');
   await editor.locator('.calendar-deadline-row').nth(2).getByLabel('Morning ready by',{exact:true}).fill('09:30');
   const opening=editor.locator('details').filter({has:page.locator('summary',{hasText:'Date exceptions · opening days'})});await opening.locator('summary').click();await opening.getByRole('button',{name:'Remove exception',exact:true}).click();
   const deadlines=editor.locator('details').filter({has:page.locator('summary',{hasText:'Date exceptions · deadlines'})});await deadlines.locator('summary').click();await deadlines.getByRole('button',{name:'Remove exception',exact:true}).click();
   await editor.getByRole('button',{name:'Review changes',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Save calendar changes?',exact:true}).waitFor();const text=await dialog.innerText();
   for(const expected of ['09:30','2027-03-20','2027-03-21','22 Mar 2027','Existing plans need review'])assert(text.includes(expected),expected+' missing from '+text);assert(/removed/i.test(text));assert(/Mon/.test(text));await shot('calendar-complete-preview',true);await dialog.getByRole('button',{name:'Back',exact:true}).click();
  }finally{await page.unroute('**/api/operating-calendar');await page.evaluate(({key,prior})=>prior===null?localStorage.removeItem(key):localStorage.setItem(key,prior),{key,prior});await go('morning',{day:'2026-10-15'});}
 });
 await test('Ready then Undo survives row regrouping and reload','real local API writes on synthetic check',async()=>{
  await page.setViewportSize({width:390,height:844});await go('morning',{day:'2026-10-15'});await visible('.morning-row').first().waitFor();
  const row=visible('.morning-row').first(),id=await row.getAttribute('data-item-id');
  const check=await json('/api/evening?morningDay=2026-10-15'),task=check.check.tasks.find(t=>t.itemId===id);assert.equal(task.ready,false,'Expected unready synthetic task');
  await row.getByRole('checkbox',{name:/^Mark ready:/}).check();
  const undo=page.getByRole('button',{name:'Undo last change',exact:true});await undo.waitFor();
  await page.waitForFunction(()=>[...document.querySelectorAll('.morning-row')].filter(e=>e.getClientRects().length).length===1);
  await shot('morning-ready-undo');await undo.click();
  await page.waitForFunction(id=>[...document.querySelectorAll('.morning-row')].some(e=>e.dataset.itemId===id&&e.getClientRects().length),id);
  await page.waitForTimeout(800);await page.reload();await visible('.morning-row').first().waitFor();
  const after=await json('/api/evening?morningDay=2026-10-15');assert.equal(after.check.tasks.find(t=>t.itemId===id).ready,false);
 });
 await test('Evening unchecked blocks Finish, then publish Morning, Ready and Undo','Complete rendered flow with real local synthetic API writes',async()=>{
  const snapshot=await json('/api/evening?day=2026-10-15');const used=new Set(snapshot.checks.map(c=>c.id));
  const index=Array.from({length:27},(_,i)=>i+1).find(i=>!used.has('2027-02-'+String(i).padStart(2,'0')));assert(index,'Synthetic February 2027 QA dates exhausted');
  const day='2027-02-'+String(index).padStart(2,'0'),target='2027-02-'+String(index+1).padStart(2,'0');
  await page.setViewportSize({width:390,height:844});await go('morning',{day:target});
  await page.getByRole('button',{name:'Open evening check for this plan',exact:true}).click();await page.getByRole('heading',{name:'Evening check',exact:true}).waitFor();assert.equal(new URL(page.url()).searchParams.get('day'),day);
  await page.getByRole('button',{name:'Start evening check',exact:true}).click();await visible('.evening-row').first().waitFor();
  await page.getByRole('button',{name:'Finish check',exact:true}).click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Publish morning plan?',exact:true}).waitFor();assert(await dialog.getByRole('button',{name:'Finish check',exact:true}).isDisabled());await shot('evening-unchecked-blocks-finish');await dialog.getByRole('button',{name:'Return to the first item to review',exact:true}).click();await dialog.waitFor({state:'hidden'});
  const ids=await visible('.evening-row').evaluateAll(rows=>rows.map(row=>row.dataset.itemId));assert(ids.length>=2);
  for(let i=0;i<ids.length;i++)await page.locator('.evening-row[data-item-id="'+ids[i]+'"]').locator('[data-value="'+(i<2?'missing':'have')+'"]').click();
  await page.getByRole('button',{name:'Finish check',exact:true}).click();await dialog.getByRole('heading',{name:'Publish morning plan?',exact:true}).waitFor();await dialog.getByRole('button',{name:'Finish check',exact:true}).click();await dialog.waitFor({state:'hidden'});await page.waitForFunction(()=>{const e=document.activeElement;return e!==document.body&&!e?.matches(':disabled')&&!e?.closest('[role=dialog]')&&document.getElementById('workspace-content')?.contains(e);},{},{timeout:1000});metrics.push({successfulDialogFocus:await page.evaluate(()=>({tag:document.activeElement.tagName,text:document.activeElement.textContent?.slice(0,80)}))});
  await page.getByRole('button',{name:'View morning prep',exact:true}).last().click();await page.getByRole('heading',{name:'Morning prep',exact:true}).waitFor();await visible('.morning-row').first().waitFor();assert.equal(new URL(page.url()).searchParams.get('day'),target);assert.equal(await visible('.morning-row').count(),2);
  const published=await json('/api/evening?morningDay='+target);assert.equal(published.check.stage,'confirmed');assert.equal(published.check.version,1);assert.equal(published.check.tasks.filter(t=>!t.cancelled).length,2);
  const task=visible('.morning-row').first(),id=await task.getAttribute('data-item-id');await task.getByRole('checkbox',{name:/^Mark ready:/}).check();await page.getByRole('button',{name:'Undo last change',exact:true}).click();await page.waitForTimeout(900);await page.reload();await visible('.morning-row').first().waitFor();
  const after=await json('/api/evening?morningDay='+target);assert.equal(after.check.tasks.find(task=>task.itemId===id).ready,false);assert.equal(after.check.version,1);
  assert.equal(await page.getByRole('button',{name:'View Morning prep',exact:true}).count(),0,'No CTA to the current Morning screen');metrics.push({completeFlow:{day,target,tasks:2,version:1}});await shot('evening-to-morning-complete');
 });
 await test('Today stays available during editor endpoint failure','Browser route fault emulation; real operations endpoint',async()=>{
  await page.route('**/api/notebook',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'Synthetic editor endpoint outage'})}));
  try{await go('morning',{day:'2026-10-15'});await visible('.morning-row').first().waitFor();assert(await page.getByRole('heading',{name:'Morning prep',exact:true}).isVisible());await shot('morning-editor-outage');}finally{await page.unroute('**/api/notebook');}
 });
 if(process.env.WORKSPACE2_LOCAL_ROLE_TESTS==='1')await test('Owner, Manager, Cook and legacy UI/API boundaries','Real local SQLite role switching; synthetic identity; restored in finally',async()=>{
  const team=await json('/api/team');assert.equal(team.accountId,'local_seedy');assert.equal(team.isOwner,true);
  const originalRole=team.self.accessRole;assert(['legacy','manager','cook'].includes(originalRole));
  const sql=command=>execFileSync(process.execPath,['--import','./scripts/sites-env.mjs','./node_modules/wrangler/bin/wrangler.js','d1','execute','DB','--local','--config','wrangler.local.json','--persist-to','.wrangler/state','--command',command,'--json'],{cwd:process.cwd(),encoding:'utf8',maxBuffer:2_000_000});
  try{
   for(const role of ['manager','cook','legacy']){
    sql(`UPDATE kitchen_owner SET user_id='workspace2_reserved_synthetic_owner' WHERE id='owner' AND user_id='local_seedy'; UPDATE kitchen_team SET access_role='${role}' WHERE user_id='local_seedy' AND email='seedy@sites.test';`);
    await page.setViewportSize({width:390,height:844});await go('recipes');await page.getByRole('heading',{name:'Menu',exact:true}).waitFor();await page.locator('.wm-list-row').first().waitFor();
    const menu=await json('/api/menu');assert.equal(menu.canEdit,role==='manager');assert.equal(menu.canOrdinaryEdit,role!=='cook');
    assert.equal(await page.getByRole('button',{name:'Add dish',exact:true}).count(),role==='manager'?1:0);
    if(role==='cook'){
     for(const url of ['/api/notebook','/api/private-backup','/api/stock-settings'])assert.equal((await page.request.get(base+url)).status(),403,url);
     assert.equal((await page.request.put(base+'/api/menu',{headers:{Origin:base,'If-Match':'0'},data:{}})).status(),403);
     assert(!Object.hasOwn(menu,'processes')&&!Object.hasOwn(menu,'applied')&&!Object.hasOwn(menu,'review'));
     assert(menu.items.length<source.data.items.length,'Cook projection excludes unrelated synthetic catalog items');
     await go('morning',{day:'2026-10-15'});await visible('.morning-row').first().waitFor();
     for(const width of [320,390]){await page.setViewportSize({width,height:844});const buttons=page.locator('.stock-work-nav .actions>button').filter({visible:true});const boxes=await buttons.evaluateAll(es=>es.map(e=>({width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})));assert.equal(boxes.length,2);assert(Math.abs(boxes[0].width-boxes[1].width)<2);assert(boxes.every(b=>b.height>=44&&b.width>=120));metrics.push({role,width,modeButtons:boxes});await shot('cook-'+width);}
    }
    if(role==='legacy'){
     assert.equal((await page.request.put(base+'/api/menu',{headers:{Origin:base,'If-Match':'0','X-Labula-Workspace-Version':'2'},data:{}})).status(),403,'Legacy cannot publish canonical composition');
     await page.locator('.wm-list-row').first().click();await page.getByRole('button',{name:'Edit recipe',exact:true}).click();let d=page.getByRole('dialog');assert(await d.getByRole('textbox',{name:'Recipe portions',exact:true}).isDisabled());await fieldStyle(d.getByRole('textbox',{name:'Recipe portions',exact:true}),'disabled');assert(await d.getByRole('textbox',{name:'Dish name',exact:true}).isDisabled());assert(await d.getByRole('combobox',{name:'Ingredient to add',exact:true}).isEnabled());await d.getByRole('button',{name:'Close — keep draft',exact:true}).click();
     await go('catalog',{item:'audit-item-1'});assert(await page.getByRole('button',{name:'Add item',exact:true}).isVisible());assert.equal(await page.getByRole('button',{name:'Edit item',exact:true}).count(),0);await page.locator('summary').filter({hasText:'Name, type & duplicates'}).click();await page.getByRole('button',{name:'Name & storage',exact:true}).click();d=page.getByRole('dialog');assert(await d.getByRole('textbox',{name:'Item name',exact:true}).isEnabled());assert(await d.getByRole('textbox',{name:'Specification',exact:true}).isDisabled());await shot('legacy-ordinary-edit');await d.getByRole('button',{name:'Close — keep draft',exact:true}).click();
    }
    await shot('role-'+role);
   }
  }finally{sql(`UPDATE kitchen_owner SET user_id='local_seedy' WHERE id='owner' AND user_id='workspace2_reserved_synthetic_owner'; UPDATE kitchen_team SET access_role='${originalRole}' WHERE user_id='local_seedy' AND email='seedy@sites.test';`);await page.reload();const restored=await json('/api/team');assert.equal(restored.isOwner,true);assert.equal(restored.self.accessRole,originalRole);}
 });
 await test('Browser runtime has no page exceptions','real rendered application',async()=>assert.deepEqual(errors,[]));
}finally{
 await fs.writeFile(path.join(output,'browser-results.json'),JSON.stringify({timestamp:new Date().toISOString(),base,node:process.version,results,metrics,errors,limits:['Headless Chromium emulation, not physical phones/tablets or an actual kitchen pilot.','Production menu and production migration are not verified by local synthetic tests.']},null,2));
 await browser.close();
}
