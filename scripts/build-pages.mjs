// Aperçu gratuit sur GitHub Pages : reprend l'export statique et rend les chemins relatifs,
// car le site est servi sous /<nom-du-depot>/ et non à la racine du domaine.
// Ajoute la démonstration de l'espace de gestion (demo/), qui exécute le serveur dans le navigateur.
import {execFileSync} from 'node:child_process';
import {cpSync,rmSync,readFileSync,writeFileSync,readdirSync,existsSync,mkdirSync} from 'node:fs';
import {resolve,join,relative,dirname,posix} from 'node:path';
import assert from 'node:assert/strict';

execFileSync(process.execPath,['scripts/package-static.mjs'],{stdio:'inherit'});
const source=resolve('livraison','Burnt-Mills-STATIQUE-LWS','site-a-transferer'),out=resolve('_site');
rmSync(out,{recursive:true,force:true});
cpSync(source,out,{recursive:true});
writeFileSync(join(out,'.nojekyll'),'');

// Démonstration de l'espace de gestion.
const demo=join(out,'demo');
cpSync(resolve('demo'),demo,{recursive:true});
mkdirSync(join(demo,'server'),{recursive:true});
for(const f of ['index.mjs','db.mjs','domain.mjs','access.mjs','public-site.mjs','hosting.mjs'])cpSync(resolve('server',f),join(demo,'server',f));
for(const f of ['style.css','logo.png','icon.png'])cpSync(resolve('public',f),join(demo,f));
let app=readFileSync('public/app.js','utf8');
const patch=(from,to,count)=>{assert.equal(app.split(from).length-1,count,`app.js: ${from}`);app=app.replaceAll(from,to);};
patch('"/logo.png"','"logo.png"',6);
patch("globalHome.href='/fr/accueil'","globalHome.href='../fr/accueil.html'",1);
patch("${lang==='fr'?'/fr/accueil':'/en/home'}","${lang==='fr'?'../fr/accueil.html':'../en/home.html'}",1);
patch("'serviceWorker' in navigator","false",1);
writeFileSync(join(demo,'app.js'),app);

const htmlFiles=[];
(function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.html'))htmlFiles.push(p);}})(out);

for(const file of htmlFiles){
 if(file.startsWith(demo))continue;
 const fromDir=relative(out,dirname(file)).split('\\').join('/');
 let html=readFileSync(file,'utf8');
 const en=/<html[^>]*lang="en"/.test(html);
 html=html.replace('</nav></div><nav class="desktop-nav"',`</nav><a class="static-demo" href="/demo/index.html?lang=${en?'en':'fr'}">${en?'Management demo':'Espace de gestion (démo)'} ↗</a></div><nav class="desktop-nav"`);
 html=html.replace(/(href|src)="\/([^"]*)"/g,(_,attr,path)=>{
  const target=path||'index.html';
  const rel=posix.relative(fromDir||'.',target)||target;
  assert.ok(existsSync(join(out,target.split(/[?#]/)[0])),`Missing ${target} in ${file}`);
  return `${attr}="${rel}"`;
 });
 if(!/<meta name="robots"/.test(html))html=html.replace('<head>','<head><meta name="robots" content="noindex">');
 assert.ok(!/(href|src)="\//.test(html),`Absolute path remains in ${file}`);
 assert.ok(html.includes('class="static-demo"'),`Demo link missing in ${file}`);
 writeFileSync(file,html);
}
writeFileSync(join(out,'site.css'),readFileSync(join(out,'site.css'),'utf8')+'\n.static-demo{margin-left:12px;padding:8px 12px;border-radius:6px;background:#07835f;color:#fff;font-size:13px;font-weight:600;text-decoration:none;white-space:nowrap}.static-demo:hover,.static-demo:focus-visible{background:#0d2e54}@media(max-width:700px){.header-tools{flex-wrap:wrap;justify-content:flex-end;gap:8px}.static-demo{margin-left:0;font-size:12px}}\n');
console.log(JSON.stringify({folder:out,htmlPages:htmlFiles.length}));
