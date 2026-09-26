// Démo navigateur : aucun accès disque ; les fichiers statiques sont servis par GitHub Pages.
export const readFileSync=()=>'';
export const mkdirSync=()=>{};
export const existsSync=()=>false;
export default {readFileSync,mkdirSync,existsSync};
