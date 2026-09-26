// Temporary, isolated customer demonstration. Never copies the working database.
import {spawn} from 'node:child_process';
import {mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomBytes} from 'node:crypto';
import {once} from 'node:events';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const folder=resolve(root,'data','previews',new Date().toISOString().replace(/[:.]/g,'-'));
const stopFile=resolve(folder,'STOP');
const port=4311,local=`http://127.0.0.1:${port}`;
const secret=()=>randomBytes(18).toString('base64url');
const adminPassword=secret(),managerPassword=secret(),clientPassword=secret();
let app,tunnel,cookie='',csrf='',stopping=false;
mkdirSync(folder,{recursive:true});
function stop(){if(stopping)return;stopping=true;app?.kill();tunnel?.kill();writeFileSync(resolve(folder,'status.json'),JSON.stringify({status:'stopped',at:new Date().toISOString()}));process.exit(0);}
process.on('SIGTERM',stop);process.on('SIGINT',stop);
async function launch(env={}){
 app=spawn(process.execPath,[resolve(root,'server/index.mjs')],{cwd:root,env:{...process.env,BM_PUBLIC_ORIGIN:'',BM_DEMO_UNTIL:'',PORT:String(port),BM_DATA_DIR:folder,...env},windowsHide:true,stdio:['ignore','pipe','pipe']});
 app.stderr.on('data',d=>process.stderr.write(d));
 await Promise.race([once(app.stdout,'data'),once(app,'exit').then(()=>{throw new Error('Preview server failed to start');})]);
}
async function api(path,method='GET',data){
 const r=await fetch(local+path,{method,headers:{Origin:local,'Content-Type':'application/json',Cookie:cookie,'X-CSRF-Token':csrf},...(data?{body:JSON.stringify(data)}:{})});
 const body=await r.json();if(!r.ok)throw new Error(`Preview preparation failed: ${path} ${r.status}`);
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];if(body.user?.csrf)csrf=body.user.csrf;return body;
}
try{
 await launch();
 await api('/api/setup','POST',{name:'Administration démo',email:'admin@example.com',password:adminPassword});
 await api('/api/demo','POST',{});
 let state=await api('/api/state');
 const client=state.records.clients.find(c=>c.email==='jordan@example.com');
 await api('/api/users','POST',{name:'Visiteur · Gestion DEMO',email:'gestion@example.com',password:managerPassword,role:'director'});
 await api('/api/users','POST',{name:'Visiteur · Client DEMO',email:'client@example.com',password:clientPassword,role:'client',clientId:client.id});
 for(const kind of ['estimates','invoices','events'])for(const record of state.records[kind]){
  const project=state.records.projects.find(p=>p.id===record.projectId);
  if((record.clientId||project?.clientId)===client.id)await api(`/api/share/${kind}/${record.id}`,'POST',{shared:true,version:record.version});
 }
 const project=state.records.projects.find(p=>p.clientId===client.id);
 await api('/api/records/messages','POST',{name:'Bienvenue / Welcome',projectId:project.id,audience:'client',notes:'Démonstration : testez les devis et messages. Données fictives uniquement. / Demo: try estimates and messages. Fictional data only.'});
 await api('/api/logout','POST',{});
 const closed=once(app,'exit');app.kill();await closed;
 // Obtain the random hostname while no app is listening on the target port.
 tunnel=spawn(resolve(root,'data/tools/cloudflared.exe'),['tunnel','--no-autoupdate','--url',local,'--protocol','http2'],{cwd:folder,windowsHide:true,stdio:['ignore','pipe','pipe']});
 const publicOrigin=await new Promise((accept,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Tunnel startup timed out')),60000);
  const inspect=data=>{const text=data.toString();const match=text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/);if(match){clearTimeout(timeout);accept(match[0]);}};
  tunnel.stderr.on('data',inspect);tunnel.stdout.on('data',inspect);tunnel.once('error',reject);tunnel.once('exit',()=>reject(new Error('Tunnel stopped before startup')));
 });
 const expires=new Date(Date.now()+47*3600000).toISOString();
 await launch({BM_PUBLIC_ORIGIN:publicOrigin,BM_DEMO_UNTIL:expires});
 const access=`DÉMONSTRATION BURNT MILLS INVESTMENT LLC\n\nLien : ${publicOrigin}\n\nGestion de l'entreprise (données fictives)\nEmail : gestion@example.com\nMot de passe : ${managerPassword}\n\nPortail client\nEmail : client@example.com\nMot de passe : ${clientPassword}\n\nExpiration au plus tard : ${expires} (UTC)\nLe PC doit rester allumé et connecté. Aucun paiement réel. Ne saisissez aucune donnée confidentielle.\n\nPour arrêter : double-cliquer ARRETER-DEMO.cmd dans le dossier de l'application.\n`;
 writeFileSync(resolve(folder,'ACCES-CLIENT.txt'),access);
 writeFileSync(resolve(root,'data','preview-current.json'),JSON.stringify({folder,url:publicOrigin,expires,stopFile},null,2));
 writeFileSync(resolve(folder,'status.json'),JSON.stringify({status:'running',url:publicOrigin,expires}));
 console.log(JSON.stringify({url:publicOrigin,expires,accessFile:resolve(folder,'ACCES-CLIENT.txt')}));
 app.once('exit',stop);tunnel.once('exit',stop);
 setInterval(()=>{if(existsSync(stopFile)||Date.now()>=Date.parse(expires))stop();},1000);
}catch(error){console.error(error.message);app?.kill();tunnel?.kill();process.exit(1);}
