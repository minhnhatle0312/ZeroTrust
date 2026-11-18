// Startup validation only. No identity fallback and no automatic ID reconciliation.
const fs=require('node:fs');
const {DatabaseSync}=require('node:sqlite');
const {createHash}=require('node:crypto');
const demo=require('../keycloak/lab-config.json').users;
const fail=code=>{throw Error(code+': kiểm tra hướng dẫn KHOI_TAO_MAY_MOI; không tự sửa ID hoặc chạy lại setup trên dữ liệu có sẵn.');};
const hash=value=>createHash('sha256').update(value).digest('hex');

function readLocal(databasePath,staffFile){
  if(fs.existsSync(staffFile+'.reconcile-pending.json'))fail('BOOTSTRAP_RECOVERY_REQUIRED');
  if(fs.existsSync(databasePath+'.identity-links-pending.json'))fail('BOOTSTRAP_RECOVERY_REQUIRED');
  let seed=null,raw='';
  if(fs.existsSync(staffFile)){
    try{raw=fs.readFileSync(staffFile,'utf8');seed=JSON.parse(raw.replace(/^\uFEFF/,''));}catch{fail('BOOTSTRAP_SEED_INVALID');}
    if(!Array.isArray(seed)||seed.length!==demo.length)fail('BOOTSTRAP_SEED_INVALID');
    const ids=new Set(),names=new Set();
    for(const s of seed){
      if(!s||typeof s!=='object'||Object.keys(s).some(k=>!['id','username','role','name','team'].includes(k)))fail('BOOTSTRAP_SEED_INVALID');
      const expected=demo.find(u=>u.username===s.username);
      if(!expected||s.role!==expected.role||typeof s.id!=='string'||!/^[-a-zA-Z0-9_]{1,128}$/.test(s.id)||
        !['name','team'].every(k=>typeof s[k]==='string'&&s[k].trim())||ids.has(s.id)||names.has(s.username))fail('BOOTSTRAP_SEED_INVALID');
      ids.add(s.id);names.add(s.username);
    }
  }
  let rows=[],links=null;
  if(fs.existsSync(databasePath)){
    let db;
    try{
      db=new DatabaseSync(databasePath,{readOnly:true});db.exec('PRAGMA query_only=ON');
      if(db.prepare('PRAGMA integrity_check').all().some(r=>r.integrity_check!=='ok')||db.prepare('PRAGMA foreign_key_check').all().length)fail('BOOTSTRAP_DATABASE_INVALID');
      const tables=db.prepare("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
      if(tables.some(t=>t.name==='staff'))rows=db.prepare('SELECT * FROM staff ORDER BY id').all();
      const readonly={one:(sql,...args)=>db.prepare(sql).get(...args),all:(sql,...args)=>db.prepare(sql).all(...args)};
      const bindingModule=require('./identity-bindings');
      bindingModule.validateStoredBindings(readonly);
      if(bindingModule.presence(readonly))links={batches:readonly.all('SELECT * FROM identity_link_batches ORDER BY id'),bindings:readonly.all('SELECT * FROM staff_identity_bindings ORDER BY issuer,subject')};
      if(!rows.length){
        for(const {name} of tables){
          if(name==='incident_migrations')continue;
          if(db.prepare('SELECT 1 FROM "'+name.replaceAll('"','""')+'" LIMIT 1').get())fail('BOOTSTRAP_ORPHAN_DATA');
        }
      }
    }catch(error){if(error.message.startsWith('BOOTSTRAP_'))throw error;fail('BOOTSTRAP_DATABASE_INVALID');}
    finally{db?.close();}
  }
  if(!rows.length&&!seed)fail('BOOTSTRAP_SEED_REQUIRED');
  if(rows.length&&seed){
    for(const s of seed){
      const matches=rows.filter(r=>r.username.toLowerCase()===s.username.toLowerCase());
      if(matches.length!==1||matches[0].id!==s.id||matches[0].username!==s.username||
        (matches[0].identity_source||'local')!=='local'||matches[0].directory_provider_id)fail('BOOTSTRAP_LOCAL_ID_MISMATCH');
    }
  }
  // Existing mutable role/team/MFA state belongs to the DB, never to an old seed.
  return {rows,seed,signature:hash(JSON.stringify({rows,raw,links}))};
}

async function preflight({databasePath,staffFile,identity}){
  const local=readLocal(databasePath,staffFile);
  const fresh=!local.rows.length;
  const candidates=fresh?local.seed:local.rows.filter(r=>(r.identity_source||'local')==='local'&&
    !r.disabled&&(r.governance_state||'active')==='active');
  for(const s of candidates){
    let remote;
    try{remote=await identity.bootstrapIdentity(s.username);}catch{fail('BOOTSTRAP_IDENTITY_UNAVAILABLE');}
    if(!remote||remote.id!==s.id||remote.username!==s.username||remote.federated)fail('BOOTSTRAP_KEYCLOAK_ID_MISMATCH');
    if(fresh&&(!remote.enabled||remote.roles.length!==1||remote.roles[0]!==s.role))fail('BOOTSTRAP_ROLE_MISMATCH');
  }
  return {...local,fresh,databasePath,staffFile};
}

function openVerifiedStore(plan){
  if(readLocal(plan.databasePath,plan.staffFile).signature!==plan.signature)fail('BOOTSTRAP_LOCAL_CHANGED');
  const store=require('./store').openStore(plan.databasePath);
  try{
    store.tx(()=>{
      const current=store.all('SELECT * FROM staff ORDER BY id');
      if(current.length!==plan.rows.length||plan.rows.some((row,i)=>Object.keys(row).some(k=>current[i][k]!==row[k])))fail('BOOTSTRAP_LOCAL_CHANGED');
      if(plan.fresh){
        for(const s of plan.seed)store.run('INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)',s.id,s.username,s.name,s.team,s.role);
        if(store.one('SELECT COUNT(*) AS n FROM staff').n!==plan.seed.length)fail('BOOTSTRAP_INSERT_FAILED');
      }
    });
    return store;
  }catch(error){store.db.close();throw error;}
}
module.exports={readLocal,preflight,openVerifiedStore};
