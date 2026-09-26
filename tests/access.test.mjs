import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtempSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const port=4331,origin=`http://127.0.0.1:${port}`,dir=mkdtempSync(join(tmpdir(),'bm-access-'));
const password=randomBytes(24).toString('hex');
let server,admin,clients=[],projects=[],employees=[],accounts={},tasks=[],quotes=[],invoices=[],files={},messages=[];
async function request(auth,path,method='GET',data){
 const res=await fetch(origin+'/api'+path,{method,headers:{Origin:origin,'Content-Type':'application/json',...(auth?{Cookie:auth.cookie,'X-CSRF-Token':auth.csrf}:{})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 const body=res.headers.get('content-type')?.includes('json')?await res.json():await res.arrayBuffer();return {status:res.status,body,headers:res.headers};
}
async function good(auth,path,method='GET',data,status=200){const r=await request(auth,path,method,data);assert.equal(r.status,status,`${method} ${path}: ${JSON.stringify(r.body)}`);return r.body;}
async function login(email){const r=await request(null,'/login','POST',{email,password});assert.equal(r.status,200,JSON.stringify(r.body));return {cookie:r.headers.get('set-cookie').split(';')[0],csrf:r.body.user.csrf,id:r.body.user.id,user:r.body.user};}
async function createUser(role,extra={},label=role){const email=label+'@example.com';const r=await good(admin,'/users','POST',{name:label,email,password,role,...extra},201);return {...await login(email),email,id:r.id};}
before(async()=>{
 server=spawn(process.execPath,['server/index.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),BM_DATA_DIR:dir},stdio:['ignore','pipe','pipe'],windowsHide:true});
 await new Promise((res,rej)=>{server.stdout.once('data',res);server.once('error',rej);server.once('exit',()=>rej(new Error('Server stopped')));});
 await good(null,'/setup','POST',{name:'Admin',email:'admin@example.com',password});admin=await login('admin@example.com');
 for(let i=0;i<2;i++){
  clients.push(await good(admin,'/records/clients','POST',{name:`Client ${i}`,notes:`CRM SECRET ${i}`,email:`client${i}@example.com`},201));
  projects.push(await good(admin,'/records/projects','POST',{name:`Project ${i}`,clientId:clients[i].id,address:`Address ${i}`,notes:`Private project notes ${i}`,budget:500000,progress:10},201));
  employees.push(await good(admin,'/records/employees','POST',{name:`Employee ${i}`,email:`employee${i}@example.com`,rate:3500,notes:'PRIVATE HR'},201));
  const q=await good(admin,'/records/estimates','POST',{name:`Quote ${i}`,clientId:clients[i].id,notes:'INTERNAL QUOTE SECRET',items:[{name:'Scope',quantity:1,unitPrice:100000}]},201);
  quotes.push(await good(admin,`/records/estimates/${q.id}`,'PATCH',{...q,status:'sent'}));
  const inv=await good(admin,'/records/invoices','POST',{name:`Invoice ${i}`,clientId:clients[i].id,projectId:projects[i].id,amount:100000,due:'2099-12-31',notes:'INTERNAL INVOICE SECRET'},201);
  invoices.push(await good(admin,`/records/invoices/${inv.id}`,'PATCH',{...inv,status:'sent'}));
 }
 accounts.client0=await createUser('client',{clientId:clients[0].id},'customer0');accounts.client1=await createUser('client',{clientId:clients[1].id},'customer1');
 accounts.employee=await createUser('employee',{employeeId:employees[0].id,projectIds:[projects[0].id]});
 accounts.contractor=await createUser('subcontractor',{projectIds:[projects[0].id]});
 accounts.foreman=await createUser('foreman',{projectIds:[projects[0].id]});
 accounts.pm=await createUser('project_manager',{projectIds:[projects[0].id]});
 accounts.director=await createUser('director');
 for(const [i,assigneeId] of [accounts.employee.id,accounts.contractor.id,''].entries())tasks.push(await good(admin,'/records/tasks','POST',{name:`Task ${i}`,projectId:projects[0].id,assigneeId,priority:'normal'},201));
 for(const audience of ['internal','team','client']){
  messages.push(await good(admin,'/records/messages','POST',{name:audience,projectId:projects[0].id,notes:`${audience} content`,audience},201));
  files[audience]=await good(admin,'/files','POST',{name:'plan.png',projectId:projects[0].id,category:'during',audience,description:audience,base64:readFileSync('public/icon.png').toString('base64')},201);
 }
});
after(()=>server?.kill());
test('client sees only own projects and no unpublished documents or internal notes',async()=>{
 const state=await good(accounts.client0,'/state');assert.deepEqual(state.records.projects.map(p=>p.id),[projects[0].id]);assert.equal(state.records.projects[0].budget,undefined);assert.equal(state.records.projects[0].notes,undefined);assert.equal(state.records.clients[0].notes,undefined);assert.equal(state.records.employees,undefined);assert.equal(state.records.estimates.length,0);assert.equal(state.records.invoices.length,0);assert.deepEqual(state.assignees,[]);
 assert.equal((await request(accounts.client0,`/records/projects/${projects[1].id}`)).status,404);
 assert.equal((await request(accounts.client0,`/records/clients/${clients[1].id}`)).status,404);
 assert.equal((await request(accounts.client0,`/records/estimates/${quotes[0].id}`)).status,404);
 assert.equal((await request(accounts.client0,`/records/projects/${projects[0].id}`,'PATCH',{...projects[0],budget:1})).status,403);
});
test('publication is explicit, scoped and redacts internal commercial notes',async()=>{
 for(let i=0;i<2;i++){
  quotes[i]=await good(admin,`/share/estimates/${quotes[i].id}`,'POST',{shared:true,version:quotes[i].version});
  invoices[i]=await good(admin,`/share/invoices/${invoices[i].id}`,'POST',{shared:true,version:invoices[i].version});
 }
 const mine=await good(accounts.client0,'/records/estimates');assert.equal(mine.length,1);assert.equal(mine[0].id,quotes[0].id);assert.equal(mine[0].notes,undefined);assert.equal(mine[0].total,100000);
 assert.equal((await request(accounts.client1,`/records/estimates/${quotes[0].id}`)).status,404);
 assert.equal((await request(accounts.client0,`/share/estimates/${quotes[0].id}`,'POST',{shared:false,version:quotes[0].version})).status,403);
 const hidden=await good(admin,'/records/estimates','POST',{name:'Draft',clientId:clients[0].id,items:[{name:'Work',quantity:1,unitPrice:1}]},201);
 assert.equal((await request(admin,`/share/estimates/${hidden.id}`,'POST',{shared:true,version:hidden.version})).status,409);
});
test('client estimate decision requires explicit confirmation, records identity and is idempotent',async()=>{
 const path=`/estimates/${quotes[0].id}/decision`;
 assert.equal((await request(accounts.client1,path,'POST',{decision:'accepted',confirmed:true,version:quotes[0].version})).status,404);
 assert.equal((await request(accounts.client0,path,'POST',{decision:'accepted',version:quotes[0].version})).status,400);
 const result=await good(accounts.client0,path,'POST',{decision:'accepted',confirmed:true,version:quotes[0].version});assert.equal(result.status,'accepted');assert.ok(result.decisionAt);assert.equal(result.notes,undefined);
 assert.equal((await good(accounts.client0,path,'POST',{decision:'accepted',confirmed:true,version:quotes[0].version})).id,result.id);
 assert.equal((await request(accounts.client0,path,'POST',{decision:'rejected',confirmed:true,version:result.version})).status,409);
 const stored=await good(admin,`/records/estimates/${quotes[0].id}`);assert.equal(stored.decisionBy,accounts.client0.id);
 assert.equal((await request(accounts.client0,`/estimates/${quotes[0].id}/convert`,'POST',{})).status,403);
});
test('field users see assigned projects and tasks, without budgets or HR rates',async()=>{
 const state=await good(accounts.employee,'/state');assert.deepEqual(state.records.projects.map(p=>p.id),[projects[0].id]);assert.equal(state.records.projects[0].budget,undefined);assert.equal(state.records.employees[0].id,employees[0].id);assert.equal(state.records.employees[0].rate,undefined);assert.equal(state.records.employees[0].notes,undefined);assert.equal(state.records.tasks.length,1);assert.equal(state.records.tasks[0].id,tasks[0].id);assert.equal(state.records.expenses,undefined);
 assert.equal((await request(accounts.employee,`/records/projects/${projects[1].id}`)).status,404);
 assert.equal((await request(accounts.employee,`/records/tasks/${tasks[1].id}`)).status,404);
 assert.equal((await request(accounts.employee,`/records/tasks/${tasks[0].id}`,'PATCH',{...tasks[0],projectId:projects[1].id})).status,403);
 assert.equal((await request(accounts.employee,`/records/tasks/${tasks[0].id}`,'PATCH',{...tasks[0],assigneeId:accounts.contractor.id})).status,403);
 const updated=await good(accounts.employee,`/records/tasks/${tasks[0].id}`,'PATCH',{version:tasks[0].version,status:'done',notes:'Done on site'});assert.equal(updated.status,'done');
 assert.equal((await request(accounts.employee,'/records/tasks','POST',{name:'Hidden task',projectId:projects[0].id})).status,403);
 const contractor=await good(accounts.contractor,'/state');assert.equal(contractor.records.tasks.length,1);assert.equal(contractor.records.tasks[0].id,tasks[1].id);
});
test('file metadata and binary downloads apply identical audience and project checks',async()=>{
 const c=await good(accounts.client0,'/state');assert.deepEqual(c.files.map(f=>f.id),[files.client.id]);
 const e=await good(accounts.employee,'/state');assert.deepEqual(e.files.map(f=>f.id),[files.team.id]);
 assert.equal((await request(accounts.client0,`/files/${files.internal.id}`)).status,404);assert.equal((await request(accounts.client1,`/files/${files.client.id}`)).status,404);assert.equal((await request(accounts.employee,`/files/${files.client.id}`)).status,404);
 assert.equal((await request(accounts.client0,`/files/${files.client.id}`)).status,200);assert.equal((await request(accounts.employee,`/files/${files.team.id}`)).status,200);
 assert.equal((await request(accounts.employee,`/files/${files.team.id}/audience`,'POST',{audience:'client',previousAudience:'team'})).status,403);
 await good(admin,`/files/${files.client.id}/audience`,'POST',{audience:'internal',previousAudience:'client'});assert.equal((await request(accounts.client0,`/files/${files.client.id}`)).status,404);
 assert.equal((await request(accounts.employee,'/files','POST',{projectId:projects[1].id,name:'x.png',category:'during',description:'',base64:'AA=='})).status,403);
});
test('messages keep management, team and client conversations separate',async()=>{
 assert.deepEqual((await good(accounts.client0,'/records/messages')).map(m=>m.audience),['client']);assert.deepEqual((await good(accounts.employee,'/records/messages')).map(m=>m.audience),['team']);
 assert.equal((await request(accounts.client0,`/records/messages/${messages[0].id}`)).status,404);
 assert.equal((await request(accounts.client0,'/records/messages','POST',{name:'Attempt',projectId:projects[0].id,notes:'Hello',audience:'team'})).status,403);
 assert.equal((await request(accounts.client0,'/records/messages','POST',{name:'Attempt',projectId:projects[1].id,notes:'Hello',audience:'client'})).status,403);
 const message=await good(accounts.client0,'/records/messages','POST',{name:'Question',projectId:projects[0].id,notes:'When is delivery?',audience:'client',author:'Fake admin'},201);assert.equal(message.author,'customer0');assert.equal(message.authorId,accounts.client0.id);
 assert.equal((await request(accounts.employee,`/records/messages/${message.id}`)).status,404);assert.equal((await request(admin,`/records/messages/${message.id}`)).status,200);
});
test('personal time recording cannot impersonate another employee or cross projects',async()=>{
 assert.equal((await request(accounts.employee,'/time/start','POST',{employeeId:employees[1].id,projectId:projects[0].id})).status,403);
 assert.equal((await request(accounts.employee,'/time/start','POST',{employeeId:employees[0].id,projectId:projects[1].id})).status,403);
 const timer=await good(accounts.employee,'/time/start','POST',{employeeId:employees[0].id,projectId:projects[0].id},201);assert.equal(timer.rate,undefined);assert.equal(timer.cost,undefined);
 const own=await good(accounts.employee,`/time/${timer.id}/stop`,'POST',{notes:'Field work'});assert.ok(own.end);assert.equal(own.rate,undefined);assert.equal(own.cost,undefined);
 const other=await good(admin,'/time/start','POST',{employeeId:employees[1].id,projectId:projects[1].id},201);
 assert.equal((await request(accounts.employee,`/time/${other.id}/stop`,'POST',{})).status,404);
});
test('project manager budgets are opt-in, foremen cannot edit financial fields',async()=>{
 const pm=await good(accounts.pm,'/state');assert.equal(pm.records.projects[0].budget,undefined);assert.equal(pm.records.expenses,undefined);
 assert.equal((await request(accounts.pm,`/records/projects/${projects[0].id}`,'PATCH',{version:projects[0].version,budget:1})).status,403);
 assert.equal((await request(accounts.foreman,`/records/projects/${projects[0].id}`,'PATCH',{version:projects[0].version,clientId:clients[1].id})).status,403);
 const progress=await good(accounts.foreman,`/records/projects/${projects[0].id}`,'PATCH',{version:projects[0].version,progress:50});assert.equal(progress.progress,50);assert.equal(progress.budget,undefined);
 assert.equal((await request(accounts.pm,`/records/projects/${projects[1].id}`,'PATCH',{version:projects[1].version,progress:50})).status,404);
 let manager=(await good(admin,'/users')).find(u=>u.id===accounts.pm.id);
 await good(admin,`/users/${manager.id}/access`,'PATCH',{version:manager.version,budgetAccess:true});
 assert.equal((await request(accounts.pm,'/state')).status,401);accounts.pm=await login(accounts.pm.email);
 const allowed=await good(accounts.pm,'/state');assert.equal(allowed.records.projects[0].budget,500000);assert.ok(allowed.records.expenses);
 assert.equal((await request(accounts.director,`/users/${manager.id}/access`,'PATCH',{version:manager.version,budgetAccess:true})).status,403);
});
test('revoking assignments invalidates sessions and removes direct access after login',async()=>{
 const u=(await good(admin,'/users')).find(u=>u.id===accounts.employee.id);
 await good(admin,`/users/${u.id}/access`,'PATCH',{version:u.version,projectIds:[]});
 assert.equal((await request(accounts.employee,'/state')).status,401);accounts.employee=await login('employee@example.com');
 const state=await good(accounts.employee,'/state');assert.equal(state.records.projects.length,0);assert.equal(state.records.tasks.length,0);assert.equal(state.files.length,0);
 assert.equal((await request(accounts.employee,`/files/${files.team.id}`)).status,404);
 assert.equal((await request(accounts.employee,'/time/start','POST',{employeeId:employees[0].id,projectId:projects[0].id})).status,403);
 const current=(await good(admin,'/users')).find(u=>u.id===accounts.employee.id);
 await good(admin,`/users/${current.id}/access`,'PATCH',{version:current.version,active:false});
 assert.equal((await request(accounts.employee,'/state')).status,401);assert.equal((await request(null,'/login','POST',{email:'employee@example.com',password})).status,401);
});
test('client payment projections omit bank references and other clients payments',async()=>{
 await good(admin,'/payments','POST',{invoiceId:invoices[0].id,amount:10000,date:'2026-09-13',method:'bank',reference:'PRIVATE BANK REFERENCE'},201);
 await good(admin,'/payments','POST',{invoiceId:invoices[1].id,amount:20000,date:'2026-09-13',method:'bank',reference:'OTHER PRIVATE REF'},201);
 const rows=(await good(accounts.client0,'/state')).records.payments;assert.equal(rows.length,1);assert.equal(rows[0].amount,10000);assert.equal(rows[0].reference,undefined);assert.equal(rows[0].recordedBy,undefined);
});
