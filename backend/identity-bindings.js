// Explicit schema installation only. No startup reconciliation, username linking,
// network calls, or audit rewrites. A binding is identity, never authorization.
const {createHash}=require('node:crypto');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const fail=(code='IDENTITY_LINK_UNVERIFIED')=>{throw Object.assign(Error('Liên kết danh tính chưa được xác minh hoặc đã thay đổi.'),{code,status:403});};
const text=v=>typeof v==='string'&&v.length>0&&v.length<=512&&v===v.trim()&&!/[\u0000-\u001f]/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const tables=['identity_link_batches','staff_identity_bindings'];
const schema=`
 CREATE TABLE identity_link_batches (
 id TEXT PRIMARY KEY,plan_hash TEXT NOT NULL CHECK(length(plan_hash)=64),
 manifest_hash TEXT NOT NULL CHECK(length(manifest_hash)=64),verified_at TEXT NOT NULL,
 evidence_ref TEXT NOT NULL CHECK(length(trim(evidence_ref))>0));
 CREATE TABLE staff_identity_bindings (
 issuer TEXT NOT NULL,subject TEXT NOT NULL,staff_id TEXT NOT NULL REFERENCES staff(id),
 provider_id TEXT NOT NULL,source_instance TEXT NOT NULL,entry_uuid TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('active','retired')),valid_from INTEGER NOT NULL,
 valid_until INTEGER,batch_id TEXT NOT NULL REFERENCES identity_link_batches(id),
 PRIMARY KEY(issuer,subject),
 CHECK(length(trim(issuer))>0 AND length(trim(subject))>0 AND length(trim(provider_id))>0
 AND length(trim(source_instance))>0 AND length(trim(entry_uuid))>0),
 CHECK(typeof(valid_from)='integer' AND valid_from>=0),
 CHECK((state='active' AND valid_until IS NULL) OR
 (state='retired' AND typeof(valid_until)='integer' AND valid_until>valid_from)));
 CREATE UNIQUE INDEX binding_active_staff ON staff_identity_bindings(issuer,staff_id) WHERE state='active';
 CREATE UNIQUE INDEX binding_active_entry ON staff_identity_bindings(issuer,source_instance,entry_uuid) WHERE state='active';
`;
function presence(store){
  const found=store.all("SELECT name FROM sqlite_schema WHERE type='table' AND name IN ('identity_link_batches','staff_identity_bindings')");
  if(found.length!==0&&found.length!==2)fail('IDENTITY_LINK_SCHEMA_INVALID');
  return found.length===2;
}
function installSchema(db){
  // Must be called deliberately on a test DB or by a separately approved migrator.
  db.exec('SAVEPOINT identity_schema');
  try{db.exec(schema);db.exec('RELEASE identity_schema');}
  catch(e){db.exec('ROLLBACK TO identity_schema; RELEASE identity_schema');throw e;}
}
function validRow(row){
  return row&&['issuer','subject','staff_id','provider_id','source_instance','entry_uuid','batch_id','evidence_ref'].every(k=>text(row[k]))&&
    sha(row.plan_hash)&&sha(row.manifest_hash)&&Number.isFinite(Date.parse(row.verified_at))&&
    Number.isSafeInteger(row.valid_from)&&row.valid_from>=0&&
    (row.state==='active'?row.valid_until===null:row.state==='retired'&&Number.isSafeInteger(row.valid_until)&&row.valid_until>row.valid_from);
}
const joined=`SELECT b.*,v.plan_hash,v.manifest_hash,v.verified_at,v.evidence_ref
 FROM staff_identity_bindings b LEFT JOIN identity_link_batches v ON v.id=b.batch_id`;
function validateStoredBindings(store){
  if(!presence(store))return;
  const active=new Set(),entries=new Set();
  for(const row of store.all(joined)){
    const staff=store.one('SELECT * FROM staff WHERE id=?',row.staff_id);
    if(!validRow(row)||staff?.identity_source!=='ldap')fail('IDENTITY_LINK_SCHEMA_INVALID');
    const collision=store.one('SELECT id FROM staff WHERE id=? AND id<>?',row.subject,row.staff_id);
    if(collision)fail('IDENTITY_LINK_CONFLICT');
    if(row.state==='active'){
      const key=JSON.stringify([row.issuer,row.staff_id]),entry=JSON.stringify([row.issuer,row.source_instance,row.entry_uuid]);
      if(active.has(key)||entries.has(entry))fail('IDENTITY_LINK_CONFLICT');active.add(key);entries.add(entry);
    }
  }
}
function createIdentityBindings({store,issuer='',providerId='',now=Date.now}){
  validateStoredBindings(store);
  function binding(subject){
    if(!presence(store))return null;
    const rows=store.all(joined+' WHERE b.issuer=? AND b.subject=?',issuer,subject);
    if(rows.length>1)fail('IDENTITY_LINK_CONFLICT');
    const b=rows[0];if(b&&!validRow(b))fail();return b||null;
  }
  function active(b){
    if(!issuer||!providerId||!b||b.state!=='active'||b.provider_id!==providerId||b.valid_from>Math.floor(now()/1000))fail();
    const staff=store.one('SELECT * FROM staff WHERE id=?',b.staff_id);
    if(staff?.identity_source!=='ldap'||store.one('SELECT id FROM staff WHERE id=? AND id<>?',b.subject,b.staff_id))fail('IDENTITY_LINK_CONFLICT');
    const others=store.all("SELECT subject FROM staff_identity_bindings WHERE issuer=? AND staff_id=? AND state='active'",issuer,b.staff_id);
    if(others.length!==1)fail('IDENTITY_LINK_CONFLICT');
    return {staff,principal:{issuer,subject:b.subject,providerId:b.provider_id,entryUuid:b.entry_uuid,sourceInstance:b.source_instance,
      bindingVersion:hash(b),staffId:staff.id}};
  }
  function resolve(subject,claimIssuer=issuer){
    if(typeof subject!=='string'||!subject||claimIssuer!==issuer)fail();
    const b=binding(subject);if(b)return active(b); // Retired never falls through.
    const staff=store.one('SELECT * FROM staff WHERE id=?',subject);
    if(staff?.identity_source==='ldap')fail();
    if(!staff)return null;
    return {staff,principal:{issuer,subject,staffId:staff.id,providerId:null,bindingVersion:'local'}};
  }
  function forStaff(id){
    const staff=store.one('SELECT * FROM staff WHERE id=?',id);if(!staff)fail();
    if(staff.identity_source!=='ldap'){
      if(binding(id))fail('IDENTITY_LINK_CONFLICT');
      return resolve(id);
    }
    if(!presence(store))fail();
    const rows=store.all("SELECT subject FROM staff_identity_bindings WHERE issuer=? AND staff_id=? AND state='active'",issuer,id);
    if(rows.length!==1)fail();return active(binding(rows[0].subject));
  }
  function unchanged(principal){
    const current=resolve(principal.subject,principal.issuer);
    if(!current||current.staff.id!==principal.staffId||current.principal.bindingVersion!==principal.bindingVersion)fail('IDENTITY_LINK_CHANGED');
    return current;
  }
  function assertAvailable(subject){
    if(!text(subject)||store.one('SELECT id FROM staff WHERE id=?',subject)||binding(subject))fail('IDENTITY_LINK_CONFLICT');
  }
  function historical(subject,time){
    if(!issuer||!Number.isFinite(time))return null;
    const b=binding(subject);
    if(!b||time<b.valid_from||(b.valid_until!==null&&time>=b.valid_until))return null;
    return {staffId:b.staff_id,issuer,subject,batchId:b.batch_id,contextOnly:true};
  }
  function lastLogin(staffId){
    if(!presence(store)||!issuer)return null;
    let latest=null;
    for(const b of store.all(joined+' WHERE b.issuer=? AND b.staff_id=?',issuer,staffId)){
      if(!validRow(b))fail();
      const row=store.one("SELECT MAX(time) AS time FROM identity_events WHERE user_id=? AND type='LOGIN' AND unixepoch(time)>=? AND (? IS NULL OR unixepoch(time)<?)",b.subject,b.valid_from,b.valid_until,b.valid_until);
      if(row.time&&(!latest||row.time>latest))latest=row.time;
    }
    return latest;
  }
  return {issuer,providerId,resolve,forStaff,unchanged,assertAvailable,historical,lastLogin,
    subject:id=>forStaff(id).principal.subject,
    currentProvider(id){try{return forStaff(id).principal.providerId;}catch{return null;}},
    linkedUsers(){if(!presence(store)||!issuer||!providerId)return [];
      return store.all("SELECT s.* FROM staff s JOIN staff_identity_bindings b ON b.staff_id=s.id WHERE b.issuer=? AND b.provider_id=? AND b.state='active'",issuer,providerId)
        .map(s=>forStaff(s.id).staff);}};
}
function localIdentity(identity,bindings){
  const scoped=Object.create(identity);
  scoped.containNewIdentity=async subject=>{bindings.assertAvailable(subject);return identity.remediate(subject,'disable');};
  const paths=require('../directory/directory-config.json').mappings.map(m=>m.keycloakPath);
  for(const method of ['userSecurity','inspectUser','sessions','endSession','resetPassword','recoverMfa','remediate','updateUser','requireDirectoryEnrollment']){
    scoped[method]=async(id,...args)=>{
      const {principal}=bindings.forStaff(id);
      if(principal.providerId){
        const remote=await identity.directoryUser(principal.subject,paths);
        if(remote.id!==principal.subject||remote.providerId!==principal.providerId||remote.entryUuid!==principal.entryUuid)fail();
        bindings.unchanged(principal);
      }
      const result=await identity[method](principal.subject,...args);
      bindings.unchanged(principal);return result;
    };
  }
  return scoped;
}
module.exports={installSchema,createIdentityBindings,validateStoredBindings,presence,localIdentity};
