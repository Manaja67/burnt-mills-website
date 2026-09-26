// Démo navigateur : node:sqlite (DatabaseSync) sur sql.js ; la base est fournie par boot.mjs.
const bind=params=>params.map(v=>v===undefined?null:typeof v==='boolean'?+v:v);
class Statement{
  constructor(owner,sql){this.owner=owner;this.sql=sql;this.noop=/^\s*VACUUM\s+INTO/i.test(sql);}
  rows(params,first){
    if(this.noop)return [];
    const s=this.owner.db.prepare(this.sql);const out=[];
    try{s.bind(bind(params));while(s.step()){out.push(s.getAsObject());if(first)break;}}finally{s.free();}
    return out;
  }
  get(...p){return this.rows(p,true)[0];}
  all(...p){return this.rows(p,false);}
  run(...p){
    if(this.noop)return {changes:0,lastInsertRowid:0};
    this.owner.db.run(this.sql,bind(p));this.owner.touch();
    const id=this.owner.db.exec('SELECT last_insert_rowid()')[0]?.values[0][0]??0;
    return {changes:this.owner.db.getRowsModified(),lastInsertRowid:id};
  }
}
export class DatabaseSync{
  constructor(){this.db=globalThis.__bmDemo.openDatabase();}
  touch(){globalThis.__bmDemo.dirty=true;}
  exec(sql){this.db.exec(sql);this.touch();}
  prepare(sql){return new Statement(this,sql);}
  close(){}
}
export default {DatabaseSync};
