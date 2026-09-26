import {randomBytes,scryptSync,randomUUID} from 'node:crypto';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {database} from './db.mjs';
import {hosting} from './hosting.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const [email,name]=process.argv.slice(2);
if(!email||email.length>250||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||!name?.trim()||name.length>100)throw new Error('Usage: node --env-file=.env server/init-admin.mjs admin@example.com "Admin Name"');
if(!process.env.BM_DATA_DIR)throw new Error('BM_DATA_DIR required');
const {data}=hosting(process.env,root);
const {db,tx,audit}=database(data);
try{
  const password=randomBytes(24).toString('base64url'),salt=randomBytes(16).toString('hex');
  const hash=salt+':'+scryptSync(password,salt,64).toString('hex');
  tx(()=>{
    if(db.prepare('SELECT id FROM users LIMIT 1').get())throw new Error('Accounts already exist; initialization refused');
    const id=randomUUID();
    db.prepare('INSERT INTO users(id,email,name,password,role) VALUES(?,?,?,?,?)').run(id,email.toLowerCase(),name.trim(),hash,'admin');
    audit(id,'hosting.initialize',id);
  });
  console.log('Administrateur créé. Conservez immédiatement ce mot de passe dans votre gestionnaire de mots de passe. Il ne sera plus affiché.');
  console.log('Email: '+email.toLowerCase()+'\nPassword: '+password);
}finally{db.close();}
