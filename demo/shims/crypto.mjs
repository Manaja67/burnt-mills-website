// Démo navigateur : équivalents de node:crypto utilisés par le serveur.
import {Buffer,sha256,scrypt,bytesToHex} from '../vendor/node-lib.mjs';
export const randomBytes=n=>Buffer.from(crypto.getRandomValues(new Uint8Array(n)));
export const randomUUID=()=>crypto.randomUUID();
export function createHash(algo){
  if(algo!=='sha256')throw new Error('Unsupported hash '+algo);
  let data='';
  const h={update(s){data+=s;return h;},digest(enc){const out=sha256(new TextEncoder().encode(data));return enc==='hex'?bytesToHex(out):Buffer.from(out);}};
  return h;
}
// Paramètres réduits : les comptes de démonstration n'ont pas de valeur réelle.
export const scryptSync=(p,salt,len)=>Buffer.from(scrypt(p,salt,{N:1024,r:8,p:1,dkLen:len}));
export function timingSafeEqual(a,b){if(a.length!==b.length)throw new RangeError('Input buffers must have the same byte length');let d=0;for(let i=0;i<a.length;i++)d|=a[i]^b[i];return d===0;}
export default {randomBytes,randomUUID,createHash,scryptSync,timingSafeEqual};
