import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {mkdtempSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {pages,routeFor,publicPage,renderPublic} from '../server/public-site.mjs';

test('all eight public sections have individual FR/EN pages and translated navigation',()=>{
 for(const lang of ['fr','en'])for(const [key] of pages){
  const route=routeFor(key,lang);assert.deepEqual(publicPage(route),{key,lang});
  const html=renderPublic(key,lang);assert.match(html,new RegExp(`<html lang="${lang}">`));
  assert.equal((html.match(/<h1>/g)||[]).length,1);
  assert.ok(html.includes(`/connexion?lang=${lang}`));
  assert.ok(html.includes(routeFor(key,lang==='fr'?'en':'fr')));
  for(const [other] of pages)assert.ok(html.includes(`href="${routeFor(other,lang)}"`));
 }
 assert.equal(publicPage('/fr/unknown'),null);assert.equal(publicPage('/en/entreprise'),null);
});

test('public routes preserve authenticated app; estimate intake validates, persists and limits requests',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'bm-site-')),port=4338,origin=`http://127.0.0.1:${port}`;
 const app=spawn(process.execPath,['server/index.mjs'],{env:{...process.env,PORT:String(port),BM_DATA_DIR:dir,BM_PUBLIC_ORIGIN:'',BM_DEMO_UNTIL:''},windowsHide:true,stdio:['ignore','pipe','pipe']});
 try{
  await Promise.race([once(app.stdout,'data'),once(app,'exit').then(()=>{throw new Error('Server failed');})]);
  const start=await fetch(origin+'/',{redirect:'manual'});assert.equal(start.status,302);assert.equal(start.headers.get('location'),'/fr/accueil');
  for(const lang of ['fr','en'])for(const [key] of pages){const r=await fetch(origin+routeFor(key,lang));assert.equal(r.status,200);assert.match(r.headers.get('content-type'),/text\/html/);}
  const login=await fetch(origin+'/connexion?lang=en');assert.match(await login.text(),/data-public-language="en"/);
  assert.equal((await fetch(origin+'/app')).status,200);assert.equal((await fetch(origin+'/api/state')).status,401);
  for(const path of ['/site.css','/site.js','/site-house.svg'])assert.equal((await fetch(origin+path)).status,200);
  assert.equal((await fetch(origin+'/fr/missing')).status,404);
  const payload={name:'Test visitor',email:'visitor@example.com',phone:'',location:'20901',service:'renovation',message:'A kitchen renovation request.',consent:true,lang:'en',website:''};
  const post=(body,source=origin)=>fetch(origin+'/api/public/estimate',{method:'POST',headers:{Origin:source,'Content-Type':'application/json'},body:JSON.stringify(body)});
  assert.equal((await post(payload,'https://attacker.example')).status,403);
  assert.equal((await post({...payload,consent:false})).status,400);
  assert.equal((await post({...payload,email:'bad'})).status,400);
  assert.equal((await post({...payload,message:'short'})).status,400);
  assert.equal((await post({...payload,website:'spam'})).status,400);
  assert.equal((await post({...payload,message:'x'.repeat(17000)})).status,413);
  assert.equal((await post(payload)).status,201);
  const db=new DatabaseSync(join(dir,'burnt-mills.sqlite'),{readOnly:true});
  const rows=db.prepare("SELECT data FROM records WHERE kind='clients'").all();assert.equal(rows.length,1);
  const record=JSON.parse(rows[0].data);assert.equal(record.status,'new');assert.equal(record.source,'Website / Site internet');assert.match(record.notes,/Consent to contact/);db.close();
  for(let n=0;n<14;n++)await post({...payload,consent:false});
  assert.equal((await post(payload)).status,429);
 }finally{app.kill();}
});
