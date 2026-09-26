// Démonstration en ligne sans serveur : le serveur réel (server/index.mjs) tourne dans le navigateur
// sur une base SQLite en mémoire (sql.js). Les appels /api/ de l'application lui sont transmis
// directement. Les données restent dans ce navigateur ; rien n'est envoyé ailleurs.
import {Buffer} from './vendor/node-lib.mjs';
import {seed,ACCOUNTS} from './seed.mjs';

const DB_KEY='bm-demo-db-v1',ROLE_KEY='bm-demo-role',HOST='127.0.0.1:4310',ORIGIN='http://'+HOST;
const store={
  get(k){try{return localStorage.getItem(k);}catch{return null;}},
  set(k,v){try{localStorage.setItem(k,v);return true;}catch{return false;}},
  del(k){try{localStorage.removeItem(k);}catch{}}
};
const fr=new URLSearchParams(location.search).get('lang')==='en'?(store.set('bm_language','en'),false):new URLSearchParams(location.search).get('lang')==='fr'?(store.set('bm_language','fr'),true):store.get('bm_language')!=='en';

globalThis.Buffer=Buffer;
globalThis.process={env:{BM_DATA_DIR:'/demo-data'}};
const SQL=await initSqlJs({locateFile:f=>new URL('vendor/'+f,import.meta.url).href});
let saved=null;
try{const b64=store.get(DB_KEY);if(b64)saved=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));}catch{saved=null;}
const demo=globalThis.__bmDemo={dirty:false,handler:null,db:null,openDatabase(){demo.db=saved?new SQL.Database(saved):new SQL.Database();return demo.db;}};
await import('./server/index.mjs');

let cookie='',canPersist=true;
function persist(){
  if(!demo.dirty||!canPersist)return;
  demo.dirty=false;
  const bytes=demo.db.export();
  demo.db.exec('PRAGMA foreign_keys=ON');
  let bin='';for(let i=0;i<bytes.length;i+=0x8000)bin+=String.fromCharCode(...bytes.subarray(i,i+0x8000));
  if(!store.set(DB_KEY,btoa(bin)))canPersist=false;
}
function call(method,url,headers={},body=null){
  const req={method,url,socket:{remoteAddress:'demo'},
    headers:{host:HOST,origin:ORIGIN,cookie,...Object.fromEntries(Object.entries(headers).map(([k,v])=>[k.toLowerCase(),v]))},
    async *[Symbol.asyncIterator](){if(body&&body.length)yield Buffer.from(body);}};
  return new Promise(resolve=>{
    let status=200;const out=new Headers();
    const res={
      setHeader(k,v){if(k.toLowerCase()==='set-cookie'){const [pair]=String(v).split(';');cookie=/Max-Age=0/i.test(v)?'':pair;}else out.set(k,String(v));},
      getHeader(k){return out.get(k);},
      writeHead(s,h={}){status=s;for(const [k,v] of Object.entries(h))res.setHeader(k,v);return res;},
      end(data){if(method!=='GET')persist();resolve(new Response([204,304].includes(status)?null:(data??null),{status,headers:out}));}
    };
    demo.handler(req,res);
  });
}
async function api(method,path,data){
  const r=await call(method,path,{'content-type':'application/json',...(api.csrf?{'x-csrf-token':api.csrf}:{})},data?new TextEncoder().encode(JSON.stringify(data)):null);
  const json=await r.json();if(!r.ok)throw new Error(`${method} ${path}: ${JSON.stringify(json)}`);
  const csrf=json.csrf||json.user?.csrf;if(csrf)api.csrf=csrf;
  return json;
}

const realFetch=globalThis.fetch.bind(globalThis);
globalThis.fetch=async(input,init={})=>{
  const url=typeof input==='string'?input:input instanceof URL?input.pathname+input.search:input.url;
  if(!url.startsWith('/api/'))return realFetch(input,init);
  let body=init.body??null;if(typeof body==='string')body=new TextEncoder().encode(body);
  return call((init.method||'GET').toUpperCase(),url,Object.fromEntries(new Headers(init.headers||{})),body);
};

// Les fichiers privés (photos téléversées) sont servis par l'API : on les convertit en URL locales.
const blobs=new Map();
async function localize(el,attr){
  const path=el.getAttribute(attr);if(!path||!path.startsWith('/api/files/'))return;
  if(!blobs.has(path))blobs.set(path,call('GET',path).then(r=>r.blob()).then(b=>URL.createObjectURL(b)));
  el.setAttribute(attr,await blobs.get(path));
}
new MutationObserver(()=>{for(const el of document.querySelectorAll('img[src^="/api/files/"]'))localize(el,'src');for(const el of document.querySelectorAll('a[href^="/api/files/"]'))localize(el,'href');})
  .observe(document.documentElement,{subtree:true,childList:true,attributes:true,attributeFilter:['src','href']});

if(!saved)await seed(api);
api.csrf=null;
const role=ACCOUNTS[store.get(ROLE_KEY)]?store.get(ROLE_KEY):'direction';
await api('POST','/api/login',{email:ACCOUNTS[role].email,password:ACCOUNTS[role].password});

const bar=document.createElement('aside');bar.id='demo-bar';
bar.innerHTML=`<span><b>${fr?'DÉMO':'DEMO'}</b> ${fr?'Données fictives, conservées uniquement dans ce navigateur.':'Fictional data, stored only in this browser.'}</span>
<button data-role="direction" ${role==='direction'?'aria-pressed="true"':''}>${fr?'Vue direction':'Management view'}</button>
<button data-role="client" ${role==='client'?'aria-pressed="true"':''}>${fr?'Vue client':'Client view'}</button>
<button data-reset>${fr?'Réinitialiser':'Reset'}</button>
<a href="../${fr?'fr/accueil':'en/home'}.html">${fr?'← Site':'← Website'}</a>`;
bar.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.dataset.role)store.set(ROLE_KEY,b.dataset.role);
  else if(confirm(fr?'Effacer vos essais et recharger les données de démonstration ?':'Erase your changes and reload the demo data?')){store.del(DB_KEY);store.del(ROLE_KEY);}
  else return;
  location.reload();
});
document.body.prepend(bar);
await import('./app.js');
