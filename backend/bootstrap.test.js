const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {randomUUID}=require('node:crypto');
const {preflight,openVerifiedStore,readLocal}=require('./bootstrap');
const {keycloakAdmin}=require('./keycloak-admin');
const {openStore}=require('./store');
const demo=require('../keycloak/lab-config.json').users;
const {installSchema}=require('./identity-bindings');
function fixture(){
  const dir=path.join(process.env.IAM_TEST_ROOT,'bootstrap-'+randomUUID());fs.mkdirSync(dir);
  const staffFile=path.join(dir,'staff.json'),databasePath=path.join(dir,'attendance.sqlite');
  const seed=process.env.IAM_BOOTSTRAP_SEED?JSON.parse(fs.readFileSync(process.env.IAM_BOOTSTRAP_SEED,'utf8')):demo.map(u=>({...u,id:randomUUID()}));
  fs.writeFileSync(staffFile,JSON.stringify(seed));
  const calls=[];
  const identity={async bootstrapIdentity(name){calls.push(name);const s=seed.find(u=>u.username===name);return {...s,enabled:true,federated:false,roles:[s.role]};}};
  return{staffFile,databasePath,seed,identity,calls};
}
test('bootstrap refuses identity recovery marker without opening writable storage',()=>{
  const f=fixture();fs.writeFileSync(f.databasePath+'.identity-links-pending.json','{}');
  assert.throws(()=>readLocal(f.databasePath,f.staffFile),/BOOTSTRAP_RECOVERY_REQUIRED/);
  assert.equal(fs.existsSync(f.databasePath),false);
});
test('bootstrap signature includes identity batches and detects changed approval before opening store',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));installSchema(store.db);store.db.close();
  const approved=await preflight(f),db=new (require('node:sqlite').DatabaseSync)(f.databasePath);
  db.prepare('INSERT INTO identity_link_batches VALUES(?,?,?,?,?)').run('fixture-batch','a'.repeat(64),'b'.repeat(64),'2026-11-18T00:00:00Z','fixture-proof');db.close();
  assert.throws(()=>openVerifiedStore(approved),/BOOTSTRAP_LOCAL_CHANGED/);
});
test('bootstrap rejects incomplete binding schema before writing or remote checks',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));store.db.exec('CREATE TABLE identity_link_batches(id TEXT)');store.db.close();f.calls.length=0;
  await assert.rejects(preflight(f),/BOOTSTRAP_DATABASE_INVALID/);assert.equal(f.calls.length,0);
});
test('fresh seed is verified before creation; rerun preserves all business/security state',async()=>{
  const f=fixture(),p=await preflight(f);assert.equal(fs.existsSync(f.databasePath),false);assert.equal(f.calls.length,6);
  const store=openVerifiedStore(p);assert.equal(store.one('SELECT COUNT(*) AS n FROM staff').n,6);
  const id=f.seed.find(s=>s.username==='employee01').id;
  store.run("UPDATE staff SET team='Changed',role='manager',mfa_required=1,revoked_before=123 WHERE id=?",id);
  store.run("INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES('row',?,'2026-11-12','2026-11-12T01:00:00Z','2026-11-12T01:00:00Z')",id);
  const before=store.all('SELECT * FROM staff ORDER BY id');store.db.close();
  const next=openVerifiedStore(await preflight(f));assert.deepEqual(next.all('SELECT * FROM staff ORDER BY id'),before);
  assert.equal(next.one('SELECT user_id FROM attendance').user_id,id);next.db.close();
});
test('missing seed on fresh machine fails without creating DB',async()=>{
  const f=fixture();fs.unlinkSync(f.staffFile);await assert.rejects(preflight(f),/BOOTSTRAP_SEED_REQUIRED/);assert.equal(fs.existsSync(f.databasePath),false);
});
test('failure during initial inserts rolls back the entire staff batch',async()=>{
  const f=fixture(),empty=openStore(f.databasePath);
  empty.db.exec("CREATE TRIGGER fixture_failure BEFORE INSERT ON staff WHEN NEW.username='employee01' BEGIN SELECT RAISE(ABORT,'synthetic failure'); END");empty.db.close();
  const p=await preflight(f);assert.throws(()=>openVerifiedStore(p),/synthetic failure/);
  const {DatabaseSync}=require('node:sqlite'),db=new DatabaseSync(f.databasePath,{readOnly:true});
  try{assert.equal(db.prepare('SELECT COUNT(*) AS n FROM staff').get().n,0);assert.equal(db.prepare('PRAGMA foreign_key_check').all().length,0);}finally{db.close();}
});
test('foreign-machine seed ID mismatch does not create database',async()=>{
  const f=fixture();f.identity.bootstrapIdentity=async username=>({id:randomUUID(),username,federated:false});
  await assert.rejects(preflight(f),/BOOTSTRAP_KEYCLOAK_ID_MISMATCH/);assert.equal(fs.existsSync(f.databasePath),false);
});
test('all identities must verify; failure on sixth leaves no partial profiles',async()=>{
  const f=fixture(),original=f.identity.bootstrapIdentity;let calls=0;
  f.identity.bootstrapIdentity=async name=>{if(++calls===6)throw Error('unavailable');return original(name);};
  await assert.rejects(preflight(f),/BOOTSTRAP_IDENTITY_UNAVAILABLE/);assert.equal(fs.existsSync(f.databasePath),false);
});
for(const [name,override,code] of [['LDAP',{federated:true},'KEYCLOAK_ID_MISMATCH'],['wrong role',{roles:['wrong']},'ROLE_MISMATCH'],['disabled',{enabled:false},'ROLE_MISMATCH'],['wrong username',{username:'another'},'KEYCLOAK_ID_MISMATCH']]){
  test('fresh startup rejects '+name,async()=>{const f=fixture(),original=f.identity.bootstrapIdentity;f.identity.bootstrapIdentity=async n=>({...await original(n),...override});await assert.rejects(preflight(f),new RegExp(code));assert.equal(fs.existsSync(f.databasePath),false);});
}
test('incomplete/duplicate seed fails before any Keycloak request',async()=>{
  for(const kind of ['partial','id','username','source']){
    const f=fixture(),s=structuredClone(f.seed);
    if(kind==='partial')s.pop();if(kind==='id')s[1].id=s[0].id;if(kind==='username')s[1]=s[0];if(kind==='source')s[0].identity_source='ldap';
    fs.writeFileSync(f.staffFile,JSON.stringify(s));await assert.rejects(preflight(f),/SEED_INVALID/);assert.equal(f.calls.length,0);
  }
});
test('existing SQLite and stale seed mismatch stops without altering any DB bytes',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));store.db.close();
  const before=fs.readFileSync(f.databasePath);f.seed[0].id=randomUUID();fs.writeFileSync(f.staffFile,JSON.stringify(f.seed));
  f.calls.length=0;await assert.rejects(preflight(f),/LOCAL_ID_MISMATCH/);assert.equal(f.calls.length,0);assert.deepEqual(fs.readFileSync(f.databasePath),before);
});
test('existing SQLite copied with matching stale seed still fails remote check; pending actions untouched',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));
  store.run("INSERT INTO actions(id,actor_id,target_id,action,note,time,state) VALUES('pending',?,?,'revoke','Synthetic','2026-11-12','pending')",f.seed[0].id,f.seed[1].id);store.db.close();
  const bytes=fs.readFileSync(f.databasePath);f.identity.bootstrapIdentity=async username=>({id:randomUUID(),username,federated:false});
  await assert.rejects(preflight(f),/KEYCLOAK_ID_MISMATCH/);assert.deepEqual(fs.readFileSync(f.databasePath),bytes);
});
test('seed-less existing database is verified and never reseeded',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));store.db.close();fs.unlinkSync(f.staffFile);
  const p=await preflight(f);assert.equal(p.fresh,false);const again=openVerifiedStore(p);assert.equal(again.one('SELECT COUNT(*) AS n FROM staff').n,6);again.db.close();
});
test('reconciliation interruption blocks startup without network',async()=>{
  const f=fixture();fs.writeFileSync(f.staffFile+'.reconcile-pending.json','{}');await assert.rejects(preflight(f),/RECOVERY_REQUIRED/);assert.equal(f.calls.length,0);
});
test('changing seed after check and two startup attempts are rejected',async()=>{
  const f=fixture(),p=await preflight(f);fs.appendFileSync(f.staffFile,' ');assert.throws(()=>openVerifiedStore(p),/LOCAL_CHANGED/);
  const a=await preflight(f),b=await preflight(f);const store=openVerifiedStore(a);store.db.close();assert.throws(()=>openVerifiedStore(b),/LOCAL_CHANGED/);
});
test('existing governance holds and disabled profiles are not auto-enabled or re-provisioned',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));store.run("UPDATE staff SET disabled=1,governance_state='left'");store.db.close();
  f.calls.length=0;const p=await preflight(f);assert.equal(f.calls.length,0);const again=openVerifiedStore(p);assert.equal(again.one('SELECT SUM(disabled) AS n FROM staff').n,6);again.db.close();
});
test('orphaned business records block fresh bootstrap',async()=>{
  const f=fixture(),store=openStore(f.databasePath);store.run("INSERT INTO events(request_id,time,username,method,path,status,decision,reason) VALUES('r','2026-11-12','anonymous','GET','/api/profile',403,'DENY','UNREGISTERED')");store.db.close();
  await assert.rejects(preflight(f),/ORPHAN_DATA/);assert.equal(f.calls.length,0);
});
test('actual Keycloak adapter only reads unique users and effective roles; duplicate/LDAP observed safely',async()=>{
  const http=require('node:http'),requests=[];let duplicate=false,ldap=false;
  const server=http.createServer((req,res)=>{requests.push([req.method,req.url]);res.setHeader('content-type','application/json');
    if(req.url.endsWith('/token'))return res.end(JSON.stringify({access_token:'synthetic',expires_in:60}));
    if(req.url.includes('/users?'))return res.end(JSON.stringify(Array(duplicate?2:1).fill({id:'fake-id',username:'employee01',enabled:true,attributes:ldap?{LDAP_ID:['fake']}: {}})));
    if(req.url.endsWith('/composite'))return res.end(JSON.stringify([{name:'employee'},{name:'offline_access'}]));res.statusCode=404;res.end('{}');});
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  try{
    const api=keycloakAdmin({issuer:'http://127.0.0.1:'+server.address().port+'/realms/company-iam',clientId:'fixture',clientSecret:'synthetic'});
    assert.deepEqual(await api.bootstrapIdentity('employee01'),{id:'fake-id',username:'employee01',enabled:true,federated:false,roles:['employee']});
    ldap=true;assert.equal((await api.bootstrapIdentity('employee01')).federated,true);duplicate=true;await assert.rejects(api.bootstrapIdentity('employee01'));
    assert.ok(requests.every(([method,url])=>method==='GET'||(method==='POST'&&url.endsWith('/token'))));
  }finally{await new Promise(r=>server.close(r));}
});
test('new-machine pipeline recognizes all six signed JWT subjects without auth fallback',async()=>{
  const f=fixture(),store=openVerifiedStore(await preflight(f));
  const j=await import('jose'),keys=await j.generateKeyPair('RS256'),issuer='https://fixture.invalid/realms/company-iam';
  const {createApp}=require('./app'),{createVerifier}=require('./auth');
  const app=createApp({store,origin:'http://localhost:5173',identity:{},verify:await createVerifier({issuer,jwks:keys.publicKey}),
    checkAccount:async()=>({enabled:true,required:false,configured:false,requiredActions:[]}),checkSession:async()=>true});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  async function request(s,extra={}){const now=Math.floor(Date.now()/1000);const token=await new j.SignJWT({sub:s.id,preferred_username:s.username,realm_access:{roles:[s.role]},iat:now,exp:now+120,iss:issuer,aud:'employee-api',azp:'employee-portal',sid:'fixture',...extra}).setProtectedHeader({alg:'RS256'}).sign(keys.privateKey);const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/profile',{headers:{Authorization:'Bearer '+token}});return{status:res.status,body:await res.json()};}
  try{
    for(const s of f.seed){const res=await request(s);assert.equal(res.status,200);assert.equal(res.body.id,s.id);assert.equal(res.body.username,s.username);assert.equal(res.body.role,s.role);}
    assert.equal((await request(f.seed[0],{sub:'foreign-id'})).body.code,'UNREGISTERED');
    const emp=f.seed.find(s=>s.role==='employee');assert.equal((await request(emp,{realm_access:{roles:['admin']}})).body.code,'INSUFFICIENT_ROLE');
    assert.equal((await request(emp,{azp:'security-dashboard',aud:'security-api'})).body.code,'DASHBOARD_ACCESS_DENIED');
  }finally{await new Promise(r=>server.close(r));store.db.close();}
});

test('production startup check uses service adapter and never opens/migrates SQLite',async()=>{
  const f=fixture(),http=require('node:http'),requests=[];let drift=false;
  const server=http.createServer((req,res)=>{
    requests.push([req.method,req.url]);res.setHeader('content-type','application/json');
    const url=new URL(req.url,'http://fixture');
    if(url.pathname.endsWith('/token'))return res.end(JSON.stringify({access_token:'synthetic',expires_in:60}));
    if(url.searchParams.has('username')){const u=f.seed.find(s=>s.username===url.searchParams.get('username'));return res.end(JSON.stringify([{...u,id:drift?'different-id':u.id,enabled:true}]));}
    if(url.pathname.endsWith('/composite')){const id=url.pathname.split('/')[5];const u=f.seed.find(s=>s.id===id);return res.end(JSON.stringify([{name:u?.role||'employee'}]));}
    res.statusCode=404;res.end('{}');
  });
  server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const issuer='http://127.0.0.1:'+server.address().port+'/realms/company-iam';
  const config={KEYCLOAK_ISSUER:issuer,KEYCLOAK_INTERNAL_ISSUER:issuer,API_AUDIENCE:'employee-api',FRONTEND_ORIGIN:'http://localhost:5173',KEYCLOAK_ADMIN_CLIENT_SECRET:'synthetic',ATTENDANCE_DB:f.databasePath,STAFF_FILE:f.staffFile};
  const previous=Object.fromEntries(Object.keys(config).map(k=>[k,process.env[k]]));Object.assign(process.env,config);
  try{
    const {start}=require('./server');await start({checkOnly:true});assert.equal(fs.existsSync(f.databasePath),false);
    drift=true;await assert.rejects(start({checkOnly:true}),/KEYCLOAK_ID_MISMATCH/);assert.equal(fs.existsSync(f.databasePath),false);
    assert.ok(requests.every(([method,url])=>method==='GET'||(method==='POST'&&url.endsWith('/token'))));
  }finally{for(const [k,v] of Object.entries(previous)){if(v===undefined)delete process.env[k];else process.env[k]=v;}await new Promise(r=>server.close(r));}
});
