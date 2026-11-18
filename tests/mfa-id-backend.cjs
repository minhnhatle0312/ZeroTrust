const {test}=require('node:test'),assert=require('node:assert/strict'),path=require('node:path');
const {createApp}=require('../backend/app');
const {createVerifier}=require('../backend/auth');
const {openStore}=require('../backend/store');
test('eight profiles with verified JWT; old MFA IDs denied; MFA setup and actions still enforced',async()=>{
 const j=await import('../backend/node_modules/jose/dist/webapi/index.js');
 const keys=await j.generateKeyPair('RS256'),issuer='https://fixture.invalid/realms/company-iam';
 const accounts={admin01:'admin',employee01:'employee',employee02:'employee',manager01:'manager',manager02:'manager',auditor01:'auditor','mfa-employee':'employee','mfa-auditor':'auditor'};
 const store=openStore(path.join(process.env.IAM_TEST_ROOT,'attendance.sqlite'));
 let configured=true,requiredActions=[];
 const app=createApp({store,origin:'http://localhost:5173',identity:{async policy(){return{};},async events(){return[];}},
   verify:await createVerifier({issuer,jwks:keys.publicKey}),
   checkAccount:async id=>({enabled:true,required:id.startsWith('kc-mfa-'),configured:id.startsWith('kc-mfa-')?configured:false,requiredActions}),
   checkSession:async p=>p.sid==='synthetic-session'});
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
 async function request(name,extra={}){
  const now=Math.floor(Date.now()/1000);
  const token=await new j.SignJWT({sub:'kc-'+name,preferred_username:name,realm_access:{roles:[accounts[name]]},iat:now,exp:now+300,iss:issuer,azp:'employee-portal',aud:'employee-api',sid:'synthetic-session',...extra}).setProtectedHeader({alg:'RS256'}).sign(keys.privateKey);
  const res=await fetch('http://127.0.0.1:'+server.address().port+'/api/profile',{headers:{Authorization:'Bearer '+token}});
  return{status:res.status,body:await res.json()};
 }
 try{
  for(const [name,role] of Object.entries(accounts)){
   const result=await request(name);
   if(process.env.MFA_BEFORE==='1'&&name.startsWith('mfa-'))assert.equal(result.body.code,'UNREGISTERED');
   else{assert.equal(result.status,200,name);assert.equal(result.body.id,'kc-'+name);assert.equal(result.body.role,role);}
  }
  if(process.env.MFA_BEFORE==='1')return;
  for(const name of ['mfa-employee','mfa-auditor'])assert.equal((await request(name,{sub:'old-'+name})).body.code,'UNREGISTERED');
  assert.equal((await request('mfa-employee',{realm_access:{roles:['admin']}})).body.code,'INSUFFICIENT_ROLE');
  assert.equal((await request('mfa-employee',{sid:'ended-session'})).body.code,'SSO_SESSION_ENDED');
  configured=false;assert.equal((await request('mfa-employee')).body.code,'MFA_SETUP_REQUIRED');
  configured=true;requiredActions=['CONFIGURE_TOTP'];assert.equal((await request('mfa-employee')).body.code,'REQUIRED_ACTION_PENDING');
 }finally{await new Promise(r=>server.close(r));store.db.close();}
});
