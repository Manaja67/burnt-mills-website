import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {scryptSync} from 'node:crypto';
import {database} from '../server/db.mjs';
test('hosting bootstrap creates one admin with a random hashed password and refuses replacement',()=>{
 const folder=mkdtempSync(join(tmpdir(),'bm-init-test-'));
 const env={...process.env,BM_DATA_DIR:folder,BM_DEPLOYMENT:'production',BM_PUBLIC_ORIGIN:'https://burnt.example.com',BM_DEMO_UNTIL:''};
 const args=['server/init-admin.mjs','ADMIN@example.com','Hosting Admin'];
 const result=spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true});
 assert.equal(result.status,0,result.stderr);
 const secret=result.stdout.match(/Password: (\S+)/)?.[1];assert.ok(secret?.length>=32);
 const {db}=database(folder);
 try{
  const row=db.prepare('SELECT * FROM users').get();assert.equal(row.role,'admin');assert.equal(row.email,'admin@example.com');
  const [salt,hash]=row.password.split(':');assert.equal(scryptSync(secret,salt,64).toString('hex'),hash);
  assert.equal(spawnSync(process.execPath,args,{env,encoding:'utf8',windowsHide:true}).status,1);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users').get().n,1);
 }finally{db.close();}
});
