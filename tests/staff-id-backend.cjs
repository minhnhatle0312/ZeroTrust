const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {createApp}=require('../backend/app');
const {createVerifier}=require('../backend/auth');
const {openStore}=require('../backend/store');
const issuer='https://fixture.invalid/realms/company-iam';
test('six synchronized subjects pass real JWT verification; old subjects and wrong roles remain denied',async()=>{
  const j=await import('../backend/node_modules/jose/dist/webapi/index.js');
  const keys=await j.generateKeyPair('RS256');
  const store=openStore(path.join(process.env.IAM_TEST_ROOT,'attendance.sqlite'));
  const accounts={admin01:'admin',employee01:'employee',employee02:'employee',manager01:'manager',manager02:'manager',auditor01:'auditor'};
  const securityCalls=[];
  const app=createApp({store,origin:'http://localhost:5173',identity:{async policy(){return{};},async events(){return[];}},
    verify:await createVerifier({issuer,jwks:keys.publicKey}),
    checkAccount:async id=>{securityCalls.push(id);return{enabled:true,required:false,configured:false,requiredActions:[]};},
    checkSession:async claims=>claims.sid==='synthetic-session'});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  async function request(username,route='/api/profile',extra={}){
    const now=Math.floor(Date.now()/1000);
    const token=await new j.SignJWT({sub:'kc-'+username,preferred_username:username,realm_access:{roles:[accounts[username]]},iat:now,exp:now+300,iss:issuer,azp:'employee-portal',aud:'employee-api',sid:'synthetic-session',...extra}).setProtectedHeader({alg:'RS256'}).sign(keys.privateKey);
    const res=await fetch('http://127.0.0.1:'+server.address().port+route,{headers:{Authorization:'Bearer '+token}});
    return{status:res.status,body:await res.json()};
  }
  try{
    if(process.env.IAM_EXPECT_UNREGISTERED==='1'){
      assert.equal((await request('admin01')).status,200);
      for(const name of Object.keys(accounts).filter(n=>n!=='admin01')){
        const r=await request(name);assert.equal(r.status,403);assert.equal(r.body.code,'UNREGISTERED');
      }
      return;
    }
    for(const [name,role] of Object.entries(accounts)){
      const r=await request(name);assert.equal(r.status,200,name);assert.equal(r.body.id,'kc-'+name);assert.equal(r.body.role,role);
      assert.ok(securityCalls.includes('kc-'+name),name+' still checks Keycloak account');
    }
    for(const name of Object.keys(accounts).filter(n=>n!=='admin01')){
      const r=await request(name,'/api/profile',{sub:'old-'+name});
      assert.equal(r.status,403);assert.equal(r.body.code,'UNREGISTERED');
    }
    assert.equal((await request('employee01','/api/profile',{sub:'unregistered'})).body.code,'UNREGISTERED');
    assert.equal((await request('employee01','/api/profile',{realm_access:{roles:['admin']}})).body.code,'INSUFFICIENT_ROLE');
    assert.equal((await request('employee01','/api/profile',{azp:'security-dashboard',aud:'security-api'})).body.code,'DASHBOARD_ACCESS_DENIED');
    assert.equal((await request('employee01','/api/profile',{sid:'ended-session'})).body.code,'SSO_SESSION_ENDED');
    assert.equal((await request('employee01','/api/profile',{aud:'security-api'})).body.code,'INVALID_TOKEN');
    const attendance=await request('employee01','/api/attendance?month=2026-11');
    assert.equal(attendance.body.records[0].id,'attendance-1');
    const corrections=await request('employee01','/api/corrections');
    assert.equal(corrections.body.requests[0].reviewer_name,'Demo manager01');
    const details=await request('admin01','/api/admin/users/kc-employee01');
    assert.ok(details.body.events.some(e=>e.actor_id==='old-employee01'));
    assert.equal(details.body.actions[0].target_id,'old-employee01');
    const security=await request('admin01','/api/security');
    assert.equal(security.body.actions[0].target_name,'Demo employee01');
    assert.equal(security.body.actions[0].target_id,'old-employee01');
    const workflow=await request('admin01','/api/security/governance/workflows/workflow-1');
    assert.equal(workflow.status,200);assert.equal(workflow.body.history[0].actor,'manager01');
    assert.equal(workflow.body.history[0].actor_id,'old-manager01');
    const reviews=await request('auditor01','/api/security/governance/reviews');
    assert.equal(reviews.body.items[0].creator,'auditor01');
    const report=await request('employee01','/api/access/resources/audit-report');
    assert.equal(report.status,200);
    const {historicalStaffId}=require('../backend/historical-identity');
    const login=store.one("SELECT MAX(i.time) AS observed FROM identity_events i WHERE "+historicalStaffId(store,'i.user_id')+"=? AND i.type='LOGIN'",'kc-employee01');
    assert.equal(login.observed,'2026-11-10T00:00:00Z');
    const oldEvents=store.one("SELECT COUNT(*) AS n FROM events WHERE actor_id='old-employee01'").n;
    assert.ok(oldEvents>0);
    assert.equal(report.body.items.reduce((n,row)=>n+row.requests,0),store.one("SELECT COUNT(*) AS n FROM events WHERE actor_id IN ('old-employee01','kc-employee01')").n-1);
  } finally {await new Promise(r=>server.close(r));store.db.close();}
});
