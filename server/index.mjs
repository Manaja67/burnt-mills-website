import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve,dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes,createHash,scryptSync,timingSafeEqual } from 'node:crypto';
import { database } from './db.mjs';
import { models,must,money,Failure,validate,id } from './domain.mjs';
import { ROLES,SCOPED,permissions,can,accessControl } from './access.mjs';
import {publicPage,renderPublic} from './public-site.mjs';
import {hosting} from './hosting.mjs';
const ROOT=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const PORT=Number(process.env.PORT||4310), HOST='127.0.0.1';
const {origin:PUBLIC,until:DEMO_UNTIL,production:PRODUCTION,data:DATA_DIR}=hosting(process.env,ROOT);
const store=database(DATA_DIR);
const {db,get,all,add,update,audit,tx}=store;
if(PUBLIC&&!db.prepare('SELECT id FROM users LIMIT 1').get())throw new Error('Initialize accounts with server/init-admin.mjs before publishing');
const acl=accessControl(store);
const digest=s=>createHash('sha256').update(s).digest('hex');
const password=p=>{const salt=randomBytes(16).toString('hex');return salt+':'+scryptSync(p,salt,64).toString('hex');};
const verify=(p,h)=>{const [salt,hash]=h.split(':');return timingSafeEqual(scryptSync(p,salt,64),Buffer.from(hash,'hex'));};
const dummyHash=password(randomBytes(32).toString('hex'));
const limits=new Map();
let publicRequests={at:Date.now(),count:0};
function hydrate(row){return row?{...row,clientId:row.client_id||null,employeeId:row.employee_id||null,budgetAccess:!!row.budget_access,projectIds:db.prepare('SELECT project_id FROM user_projects WHERE user_id=?').all(row.id).map(p=>p.project_id)}:null;}
function allowed(user,kind,write=false){must(can(user,kind,write),'forbidden',403);}
function visibleRows(user,kind){return all(kind).filter(r=>acl.visible(user,kind,r)).map(r=>acl.project(user,kind,r));}
function session(req){const value=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('bm_session='))?.slice(11);if(!value)return null;return hydrate(db.prepare('SELECT users.*,sessions.csrf,sessions.token FROM sessions JOIN users ON users.id=sessions.user_id WHERE token=? AND expires>? AND users.active=1').get(digest(value),Date.now()));}
function login(res,user){const token=randomBytes(32).toString('hex'),csrf=randomBytes(24).toString('hex');db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),user.id,csrf,Date.now()+8*3600000);res.setHeader('Set-Cookie',`bm_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800${PUBLIC?'; Secure':''}`);return publicUser({...hydrate(user),csrf});}
const publicUser=u=>({id:u.id,name:u.name,email:u.email,role:u.role,csrf:u.csrf,clientId:u.clientId,employeeId:u.employeeId,projectIds:u.projectIds,budgetAccess:u.budgetAccess,permissions:permissions(u)});
function userSummary(u){const h=hydrate(u);return {id:h.id,name:h.name,email:h.email,role:h.role,active:!!h.active,version:h.version,clientId:h.clientId,employeeId:h.employeeId,projectIds:h.projectIds,budgetAccess:h.budgetAccess};}
function validateAccess(b,old=null){
  const role=b.role??old?.role;must(ROLES.includes(role)&&role!=='admin','invalid_role');
  const projectIds=b.projectIds??(old?hydrate(old).projectIds:[]);must(Array.isArray(projectIds)&&projectIds.length<=500&&new Set(projectIds).size===projectIds.length,'invalid_assignment');
  for(const key of projectIds)must(typeof key==='string'&&get('projects',key),'invalid_projectId');
  const clientId='clientId' in b?b.clientId:old?.client_id??null,employeeId='employeeId' in b?b.employeeId:old?.employee_id??null;
  if(role==='client')must(get('clients',clientId),'required_clientId');
  if(role==='employee')must(get('employees',employeeId),'required_employeeId');
  if(employeeId)must(['employee','foreman'].includes(role)&&get('employees',employeeId),'invalid_employeeId');
  if(clientId)must(role==='client'&&get('clients',clientId),'invalid_clientId');
  if(!SCOPED.includes(role))must(projectIds.length===0,'invalid_assignment');
  if(employeeId)must(!db.prepare('SELECT id FROM users WHERE employee_id=? AND id<>?').get(employeeId,old?.id||''),'employee_account_exists',409);
  const budgetAccess=b.budgetAccess??(old?!!old.budget_access:false),active=b.active??(old?!!old.active:true);
  must(typeof budgetAccess==='boolean'&&typeof active==='boolean','invalid_data');must(!budgetAccess||role==='project_manager','invalid_budgetAccess');
  return {role,projectIds,clientId:clientId||null,employeeId:employeeId||null,budgetAccess,active};
}
function assignments(userId,projectIds){db.prepare('DELETE FROM user_projects WHERE user_id=?').run(userId);for(const p of projectIds)db.prepare('INSERT INTO user_projects VALUES(?,?)').run(userId,p);}
function restrictFields(input,old,fields){for(const k of Object.keys(input))if(!['id','version','createdAt','updatedAt'].includes(k)&&!fields.includes(k))must(JSON.stringify(input[k])===JSON.stringify(old[k]),'forbidden_field',403);}
async function body(req,maxBytes=12*1024*1024){must((req.headers['content-type']||'').startsWith('application/json'),'json_required',415);let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;must(size<=maxBytes,'file_too_large',413);chunks.push(chunk);}let data;try{data=JSON.parse(Buffer.concat(chunks).toString());}catch{throw new Failure('invalid_json');}must(data&&typeof data==='object'&&!Array.isArray(data),'invalid_data');return data;}
function json(res,data,status=200){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));}
const today=()=>new Date().toISOString().slice(0,10);
function checkCredentials(data){must(typeof data.email==='string'&&data.email.length<=250&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email),'invalid_email');must(typeof data.password==='string'&&data.password.length>=12&&data.password.length<=128,'password_length');must(typeof data.name==='string'&&data.name.trim().length>0&&data.name.length<=100,'required_name');}
function quoteConvert(key,user){const q=get('estimates',key);must(q,'not_found',404);must(q.status==='accepted','estimate_not_accepted',409);if(q.projectId)return {projectId:q.projectId,contractId:q.contractId};return tx(()=>{const p=add('projects',{name:q.name,clientId:q.clientId,address:q.address,manager:'',start:today(),due:q.due,notes:q.notes,budget:q.total,progress:0,status:'planned'});const c=add('contracts',{name:q.name,estimateId:q.id,projectId:p.id,clientId:q.clientId,total:q.total,status:'draft',notes:q.notes,items:q.items});update('estimates',q.id,{...q,projectId:p.id,contractId:c.id},q.version);audit(user.id,'estimate.convert',q.id);return {projectId:p.id,contractId:c.id};});}
function seed(user){must(all('clients').length===0&&all('projects').length===0,'demo_requires_empty',409);return tx(()=>{
  const date=(delta=0)=>new Date(Date.now()+delta*86400000).toISOString().slice(0,10);
  const c=add('clients',{name:'Alex Morgan · DEMO',company:'',email:'alex@example.com',phone:'',address:'',city:'Silver Spring',state:'MD',zip:'',siteAddress:'',source:'Referral',notes:'Fictional record / Donnée fictive',status:'won',demo:true});
  const c2=add('clients',{name:'Jordan Taylor · DEMO',email:'jordan@example.com',city:'Bethesda',state:'MD',notes:'Fictional record / Donnée fictive',status:'negotiation',demo:true});
  const p=add('projects',{name:'Oak House · DEMO',clientId:c.id,address:'Silver Spring, MD · DEMO',manager:'Alex',start:date(-20),due:date(25),budget:8500000,progress:65,status:'active',notes:'Kitchen renovation / Rénovation de cuisine — DEMO',demo:true});
  const p2=add('projects',{name:'Maple Residence · DEMO',clientId:c2.id,address:'Bethesda, MD · DEMO',manager:'Jordan',start:date(-10),due:date(40),budget:4200000,progress:30,status:'preparing',notes:'Interior renovation / Rénovation intérieure — DEMO',demo:true});
  add('tasks',{name:'Electrical inspection · DEMO',projectId:p.id,assignee:'Alex',start:date(),due:date(),priority:'high',status:'todo',notes:'',demo:true});
  add('tasks',{name:'Wall preparation · DEMO',projectId:p.id,assignee:'Jordan',start:date(-5),due:date(-1),priority:'normal',status:'done',notes:'',demo:true});
  add('tasks',{name:'Material selection · DEMO',projectId:p2.id,assignee:'Jordan',due:date(2),priority:'normal',status:'doing',notes:'',demo:true});
  add('employees',{name:'Alex Rivera · DEMO',email:'rivera@example.com',phone:'',trade:'Carpentry',rate:3500,status:'assigned',expiry:date(20),notes:'',demo:true});
  add('employees',{name:'Jordan Lee · DEMO',email:'lee@example.com',trade:'Electrical',rate:4500,status:'available',expiry:date(80),notes:'',demo:true});
  add('expenses',{name:'Cabinetry · DEMO',projectId:p.id,category:'materials',amount:1840000,date:date(-8),notes:'',demo:true});
  add('expenses',{name:'Site preparation · DEMO',projectId:p.id,category:'subcontractors',amount:780000,date:date(-3),notes:'',demo:true});
  const inv=add('invoices',{name:'Deposit · DEMO',clientId:c.id,projectId:p.id,amount:2550000,due:date(-2),status:'sent',notes:'Fictional invoice',demo:true});
  add('payments',{invoiceId:inv.id,projectId:p.id,name:'DEMO payment',amount:1500000,date:date(-5),method:'bank',reference:'DEMO-001',notes:'Fictional, not a real payment',demo:true});
  add('estimates',{...validate('estimates',{name:'Bathroom renovation · DEMO',clientId:c2.id,due:date(15),status:'sent',items:[{name:'Renovation work · DEMO',quantity:1,unitPrice:1850000}],taxBps:0,discount:0},get),demo:true});
  const st=new Date();st.setUTCHours(14,0,0,0);const en=new Date(st.getTime()+3600000);
  add('events',{name:'Site inspection · DEMO',projectId:p.id,assignee:'Alex',start:st.toISOString(),end:en.toISOString(),category:'inspection',notes:'',demo:true});
  add('materials',{name:'Drywall · DEMO',projectId:p2.id,supplierId:'',quantity:40,unitPrice:1800,status:'ordered',due:date(3),reference:'DEMO-DW',notes:'',demo:true});
  audit(user.id,'demo.load','demo');return {ok:true};
});}

const server=http.createServer(async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Cache-Control','no-store');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'");
  try{
    if(PUBLIC){res.setHeader('Strict-Transport-Security',PRODUCTION?'max-age=31536000':'max-age=172800');if(!PRODUCTION){res.setHeader('X-Robots-Tag','noindex, nofollow, noarchive');must(Date.now()<DEMO_UNTIL,'preview_expired',410);}must(req.headers.host===PUBLIC.host,'invalid_host',403);must(req.headers['x-forwarded-proto']==='https','https_required',403);}
    else must([`127.0.0.1:${PORT}`,`localhost:${PORT}`].includes(req.headers.host),'invalid_host',403);
    const url=new URL(req.url,`http://127.0.0.1:${PORT}`),path=url.pathname,method=req.method;
    if(path.startsWith('/api/')){
      const write=!['GET','HEAD'].includes(method);
      if(write){const origin=req.headers.origin;must(origin===(PUBLIC?PUBLIC.origin:`http://${req.headers.host}`),'invalid_origin',403);}
      if(path==='/api/public/estimate'&&method==='POST'){
        if(Date.now()-publicRequests.at>900000)publicRequests={at:Date.now(),count:0};
        must(++publicRequests.count<=20,'rate_limited',429);
        const b=await body(req,16000);
        for(const [key,max] of Object.entries({name:100,email:250,phone:50,location:200,message:3000,service:30,lang:2,website:250}))must(typeof b[key]==='string'&&b[key].length<=max,'invalid_'+key);
        must(b.consent===true&&!b.website&&b.message.trim().length>=10&&b.location.trim(),'invalid_data');
        must(['fr','en'].includes(b.lang)&&['construction','renovation','kitchen-bath','property'].includes(b.service),'invalid_data');
        const client=validate('clients',{name:b.name,email:b.email,phone:b.phone,siteAddress:b.location,source:'Website / Site internet',status:'new',notes:`${b.service} · ${b.lang}\n${b.message.trim()}\n\nConsent to contact / Accord pour être recontacté : ${new Date().toISOString()}`},get);
        must(client.email,'required_email');
        tx(()=>{const lead=add('clients',client);audit('public-website','lead.request',lead.id);});
        return json(res,{ok:true},201);
      }
      if(path==='/api/session'&&method==='GET'){const u=session(req);return json(res,{app:'burnt-mills-investment-llc',version:'0.2.0',user:u?publicUser(u):null,setup:!db.prepare('SELECT id FROM users LIMIT 1').get()});}
      if(['/api/setup','/api/login'].includes(path)&&method==='POST'){
        const key=req.socket.remoteAddress;const bucket=limits.get(key)||{at:Date.now(),count:0};if(Date.now()-bucket.at>900000){bucket.at=Date.now();bucket.count=0;}bucket.count++;limits.set(key,bucket);must(bucket.count<=15,'rate_limited',429);
        const b=await body(req);must(typeof b.password==='string'&&b.password.length<=128&&typeof b.email==='string'&&b.email.length<=250,'invalid_credentials',401);
        let user;
        if(path==='/api/setup'){
          must(!PUBLIC,'setup_complete',409);
          must(!db.prepare('SELECT id FROM users LIMIT 1').get(),'setup_complete',409);checkCredentials(b);user={id:id(),name:b.name.trim(),email:b.email.toLowerCase().trim(),role:'admin'};
          db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run(user.id,user.email,user.name,password(b.password),user.role);user=db.prepare('SELECT * FROM users WHERE id=?').get(user.id);audit(user.id,'account.setup',user.id);
        }else{user=db.prepare('SELECT * FROM users WHERE email=?').get(b.email.toLowerCase().trim());const valid=verify(b.password,user?.password||dummyHash);must(user&&user.active&&valid,'invalid_credentials',401);audit(user.id,'session.login',user.id);}
        limits.delete(key);return json(res,{user:login(res,user)});
      }
      const user=session(req);must(user,'unauthorized',401);if(write)must(req.headers['x-csrf-token']===user.csrf,'csrf_invalid',403);
      if(path==='/api/logout'&&method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(user.token);res.setHeader('Set-Cookie',`bm_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0${PUBLIC?'; Secure':''}`);return json(res,{ok:true});}
      if(path==='/api/state'&&method==='GET'){
        const records={};for(const k of [...Object.keys(models),'contracts','payments','time'])if(can(user,k))records[k]=visibleRows(user,k);
        const files=can(user,'files')?db.prepare('SELECT id,project_id AS projectId,name,mime,category,description,author,audience,created_at AS createdAt,length(bytes) AS size FROM files ORDER BY created_at DESC').all().filter(f=>acl.visible(user,'files',f)):[];
        const assignees=['admin','director','project_manager','foreman'].includes(user.role)?db.prepare('SELECT id,name,role FROM users WHERE active=1').all().map(u=>({id:u.id,name:u.name,role:u.role,projectIds:hydrate(u).projectIds})).filter(u=>['admin','director'].includes(user.role)||u.projectIds.some(p=>user.projectIds.includes(p))):[];
        return json(res,{records,files,assignees,settings:JSON.parse(db.prepare("SELECT value FROM settings WHERE key='company'").get()?.value||'{}'),user:publicUser(user)});
      }
      if(path==='/api/settings'&&method==='POST'){allowed(user,'users',true);const b=await body(req);const out={};for(const k of ['address','email','phone','state','timezone']){must(typeof (b[k]??'')==='string'&&(b[k]??'').length<=250,'invalid_data');out[k]=(b[k]||'').trim();}if(out.timezone){try{new Intl.DateTimeFormat('en-US',{timeZone:out.timezone});}catch{throw new Failure('invalid_timezone');}}db.prepare("INSERT INTO settings VALUES('company',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(out));audit(user.id,'settings.update','company');return json(res,out);}
      if(path==='/api/users'){
        allowed(user,'users',write);
        if(method==='GET')return json(res,db.prepare('SELECT id,name,email,role,active,client_id,employee_id,budget_access,version FROM users').all().map(userSummary));
        if(method==='POST'){const b=await body(req);checkCredentials(b);const scope=validateAccess(b);must(!db.prepare('SELECT id FROM users WHERE email=?').get(b.email.toLowerCase().trim()),'email_exists',409);const uid=id();tx(()=>{db.prepare('INSERT INTO users(id,email,name,password,role,active,client_id,employee_id,budget_access) VALUES(?,?,?,?,?,?,?,?,?)').run(uid,b.email.toLowerCase().trim(),b.name.trim(),password(b.password),scope.role,+scope.active,scope.clientId,scope.employeeId,+scope.budgetAccess);assignments(uid,scope.projectIds);audit(user.id,'user.create',uid);});return json(res,{id:uid},201);}
      }
      const accessRoute=path.match(/^\/api\/users\/([^/]+)\/access$/);
      if(accessRoute&&method==='PATCH'){
        allowed(user,'users',true);const old=db.prepare('SELECT * FROM users WHERE id=?').get(accessRoute[1]);must(old,'not_found',404);must(old.role!=='admin'&&old.id!==user.id,'protected_admin',403);const b=await body(req),scope=validateAccess(b,old);
        tx(()=>{must(b.version===old.version,'version_conflict',409);db.prepare('UPDATE users SET role=?,active=?,client_id=?,employee_id=?,budget_access=?,version=version+1 WHERE id=?').run(scope.role,+scope.active,scope.clientId,scope.employeeId,+scope.budgetAccess,old.id);assignments(old.id,scope.projectIds);db.prepare('DELETE FROM sessions WHERE user_id=?').run(old.id);audit(user.id,'user.access_changed',old.id);});
        return json(res,userSummary(db.prepare('SELECT id,name,email,role,active,client_id,employee_id,budget_access,version FROM users WHERE id=?').get(old.id)));
      }
      const shareRoute=path.match(/^\/api\/share\/(estimates|invoices|contracts|events)\/([^/]+)$/);
      if(shareRoute&&method==='POST'){
        const [,kind,key]=shareRoute;allowed(user,kind);must(permissions(user).share,'forbidden',403);const row=get(kind,key);must(acl.visible(user,kind,row),'not_found',404);const b=await body(req);must(typeof b.shared==='boolean','invalid_data');
        if(b.shared&&['estimates','invoices'].includes(kind))must(row.status!=='draft'&&row.status!=='cancelled','document_not_issued',409);
        const r=tx(()=>{const next=update(kind,key,{...row,shared:b.shared},b.version);must(next,'version_conflict',409);audit(user.id,b.shared?'client.publish':'client.unpublish',key);return next;});return json(res,acl.project(user,kind,r));
      }
      const decisionRoute=path.match(/^\/api\/estimates\/([^/]+)\/decision$/);
      if(decisionRoute&&method==='POST'){
        must(user.role==='client','forbidden',403);const q=get('estimates',decisionRoute[1]);must(acl.visible(user,'estimates',q),'not_found',404);const b=await body(req);must(['accepted','rejected'].includes(b.decision)&&b.confirmed===true,'invalid_decision');
        if(q.status===b.decision)return json(res,acl.project(user,'estimates',q));
        must(q.status==='sent','invalid_transition',409);if(b.decision==='accepted')must(!q.due||q.due>=today(),'estimate_expired',409);
        const next=tx(()=>{const r=update('estimates',q.id,{...q,status:b.decision,decisionBy:user.id,decisionAt:new Date().toISOString()},b.version);must(r,'version_conflict',409);audit(user.id,'estimate.client_'+b.decision,q.id);return r;});return json(res,acl.project(user,'estimates',next));
      }
      if(path==='/api/audit'&&method==='GET'){allowed(user,'users');return json(res,db.prepare('SELECT audit.*,users.name AS actorName FROM audit LEFT JOIN users ON users.id=audit.actor ORDER BY audit.id DESC LIMIT 200').all());}
      if(path==='/api/demo'&&method==='POST'){allowed(user,'users',true);return json(res,seed(user));}
      if(path==='/api/time/start'&&method==='POST'){
        allowed(user,'time',true);const b=await body(req);must(get('projects',b.projectId)&&get('employees',b.employeeId),'invalid_assignment');must(acl.projectAllowed(user,b.projectId),'forbidden',403);if(SCOPED.includes(user.role))must(b.employeeId===user.employeeId,'forbidden',403);must(!all('time').some(t=>t.employeeId===b.employeeId&&!t.end),'timer_running',409);
        const e=get('employees',b.employeeId),r=add('time',{employeeId:e.id,projectId:b.projectId,name:e.name,start:new Date().toISOString(),end:null,rate:e.rate,notes:'',cost:0});audit(user.id,'time.start',r.id);return json(res,acl.project(user,'time',r),201);
      }
      const stop=path.match(/^\/api\/time\/([^/]+)\/stop$/);
      if(stop&&method==='POST'){allowed(user,'time',true);const b=await body(req),t=get('time',stop[1]);must(acl.visible(user,'time',t),'not_found',404);must(!t.end,'timer_stopped',409);must(typeof(b.notes??'')==='string'&&(b.notes??'').length<=5000,'invalid_notes');const end=new Date().toISOString(),hours=(Date.parse(end)-Date.parse(t.start))/3600000;const r=update('time',t.id,{...t,end,notes:b.notes||'',cost:Math.round(hours*t.rate)},t.version);audit(user.id,'time.stop',t.id);return json(res,acl.project(user,'time',r));}
      if(path==='/api/payments'&&method==='POST'){
        allowed(user,'payments',true);const b=await body(req);const inv=get('invoices',b.invoiceId);must(inv&&inv.status==='sent','invoice_not_issued',409);money(b.amount);must(b.amount>0,'invalid_amount');must(['bank','check','cash'].includes(b.method),'invalid_method');must(typeof b.reference==='string'&&b.reference.trim().length>0&&b.reference.length<=250,'required_reference');must(typeof b.date==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(b.date)&&Number.isFinite(Date.parse(b.date))&&new Date(b.date).toISOString().slice(0,10)===b.date,'invalid_date');
        const r=tx(()=>{const paid=all('payments').filter(x=>x.invoiceId===inv.id);must(!paid.some(x=>x.reference===b.reference.trim()),'duplicate_payment',409);must(b.amount<=inv.amount-paid.reduce((s,x)=>s+x.amount,0),'payment_exceeds_balance',409);const p=add('payments',{invoiceId:inv.id,projectId:inv.projectId,name:inv.name,amount:b.amount,method:b.method,reference:b.reference.trim(),date:b.date,notes:'',recordedBy:user.id});audit(user.id,'payment.record_manual',p.id);return p;});return json(res,r,201);
      }
      const convert=path.match(/^\/api\/estimates\/([^/]+)\/convert$/);if(convert&&method==='POST'){allowed(user,'estimates',true);return json(res,quoteConvert(convert[1],user));}
      const dup=path.match(/^\/api\/estimates\/([^/]+)\/duplicate$/);if(dup&&method==='POST'){allowed(user,'estimates',true);const old=get('estimates',dup[1]);must(old,'not_found',404);const data=validate('estimates',{...old,status:'draft'},get);const r=add('estimates',data);audit(user.id,'estimate.duplicate',r.id);return json(res,r,201);}
      if(path==='/api/files'&&method==='POST'){
        allowed(user,'files',true);const b=await body(req);must(get('projects',b.projectId),'invalid_projectId');must(acl.projectAllowed(user,b.projectId),'forbidden',403);const audience=b.audience??(SCOPED.includes(user.role)?'team':'internal');must(['internal','team','client'].includes(audience),'invalid_audience');must(permissions(user).share||audience==='team','forbidden',403);must(typeof b.name==='string'&&b.name.length>0&&b.name.length<=250,'invalid_name');must(['before','during','after','document'].includes(b.category),'invalid_category');must(typeof b.description==='string'&&b.description.length<=2000,'invalid_description');must(typeof b.base64==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(b.base64),'invalid_file');const bytes=Buffer.from(b.base64,'base64');must(bytes.length>0&&bytes.length<=8*1024*1024,'file_too_large',413);
        const hex=bytes.subarray(0,8).toString('hex');let mime=hex==='89504e470d0a1a0a'?'image/png':hex.startsWith('ffd8ff')?'image/jpeg':bytes.subarray(0,5).toString()==='%PDF-'?'application/pdf':(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')?'image/webp':null;
        must(mime,'file_type');const extensions={'image/png':/\.png$/i,'image/jpeg':/\.jpe?g$/i,'image/webp':/\.webp$/i,'application/pdf':/\.pdf$/i};must(extensions[mime].test(b.name),'file_type');must(b.category==='document'||mime.startsWith('image/'),'file_type');const key=id();db.prepare('INSERT INTO files(id,project_id,name,mime,bytes,category,description,author,created_at,audience) VALUES(?,?,?,?,?,?,?,?,?,?)').run(key,b.projectId,b.name,mime,bytes,b.category,b.description,user.name,new Date().toISOString(),audience);audit(user.id,'file.upload',key);return json(res,{id:key},201);
      }
      const fileShare=path.match(/^\/api\/files\/([^/]+)\/audience$/);
      if(fileShare&&method==='POST'){allowed(user,'files',true);must(permissions(user).share,'forbidden',403);const row=db.prepare('SELECT id,project_id AS projectId,audience FROM files WHERE id=?').get(fileShare[1]);must(acl.visible(user,'files',row),'not_found',404);const b=await body(req);must(['internal','team','client'].includes(b.audience),'invalid_audience');tx(()=>{must(b.previousAudience===row.audience,'version_conflict',409);db.prepare('UPDATE files SET audience=? WHERE id=?').run(b.audience,row.id);audit(user.id,'file.audience_changed',row.id);});return json(res,{id:row.id,audience:b.audience});}
      const download=path.match(/^\/api\/files\/([^/]+)$/);
      if(download&&method==='GET'){allowed(user,'files');const f=db.prepare('SELECT * FROM files WHERE id=?').get(download[1]);must(f&&acl.visible(user,'files',{...f,projectId:f.project_id}),'not_found',404);res.setHeader('Content-Type',f.mime);res.setHeader('Content-Disposition',`${f.mime==='application/pdf'?'attachment':'inline'}; filename*=UTF-8''${encodeURIComponent(f.name).replace(/'/g,'%27')}`);res.end(Buffer.from(f.bytes));return;}
      const route=path.match(/^\/api\/records\/([a-z]+)(?:\/([^/]+))?$/);
      if(route){const [,kind,key]=route;must(models[kind],'not_found',404);allowed(user,kind,write);
        if(method==='GET'){if(key){const row=get(kind,key);must(acl.visible(user,kind,row),'not_found',404);return json(res,acl.project(user,kind,row));}return json(res,visibleRows(user,kind));}
        if(method==='POST'||method==='PATCH'){
          const b=await body(req),old=key?get(kind,key):null;if(method==='PATCH')must(acl.visible(user,kind,old),'not_found',404);if(method==='POST')must(!key,'invalid_route');
          if(SCOPED.includes(user.role)){
            if(kind==='projects'){must(old,'forbidden',403);restrictFields(b,old,user.role==='foreman'?['progress','status','notes']:['name','address','manager','start','due','progress','status','notes',...(user.budgetAccess?['budget']:[])]);}
            if(kind==='tasks'&&['employee','subcontractor'].includes(user.role)){must(old,'forbidden',403);restrictFields(b,old,['status','notes']);}
            if(kind==='materials'&&!user.budgetAccess){must(old,'forbidden',403);restrictFields(b,old,['name','reference','quantity','due','status','notes']);}
          }
          if(kind==='messages'&&old&&user.role==='client')must(old.authorId===user.id,'forbidden',403);
          const data=validate(kind,{...old,...b},get);
          if(data.projectId)must(acl.projectAllowed(user,data.projectId),'forbidden',403);
          if(kind==='tasks'&&data.assigneeId){const assignee=hydrate(db.prepare('SELECT id,role,active,client_id,employee_id,budget_access FROM users WHERE id=?').get(data.assigneeId));must(assignee&&assignee.active&&assignee.role!=='client'&&assignee.role!=='accountant'&&acl.projectAllowed(assignee,data.projectId),'invalid_assigneeId');}
          if(kind==='messages'){
            if(user.role==='client')must(data.audience==='client','forbidden',403);
            else if(!permissions(user).share)must(data.audience==='team','forbidden',403);
          }
          if(kind==='messages'){data.author=old?.author||user.name;data.authorId=old?.authorId||user.id;}
          if(old&&'shared' in old)data.shared=old.shared;
          if(old?.decisionAt){data.decisionAt=old.decisionAt;data.decisionBy=old.decisionBy;}
          if(kind==='estimates'){
            if(!old)must(data.status==='draft','new_estimate_draft');
            if(old){const transitions={draft:['draft','sent'],sent:['sent','accepted','rejected'],accepted:['accepted'],rejected:['rejected']};must(transitions[old.status].includes(data.status),'invalid_transition',409);
              if(old.status!=='draft'){for(const field of ['name','clientId','address','due','notes','discount','taxBps'])must(data[field]===old[field],'document_locked',409);must(JSON.stringify(data.items)===JSON.stringify(old.items),'document_locked',409);}
              if(old.projectId){data.projectId=old.projectId;data.contractId=old.contractId;}
            }
          }
          if(kind==='invoices'){
            if(!old)must(data.status==='draft','new_invoice_draft');
            if(old&&old.status!=='draft'){must(['sent','cancelled'].includes(data.status),'document_locked',409);for(const field of ['name','clientId','projectId','amount','due','notes'])must(data[field]===old[field],'document_locked',409);if(old.status==='cancelled')must(data.status==='cancelled','document_locked',409);if(data.status==='cancelled')must(!all('payments').some(x=>x.invoiceId===old.id),'invoice_has_payments',409);}
          }
          if(kind==='events')must(!all('events').some(e=>e.id!==key&&e.assignee.toLowerCase()===data.assignee.toLowerCase()&&Date.parse(data.start)<Date.parse(e.end)&&Date.parse(data.end)>Date.parse(e.start)),'schedule_conflict',409);
          const result=tx(()=>{const r=old?update(kind,key,{...data,...(old.demo?{demo:true}:{})},b.version):add(kind,data);must(r,'version_conflict',409);audit(user.id,`${kind}.${old?'update':'create'}`,r.id);return r;});return json(res,acl.project(user,kind,result),old?200:201);
        }
      }
      throw new Failure('not_found',404);
    }
    if(method==='GET'&&(path==='/'||path==='/index.html')){res.writeHead(302,{Location:'/fr/accueil'});return res.end();}
    const site=publicPage(path);
    if(method==='GET'&&site){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(renderPublic(site.key,site.lang));}
    if(method==='GET'&&['/connexion','/app','/login'].includes(path)){
      const language=url.searchParams.get('lang');let html=readFileSync(resolve(ROOT,'public/index.html'),'utf8');
      if(['fr','en'].includes(language))html=html.replace('<html lang="fr">',`<html lang="${language}" data-public-language="${language}">`);
      res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(html);
    }
    const assets={'/app.js':'app.js','/style.css':'style.css','/site.css':'site.css','/site.js':'site.js','/site-house.svg':'site-house.svg','/manifest.webmanifest':'manifest.webmanifest','/sw.js':'sw.js','/logo.png':'logo.png','/icon.png':'icon.png'};
    for(const name of ['house','exterior','kitchen','bathroom','construction'])assets[`/photos/${name}.jpg`]=`photos/${name}.jpg`;
    must(method==='GET'&&assets[path],'not_found',404);const filename=assets[path];const ext=filename.split('.').pop();res.setHeader('Content-Type',({html:'text/html; charset=utf-8',js:'text/javascript; charset=utf-8',css:'text/css; charset=utf-8',svg:'image/svg+xml',jpg:'image/jpeg',png:'image/png',webmanifest:'application/manifest+json'})[ext]);res.end(readFileSync(resolve(ROOT,'public',filename)));
  }catch(e){if(!(e instanceof Failure))console.error('Request failure:',e.name,e.code||'internal');json(res,{error:{code:e instanceof Failure?e.code:'server_error'}},e instanceof Failure?e.status:500);}
});
server.requestTimeout=30000;server.headersTimeout=10000;
server.listen(PORT,HOST,()=>console.log(`Burnt mills investment LLC: http://${HOST}:${PORT}`));
