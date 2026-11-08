const {test}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const {openStore}=require('./store');
const {createApp}=require('./app');
const {createIdentityCollector}=require('./identity-events');
const {createDirectory}=require('./directory');
const NOW=new Date('2026-11-08T03:00:00Z'),note='Approved isolated regression scenario';
async function fixture(options={}){
  const store=openStore(':memory:'),remote=new Map();
  for(const [id,role,team] of [['a','admin','Ops'],['e','employee','Alpha'],['x','employee','Beta'],['m','manager','Alpha'],['u','auditor','Ops']]){
    store.run('INSERT INTO staff(id,username,name,email,team,role) VALUES(?,?,?,?,?,?)',id,'test-'+id,'Demo '+id,id+'@example.test',team,role);
    remote.set(id,{id,name:'Demo '+id,email:id+'@example.test',roles:[role],enabled:true,security:{required:true}});
  }
  const identity={async ready(){if(options.offline)throw Error('offline');return true;},async events(){return [];},async adminEvents(){return [];},async sessions(){return [];},async policy(){return {};},
    async updateUser(id,p){Object.assign(remote.get(id),{name:p.name,email:p.email,roles:[p.role]});},
    async remediate(id,action){if(action==='disable')remote.get(id).enabled=false;if(action==='enable')remote.get(id).enabled=true;},
    async inspectUser(id){return remote.get(id);},async joinUser(p){remote.set('joined',{id:'joined',name:p.name,email:p.email,roles:[p.role],enabled:false,security:{required:true}});return {id:'joined'};}};
  const app=createApp({store,identity,now:()=>NOW,rateLimit:10000,verify:async t=>JSON.parse(Buffer.from(t,'base64url')),checkAccount:options.checkAccount});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  async function req(id,path,method='GET',body,claims={}){
    const user=store.one('SELECT * FROM staff WHERE id=?',id);
    const token=Buffer.from(JSON.stringify({sub:id,iat:NOW.getTime()/1000+2,auth_time:NOW.getTime()/1000,azp:'employee-portal',sid:'session',realm_access:{roles:[user?.role || 'employee']},...claims})).toString('base64url');
    const r=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  return {store,app,req,identity,async close(){await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,fn,options){test(name,async()=>{const f=await fixture(options);try{await fn(f);}finally{await f.close();}});}
async function requestGrant(f,user='e',resource='team-report'){const r=await f.req(user,'/api/me/access/requests','POST',{resource,days:2,note});assert.equal(r.status,201,JSON.stringify(r.body));return r.body.id;}
async function workflow(f,body){let r=await f.req('a','/api/security/governance/workflows','POST',{...body,note});assert.equal(r.status,201,JSON.stringify(r.body));let w=r.body.workflow;r=await f.req('a',`/api/security/governance/workflows/${w.id}/decision`,'POST',{decision:'approve',version:w.version,note});assert.equal(r.status,200);return r.body.workflow;}
async function execute(f,w,password){const r=await f.req('a',`/api/security/governance/workflows/${w.id}/execute`,'POST',{version:w.version,note,...(password?{password}:{})});assert.equal(r.status,202,JSON.stringify(r.body));for(let i=0;i<100;i++){await new Promise(r=>setTimeout(r,5));const row=f.store.one('SELECT * FROM lifecycle_workflows WHERE id=?',w.id);if(row.state!=='running')return row;}throw Error('Worker timed out');}

for(const [path,method,body] of [['/api/security/central/health','GET'],['/api/security/central/events','GET'],['/api/security/central/detection/status','GET'],['/api/security/governance','GET'],['/api/security/directory','GET'],['/api/security/central/detection/run','POST',{}]])scenario('SECURITY: employee denied '+path,async f=>assert.equal((await f.req('e',path,method,body)).status,403));
for(const path of ['settings','retry','retention','backfill','detection/run','detection/config','detection/evaluate'])scenario('SECURITY: auditor cannot mutate '+path,async f=>assert.equal((await f.req('u','/api/security/central/'+path,'POST',{})).status,403));
scenario('MFA: enrollment required fails closed',async f=>assert.equal((await f.req('e','/api/profile')).body.code,'MFA_SETUP_REQUIRED'),{checkAccount:async()=>({enabled:true,required:true,configured:false,requiredActions:[]})});
scenario('MFA: pending required action fails closed',async f=>assert.equal((await f.req('e','/api/profile')).body.code,'REQUIRED_ACTION_PENDING'),{checkAccount:async()=>({enabled:true,required:true,configured:true,requiredActions:['UPDATE_PASSWORD']})});
scenario('MFA: identity outage returns 503',async f=>assert.equal((await f.req('e','/api/profile')).status,503),{checkAccount:async()=>{throw Error('offline');}});
const recoveryAccount=async()=>({enabled:true,required:true,configured:true,requiredActions:[]});
scenario('MFA recovery: stale administrator authentication rejected',async f=>{
  const r=await f.req('a','/api/admin/users/e/mfa/recovery','POST',{note,verification:'QA verified identity reference'},{auth_time:NOW.getTime()/1000-121});
  assert.equal(r.status,401);assert.equal(r.body.code,'REAUTH_REQUIRED');
},{checkAccount:recoveryAccount});
scenario('MFA recovery: administrator must have configured OTP',async f=>{
  const r=await f.req('a','/api/admin/users/e/mfa/recovery','POST',{note,verification:'QA verified identity reference'});
  assert.equal(r.status,403);assert.equal(r.body.code,'MFA_REQUIRED_FOR_RECOVERY');
},{checkAccount:async()=>({enabled:true,required:false,configured:false,requiredActions:[]})});
scenario('MFA recovery: confirmed source update records mandatory enrollment and cutoff',async f=>{
  let recovered=null;f.identity.recoverMfa=async id=>{recovered=id;};
  const r=await f.req('a','/api/admin/users/e/mfa/recovery','POST',{note,verification:'QA verified identity reference'});
  assert.equal(r.status,200);assert.equal(recovered,'e');
  const u=f.store.one('SELECT * FROM staff WHERE id=?','e');assert.equal(u.mfa_required,1);assert.equal(u.revoked_before,NOW.getTime()/1000);
  assert.equal(f.store.one("SELECT state FROM actions WHERE action='recover-mfa'").state,'synced');
},{checkAccount:recoveryAccount});
scenario('MFA recovery: source outage retains containment and partial history',async f=>{
  f.identity.recoverMfa=async()=>{throw Error('offline');};
  const r=await f.req('a','/api/admin/users/e/mfa/recovery','POST',{note,verification:'QA verified identity reference'});
  assert.equal(r.status,202);assert.equal(r.body.status,'PARTIAL');
  assert.equal(f.store.one('SELECT mfa_required FROM staff WHERE id=?','e').mfa_required,1);
  assert.equal(f.store.one("SELECT state FROM actions WHERE action='recover-mfa'").state,'partial');
},{checkAccount:recoveryAccount});
scenario('GOV: grant requires approval, manager scope and revocation',async f=>{
  assert.equal((await f.req('e','/api/access/resources/team-report')).status,403);
  const id=await requestGrant(f);
  assert.equal((await f.req('e',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note})).status,403);
  assert.equal((await f.req('m',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note})).status,200);
  assert.equal((await f.req('e','/api/access/resources/team-report')).status,200);
  assert.equal((await f.req('m',`/api/governance/requests/${id}/decision`,'POST',{decision:'revoke',note})).status,200);
  assert.equal((await f.req('e','/api/access/resources/team-report')).status,403);
});
scenario('GOV: cross-team approval and manager audit grant denied',async f=>{for(const [u,resource] of [['x','team-report'],['e','audit-report']]){const id=await requestGrant(f,u,resource);assert.equal((await f.req('m',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note})).status,403);}});
scenario('GOV: self approval denied and pending cancellation owner-only',async f=>{const id=await requestGrant(f,'m');assert.equal((await f.req('m',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note})).status,403);assert.equal((await f.req('x',`/api/me/access/requests/${id}/cancel`,'POST',{})).status,404);assert.equal((await f.req('m',`/api/me/access/requests/${id}/cancel`,'POST',{})).status,200);});
scenario('GOV: expired and changed-team grants denied',async f=>{const id=await requestGrant(f);await f.req('a',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note});f.store.run('UPDATE staff SET team=? WHERE id=?','Beta','e');assert.equal((await f.req('e','/api/access/resources/team-report')).status,403);f.store.run('UPDATE staff SET team=? WHERE id=?','Alpha','e');f.store.run('UPDATE access_requests SET expires_at=? WHERE id=?','2020-01-01',id);assert.equal((await f.req('e','/api/access/resources/team-report')).status,403);});
scenario('JCL: local Join completes with MFA and no stored password',async f=>{const w=await workflow(f,{kind:'join',source:'local',username:'join-demo',name:'Join Demo',email:'join@example.test',team:'Alpha',role:'employee'});const password='IsolatedTestPassword123!';assert.equal((await execute(f,w,password)).state,'synced');const user=f.store.one('SELECT * FROM staff WHERE id=?','joined');assert.equal(user.mfa_required,1);assert.equal(user.governance_state,'active');for(const table of ['lifecycle_workflows','lifecycle_history','events','audit_outbox'])assert.equal(JSON.stringify(f.store.all('SELECT * FROM '+table)).includes(password),false);});
scenario('JCL: Change revokes grants then Leave keeps account blocked',async f=>{const id=await requestGrant(f);await f.req('a',`/api/governance/requests/${id}/decision`,'POST',{decision:'approve',note});let w=await workflow(f,{kind:'change',targetId:'e',name:'Demo e',email:'e@example.test',team:'Beta',role:'manager'});assert.equal((await execute(f,w)).state,'synced');assert.equal(f.store.one('SELECT state FROM access_requests WHERE id=?',id).state,'revoked');w=await workflow(f,{kind:'leave',targetId:'e'});assert.equal((await execute(f,w)).state,'synced');assert.equal((await f.req('e','/api/profile')).body.code,'GOVERNANCE_HOLD');});
scenario('JCL: outage preserves hold, blocks legacy mutations',async f=>{const w=await workflow(f,{kind:'leave',targetId:'e'});assert.equal((await execute(f,w)).state,'failed');assert.equal((await f.req('e','/api/profile')).status,403);assert.equal((await f.req('a','/api/admin/users/e','PATCH',{name:'Demo e',email:'e@example.test',role:'manager',team:'Beta',note})).body.code,'GOVERNANCE_HOLD');},{offline:true});
scenario('JCL: stale approval version and changed snapshot rejected',async f=>{const w=await workflow(f,{kind:'leave',targetId:'e'});assert.equal((await f.req('a',`/api/security/governance/workflows/${w.id}/execute`,'POST',{version:w.version-1,note})).status,409);f.store.run('UPDATE staff SET team=? WHERE id=?','Changed','e');assert.equal((await f.req('a',`/api/security/governance/workflows/${w.id}/execute`,'POST',{version:w.version,note})).status,409);});
scenario('AUDIT: event/outbox transaction rolls back together',async f=>{const before=f.store.one('SELECT count(*) AS n FROM audit_outbox').n;assert.throws(()=>f.store.tx(()=>{f.store.event({requestId:'rollback',method:'POST',path:'/test'},200,'TEST');throw Error('rollback');}));assert.equal(f.store.one('SELECT count(*) AS n FROM audit_outbox').n,before);});
scenario('AUDIT: health exposes unavailable service and durable pending',async f=>{await f.req('e','/api/profile');const r=await f.req('u','/api/security/central/health');assert.equal(r.status,200);assert.equal(r.body.remote,null);assert.ok(r.body.local.pending>0);assert.equal((await f.req('u','/api/security/central/events')).status,503);});
test('COLLECTOR: pagination/checkpoint and replay deduplicate',async()=>{const store=openStore(':memory:');try{const events=Array.from({length:5},(_,i)=>({id:'event-'+i,time:NOW.getTime()-10000+i,type:'LOGIN',userId:'subject'}));const identity={async events({first,max}){return events.slice(first,first+max);}};const collector=createIdentityCollector({store,identity,now:()=>NOW.getTime(),batchSize:2,maxPages:10,sourceRetentionDays:1});await collector.collect();assert.equal(store.one('SELECT count(*) AS n FROM identity_events').n,5);await collector.collect({force:true});assert.equal(store.one('SELECT count(*) AS n FROM identity_events').n,5);assert.throws(()=>collector.backfill('2000-01-01'));}finally{store.db.close();}});
test('LDAP: conflicting group membership and source outage fail closed',async()=>{const store=openStore(':memory:');let offline=false;const identity={async directoryProvider(){return {enabled:true,editMode:'READ_ONLY',cachePolicy:'NO_CACHE'};},async directoryUser(){if(offline)throw Error('offline');return {id:'ldap-id',username:'ldap-demo',name:'LDAP Demo',email:'ldap@example.test',providerId:'provider',enabled:true,team:'Alpha',sourceStatus:'active',mfaRequired:true,directRoles:[],groups:[{path:'/directory/employees',roles:['employee']},{path:'/directory/managers',roles:['manager']}]};},async remediate(){}};try{const directory=createDirectory({store,identity,providerId:'provider',now:()=>NOW});const r=await directory.reconcileForGovernance('ldap-id');assert.equal(r.user.directory_status,'conflict');offline=true;await assert.rejects(directory.reconcileForGovernance('ldap-id'));}finally{store.db.close();}});
test('AUDIT: ACK loss retains queue and replay keeps stable IDs',async()=>{const store=openStore(':memory:'),seen=new Set();let fail=true;const server=http.createServer(async(req,res)=>{let raw='';for await(const chunk of req)raw+=chunk;const events=JSON.parse(raw).events;for(const e of events)seen.add(e.event_id);res.writeHead(fail?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify({accepted:events.length}));});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));try{const audit=require('./central-audit').createCentralAudit({store,identity:{},url:'http://127.0.0.1:'+server.address().port,token:'test-service-token'});store.event({requestId:'stable',method:'GET',path:'/sample'},200,'AUTHORIZED');await audit.deliver({force:true});assert.equal(audit.health().pending,1);fail=false;await audit.deliver({force:true});assert.equal(audit.health().pending,0);assert.equal(seen.size,1);}finally{await new Promise(r=>server.close(r));store.db.close();}});
