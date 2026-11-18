const {test}=require('node:test'),assert=require('node:assert/strict');
const {openStore}=require('./store');
const {createIdentityBindings,validateStoredBindings,installSchema,localIdentity}=require('./identity-bindings');
const {fixture,ISSUER,PROVIDER}=require('../tests/fixtures/identity-binding-fixture.cjs');
function setup(){const store=openStore(':memory:');const data=fixture(store);return {store,...data,bindings:createIdentityBindings({store,issuer:ISSUER,providerId:PROVIDER})};}
function scenario(name,fn){test(name,async()=>{const f=setup();try{await fn(f);}finally{f.store.db.close();}});}
scenario('resolve four remote subjects to unchanged local IDs; local roles preserved',f=>{
  for(const u of f.ldap){const r=f.bindings.resolve(u.id,ISSUER);assert.equal(r.staff.id,u.localId);assert.equal(r.staff.role,u.role);assert.equal(f.bindings.subject(u.localId),u.id);}
  for(const u of f.locals){assert.equal(f.bindings.resolve(u.id,ISSUER).staff.role,u.role);assert.equal(f.bindings.subject(u.id),u.id);}
});
scenario('retired subjects, wrong issuer, username cannot authenticate',f=>{
  for(const u of f.ldap)assert.throws(()=>f.bindings.resolve(u.localId),{code:'IDENTITY_LINK_UNVERIFIED'});
  assert.throws(()=>f.bindings.resolve(f.ldap[0].id,'https://other.invalid'),{code:'IDENTITY_LINK_UNVERIFIED'});
  assert.equal(f.bindings.resolve(f.ldap[0].username),null);
});
scenario('missing evidence or invalid hash denies runtime and bootstrap validation',f=>{
  f.store.run("UPDATE identity_link_batches SET manifest_hash=?",'x'.repeat(64));
  assert.throws(()=>f.bindings.resolve(f.ldap[0].id),{code:'IDENTITY_LINK_UNVERIFIED'});
  assert.throws(()=>validateStoredBindings(f.store),{code:'IDENTITY_LINK_SCHEMA_INVALID'});
});
scenario('orphan batch cannot be created; blank entry cannot be created',f=>{
  assert.throws(()=>f.store.run("UPDATE staff_identity_bindings SET batch_id='absent'"));
  assert.throws(()=>f.store.run("UPDATE staff_identity_bindings SET entry_uuid=''"));
});
scenario('binding changes during await are rejected',f=>{
  const old=f.bindings.forStaff(f.ldap[0].localId).principal;
  f.store.run("UPDATE staff_identity_bindings SET entry_uuid='changed' WHERE subject=?",old.subject);
  assert.throws(()=>f.bindings.unchanged(old),{code:'IDENTITY_LINK_CHANGED'});
});
scenario('wrong provider and future binding deny access',f=>{
  f.store.run("UPDATE staff_identity_bindings SET provider_id='other' WHERE state='active'");
  assert.throws(()=>f.bindings.resolve(f.ldap[0].id));
  f.store.run("UPDATE staff_identity_bindings SET provider_id=?,valid_from=? WHERE state='active'",PROVIDER,Math.floor(Date.now()/1000)+10000);
  assert.throws(()=>f.bindings.resolve(f.ldap[0].id));
});
scenario('historical resolution is interval-scoped and never authenticates retired subject',f=>{
  const u=f.ldap[0];assert.equal(f.bindings.historical(u.localId,99).staffId,u.localId);
  assert.equal(f.bindings.historical(u.localId,100),null);assert.equal(f.bindings.historical(u.id,99),null);
  assert.throws(()=>f.bindings.resolve(u.localId));
});
scenario('local subject collision with binding blocked before provisioning',f=>{
  assert.throws(()=>f.bindings.assertAvailable(f.ldap[0].id));
  assert.throws(()=>f.bindings.assertAvailable(f.locals[0].id));
  assert.doesNotThrow(()=>f.bindings.assertAvailable('genuinely-new-subject'));
});
scenario('local identity facade sends only current remote IDs to all account methods',async f=>{
  const calls=[],raw={directoryUser:async id=>structuredClone(f.ldap.find(u=>u.id===id))};
  const methods=['userSecurity','inspectUser','sessions','endSession','resetPassword','recoverMfa','remediate','updateUser','requireDirectoryEnrollment'];
  for(const m of methods)raw[m]=async(id,...args)=>{calls.push([m,id,...args]);return true;};
  const scoped=localIdentity(raw,f.bindings);
  for(const m of methods)await scoped[m](f.ldap[0].localId,'synthetic-argument');
  assert.ok(calls.every(c=>c[1]===f.ldap[0].id));assert.equal(calls.length,methods.length);
});
scenario('entryUUID mismatch blocks remote actions before any write',async f=>{
  let writes=0;const scoped=localIdentity({directoryUser:async()=>({...f.ldap[0],entryUuid:'wrong'}),remediate:async()=>{writes++;}},f.bindings);
  await assert.rejects(scoped.remediate(f.ldap[0].localId,'revoke'),{code:'IDENTITY_LINK_UNVERIFIED'});assert.equal(writes,0);
});
test('schema is explicit; existing local-only databases require no migration',()=>{
  const store=openStore(':memory:');try{
    store.run("INSERT INTO staff(id,username,name,team,role) VALUES('local','local','Local','A','admin')");
    const bindings=createIdentityBindings({store,issuer:ISSUER});assert.equal(bindings.subject('local'),'local');
    assert.equal(store.one("SELECT name FROM sqlite_schema WHERE name='staff_identity_bindings'"),undefined);
    installSchema(store.db);assert.equal(store.one('SELECT COUNT(*) n FROM staff_identity_bindings').n,0);
  }finally{store.db.close();}
});
scenario('latest remote login resolves by interval without rewriting stored user ID',f=>{
  const u=f.ldap[0];f.store.run("INSERT INTO identity_events(id,time,type,user_id,username) VALUES('login','2026-11-18T00:00:00Z','LOGIN',?,'Fixture')",u.id);
  assert.equal(f.bindings.lastLogin(u.localId),'2026-11-18T00:00:00Z');
  assert.equal(f.store.one('SELECT user_id FROM identity_events').user_id,u.id);
});
test('partial binding schema fails closed instead of using direct LDAP IDs',()=>{
  const store=openStore(':memory:');try{
    store.db.exec('CREATE TABLE identity_link_batches(id TEXT)');
    assert.throws(()=>createIdentityBindings({store,issuer:ISSUER}),{code:'IDENTITY_LINK_SCHEMA_INVALID'});
  }finally{store.db.close();}
});
scenario('same-subject binding cannot point to a different local profile',f=>{
  f.store.run("INSERT INTO staff(id,username,name,team,role) VALUES(?,'collision','Fixture','A','employee')",f.ldap[0].id);
  assert.throws(()=>f.bindings.resolve(f.ldap[0].id),{code:'IDENTITY_LINK_CONFLICT'});
});
test('account and session caches are issuer-scoped; invalidation clears only intended account',async()=>{
  const {accountChecker,sessionChecker}=require('./auth');let accounts=0,sessions=0;
  const raw={userSecurity:async()=>{accounts++;return {enabled:true};},sessionActive:async()=>{sessions++;return true;}};
  const account=accountChecker(raw),session=sessionChecker(raw);
  await account('same','issuer-a');await account('same','issuer-b');await account('same','issuer-a');assert.equal(accounts,2);
  account.invalidate('same','issuer-a');await account('same','issuer-a');assert.equal(accounts,3);
  await session({iss:'issuer-a',sub:'same',sid:'same'});await session({iss:'issuer-b',sub:'same',sid:'same'});assert.equal(sessions,2);
});
