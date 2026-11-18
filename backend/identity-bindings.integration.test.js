const {test}=require('node:test'),assert=require('node:assert/strict');
const {openStore}=require('./store'),{createApp}=require('./app');
const {createVerifier,accountChecker,sessionChecker}=require('./auth');
const {fixture,ISSUER,PROVIDER}=require('../tests/fixtures/identity-binding-fixture.cjs');
let keys;
async function setup(){
  const jose=await import('jose');keys ||= await jose.generateKeyPair('RS256');
  const store=openStore(':memory:'),data=fixture(store),calls=[],clock=new Date(),security={enabled:true,required:true,configured:true,requiredActions:[]};
  let sessionActive=true,offline=false;
  const identity={
    async ready(){return true;},async policy(){return {};},async events(){return [];},async adminEvents(){return [];},
    async directoryProvider(){return {enabled:true,editMode:'READ_ONLY',cachePolicy:'NO_CACHE'};},
    async directoryUser(id){calls.push(['directoryUser',id]);if(offline)throw Error('Synthetic outage');return structuredClone(data.ldap.find(u=>u.id===id));},
    async directoryUsers(){return {users:data.ldap.map(u=>({id:u.id})),complete:true};},
    async syncDirectory(){calls.push(['syncDirectory']);return {updated:4,failed:0};},
    async userSecurity(id){calls.push(['userSecurity',id]);return {...security,enabled:security.enabled&&(data.ldap.find(u=>u.id===id)?.enabled??true),requiredActions:[...security.requiredActions]};},
    async sessionActive(id,sid){calls.push(['sessionActive',id,sid]);return sessionActive;},
    async sessions(id){calls.push(['sessions',id]);return [{id:'session-fixture',clients:['employee-portal']}];},
    async endSession(id,sid){calls.push(['endSession',id,sid]);},
    async remediate(id,action){calls.push(['remediate',id,action]);const u=data.ldap.find(u=>u.id===id);if(u&&['disable','enable'].includes(action))u.enabled=action==='enable';},
    async recoverMfa(id){calls.push(['recoverMfa',id]);},
    async inspectUser(id){calls.push(['inspectUser',id]);const u=data.ldap.find(u=>u.id===id);return {...u,roles:[u.role],security:{...security},identitySource:'ldap'};},
  };
  const app=createApp({store,identity,issuer:ISSUER,verify:await createVerifier({issuer:ISSUER,jwks:keys.publicKey}),
    checkAccount:accountChecker(identity,{ttl:0}),checkSession:sessionChecker(identity,{ttl:0}),
    directoryOptions:{providerId:PROVIDER},now:()=>clock,rateLimit:10000});
  const server=await new Promise(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  const base='http://127.0.0.1:'+server.address().port;
  async function request(subject,path='/api/profile',{method='GET',body,role,azp='employee-portal',claims={},issuer=ISSUER,audience}={}){
    const u=data.ldap.find(u=>u.id===subject||u.localId===subject)||data.locals.find(u=>u.id===subject);
    const token=await new jose.SignJWT({azp,sid:'session-fixture',realm_access:{roles:role?[role]:[u?.role||'employee']},auth_time:Math.floor(clock.getTime()/1000),...claims})
      .setProtectedHeader({alg:'RS256'}).setIssuer(issuer).setAudience(audience|| (azp==='security-dashboard'?'security-api':'employee-api')).setSubject(subject).setIssuedAt(Math.floor(clock.getTime()/1000)).setExpirationTime(Math.floor(Date.now()/1000)+300).sign(keys.privateKey);
    const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
    return {status:r.status,body:await r.json()};
  }
  return {store,...data,calls,identity,security,app,request,clock,setOffline:v=>{offline=v;},setSession:v=>{sessionActive=v;},
    close:async()=>{await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,fn){test(name,async()=>{const f=await setup();try{await fn(f);}finally{await f.close();}});}
scenario('RS256 JWT for all four linked LDAP accounts resolves unchanged profile/role and remote MFA/session',async f=>{
  for(const u of f.ldap){const r=await f.request(u.id);assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(r.body.id,u.localId);assert.equal(r.body.role,u.role);}
  assert.ok(f.calls.filter(c=>['userSecurity','sessionActive'].includes(c[0])).every(c=>c[1].startsWith('ldap-new-')));
  assert.ok(f.store.all("SELECT * FROM staff WHERE identity_source='ldap'").every(u=>u.id.startsWith('ldap-old-')&&u.directory_provider_id==='fixture-provider-old'));
});
scenario('eight local accounts and existing roles remain compatible with real verifier',async f=>{
  for(const u of f.locals){const r=await f.request(u.id);assert.equal(r.status,200);assert.equal(r.body.id,u.id);assert.equal(r.body.role,u.role);}
});
scenario('thirteen disabled profiles remain blocked and unchanged',async f=>{
  const before=f.store.all('SELECT * FROM staff WHERE disabled=1 ORDER BY id');assert.equal(before.length,13);
  for(const u of before)assert.equal((await f.request(u.id)).body.code,'ACCOUNT_DISABLED');
  assert.deepEqual(f.store.all('SELECT * FROM staff WHERE disabled=1 ORDER BY id'),before);
});
scenario('retired UUID, missing binding and unknown principal cannot provision profiles',async f=>{
  const n=f.store.one('SELECT COUNT(*) n FROM staff').n;
  assert.equal((await f.request(f.ldap[0].localId)).body.code,'IDENTITY_LINK_UNVERIFIED');
  f.store.run('DELETE FROM staff_identity_bindings WHERE subject=?',f.ldap[0].id);
  assert.equal((await f.request(f.ldap[0].id)).body.code,'UNREGISTERED');
  assert.equal(f.store.one('SELECT COUNT(*) n FROM staff').n,n);
  assert.ok(!f.calls.some(c=>c[0]==='syncDirectory'));
});
scenario('issuer, audience and role checks remain enforced',async f=>{
  for(const opt of [{issuer:'https://other.invalid'},{audience:'invalid-audience'}])assert.equal((await f.request(f.ldap[0].id,'/api/profile',opt)).status,401);
  assert.equal((await f.request(f.ldap[0].id,'/api/profile',{role:'admin'})).body.code,'INSUFFICIENT_ROLE');
  assert.equal((await f.request(f.ldap[0].id,'/api/profile',{claims:{realm_access:{roles:['employee','admin']}}})).body.code,'DIRECTORY_ACCESS_CHANGED');
});
scenario('Web B role and audience/client scope boundaries remain enforced',async f=>{
  assert.equal((await f.request(f.ldap[0].id,'/api/profile',{azp:'security-dashboard'})).body.code,'DASHBOARD_ACCESS_DENIED');
  assert.equal((await f.request(f.ldap[3].id,'/api/profile',{azp:'security-dashboard'})).status,200);
  assert.equal((await f.request(f.ldap[3].id,'/api/attendance',{azp:'security-dashboard'})).body.code,'CLIENT_SCOPE_DENIED');
});
scenario('MFA pending and required actions fail closed for linked subject',async f=>{
  f.security.configured=false;assert.equal((await f.request(f.ldap[0].id)).body.code,'MFA_SETUP_REQUIRED');
  f.security.configured=true;f.security.requiredActions=['CONFIGURE_TOTP'];assert.equal((await f.request(f.ldap[0].id)).body.code,'REQUIRED_ACTION_PENDING');
});
scenario('disabled local profile, lifecycle hold and revoked token stay blocked',async f=>{
  const u=f.ldap[0];f.store.run('UPDATE staff SET disabled=1 WHERE id=?',u.localId);assert.equal((await f.request(u.id)).body.code,'ACCOUNT_DISABLED');
  f.store.run("UPDATE staff SET disabled=0,governance_state='left' WHERE id=?",u.localId);assert.equal((await f.request(u.id)).body.code,'GOVERNANCE_HOLD');
  f.store.run("UPDATE staff SET governance_state='active',revoked_before=? WHERE id=?",Math.floor(f.clock.getTime()/1000),u.localId);assert.equal((await f.request(u.id)).body.code,'SESSION_REVOKED');
});
scenario('ended session and Keycloak outage do not authorize',async f=>{
  f.setSession(false);assert.equal((await f.request(f.ldap[0].id)).body.code,'SSO_SESSION_ENDED');
  f.setOffline(true);assert.equal((await f.request(f.ldap[1].id)).status,503);
});
scenario('missing or changed LDAP entryUUID cannot use a previously verified link',async f=>{
  f.ldap[0].entryUuid=null;const r=await f.request(f.ldap[0].id);assert.equal(r.status,403);assert.equal(r.body.code,'DIRECTORY_CONFLICT');
  assert.ok(!f.calls.some(c=>c[0]==='userSecurity'));
});
scenario('attendance and notification ownership stays on stable local ID',async f=>{
  const u=f.ldap[0];f.store.run("INSERT INTO notifications(id,user_id,title,body,section,created_at) VALUES('old-notice',?,'Fixture','Fixture','profile',?)",u.localId,f.clock.toISOString());
  const r=await f.request(u.id,'/api/attendance/check-in',{method:'POST',body:{}});assert.equal(r.status,201,JSON.stringify(r.body));
  assert.equal(f.store.one('SELECT user_id FROM attendance').user_id,u.localId);
  assert.equal((await f.request(u.id,'/api/attendance?userId='+f.ldap[1].localId)).body.code,'NOT_OWNER');
  const notices=await f.request(u.id,'/api/notifications');assert.equal(notices.status,200);assert.ok(JSON.stringify(notices.body).includes('old-notice'));
});
scenario('session read/revoke and admin security address remote subject, audit targets remain local',async f=>{
  const u=f.ldap[0];assert.equal((await f.request(u.id,'/api/me/sessions')).status,200);
  assert.equal((await f.request('local-0','/api/admin/users/'+u.localId+'/sessions')).status,200);
  assert.equal((await f.request('local-0','/api/admin/users/'+u.localId+'/security')).status,200);
  const ended=await f.request('local-0','/api/admin/users/'+u.localId+'/sessions/revoke',{method:'POST',body:{sessionId:'session-fixture',note:'Synthetic authorized reason'}});
  assert.equal(ended.status,200,JSON.stringify(ended.body));assert.ok(f.calls.some(c=>c[0]==='endSession'&&c[1]===u.id));
});
scenario('admin containment action changes local profile and targets correct remote identity',async f=>{
  const u=f.ldap[0];const r=await f.request('local-0','/api/admin/users/'+u.localId+'/actions',{method:'POST',body:{action:'disable',note:'Synthetic authorized reason'}});
  assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(f.calls.some(c=>c[0]==='remediate'&&c[1]===u.id&&c[2]==='disable'));
  assert.equal(f.store.one('SELECT target_id FROM actions').target_id,u.localId);assert.equal(f.store.one('SELECT disabled FROM staff WHERE id=?',u.localId).disabled,1);
});
scenario('admin MFA recovery addresses remote subject without changing local UUID',async f=>{
  const u=f.ldap[0];const r=await f.request('local-0','/api/admin/users/'+u.localId+'/mfa/recovery',{method:'POST',body:{note:'Synthetic authorized recovery',verification:'Fixture identity proof reviewed'}});
  assert.equal(r.status,200,JSON.stringify(r.body));assert.ok(f.calls.some(c=>c[0]==='recoverMfa'&&c[1]===u.id));
  assert.equal(f.store.one('SELECT target_id FROM actions').target_id,u.localId);
});
scenario('binding changed during account security await cannot admit request',async f=>{
  const original=f.identity.userSecurity;
  f.identity.userSecurity=async id=>{const r=await original(id);f.store.run("UPDATE staff_identity_bindings SET entry_uuid='different' WHERE subject=?",id);return r;};
  assert.notEqual((await f.request(f.ldap[0].id)).status,200);
});
scenario('full fake LDAP sync keeps four identities, does not flag them missing, preserves old audit payloads',async f=>{
  const u=f.ldap[0],time=f.clock.toISOString();
  f.store.db.exec('CREATE TABLE staff_id_reconciliations(old_id TEXT PRIMARY KEY,new_id TEXT NOT NULL UNIQUE REFERENCES staff(id),username TEXT NOT NULL UNIQUE,role TEXT NOT NULL,reconciled_at TEXT NOT NULL,batch_id TEXT NOT NULL,reason TEXT NOT NULL)');
  for(let i=1;i<=7;i++)f.store.run('INSERT INTO staff_id_reconciliations VALUES(?,?,?,?,?,?,?)','previous-'+i,'local-'+i,'local-'+i,f.locals[i].role,time,'completed-fixture','Preserved prior migration');
  f.store.run('INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES(?,?,?,?,?)','old-attendance',u.localId,'2026-01-01',time,time);
  f.store.run('INSERT INTO corrections(id,user_id,day,check_in,check_out,reason,created_at,reviewer_id) VALUES(?,?,?,?,?,?,?,?)','old-correction',u.localId,'2026-01-02',time,time,'Fixture old request',time,f.ldap[2].localId);
  f.store.run("INSERT INTO notifications(id,user_id,title,body,section,created_at) VALUES('old-personal',?,'Fixture','Fixture','profile',?)",u.localId,time);
  f.store.run("INSERT INTO notification_reads VALUES('old-personal',?,?)",u.localId,time);
  f.store.run("INSERT INTO directory_maintenance VALUES(?,'released','Fixture',?,?)",u.localId,time,time);
  f.store.run("INSERT INTO access_requests(id,user_id,resource,team,days,note,created_at) VALUES('old-grant',?,'audit-report','Team A',1,'Fixture',?)",u.localId,time);
  f.store.event({requestId:'history-fixture',staff:{id:u.localId,username:u.username},method:'GET',path:'/api/profile'},200,'AUTHORIZED');
  f.store.run("INSERT INTO identity_events(id,time,type,user_id,username) VALUES('old-identity',?,'LOGIN',?,?)",time,u.localId,u.username);
  const alert=f.store.alert({actorId:u.localId,username:u.username,kind:'Synthetic history',time,evidence:{source:'identity_events',id:'old-identity'}});
  f.store.run('INSERT INTO alert_history VALUES(?,?,?,?,?,?,?,?,?,?)','old-history',alert,1,'local-0','Fixture Admin','history-request',time,'reviewing','Fixture',JSON.stringify({actor:u.localId}));
  const tables=['attendance','corrections','notification_reads','directory_maintenance','access_requests','staff_id_reconciliations','identity_events','alerts','alert_evidence','alert_history','notifications'];
  const preserved=Object.fromEntries(tables.map(t=>[t,f.store.all('SELECT * FROM '+t)]));
  const before=f.store.all('SELECT * FROM audit_outbox'),staff=f.store.all('SELECT id,directory_provider_id FROM staff ORDER BY id');
  assert.ok(before.length>=2);
  const directory=f.app.locals.directory,job=directory.queue();let completed;
  for(let i=0;i<1000;i++){await new Promise(r=>setImmediate(r));completed=f.store.one('SELECT * FROM directory_sync_jobs WHERE id=?',job.id);if(!['pending','running'].includes(completed.state))break;}
  assert.equal(completed.state,'synced');assert.equal(completed.error_count,0);assert.equal(completed.blocked,0);assert.equal(completed.imported,0);
  assert.equal(directory.state().users.total,4);assert.deepEqual(f.store.all('SELECT id,directory_provider_id FROM staff ORDER BY id'),staff);
  for(const row of before)assert.deepEqual(f.store.one('SELECT * FROM audit_outbox WHERE seq=?',row.seq),row);
  for(const t of tables)assert.deepEqual(f.store.all('SELECT * FROM '+t),preserved[t],t);
  assert.deepEqual(f.store.all('PRAGMA foreign_key_check'),[]);
  assert.ok(!f.calls.some(c=>c[0]==='remediate'));
  const list=await f.request('local-0','/api/security/directory/users');assert.equal(list.body.total,4);assert.ok(list.body.items.every(u=>u.id.startsWith('ldap-old-')&&u.currentProvider===PROVIDER));
});
scenario('maintenance hold is looked up by local ID and cannot be bypassed with remote subject',async f=>{
  f.store.run("INSERT INTO directory_maintenance VALUES(?,'writing','Fixture',?,NULL)",f.ldap[0].localId,f.clock.toISOString());
  const r=await f.request(f.ldap[0].id);assert.equal(r.status,503);assert.equal(r.body.code,'DIRECTORY_UNAVAILABLE');
});
scenario('source disabled and conflicting group memberships still deny access',async f=>{
  f.ldap[0].sourceStatus='disabled';assert.equal((await f.request(f.ldap[0].id)).body.code,'DIRECTORY_ACCESS_CHANGED');
  f.ldap[1].groups.push({path:'/directory/managers',roles:['manager']});assert.equal((await f.request(f.ldap[1].id)).body.code,'DIRECTORY_ACCESS_CHANGED');
  assert.ok(f.calls.filter(c=>c[0]==='remediate').every(c=>c[1].startsWith('ldap-new-')));
});
scenario('Keycloak disable is enforced separately; verified admin enable still requires active LDAP source',async f=>{
  const u=f.ldap[0];u.enabled=false;
  assert.equal((await f.request(u.id)).body.code,'ACCOUNT_DISABLED');
  const path='/api/admin/users/'+u.localId+'/actions';
  const r=await f.request('local-0',path,{method:'POST',body:{action:'enable',note:'Synthetic approved enable'}});
  assert.equal(r.status,200,JSON.stringify(r.body));assert.equal(u.enabled,true);
  f.ldap[1].sourceStatus='disabled';
  assert.equal((await f.request('local-0','/api/admin/users/'+f.ldap[1].localId+'/actions',{method:'POST',body:{action:'enable',note:'Synthetic denied enable'}})).body.code,'DIRECTORY_CONFLICT');
});
scenario('LDAP profile and password remain read-only even for admin',async f=>{
  const path='/api/admin/users/'+f.ldap[0].localId;
  const r=await f.request('local-0',path,{method:'PATCH',body:{name:'Synthetic User',team:'Team A',role:'employee',email:'fixture@example.test',note:'Synthetic requested change'}});
  assert.equal(r.body.code,'DIRECTORY_READ_ONLY');
  const reset=await f.request('local-0',path+'/reset-password',{method:'POST',body:{password:'SyntheticOnly123!',note:'Synthetic requested change'}});
  assert.equal(reset.body.code,'DIRECTORY_READ_ONLY');
});
scenario('reconciliation retry version includes binding proof',async f=>{
  const u=f.ldap[0],path='/api/admin/users/'+u.localId;
  f.store.run("INSERT INTO actions(id,actor_id,target_id,action,note,time,state) VALUES('partial-action','local-0',?,'revoke','Fixture',?,'partial')",u.localId,f.clock.toISOString());
  const before=await f.request('local-0',path+'/reconciliation');assert.equal(before.status,200);
  assert.equal(before.body.local.id,u.localId);assert.equal(before.body.remote.id,u.id);
  f.store.run('UPDATE identity_link_batches SET manifest_hash=?','a'.repeat(64));
  const r=await f.request('local-0',path+'/actions/partial-action/retry',{method:'POST',body:{version:before.body.version,note:'Synthetic approved retry'}});
  assert.equal(r.body.code,'RECONCILIATION_CHANGED');assert.ok(!f.calls.some(c=>c[0]==='remediate'));
});
scenario('remote action outage retains local containment and partial audit',async f=>{
  f.identity.remediate=async()=>{throw Error('Synthetic outage');};const u=f.ldap[0];
  const r=await f.request('local-0','/api/admin/users/'+u.localId+'/actions',{method:'POST',body:{action:'disable',note:'Synthetic safe containment'}});
  assert.equal(r.status,202);assert.equal(f.store.one('SELECT disabled FROM staff WHERE id=?',u.localId).disabled,1);
  assert.equal(f.store.one('SELECT state FROM actions').state,'partial');assert.equal(f.store.one('SELECT target_id FROM actions').target_id,u.localId);
});
scenario('governance observed and execute compare bound remote ID while target remains local',async f=>{
  const u=f.ldap[0],desired={name:u.name,email:u.email,team:u.team,role:u.role};
  f.identity.userByUsername=async()=>({id:u.id,providerId:PROVIDER});f.identity.sessions=async id=>{f.calls.push(['sessions',id]);return [];};
  f.store.run("INSERT INTO lifecycle_workflows(id,kind,source,target_id,username,desired_json,creator_id,note,approval,state,attempts,source_done,created_at,updated_at) VALUES('linked-workflow','change','ldap',?,?,?,'local-0','Fixture','approved','partial',1,1,?,?)",u.localId,u.username,JSON.stringify(desired),f.clock.toISOString(),f.clock.toISOString());
  const path='/api/security/governance/workflows/linked-workflow';
  const observed=await f.request('local-0',path+'/observed');assert.equal(observed.status,200,JSON.stringify(observed.body));assert.equal(observed.body.local.id,u.localId);assert.equal(observed.body.remote.id,u.id);
  const r=await f.request('local-0',path+'/execute',{method:'POST',body:{version:1,note:'Synthetic approved reconciliation'}});assert.equal(r.status,202,JSON.stringify(r.body));
  let row;for(let i=0;i<1000;i++){await new Promise(r=>setImmediate(r));row=f.store.one("SELECT * FROM lifecycle_workflows WHERE id='linked-workflow'");if(row.state!=='running')break;}
  assert.equal(row.state,'synced',row.message);assert.equal(row.target_id,u.localId);
  assert.ok(f.calls.filter(c=>['inspectUser','remediate','sessions'].includes(c[0])).every(c=>c[1]===u.id));
});
scenario('manager owner/team/self-approval checks use stable local ID',async f=>{
  const day=new Date(f.clock.getTime()-86400000).toISOString().slice(0,10);
  const draft={day,checkIn:'08:00',checkOut:'17:00',reason:'Synthetic attendance correction'};
  const employee=f.ldap[0],manager=f.ldap[2];
  assert.equal((await f.request(employee.id,'/api/corrections',{method:'POST',body:draft})).status,201);
  const id=f.store.one('SELECT id FROM corrections WHERE user_id=?',employee.localId).id;
  const decision={decision:'approved',note:'Synthetic verified attendance'};
  assert.equal((await f.request(manager.id,'/api/corrections/'+id,{method:'PATCH',body:decision})).status,200);
  assert.equal(f.store.one('SELECT reviewer_id FROM corrections WHERE id=?',id).reviewer_id,manager.localId);
  await f.request(manager.id,'/api/corrections',{method:'POST',body:draft});
  const own=f.store.one('SELECT id FROM corrections WHERE user_id=?',manager.localId).id;
  assert.equal((await f.request(manager.id,'/api/corrections/'+own,{method:'PATCH',body:decision})).body.code,'SELF_APPROVAL');
  f.ldap[1].team='Team B';f.store.run('UPDATE staff SET team=? WHERE id=?','Team B',f.ldap[1].localId);
  await f.request(f.ldap[1].id,'/api/corrections',{method:'POST',body:draft});
  const other=f.store.one('SELECT id FROM corrections WHERE user_id=?',f.ldap[1].localId).id;
  assert.equal((await f.request(manager.id,'/api/corrections/'+other,{method:'PATCH',body:decision})).body.code,'CROSS_TEAM');
});
