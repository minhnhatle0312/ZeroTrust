// Test data only; no operational identifiers or files.
const {installSchema}=require('../../backend/identity-bindings');
const {createHash}=require('node:crypto');
const ISSUER='https://identity.fixture.invalid/realms/company-test',PROVIDER='fixture-provider-current';
const digest=x=>createHash('sha256').update(x).digest('hex');
function batch(store){
  installSchema(store.db);
  store.run('INSERT INTO identity_link_batches VALUES(?,?,?,?,?)','fixture-batch',digest('synthetic verified plan'),digest('synthetic verified backup'),'2026-01-02T00:00:00Z','fixture-evidence:approved-entry-uuid-history');
}
function link(store,{localId,subject,entryUuid='entry-'+subject,issuer=ISSUER,provider=PROVIDER,retired=localId}){
  store.run('INSERT INTO staff_identity_bindings VALUES(?,?,?,?,?,?,?,?,?,?)',issuer,subject,localId,provider,'fixture-ldap-source',entryUuid,'active',100,null,'fixture-batch');
  if(retired!==subject)store.run('INSERT INTO staff_identity_bindings VALUES(?,?,?,?,?,?,?,?,?,?)',issuer,retired,localId,'fixture-provider-old','fixture-ldap-source',entryUuid,'retired',0,100,'fixture-batch');
}
function fixture(store){
  batch(store);
  const ldap=['employee','employee','manager','auditor'].map((role,i)=>({id:'ldap-new-'+i,localId:'ldap-old-'+i,username:'ldap-fixture-'+i,name:'Fixture '+i,email:'fixture'+i+'@example.test',team:'Team A',role,
    providerId:PROVIDER,entryUuid:'fixture-entry-'+i,enabled:true,sourceStatus:'active',mfaRequired:true,directRoles:[],groups:[{path:'/directory/'+(role==='employee'?'employees':role==='manager'?'managers':'auditors'),roles:[role]}]}));
  for(const u of ldap){
    store.run("INSERT INTO staff(id,username,name,email,team,role,identity_source,directory_provider_id,directory_status,directory_groups,mfa_required) VALUES(?,?,?,?,?,?,'ldap','fixture-provider-old','active',?,1)",u.localId,u.username,u.name,u.email,u.team,u.role,JSON.stringify(u.groups.map(g=>g.path)));
    link(store,{localId:u.localId,subject:u.id,entryUuid:u.entryUuid});
  }
  const locals=['admin','employee','employee','manager','manager','auditor','employee','auditor'].map((role,i)=>({id:'local-'+i,username:'local-'+i,role}));
  for(const u of locals)store.run("INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,'Team A',?)",u.id,u.username,u.username,u.role);
  for(let i=0;i<13;i++)store.run("INSERT INTO staff(id,username,name,team,role,disabled) VALUES(?,?,?,'Other Team','employee',1)",'disabled-'+i,'disabled-'+i,'Disabled fixture '+i);
  return {ldap,locals};
}
module.exports={ISSUER,PROVIDER,batch,link,fixture};
