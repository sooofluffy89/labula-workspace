const {chromium}=require('/opt/codex/cua_node/lib/node_modules/playwright-core');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=process.env.QA_BASE_URL||'http://127.0.0.1:4183';
const output=path.join(__dirname,'qa-evidence');fs.mkdirSync(output,{recursive:true});
const results=[];
let browser;
async function scenario(name,fn,viewport={width:1440,height:900}){
 const context=await browser.newContext({viewport});const page=await context.newPage();page.setDefaultTimeout(5000);const errors=[];page.on('pageerror',e=>errors.push(String(e)));
 try{await page.goto(base);await fn(page);assert.deepEqual(errors,[]);await page.screenshot({path:path.join(output,name+'.png'),fullPage:true,animations:"disabled"});results.push({name,status:'passed',errors});}
 catch(e){await page.screenshot({path:path.join(output,name+'-failed.png'),fullPage:true,animations:"disabled"});results.push({name,status:'failed',message:String(e),errors});}
 finally{await context.close();console.log(JSON.stringify(results.at(-1)));}
}
const data=p=>p.evaluate(()=>window.LabulaPrototype.getData());
const drafts=p=>p.evaluate(()=>window.LabulaPrototype.getDrafts());
const health=p=>p.evaluate(()=>window.LabulaPrototypeModel.health(window.LabulaPrototype.getData()));
const click=(p,action,id,scope='')=>p.locator(`${scope} [data-action="${action}"]${id?`[data-id="${id}"]`:''}`.trim()).click();
const row=(p,id)=>p.locator(`[data-row="${id}"]`);
(async()=>{browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 await scenario('health-nested-composition',async p=>{
   assert.equal((await health(p)).completeVariants,7);
   await click(p,'nested','house-chilli-sauce','.composition-list');
   await click(p,'nested','house-garlic-paste','.composition-list');
   await click(p,'nested','ingredient-garlic','.composition-list');
   assert.equal(await p.locator('.detail-header h2').innerText(),'Garlic');
   await click(p,'breadcrumb','1');assert.equal(await p.locator('.detail-header h2').innerText(),'Chilli sauce');
   await click(p,'confirm','house-chilli-sauce');assert.equal((await health(p)).completeVariants,12);
   await click(p,'breadcrumb','0');assert.equal(await p.locator('.detail-header h2').innerText(),'Silken tofu chili');
   assert.equal((await p.evaluate(()=>window.LabulaPrototype.getContext())).context.root,'dish-s1-standard');
 });
 await scenario('draft-add-remove-reload-save',async p=>{
   const id='dish-s1-standard';await click(p,'picker',id);
   await p.locator('[data-pick="ingredient-sugar"]').check();await p.locator('[data-pick="ingredient-salt"]').check();await click(p,'add-picked');
   await click(p,'remove-input','ingredient-sesame');
   await p.getByText('Quantities & composition notes',{exact:false}).click();
   await p.locator('[data-amount="ingredient-silken-tofu"]').fill('175 g');await p.locator('[data-note="ingredient-silken-tofu"]').fill('Keep intact');
   await click(p,'tab','house');await click(p,'tab','menu');assert.equal((await drafts(p))[id].value.inputs.length,5);
   await p.reload();let d=(await drafts(p))[id].value;assert(d.inputs.some(x=>x.id==='ingredient-sugar'));assert(!d.inputs.some(x=>x.id==='ingredient-sesame'));assert.equal(d.inputs.find(x=>x.id==='house-chilli-sauce').amount,'25 g');
   await p.locator('#confirm-list').check();await click(p,'save',id);
   d=(await data(p)).entities[id];assert.equal(d.inputs.find(x=>x.id==='ingredient-silken-tofu').amount,'175 g');assert.equal(d.inputs.find(x=>x.id==='ingredient-silken-tofu').note,'Keep intact');assert.equal(d.confirmed,true);assert.equal((await drafts(p))[id],undefined);
 });
 await scenario('create-ingredient-picker-cycle-offmenu',async p=>{
   await click(p,'picker','dish-s1-standard');await p.locator('#picker-query').fill('Fresh lime QA');await click(p,'new-in-picker');await p.locator('[form="create-form"]').click();
   const state=await data(p),created=Object.values(state.entities).find(x=>x.name==='Fresh lime QA');assert(created);assert.equal(created.type,'ingredient');assert((await drafts(p))['dish-s1-standard'].value.inputs.some(x=>x.id===created.id));
   await click(p,'tab','house');await click(p,'open','house-garlic-paste');await click(p,'picker','house-garlic-paste');assert(await p.locator('[data-pick="house-chilli-sauce"]').isDisabled());await p.keyboard.press('Escape');
   await click(p,'tab','menu');await p.locator('#scope-filter').selectOption('off');await click(p,'open','dish-p1-chicken-feet');await click(p,'confirm','dish-p1-chicken-feet');assert.equal((await data(p)).entities['dish-p1-chicken-feet'].confirmed,true);assert.equal((await data(p)).entities['dish-p1-chicken-feet'].active,false);
 });
 await scenario('hidden-bulk-exact-preview-undo',async p=>{
   await p.locator('[data-select="dish-s1-standard"]').check();await p.locator('[data-select="dish-m1-standard"]').check();await p.locator('#table-search').fill('Wood ear');
   assert((await p.locator('#selection-bar').innerText()).includes('2 outside this view'));await click(p,'show-selected');assert.equal(await p.locator('tbody tr').count(),2);await click(p,'show-selected');await click(p,'bulk','off');
   assert.equal(await p.locator('.preview-row').count(),2);assert((await p.locator('.dialog').innerText()).includes('Current dishes: 12 → 11'));await click(p,'apply-bulk');let d=await data(p);assert.equal(d.entities['dish-s1-standard'].active,false);assert.equal(d.entities['dish-m1-standard'].active,false);assert.equal(d.entities['dish-m1-beef-max'].active,true);await click(p,'undo');d=await data(p);assert.equal(d.entities['dish-s1-standard'].active,true);assert.equal(d.entities['dish-m1-standard'].active,true);
 });
 await scenario('health-filters-and-indirect-ingredients',async p=>{
   await click(p,'health','house');assert.equal(await p.locator('tbody tr').count(),2);assert.deepEqual(await p.locator('tbody tr').evaluateAll(es=>es.map(e=>e.dataset.row).sort()),['house-chilli-sauce','house-mushroom-dressing']);
   await click(p,'tab','menu');await p.locator('#scope-filter').selectOption('off');await click(p,'toggle-menu','dish-m6-standard','tbody');await click(p,'apply-bulk');assert.equal((await health(p)).ownToCheck,3);await click(p,'health','lists');assert.equal(await p.locator('tbody tr').count(),3);assert(await row(p,'dish-m6-standard').isVisible());
   await click(p,'tab','ingredients');assert.equal(await row(p,'ingredient-garlic').count(),1);assert.equal(await row(p,'ingredient-black-pepper').count(),0);await click(p,'open','ingredient-garlic');assert((await p.locator('.usage-list').innerText()).includes('Via house-made'));
 });
 await scenario('bulk-undo-preserves-draft-status',async p=>{
   const id='dish-s1-standard';await click(p,'remove-input','ingredient-sesame');await click(p,'toggle-menu',id,'tbody');await click(p,'apply-bulk');await click(p,'undo');assert.equal((await data(p)).entities[id].active,true);await click(p,'save',id);assert.equal((await data(p)).entities[id].active,true,'Saving ingredient draft after Undo must not quietly deactivate dish');
 });
 await scenario('bulk-reopen-keeps-draft-unconfirmed',async p=>{
   const id='house-garlic-paste';await click(p,'tab','house');await click(p,'open',id);await p.getByText('Quantities & composition notes',{exact:false}).click();await p.locator('[data-note="ingredient-garlic"]').fill('Stored note');await p.locator(`[data-select="${id}"]`).check();await click(p,'bulk','reopen');await click(p,'apply-bulk');assert.equal((await data(p)).entities[id].confirmed,false);await click(p,'save',id);assert.equal((await data(p)).entities[id].confirmed,false,'Saving draft after explicit reopen must keep list unconfirmed');
 });
 await scenario('today-plan-remains-snapshot',async p=>{
   await p.locator('#nav-today').click();await click(p,'check-enough','ingredient-cucumber');await click(p,'check-low','ingredient-silken-tofu');await click(p,'publish-plan');assert.equal(await p.locator('.preview-row').count(),3);await click(p,'confirm-publish');await click(p,'ready','house-chilli-sauce');const published=(await data(p)).plan;assert(published.tasks.find(x=>x.id==='house-chilli-sauce').ready);assert(published.tasks.some(x=>x.id==='ingredient-silken-tofu'));
   await p.locator('#nav-menu').click();await click(p,'nested','house-chilli-sauce','.composition-list');await click(p,'remove-input','ingredient-chilli');await click(p,'save','house-chilli-sauce');await p.locator('#nav-today').click();assert.deepEqual((await data(p)).plan,published);await click(p,'today-tab','morning');assert.equal(await p.locator('.today-row').count(),3);
 });
 await scenario('modal-focus-search-mobile-detail',async p=>{
   assert(await p.locator('.list-panel').isVisible());await click(p,'open','dish-s1-standard');assert(!(await p.locator('.list-panel').isVisible()));assert(await p.locator('.detail-panel').isVisible());await click(p,'picker','dish-s1-standard');await p.waitForTimeout(30);assert(await p.evaluate(()=>document.querySelector('.dialog').contains(document.activeElement)));await p.keyboard.press('Shift+Tab');assert(await p.evaluate(()=>document.querySelector('.dialog').contains(document.activeElement)));await p.keyboard.press('Escape');assert.equal(await p.locator('[role=dialog]').count(),0);await click(p,'back-list');assert(await p.locator('.list-panel').isVisible());assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await p.keyboard.press('/');assert.equal(await p.locator('#table-search').evaluate(e=>e===document.activeElement),true);await p.locator('#table-search').fill('zzzzzzzz');assert(await p.getByText('No matching items').isVisible());
 },{width:390,height:844});
 await scenario('narrow-desktop-reflow',async p=>{assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await click(p,'open','dish-s1-standard');assert(await p.locator('.detail-panel').isVisible());},{width:720,height:450});
 {const context=await browser.newContext({viewport:{width:1440,height:900}}),p=await context.newPage();p.setDefaultTimeout(5000);await p.goto(base);await p.screenshot({path:path.join(output,'example-menu-1440.png'),fullPage:true,animations:"disabled"});await click(p,'tab','house');await p.screenshot({path:path.join(output,'example-house-made-1440.png'),fullPage:true,animations:"disabled"});await click(p,'tab','ingredients');await click(p,'open','ingredient-garlic');await p.screenshot({path:path.join(output,'example-ingredients-1440.png'),fullPage:true,animations:"disabled"});await p.locator('#nav-today').click();await p.screenshot({path:path.join(output,'example-today-1440.png'),fullPage:true,animations:"disabled"});await p.setViewportSize({width:390,height:844});await p.locator('#nav-menu').click();await click(p,'tab','menu');await p.screenshot({path:path.join(output,'example-menu-390.png'),fullPage:true,animations:"disabled"});await click(p,'open','dish-s1-standard');await p.screenshot({path:path.join(output,'example-detail-390.png'),fullPage:true,animations:"disabled"});await context.close();}
 fs.writeFileSync(path.join(output,'results.json'),JSON.stringify(results,null,2));await browser.close();if(results.some(x=>x.status==='failed'))process.exitCode=1;
})();
