import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes,scryptSync} from 'node:crypto';
import {database} from '../server/db.mjs';
import http from 'node:http';

for(const production of [false,true])test(`${production?'Permanent hosting':'HTTPS preview'} requires exact host/origin, secure cookies and preexisting accounts`,async()=>{
 const folder=mkdtempSync(join(tmpdir(),'bm-preview-test-'));
 const {db}=database(folder),password=randomBytes(18).toString('hex'),salt=randomBytes(16).toString('hex');
 db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run('demo','demo@example.com','Demo',salt+':'+scryptSync(password,salt,64).toString('hex'),'director');db.close();
 const port=production?4339:4337,origin='https://demo.example.com';
 const app=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),BM_DATA_DIR:folder,BM_PUBLIC_ORIGIN:origin,BM_DEPLOYMENT:production?'production':'preview',BM_DEMO_UNTIL:production?'':new Date(Date.now()+3600000).toISOString()},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(app.stdout,'data'),once(app,'exit').then(()=>{throw new Error('Server failed');})]);
  const call=(path,method='GET',body,extra={})=>new Promise((accept,reject)=>{
   const req=http.request(`http://127.0.0.1:${port}${path}`,{method,headers:{Host:'demo.example.com','X-Forwarded-Proto':'https',Origin:origin,'Content-Type':'application/json',...extra}},res=>{let text='';res.on('data',d=>text+=d);res.on('end',()=>accept({status:res.statusCode,headers:{get:key=>Array.isArray(res.headers[key])?res.headers[key][0]:res.headers[key]},json:async()=>JSON.parse(text)}));});
   req.on('error',reject);req.end(body?JSON.stringify(body):undefined);
  });
  assert.equal((await call('/api/session')).status,200);
  assert.equal((await call('/api/state')).status,401);
  assert.equal((await call('/api/session','GET',null,{Host:'attacker.example'})).status,403);
  assert.equal((await call('/api/session','GET',null,{'X-Forwarded-Proto':'http'})).status,403);
  const credentials={email:'demo@example.com',password};
  assert.equal((await call('/api/login','POST',credentials,{Origin:'https://attacker.example'})).status,403);
  assert.equal((await call('/api/setup','POST',{...credentials,name:'Bad'})).status,409);
  const login=await call('/api/login','POST',credentials);assert.equal(login.status,200);
  assert.match(login.headers.get('set-cookie'),/; Secure/);
  assert.equal(login.headers.get('strict-transport-security'),production?'max-age=31536000':'max-age=172800');
  const user=(await login.json()).user;
  const auth={Cookie:login.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':user.csrf};
  assert.equal((await call('/api/users','GET',null,auth)).status,403);
  assert.equal((await call('/api/state','GET',null,auth)).status,200);
  const logout=await call('/api/logout','POST',{},auth);assert.equal(logout.status,200);assert.match(logout.headers.get('set-cookie'),/; Secure/);
 }finally{app.kill();}
});
