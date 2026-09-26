import {createRequire} from 'node:module';
import {spawn} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {resolve,join} from 'node:path';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const pkg=process.env.BM_BROWSER_PACKAGES;
if(!pkg)throw new Error('Set BM_BROWSER_PACKAGES to the folder containing the Playwright package.');
const require=createRequire(resolve(pkg,'package.json'));
const {chromium}=require('playwright');
const data=mkdtempSync(join(tmpdir(),'bm-ui-'));
const server=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:'4322',BM_DATA_DIR:data},windowsHide:true,stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{server.stdout.once('data',res);server.once('error',rej);server.once('exit',()=>rej(new Error('Server startup failed')));});
const output=resolve('docs/previews');mkdirSync(output,{recursive:true});
let browser;const errors=[];const results=[];
try{
 browser=await chromium.launch({channel:'chrome',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1024},locale:'fr-FR',timezoneId:'America/New_York'});
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4322');await page.locator('#auth-name').waitFor();await page.screenshot({path:join(output,'connexion-desktop.png'),fullPage:true});
 await page.locator('#auth-name').fill('Alex');await page.locator('#auth-email').fill('ui@example.com');await page.locator('#auth-password').fill(randomBytes(24).toString('hex'));await page.locator('#auth-form button').click();await page.locator('[data-action="demo"]').waitFor();
 await page.locator('[data-action="demo"]').click();await page.locator('dialog button[type="submit"]').click();await page.getByText('Oak House · DEMO',{exact:true}).waitFor();
 await page.locator('#toast').waitFor({state:'hidden'});await page.screenshot({path:join(output,'dashboard-desktop.png'),fullPage:true});results.push('Account setup and explicit sample loading');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(output,'dashboard-mobile.png'),fullPage:false});await page.setViewportSize({width:1440,height:1024});
 await page.locator('[data-action="lang"]').click();await page.getByRole('heading',{name:'Hello, Alex.'}).waitFor();assert.equal(await page.locator('html').getAttribute('lang'),'en');results.push('French / English switching');
 await page.locator('.sidebar [data-nav="clients"]').click();await page.locator('[data-action="new"]').click();await page.locator('#f-name').fill('Browser client <script>window.injected=1</script>');await page.locator('#f-email').fill('browser@example.com');await page.locator('dialog button[type="submit"]').click();await page.getByText('Browser client <script>window.injected=1</script>',{exact:true}).waitFor();assert.equal(await page.evaluate(()=>window.injected),undefined);results.push('Client creation and escaped untrusted text');
 await page.locator('.sidebar [data-nav="estimates"]').click();await page.locator('[data-action="new"]').click();await page.locator('#f-name').fill('Browser estimate');await page.locator('#f-clientId').selectOption({label:'Browser client <script>window.injected=1</script>'});await page.locator('.item-name').fill('Cabinetry');await page.locator('.item-quantity').fill('2');await page.locator('.item-price').fill('500');await page.locator('#f-taxBps').fill('6');await page.locator('#f-discount').fill('100');assert.match(await page.locator('#quote-total').textContent(),/954/);await page.locator('dialog button[type="submit"]').click();await page.getByText('Browser estimate',{exact:true}).waitFor();
 let row=page.locator('tr').filter({hasText:'Browser estimate'});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#f-status').selectOption('sent');await page.locator('dialog button[type="submit"]').click();await page.locator('dialog').waitFor({state:'hidden'});row=page.locator('tr').filter({hasText:'Browser estimate'});await row.getByRole('button',{name:'Edit',exact:true}).click();await page.locator('#f-status').selectOption('accepted');await page.locator('dialog button[type="submit"]').click();await page.locator('dialog').waitFor({state:'hidden'});await row.getByRole('button',{name:'Open',exact:true}).click();await page.locator('[data-action="convert"]').click();await page.getByRole('heading',{name:'Browser estimate',exact:true}).waitFor();results.push('Estimate creation, calculation, issue, acceptance, conversion');
 await page.locator('.sidebar [data-nav="photos"]').click();await page.locator('[data-action="upload"]').click();await page.locator('#f-projectId').selectOption({label:'Oak House · DEMO'});await page.locator('#upload-file').setInputFiles('public/icon.png');await page.locator('#f-description').fill('UI upload test');await page.locator('dialog button[type="submit"]').click();await page.locator('.photo img').waitFor();assert.equal(await page.locator('.photo img').evaluate(i=>i.complete&&i.naturalWidth>0),true);results.push('Authenticated image upload and gallery');
 for(const module of ['dashboard','clients','estimates','contracts','projects','events','tasks','employees','subcontractors','time','suppliers','materials','expenses','invoices','payments','photos','documents','messages','reports','settings']){
   await page.locator(`.sidebar [data-nav="${module}"]`).click();await page.locator('h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${module}: desktop overflow`);
 }
 results.push('All 20 desktop modules render without horizontal document overflow');
 await page.locator('.sidebar [data-nav="dashboard"]').click();await page.locator('[data-action="lang"]').click();
 await page.setViewportSize({width:390,height:844});
 for(const module of ['dashboard','projects','events','time','invoices','photos','settings','clients','estimates','tasks','reports']){
   await page.locator('.bottom-nav [data-nav="more"]').click();await page.locator(`.menu-grid [data-nav="${module}"]`).click();await page.locator('h1').waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,`${module}: mobile overflow`);
   if(['projects','time','invoices','events'].includes(module))await page.screenshot({path:join(output,`${module}-mobile.png`),fullPage:true});
 }
 results.push('Mobile 390px navigation and overflow checks');
 await page.locator('.bottom-nav [data-nav="more"]').click();await page.locator('.menu-grid [data-nav="clients"]').click();await page.locator('[data-action="export"]').click();
 assert.deepEqual(errors,[]);results.push('No browser JavaScript errors');
 writeFileSync(join(output,'ui-results.json'),JSON.stringify({date:new Date().toISOString(),results,errors},null,2));
 console.log(JSON.stringify({results,errors,output},null,2));
}finally{await browser?.close();server.kill();}
