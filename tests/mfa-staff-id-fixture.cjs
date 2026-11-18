// Synthetic data only. This never opens the live database or runs either migration.
const fs=require('node:fs'),path=require('node:path');
const {openStore}=require('../backend/store');
const {createCentralAudit}=require('../backend/central-audit');
const {migrate}=require('../backend/incidents');
const root=process.env.IAM_TEST_ROOT;
if(!root)throw Error('Isolated fixture root required');
const store=openStore(path.join(root,'attendance.sqlite'));
const roles={admin01:'admin',employee01:'employee',employee02:'employee',manager01:'manager',manager02:'manager',auditor01:'auditor'};
const seed=Object.entries(roles).map(([username,role])=>({id:'kc-'+username,username,role,name:'Fixture '+username,team:'A'}));
for(const u of seed)store.run('INSERT INTO staff(id,username,role,name,team) VALUES(?,?,?,?,?)',u.id,u.username,u.role,u.name,u.team);
for(const [username,role] of Object.entries({'mfa-employee':'employee','mfa-auditor':'auditor'})){
 store.run("INSERT INTO staff(id,username,role,name,team,mfa_required,revoked_before,security_updated_at) VALUES(?,?,?,?,?,1,123,'2026-11-08T00:00:00Z')",'old-'+username,username,role,'Fixture '+username,'MFA');
}
store.run("INSERT INTO staff(id,username,role,name,team,identity_source,directory_provider_id,directory_status,mfa_required) VALUES('ldap-id','ldap-fixture','employee','LDAP fixture','A','ldap','fixture-provider','active',1)");
store.run("INSERT INTO staff(id,username,role,name,team,disabled,governance_state) VALUES('disabled-id','disabled-fixture','employee','Disabled fixture','A',1,'left')");
store.run("INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES('demo-att','kc-employee01','2026-11-11','2026-11-11T01:00:00Z','2026-11-11T01:00:00Z')");
createCentralAudit({store,identity:{}});migrate(store.db);
for(const name of ['mfa-employee','mfa-auditor'])for(let i=0;i<10;i++){
 store.run('INSERT INTO audit_outbox(source,event_key,payload,delivered_at) VALUES(?,?,?,?)','synthetic',name+'-'+i,JSON.stringify({resource:'users/'+(i<6?'old-':'kc-')+name,action:'SYNTHETIC'}),i<6?'2026-11-08T00:00:00Z':null);
}
store.db.close();fs.writeFileSync(path.join(root,'staff.json'),JSON.stringify(seed,null,2)+'\n');
