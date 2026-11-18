// Read-only bootstrap against an explicitly isolated copy and captured identities.
const fs=require('node:fs'),path=require('node:path');
const {preflight}=require('../backend/bootstrap');
const root=process.env.IAM_TEST_ROOT;
const users=JSON.parse(fs.readFileSync(path.join(root,'remote-identities.json'),'utf8'));
const identity={async bootstrapIdentity(name){
 const u=users[name];if(!u)throw Error('Uncaptured fixture identity');
 return {id:u.id,username:name,roles:[u.role],enabled:true,federated:false};
}};
(async()=>{
 try{
  const result=await preflight({databasePath:path.join(root,'attendance.sqlite'),staffFile:path.join(root,'staff.json'),identity});
  if(process.argv.includes('--expect-mismatch'))throw Error('Expected mismatch was not detected');
  console.log(JSON.stringify({status:'PASS',mode:'copy and mocked IAM',activeLocalProfiles:result.rows.filter(r=>r.identity_source==='local'&&!r.disabled&&r.governance_state==='active').length}));
 }catch(e){
  if(process.argv.includes('--expect-mismatch')&&e.message.startsWith('BOOTSTRAP_KEYCLOAK_ID_MISMATCH')){
   console.log(JSON.stringify({status:'PASS',expectedMismatchDetected:true}));return;
  }
  console.error('Copy bootstrap check failed; details omitted.');process.exitCode=1;
 }
})();
