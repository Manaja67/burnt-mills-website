import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import assert from 'node:assert/strict';
const config=JSON.parse(readFileSync('data/preview-current.json','utf8'));
const access=readFileSync(resolve(config.folder,'ACCES-CLIENT.txt'),'utf8');
const credentials=[...access.matchAll(/Email : (.+)\nMot de passe : (.+)/g)];
const origin=config.url;
let response=await fetch(origin+'/api/session');assert.equal(response.status,200);
assert.equal((await response.json()).setup,false);
assert.equal((await fetch(origin+'/api/state')).status,401);
for(const [,email,password] of credentials){
 response=await fetch(origin+'/api/login',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 assert.equal(response.status,200);assert.match(response.headers.get('set-cookie'),/; Secure/);
 const {user}=await response.json();
 const headers={Cookie:response.headers.get('set-cookie').split(';')[0],'X-CSRF-Token':user.csrf,Origin:origin,'Content-Type':'application/json'};
 const state=await fetch(origin+'/api/state',{headers});assert.equal(state.status,200);
 const data=await state.json();assert.ok(data.records.projects.length>0);
 assert.equal((await fetch(origin+'/api/users',{headers})).status,403);
 if(user.role==='client'){assert.equal(data.records.projects.length,1);assert.equal(data.records.estimates.length,1);}
 assert.equal((await fetch(origin+'/api/logout',{method:'POST',headers,body:'{}'})).status,200);
 console.log(`${user.role}: HTTPS login, scoped projects and logout verified`);
}
