import {mkdirSync,copyFileSync,writeFileSync,readFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import assert from 'node:assert/strict';
import {pages,renderPublic,routeFor} from '../server/public-site.mjs';

const out=resolve('livraison','Burnt-Mills-STATIQUE-LWS'),site=join(out,'site-a-transferer');
mkdirSync(site,{recursive:true});
const outputs=[];
function save(path,body){const dest=join(site,path);mkdirSync(resolve(dest,'..'),{recursive:true});writeFileSync(dest,body);outputs.push(dest);}
function render(key,lang){
 const fr=lang==='fr',t=(f,e)=>fr?f:e;
 let html=renderPublic(key,lang);
 html=html.replace(/<script src="\/site.js" defer><\/script>/,'');
 html=html.replace(/<a\b[^>]*href="\/connexion\?lang=[^"]*"[^>]*>[\s\S]*?<\/a>/g,'');
 html=html.replace(/<aside class="portal-callout">[\s\S]*?<\/aside>/,`<aside class="portal-callout"><h2>${t('Une question sur votre chantier ?','A question about your project?')}</h2><p>${t('Contactez notre équipe pour faire le point sur vos travaux.','Contact our team for an update on your project.')}</p><a class="button" href="tel:+14438392238">${t('Appeler notre équipe','Call our team')}</a></aside>`);
 html=html.replace('Décrivez les travaux envisagés. Votre demande sera enregistrée pour permettre à l’équipe de vous recontacter.','Appelez-nous pour présenter les travaux envisagés et discuter de votre demande de devis.');
 html=html.replace('Tell us about the work you have in mind. Your request will be recorded so the team can get back to you.','Call us to discuss the work you have in mind and your estimate request.');
 html=html.replace(/<form id="estimate-form">[\s\S]*?<\/form>/,`<div class="static-contact"><p class="eyebrow">${t('VOTRE DEMANDE DE DEVIS','YOUR ESTIMATE REQUEST')}</p><h2>${t('Parlons de vos travaux.','Let’s discuss your project.')}</h2><p>${t('Pour préparer notre échange, notez l’adresse du chantier, les travaux souhaités et votre calendrier prévisionnel.','To prepare for our conversation, have the jobsite address, proposed work and preferred timeline ready.')}</p><a class="button" href="tel:+14438392238">${t('Appeler','Call')} +1 (443) 839-2238 ↗</a><p>${t('Depuis un ordinateur, composez ce numéro sur votre téléphone.','On a computer, dial this number on your phone.')}</p></div>`);
 html=html.replace(/<a class="language"[^>]*>[\s\S]*?<\/a>/,`<nav class="static-language" aria-label="${t('Choisir la langue','Select language')}"><a href="${routeFor(key,'fr')}" lang="fr" ${fr?'aria-current="true"':''}>FR</a><span aria-hidden="true">/</span><a href="${routeFor(key,'en')}" lang="en" ${!fr?'aria-current="true"':''}>EN</a></nav>`);
 for(const p of pages)for(const l of ['fr','en'])html=html.replaceAll(`href="${routeFor(p[0],l)}"`,`href="${routeFor(p[0],l)}.html"`);
 assert.ok(!/\/api\/|\/connexion|<form\b|<script\b/.test(html),'Dynamic dependency remains');
 return html;
}
for(const p of pages)for(const lang of ['fr','en'])save(routeFor(p[0],lang).slice(1)+'.html',render(p[0],lang));
save('index.html',render('home','fr'));
for(const file of ['logo.png','icon.png',...['house','kitchen','bathroom','construction','exterior'].map(n=>'photos/'+n+'.jpg')]){
 const target=join(site,file);mkdirSync(resolve(target,'..'),{recursive:true});copyFileSync(resolve('public',file),target);
}
const hover=readFileSync('public/site.js','utf8').match(/hoverStyle\.textContent='([^']+)'/)?.[1]||'';
save('site.css',readFileSync('public/site.css','utf8')+'\n'+hover+`\n.static-contact{padding:clamp(24px,5vw,48px);background:#e9f1f5;border:1px solid #c8d6e4;border-radius:12px}.static-contact .button{margin:20px 0}.static-language{display:flex;gap:8px;align-items:center}.static-language a{padding:8px 10px;border:1px solid transparent;border-radius:6px;color:#0d2e54;text-decoration:none}.static-language a[aria-current],.static-language a:hover,.static-language a:focus-visible{background:#0d2e54;color:white;border-color:#0d2e54}\n`);
// All local navigation and image/style paths must resolve without rewrites or a backend.
let links=0;
for(const file of outputs.filter(p=>p.endsWith('.html'))){
 const html=readFileSync(file,'utf8');
 for(const match of html.matchAll(/(?:href|src)="(\/[^"?#]*)[^\"]*"/g)){
  assert.ok(existsSync(join(site,match[1].slice(1))),`Missing asset/link ${match[1]} in ${file}`);links++;
 }
}
writeFileSync(join(out,'INSTALLATION-LWS.txt'),`BURNT MILLS — SITE STATIQUE FR / EN\nDestination : https://burnt.gmccgabon.com\n\nAucun Node.js, npm, PHP ou base de données nécessaire sur le serveur.\n\n1. Décompressez ce ZIP sur votre ordinateur.\n2. Dans LWS Panel, cliquez sur « Sous domaines » (capture CP2). Si burnt existe, consultez son répertoire. Sinon créez le sous-domaine burnt et relevez le répertoire associé.\n3. Ouvrez le gestionnaire de fichiers ou connectez FileZilla avec votre compte FTP. Ouvrez UNIQUEMENT le répertoire associé à burnt.gmccgabon.com. Ne remplacez pas les fichiers du site principal gmccgabon.com.\n4. Si ce répertoire contient déjà un site, sauvegardez-le avant remplacement. Une ancienne page index.php ou index.html peut prendre priorité : archivez-la hors du répertoire public.\n5. Transférez LE CONTENU du dossier site-a-transferer dans ce répertoire : index.html, site.css, logo.png, icon.png, fr/, en/, photos/. Ne transférez pas le dossier parent lui-même.\n6. Dans « SSL » (capture CP3), activez ou vérifiez le certificat pour burnt.gmccgabon.com. Après activation, utilisez l’option de redirection HTTPS proposée par LWS si disponible.\n7. Ouvrez https://burnt.gmccgabon.com puis testez FR / EN et les liens des rubriques. Si une ancienne version apparaît, actualisez avec Ctrl+F5.\n\nContenu : huit rubriques en français et huit en anglais, une page d’accueil à la racine, photos et styles. Les URL utilisent .html et ne nécessitent aucune règle de réécriture. Le site doit être placé à la racine du sous-domaine.\n\nLe contact se fait par téléphone au +1 (443) 839-2238. Aucun formulaire ne collecte ni n’envoie de données. L’espace de gestion, les comptes, les paiements et la connexion ne font pas partie de cette version statique. L’application locale complète reste dans son dossier initial. Les photos conservent leurs crédits et leur mention d’illustration.\n`);
console.log(JSON.stringify({folder:out,htmlPages:17,checkedLocalLinks:links}));
