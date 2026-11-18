const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createVerifier,accountChecker,sessionChecker}=require('./auth');
const {proxyHeaders,requestPath}=require('../network/security');
const ready=import('jose').then(async jose=>({...jose,...await jose.generateKeyPair('RS256')}));
const issuer='https://issuer.example.test/realms/company-iam';
async function signed(overrides={},header={alg:'RS256'}) {
  const j=await ready,now=Math.floor(Date.now()/1000);
  return new j.SignJWT({sub:'synthetic-subject',iat:now,exp:now+300,iss:issuer,
    azp:'employee-portal',aud:'employee-api',sid:'synthetic-session',...overrides})
    .setProtectedHeader(header).sign(j.privateKey);
}
for(const claim of ['sub','iat','exp','azp','sid'])test('phase2 JWT requires '+claim,async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  await assert.rejects(()=>signed({[claim]:undefined}).then(verify));
});
test('phase2 JWT rejects blank session and unauthorized client/audience pairs',async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  for(const claims of [{sid:''},{sid:123},{azp:'security-dashboard',aud:'employee-api'},
    {azp:'employee-portal',aud:'security-api'},{azp:'unlisted-client'}])await assert.rejects(()=>signed(claims).then(verify));
});
test('phase2 JWT accepts both mapped clients and additional audiences only with own audience present',async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  for(const claims of [{},{azp:'security-dashboard',aud:'security-api'},
    {aud:['employee-api','account']}])assert.ok((await verify(await signed(claims))).sub);
});
test('phase2 JWT rejects wrong issuer, expired validity and future nbf',async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  for(const claims of [{iss:'https://rogue.example.test'},{exp:1},{nbf:Math.floor(Date.now()/1000)+300}])await assert.rejects(()=>signed(claims).then(verify));
});
test('phase2 JWT rejects a token signed by another key',async()=>{
  const j=await ready,other=await j.generateKeyPair('RS256'),verify=await createVerifier({issuer,jwks:other.publicKey});
  await assert.rejects(()=>signed().then(verify));
});
test('phase2 JWT rejects unapproved signing algorithm',async()=>{
  const j=await ready,verify=await createVerifier({issuer,jwks:j.publicKey});
  await assert.rejects(()=>signed({}, {alg:'RS512'}).then(verify));
});
test('phase2 account cache detects disable after TTL and does not cache outage as healthy',async()=>{
  let now=0,enabled=true,offline=false,calls=0;
  const check=accountChecker({async userSecurity(){calls++;if(offline)throw Error('synthetic outage');return {enabled};}},{now:()=>now});
  assert.equal((await check('fixture')).enabled,true);enabled=false;
  assert.equal((await check('fixture')).enabled,true);now=5001;
  assert.equal((await check('fixture')).enabled,false);offline=true;check.invalidate('fixture');
  await assert.rejects(()=>check('fixture'));offline=false;assert.equal((await check('fixture')).enabled,false);assert.equal(calls,4);
});
test('phase2 session verification outage is never converted into an active cached session',async()=>{
  let fail=true;const check=sessionChecker({async sessionActive(){if(fail)throw Error('synthetic outage');return false;}});
  await assert.rejects(()=>check({sub:'fixture',sid:'fixture'}));fail=false;assert.equal(await check({sub:'fixture',sid:'fixture'}),false);
});
test('phase2 gateway overwrites untrusted forwarding metadata',()=>{
  const headers=proxyHeaders({headers:{host:'spoofed.invalid','x-forwarded-for':'spoofed',
    'x-forwarded-proto':'http',forwarded:'for=spoofed','x-real-ip':'spoofed'},
    socket:{remoteAddress:'192.0.2.10'}},new URL('https://app.example.test:8443/'));
  assert.equal(headers.host,'app.example.test:8443');assert.equal(headers['x-forwarded-for'],'192.0.2.10');
  assert.equal(headers['x-forwarded-proto'],'https');assert.equal(headers.forwarded,undefined);assert.equal(headers['x-real-ip'],undefined);
});
test('phase2 gateway rejects encoded traversal and ambiguous paths',()=>{
  for(const value of ['//rogue','/a/%2e%2e/private','/a/%252e%252e/private','/a/%5cprivate','/a/%00private'])assert.equal(requestPath(value),null);
  assert.equal(requestPath('/a/?section=profile'),'/a/');
});
