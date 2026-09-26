// Pure, offline rendering tests. No browser or running application is accessed.
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {permissions} from '../server/access.mjs';
const source=readFileSync('public/app.js','utf8').replace(/\nboot\(\);\s*$/,'\n');
test('stale setup form switches to login after setup_complete in both languages',async()=>{
 for(const locale of ['fr','en']){
  const elements=new Map();const element=selector=>{if(!elements.has(selector))elements.set(selector,{innerHTML:'',textContent:'',style:{},focus(){this.focused=true;},querySelector:element,querySelectorAll:()=>[]});return elements.get(selector);};
  const calls=[];
  const context=vm.createContext({document:{querySelector:element,documentElement:{}},window:{addEventListener(){}},navigator:{onLine:true},localStorage:{getItem:()=>locale},setInterval(){},setTimeout(){},clearTimeout(){},Intl,Date,URL,Blob,FormData:class{*[Symbol.iterator](){yield ['email','test@example.com'];yield ['password','example-password'];}},fetch:async path=>{calls.push(path);return {ok:false,status:409,json:async()=>({error:{code:'setup_complete'}})};}});
  vm.runInContext(source,context);vm.runInContext('setup=true;renderAuth()',context);
  await element('#auth-form').onsubmit({preventDefault(){},target:element('#auth-form')});
  assert.equal(vm.runInContext('setup',context),false);
  assert.match(element('#app').innerHTML,/autocomplete="current-password"/);
  assert.doesNotMatch(element('#app').innerHTML,/id="auth-name"/);
  assert.match(element('.form-error').textContent,locale==='fr'?/Un compte administrateur existe déjà/:/An administrator account already exists/);
  assert.deepEqual(calls.filter(path=>path==='/api/setup'),['/api/setup']);assert.equal(element('button').disabled,false);
 }
});
function renderer(role,locale='fr',budgetAccess=false){
 const dom={innerHTML:'',style:{},querySelectorAll:()=>[]};
 const context=vm.createContext({document:{querySelector:()=>dom,documentElement:{}},window:{addEventListener(){},innerWidth:390},navigator:{onLine:true},localStorage:{getItem:()=>locale},setInterval(){},setTimeout(){},clearTimeout(){},Intl,Date,URL,Blob});
 vm.runInContext(source,context);
 const user={id:'user-1',name:'Alex',role,employeeId:role==='employee'?'employee-1':null,projectIds:['project-1'],clientId:role==='client'?'client-1':null,budgetAccess};user.permissions=permissions(user);
 const data={user,settings:{address:'10845 Childs St, MD 20901'},assignees:[],files:[],records:{projects:[{id:'project-1',name:'Kitchen',clientId:'client-1',progress:25,status:'active',budget:budgetAccess?10000:undefined}],clients:[{id:'client-1',name:'Client'}],tasks:[{id:'task-1',projectId:'project-1',name:'Paint walls',assigneeId:'user-1',status:'todo',priority:'normal'}],time:[],messages:[],events:[],estimates:[{id:'quote-1',clientId:'client-1',name:'Estimate',items:[{name:'Cabinets',quantity:1,unitPrice:10000,total:10000}],total:10000,status:'sent',shared:true}],invoices:[],payments:[],expenses:[]}};
 context.testUser=user;context.testState=data;vm.runInContext('user=testUser; state=testState;',context);return {context,render:(page,detail=null)=>{context.testPage=page;context.testDetail=detail;return vm.runInContext('page=testPage; detail=testDetail; view()',context);}};
}
test('FR and EN client portal offers estimate decision and hides internal administration',()=>{
 for(const locale of ['fr','en']){const r=renderer('client',locale);const home=r.render('dashboard');assert.match(home,locale==='fr'?/VOTRE ESPACE CLIENT/:/YOUR CUSTOMER PORTAL/);assert.doesNotMatch(home,/data-action="user-create"/);const quote=r.render('estimates','quote-1');assert.match(quote,/data-action="client-decision"/);assert.doesNotMatch(quote,/data-action="convert"|data-action="payment"/);const settings=r.render('settings');assert.doesNotMatch(settings,/data-action="user-create"/);assert.doesNotMatch(r.render('documents'),/data-action="upload"/);}
});
test('field screens render without financial panels and editing uses allowed fields',()=>{
 for(const role of ['foreman','employee','subcontractor','project_manager']){const r=renderer(role);assert.match(r.render('dashboard'),/Accès par affectation/);assert.doesNotMatch(r.render('projects','project-1'),/Budget restant|budget remaining/i);assert.doesNotMatch(r.render('settings'),/data-action="user-create"/);
 if(['employee','subcontractor'].includes(role))assert.equal(vm.runInContext("JSON.stringify(editableModel('tasks').fields)",r.context),'["status","notes"]');
 if(role==='foreman')assert.equal(vm.runInContext("JSON.stringify(editableModel('projects').fields)",r.context),'["progress","status","notes"]');
 if(role==='project_manager')assert.equal(vm.runInContext("editableModel('projects').fields.includes('budget')",r.context),false);
 }
 const employee=renderer('employee');assert.doesNotMatch(employee.render('time'),/Coût estimé|Estimated cost/);assert.match(employee.render('time'),/employeeId/);
});
test('management can publish and administer access; text remains escaped',()=>{
 const admin=renderer('admin');assert.match(admin.render('settings'),/data-action="user-create"/);assert.match(admin.render('estimates','quote-1'),/data-action="publish-record"/);
 assert.equal(vm.runInContext("esc('<script>alert(1)</script>')",admin.context),'&lt;script&gt;alert(1)&lt;/script&gt;');
 const manager=renderer('project_manager','en',true);assert.equal(vm.runInContext("editableModel('projects').fields.includes('budget')",manager.context),true);assert.match(manager.render('projects','project-1'),/Budget \/ recorded expenses/);
});
