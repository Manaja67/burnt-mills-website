// Aperçu gratuit sur GitHub Pages : reprend l'export statique et rend les chemins relatifs,
// car le site est servi sous /<nom-du-depot>/ et non à la racine du domaine.
import {execFileSync} from 'node:child_process';
import {cpSync,rmSync,readFileSync,writeFileSync,readdirSync,existsSync} from 'node:fs';
import {resolve,join,relative,dirname,posix} from 'node:path';
import assert from 'node:assert/strict';

execFileSync(process.execPath,['scripts/package-static.mjs'],{stdio:'inherit'});
const source=resolve('livraison','Burnt-Mills-STATIQUE-LWS','site-a-transferer'),out=resolve('_site');
rmSync(out,{recursive:true,force:true});
cpSync(source,out,{recursive:true});
writeFileSync(join(out,'.nojekyll'),'');

const htmlFiles=[];
(function walk(dir){for(const e of readdirSync(dir,{withFileTypes:true})){const p=join(dir,e.name);if(e.isDirectory())walk(p);else if(p.endsWith('.html'))htmlFiles.push(p);}})(out);

for(const file of htmlFiles){
 const fromDir=relative(out,dirname(file)).split('\\').join('/');
 let html=readFileSync(file,'utf8').replace(/(href|src)="\/([^"]*)"/g,(_,attr,path)=>{
  const target=path||'index.html';
  const rel=posix.relative(fromDir||'.',target)||target;
  assert.ok(existsSync(join(out,target.split(/[?#]/)[0])),`Missing ${target} in ${file}`);
  return `${attr}="${rel}"`;
 });
 if(!/<meta name="robots"/.test(html))html=html.replace('<head>','<head><meta name="robots" content="noindex">');
 assert.ok(!/(href|src)="\//.test(html),`Absolute path remains in ${file}`);
 writeFileSync(file,html);
}
console.log(JSON.stringify({folder:out,htmlPages:htmlFiles.length}));
