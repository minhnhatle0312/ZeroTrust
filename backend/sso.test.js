const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createVerifier,sessionChecker}=require('./auth');
const {createApp}=require('./app');
const {openStore}=require('./store');
const ready=import('jose').then(async j=>({...j,...await j.generateKeyPair('RS256')}));
const issuer='https://iam.test/realms/company-iam';
async function sign(claims={}){
  const j=await ready,now=Math.floor(Date.now()/1000);
  return new j.SignJWT({sub:'u',iat:now,exp:now+300,iss:issuer,azp:'security-dashboard',aud:'security-api',sid:'session-1',realm_access:{roles:['auditor']},...claims}).setProtectedHeader({alg:'RS256'}).sign(j.privateKey);
}
test('SSO: verify own audience for each OIDC client',async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  assert.equal((await verify(await sign())).azp,'security-dashboard');
  assert.equal((await verify(await sign({azp:'employee-portal',aud:'employee-api'}))).azp,'employee-portal');
});
for(const [name,claims] of [['cross-client audience',{aud:'employee-api'}],['unknown client',{azp:'rogue'}],['missing client',{azp:undefined}],['missing sid',{sid:undefined}],['wrong issuer',{iss:'https://rogue.test'}],['expired token',{exp:1}]]){
  test('SSO: reject '+name,async()=>{const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});await assert.rejects(async()=>verify(await sign(claims)));});
}
async function fixture(role='auditor',options={}){
  const j=await ready,store=openStore(':memory:');
  store.run('INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)','u','demo','Demo','A',role);
  const app=createApp({store,origin:['http://localhost:5173','http://localhost:5174'],identity:{async policy(){return{};},async events(){return[];}},verify:await createVerifier({issuer,jwks:j.publicKey}),...options});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  return {store,async req(path,method='GET',claims={},headers={}){const response=await fetch('http://127.0.0.1:'+server.address().port+path,{method,headers:{Authorization:'Bearer '+await sign({realm_access:{roles:[role]},...claims}),...headers}});return{status:response.status,body:await response.json(),headers:response.headers};},async close(){await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,role,fn,options){test(name,async()=>{const f=await fixture(role,options);try{await fn(f);}finally{await f.close();}});}
scenario('Web B: auditor can read security', 'auditor',async f=>assert.equal((await f.req('/api/security')).status,200));
scenario('Web B: employee denied at backend despite valid token', 'employee',async f=>assert.equal((await f.req('/api/profile')).body.code,'DASHBOARD_ACCESS_DENIED'));
scenario('Web B: manager denied', 'manager',async f=>assert.equal((await f.req('/api/security')).status,403));
scenario('Web B: admin token cannot access attendance', 'admin',async f=>assert.equal((await f.req('/api/attendance')).body.code,'CLIENT_SCOPE_DENIED'));
scenario('Web B: auditor cannot manage users', 'auditor',async f=>assert.equal((await f.req('/api/admin/users')).status,403));
scenario('Web B: admin may view users', 'admin',async f=>assert.equal((await f.req('/api/admin/users')).status,200));
scenario('SSO: ended Keycloak session rejects still-valid JWT', 'auditor',async f=>assert.equal((await f.req('/api/profile')).body.code,'SSO_SESSION_ENDED'),{checkSession:async()=>false});
scenario('SSO: Keycloak outage fails closed with 503', 'auditor',async f=>assert.equal((await f.req('/api/profile')).status,503),{checkSession:async()=>{throw Error('offline');}});
scenario('CORS: Web B exact origin allowed', 'auditor',async f=>assert.equal((await f.req('/api/profile','GET',{}, {Origin:'http://localhost:5174'})).headers.get('access-control-allow-origin'),'http://localhost:5174'));
scenario('CORS: lookalike origin denied', 'auditor',async f=>assert.equal((await f.req('/api/profile','GET',{}, {Origin:'http://localhost:5174.evil.test'})).body.code,'ORIGIN_DENIED'));
test('SSO: cache expires and discovers logout',async()=>{
  let clock=0,active=true,calls=0;
  const check=sessionChecker({async sessionActive(){calls++;return active;}},{ttl:5000,now:()=>clock});
  const claims={sub:'u',sid:'s'};
  assert.equal(await check(claims),true);active=false;
  assert.equal(await check(claims),true);clock=5001;
  assert.equal(await check(claims),false);assert.equal(calls,2);
});
test('SSO: outage is not cached and simultaneous checks coalesce',async()=>{
  let calls=0,fail=true;
  const check=sessionChecker({async sessionActive(){calls++;if(fail)throw Error('offline');return true;}});
  await assert.rejects(()=>check({sub:'u',sid:'s'}));fail=false;
  assert.deepEqual(await Promise.all([check({sub:'u',sid:'s'}),check({sub:'u',sid:'s'})]),[true,true]);assert.equal(calls,2);
});
