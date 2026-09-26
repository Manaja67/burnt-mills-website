import {resolve,relative,isAbsolute,sep} from 'node:path';

export function hosting(env,root,now=Date.now()){
  const production=env.BM_DEPLOYMENT==='production';
  if(env.BM_DEPLOYMENT&&!['local','production','preview'].includes(env.BM_DEPLOYMENT))throw new Error('Invalid BM_DEPLOYMENT');
  const origin=env.BM_PUBLIC_ORIGIN?new URL(env.BM_PUBLIC_ORIGIN):null;
  const until=Date.parse(env.BM_DEMO_UNTIL||'');
  const data=resolve(env.BM_DATA_DIR||resolve(root,'data'));
  if(production&&!origin)throw new Error('Production requires BM_PUBLIC_ORIGIN');
  if(origin&&(origin.protocol!=='https:'||origin.origin!==env.BM_PUBLIC_ORIGIN||!env.BM_DATA_DIR))throw new Error('Hosting requires an exact HTTPS origin and BM_DATA_DIR');
  if(production){
    const rel=relative(root,data);
    if(!isAbsolute(env.BM_DATA_DIR)||(!rel||(rel!=='..'&&!rel.startsWith('..'+sep)&&!isAbsolute(rel))))throw new Error('Production data must be outside the application directory');
    if(env.BM_DEMO_UNTIL)throw new Error('Remove BM_DEMO_UNTIL for production');
  }else if(origin&&(!Number.isFinite(until)||until<=now||until>now+48*3600000||data===resolve(root,'data')))throw new Error('Public preview requires separate data and expiry within 48 hours');
  return {production,origin,until,data};
}
