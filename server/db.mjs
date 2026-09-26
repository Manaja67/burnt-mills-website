import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { id } from './domain.mjs';
export function database(dir){
  mkdirSync(dir,{recursive:true});const db=new DatabaseSync(resolve(dir,'burnt-mills.sqlite'));
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
    CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','director','accountant')));
    CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT REFERENCES users(id) ON DELETE CASCADE,csrf TEXT NOT NULL,expires INTEGER NOT NULL);
    CREATE TABLE IF NOT EXISTS records(id TEXT PRIMARY KEY,kind TEXT NOT NULL,data TEXT NOT NULL,version INTEGER NOT NULL DEFAULT 1,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS records_kind ON records(kind);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,target TEXT NOT NULL,at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS files(id TEXT PRIMARY KEY,project_id TEXT NOT NULL REFERENCES records(id),name TEXT NOT NULL,mime TEXT NOT NULL,bytes BLOB NOT NULL,category TEXT NOT NULL,description TEXT NOT NULL,author TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
  `);
  // Upgrade the original three-role schema, preserving account IDs and sessions.
  if(!db.prepare('PRAGMA table_info(users)').all().some(c=>c.name==='active')){
    const backupDir=resolve(dir,'backups');mkdirSync(backupDir,{recursive:true});
    const target=resolve(backupDir,`before-access-v2-${Date.now()}-${id().slice(0,8)}.sqlite`);
    db.prepare('VACUUM INTO ?').run(target);
    db.exec('PRAGMA foreign_keys=OFF; BEGIN IMMEDIATE');
    try{
      db.exec(`CREATE TABLE users_v2(id TEXT PRIMARY KEY,email TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','director','accountant','project_manager','foreman','employee','subcontractor','client')),
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),client_id TEXT REFERENCES records(id),employee_id TEXT REFERENCES records(id),
        budget_access INTEGER NOT NULL DEFAULT 0 CHECK(budget_access IN (0,1)),version INTEGER NOT NULL DEFAULT 1);
        INSERT INTO users_v2(id,email,name,password,role) SELECT id,email,name,password,role FROM users;
        DROP TABLE users;
        ALTER TABLE users_v2 RENAME TO users;
        CREATE UNIQUE INDEX user_employee ON users(employee_id) WHERE employee_id IS NOT NULL;
        ALTER TABLE files ADD COLUMN audience TEXT NOT NULL DEFAULT 'internal' CHECK(audience IN ('internal','team','client'));
        PRAGMA user_version=2;`);
      if(db.prepare('PRAGMA foreign_key_check').all().length)throw new Error('Migration foreign key check failed');
      db.exec('COMMIT');
    }catch(e){db.exec('ROLLBACK');throw e;}finally{db.exec('PRAGMA foreign_keys=ON');}
  }
  db.exec(`CREATE TABLE IF NOT EXISTS user_projects(user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,project_id TEXT NOT NULL REFERENCES records(id),PRIMARY KEY(user_id,project_id));`);
  db.prepare("INSERT OR IGNORE INTO settings VALUES('company',?)").run(JSON.stringify({address:'10845 Childs St, MD 20901',state:'Maryland',phone:'+1 (443) 839-2238',email:'',timezone:'America/New_York'}));
  const decode=r=>r?{...JSON.parse(r.data),id:r.id,version:r.version,createdAt:r.created_at,updatedAt:r.updated_at}:null;
  const get=(kind,key)=>typeof key==='string'?decode(db.prepare('SELECT * FROM records WHERE kind=? AND id=?').get(kind,key)):null;
  const all=kind=>db.prepare('SELECT * FROM records WHERE kind=? ORDER BY created_at DESC').all(kind).map(decode);
  const add=(kind,data)=>{const key=id(),at=new Date().toISOString();db.prepare('INSERT INTO records VALUES(?,?,?,1,?,?)').run(key,kind,JSON.stringify(data),at,at);return get(kind,key);};
  const update=(kind,key,data,version)=>{const r=db.prepare('UPDATE records SET data=?,version=version+1,updated_at=? WHERE kind=? AND id=? AND version=?').run(JSON.stringify(data),new Date().toISOString(),kind,key,version);return r.changes?get(kind,key):null;};
  const audit=(actor,action,target)=>db.prepare('INSERT INTO audit(actor,action,target,at) VALUES(?,?,?,?)').run(actor,action,target,new Date().toISOString());
  const tx=fn=>{db.exec('BEGIN IMMEDIATE');try{const r=fn();db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}};
  return {db,get,all,add,update,audit,tx};
}
