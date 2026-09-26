// Démo navigateur : sous-ensemble POSIX de node:path.
export const sep='/';
const norm=p=>{const out=[];for(const s of p.split('/')){if(!s||s==='.')continue;if(s==='..')out.pop();else out.push(s);}return '/'+out.join('/');};
export const isAbsolute=p=>p.startsWith('/');
export function resolve(...parts){let p='';for(const part of parts){if(!part)continue;p=isAbsolute(part)?part:p+'/'+part;}return norm(p||'/');}
export const dirname=p=>norm(p+'/..');
export const join=(...parts)=>norm(parts.join('/'));
export function relative(from,to){const a=resolve(from).split('/').filter(Boolean),b=resolve(to).split('/').filter(Boolean);let i=0;while(i<a.length&&a[i]===b[i])i++;return [...a.slice(i).map(()=>'..'),...b.slice(i)].join('/');}
export default {sep,isAbsolute,resolve,dirname,join,relative};
