import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
import http from 'node:http';
const port=4321,origin=`http://127.0.0.1:${port}`,dataDir=mkdtempSync(join(tmpdir(),'bm-test-'));
let server,cookie='',csrf='',client,project,estimate,invoice,employee,fileId;
const credential=randomBytes(24).toString('base64url');
async function call(path,method='GET',data,options={}){const headers={'Content-Type':'application/json',Origin:origin,...(cookie?{Cookie:cookie,'X-CSRF-Token':csrf}:{}),...options.headers};const r=await fetch(origin+path,{method,headers,...(data===undefined?{}:{body:JSON.stringify(data)})});const isJson=r.headers.get('content-type')?.includes('json');return {status:r.status,data:isJson?await r.json():await r.arrayBuffer(),headers:r.headers};}
async function launch(){server=spawn(process.execPath,['server/index.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),BM_DATA_DIR:dataDir},stdio:['ignore','pipe','pipe'],windowsHide:true});await new Promise((resolve,reject)=>{server.once('error',reject);server.stdout.once('data',resolve);server.once('exit',c=>reject(new Error('Server exited '+c)));});}
before(launch);
after(()=>server?.kill());
test('initial setup, local identity, session and security headers',async()=>{
 const before=await call('/api/state');assert.equal(before.status,401);
 const r=await call('/api/setup','POST',{name:'Test Admin',email:'admin@example.com',password:credential});assert.equal(r.status,200);cookie=r.headers.get('set-cookie').split(';')[0];csrf=r.data.user.csrf;assert.match(r.headers.get('set-cookie'),/HttpOnly; SameSite=Strict/);assert.equal(r.headers.get('x-frame-options'),'DENY');assert.match(r.headers.get('content-security-policy'),/frame-ancestors 'none'/);
 assert.equal((await call('/api/setup','POST',{name:'Bad',email:'bad@example.com',password:credential})).status,409);
 assert.equal((await call('/api/state')).data.settings.address,'10845 Childs St, MD 20901');
});
test('CSRF, origin and host reject writes before mutation',async()=>{
 assert.equal((await call('/api/records/clients','POST',{name:'Fail'},{headers:{'X-CSRF-Token':'bad'}})).status,403);
 assert.equal((await call('/api/records/clients','POST',{name:'Fail'},{headers:{Origin:'https://evil.example'}})).status,403);
 const hostStatus=await new Promise((resolve,reject)=>{const request=http.get(origin+'/api/session',{headers:{Host:'evil.example'}},r=>{r.resume();resolve(r.statusCode);});request.on('error',reject);});assert.equal(hostStatus,403);
 assert.equal((await call('/api/records/clients')).data.length,0);
});
test('client validation, persistence and optimistic concurrency',async()=>{
 assert.equal((await call('/api/records/clients','POST',{name:'x',email:'invalid'})).status,400);
 client=(await call('/api/records/clients','POST',{name:'Test Client',email:'client@example.com'})).data;
 const updated=await call('/api/records/clients/'+client.id,'PATCH',{...client,city:'Silver Spring'});assert.equal(updated.status,200);
 assert.equal((await call('/api/records/clients/'+client.id,'PATCH',client)).status,409);
 client=updated.data;assert.equal((await call('/api/records/clients/'+client.id)).data.city,'Silver Spring');
});
test('server computes estimate totals, freezes issued version and converts exactly once',async()=>{
 let r=await call('/api/records/estimates','POST',{name:'Kitchen estimate',clientId:client.id,due:'2026-10-30',discount:10000,taxBps:600,total:1,items:[{name:'Cabinets',quantity:2,unitPrice:100000},{name:'Labor',quantity:1.5,unitPrice:10000}]});assert.equal(r.status,201);estimate=r.data;assert.equal(estimate.subtotal,215000);assert.equal(estimate.tax,12300);assert.equal(estimate.total,217300);
 estimate=(await call('/api/records/estimates/'+estimate.id,'PATCH',{...estimate,status:'sent'})).data;
 assert.equal((await call('/api/records/estimates/'+estimate.id,'PATCH',{...estimate,items:[{name:'Bad',quantity:1,unitPrice:10001}]})).status,409);
 assert.equal((await call('/api/estimates/'+estimate.id+'/convert','POST',{})).status,409);
 estimate=(await call('/api/records/estimates/'+estimate.id,'PATCH',{...estimate,status:'accepted'})).data;
 const a=await call('/api/estimates/'+estimate.id+'/convert','POST',{}),b=await call('/api/estimates/'+estimate.id+'/convert','POST',{});assert.equal(a.status,200);assert.deepEqual(a.data,b.data);
 project=(await call('/api/records/projects/'+a.data.projectId)).data;assert.equal(project.budget,217300);assert.equal((await call('/api/state')).data.records.contracts.length,1);
});
test('calendar rejects conflicts but allows adjacent appointments',async()=>{
 const base={name:'Inspection',projectId:project.id,assignee:'Team A',start:'2026-09-15T14:00:00Z',end:'2026-09-15T15:00:00Z'};
 assert.equal((await call('/api/records/events','POST',base)).status,201);
 assert.equal((await call('/api/records/events','POST',{...base,start:'2026-09-15T14:30:00Z'})).status,409);
 assert.equal((await call('/api/records/events','POST',{...base,start:'2026-09-15T15:00:00Z',end:'2026-09-15T16:00:00Z'})).status,201);
 assert.equal((await call('/api/records/events','POST',{...base,end:'2026-09-14T15:00:00Z'})).status,400);
});
test('invoices, partial payments, overpayment and duplicates',async()=>{
 invoice=(await call('/api/records/invoices','POST',{name:'Deposit',clientId:client.id,projectId:project.id,amount:100000,due:'2026-10-30'})).data;
 assert.equal((await call('/api/payments','POST',{invoiceId:invoice.id,amount:30000,date:'2026-09-13',method:'bank',reference:'bank-1'})).status,409);
 invoice=(await call('/api/records/invoices/'+invoice.id,'PATCH',{...invoice,status:'sent'})).data;
 const pay={invoiceId:invoice.id,amount:30000,date:'2026-09-13',method:'bank',reference:'bank-1'};
 assert.equal((await call('/api/payments','POST',pay)).status,201);assert.equal((await call('/api/payments','POST',pay)).status,409);
 assert.equal((await call('/api/payments','POST',{...pay,reference:'bank-2',amount:100000})).status,409);
 assert.equal((await call('/api/records/invoices/'+invoice.id,'PATCH',{...invoice,amount:1})).status,409);
 assert.equal((await call('/api/records/invoices/'+invoice.id,'PATCH',{...invoice,status:'cancelled'})).status,409);
 const payments=(await call('/api/state')).data.records.payments;assert.equal(payments.reduce((s,p)=>s+p.amount,0),30000);
});
test('one timer per employee and snapshot labor rate',async()=>{
 employee=(await call('/api/records/employees','POST',{name:'Field Employee',rate:3500})).data;
 const timer=(await call('/api/time/start','POST',{employeeId:employee.id,projectId:project.id})).data;
 assert.equal(timer.rate,3500);assert.equal((await call('/api/time/start','POST',{employeeId:employee.id,projectId:project.id})).status,409);
 await call('/api/records/employees/'+employee.id,'PATCH',{...employee,rate:9900});
 const stop=await call('/api/time/'+timer.id+'/stop','POST',{notes:'Completed work'});assert.equal(stop.status,200);assert.equal(stop.data.rate,3500);assert.ok(stop.data.end);assert.equal((await call('/api/time/'+timer.id+'/stop','POST',{})).status,409);
});
test('files require authentication, project links and safe types',async()=>{
 const payload={projectId:project.id,name:'photo.png',category:'during',description:'Site progress',base64:readFileSync('public/icon.png').toString('base64')};
 const r=await call('/api/files','POST',payload);assert.equal(r.status,201);fileId=r.data.id;
 const file=await call('/api/files/'+fileId);assert.equal(file.status,200);assert.equal(file.headers.get('cache-control'),'no-store');
 assert.equal((await call('/api/files/'+fileId,'GET',undefined,{headers:{Cookie:''}})).status,401);
 assert.equal((await call('/api/files','POST',{...payload,name:'script.svg',base64:Buffer.from('<svg onload="alert(1)">').toString('base64')})).status,400);
 assert.equal((await call('/api/files','POST',{...payload,name:'unsafe.html'})).status,400);
 assert.equal((await call('/api/files','POST',{...payload,projectId:'missing'})).status,400);
});
test('accountant cannot access employee data, files or administer users',async()=>{
 const r=await call('/api/users','POST',{name:'Accountant',email:'accountant@example.com',password:credential,role:'accountant'});assert.equal(r.status,201);
 const login=await call('/api/login','POST',{email:'accountant@example.com',password:credential});const save=[cookie,csrf];cookie=login.headers.get('set-cookie').split(';')[0];csrf=login.data.user.csrf;
 const data=(await call('/api/state')).data;assert.equal(data.records.employees,undefined);assert.equal(data.records.estimates,undefined);assert.equal(data.files.length,0);
 assert.equal((await call('/api/records/employees')).status,403);assert.equal((await call('/api/users')).status,403);assert.equal((await call('/api/files/'+fileId)).status,403);
 assert.equal((await call('/api/records/clients','POST',{name:'Not allowed'})).status,403);assert.equal((await call('/api/records/invoices')).status,200);
 [cookie,csrf]=save;
});
test('invalid dates, unknown fields and SQL-like input do not alter schema',async()=>{
 assert.equal((await call('/api/records/expenses','POST',{name:'x',projectId:project.id,date:'2026-99-99',amount:1})).status,400);
 const r=await call('/api/records/clients','POST',{name:"Robert'); DROP TABLE users;--",role:'admin'});assert.equal(r.status,201);assert.equal(r.data.role,undefined);assert.ok((await call('/api/users')).data.length>0);
});
test('data survives process restart; sessions can be revoked',async()=>{
 server.kill();await new Promise(resolve=>server.once('exit',resolve));await launch();assert.equal((await call('/api/records/clients/'+client.id)).data.name,'Test Client');
 assert.equal((await call('/api/logout','POST',{})).status,200);assert.equal((await call('/api/state')).status,401);
});
