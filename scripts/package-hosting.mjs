import {mkdirSync,copyFileSync,readdirSync,writeFileSync,readFileSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve('.'),stamp=new Date().toISOString().replace(/[:.]/g,'-');
const out=join(root,'livraison',`burnt.gmccgabon.com-${stamp}`);
mkdirSync(out,{recursive:true});
const manifest=[];
function copy(source,target){
 const dest=join(out,target);mkdirSync(resolve(dest,'..'),{recursive:true});copyFileSync(join(root,source),dest);
 manifest.push({file:target.replaceAll('\\','/'),sha256:createHash('sha256').update(readFileSync(dest)).digest('hex')});
}
for(const file of ['index.mjs','db.mjs','domain.mjs','access.mjs','public-site.mjs','hosting.mjs','init-admin.mjs','backup.mjs'])copy('server/'+file,'application/server/'+file);
function assets(dir){for(const entry of readdirSync(join(root,dir),{withFileTypes:true})){if(entry.isSymbolicLink())throw new Error('Symlink refused');const path=join(dir,entry.name);if(entry.isDirectory())assets(path);else if(/\.(js|css|html|svg|png|jpg|webmanifest)$/.test(entry.name))copy(path,join('application',path));else throw new Error('Unexpected public asset: '+path);}}
assets('public');
copy('package.json','application/package.json');
const pkg=JSON.parse(readFileSync(join(root,'package.json'),'utf8'));
pkg.scripts={start:'node --env-file=.env server/index.mjs',backup:'node --env-file=.env server/backup.mjs'};
const packaged=join(out,'application/package.json');writeFileSync(packaged,JSON.stringify(pkg,null,2)+'\n');
manifest.find(x=>x.file==='application/package.json').sha256=createHash('sha256').update(readFileSync(packaged)).digest('hex');
for(const file of readdirSync(join(root,'deployment-config')))copy('deployment-config/'+file,'configuration/'+file);
copy('docs/HEBERGEMENT-FTP.md','LIRE-MOI-INSTALLATION.md');
writeFileSync(join(out,'SHA256.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(out);
