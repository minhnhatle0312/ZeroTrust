// Synthetic fixture only. Run with isolated-node.cjs and a fresh IAM_TEST_ROOT.
const fs=require('node:fs'),path=require('node:path');
const {openStore}=require('../backend/store');
const {createCentralAudit}=require('../backend/central-audit');
const root=process.env.IAM_TEST_ROOT;
if(!root||!process.execArgv.some(x=>x.endsWith('isolated-node.cjs')))throw Error('Isolation required');
const file=path.join(root,'attendance.sqlite');
if(fs.existsSync(file))throw Error('Fresh fixture required');
const s=openStore(file),stamp='2026-01-01T00:00:00Z';
const roles=['employee','employee','manager','auditor'];
const users=roles.map((role,i)=>({id:`fixture-old-${i}`,subject:`fixture-new-${i}`,username:`ldap-fixture-${i}`,role,entry:`fixture-entry-${i}`}));
for(const u of users)s.run("INSERT INTO staff(id,username,name,team,role,identity_source,directory_provider_id,directory_status,mfa_required) VALUES(?,?,?,'A',?,'ldap','fixture-provider-old','active',1)",u.id,u.username,u.username,u.role);
for(let i=0;i<21;i++)s.run("INSERT INTO staff(id,username,name,team,role,disabled) VALUES(?,?,?,'A',?,?)",`fixture-local-${i}`,`local-${i}`,`Local ${i}`,i===0?'admin':'employee',i>=8?1:0);
s.db.exec('CREATE TABLE staff_id_reconciliations(old_id TEXT PRIMARY KEY,new_id TEXT NOT NULL UNIQUE REFERENCES staff(id),username TEXT NOT NULL UNIQUE,role TEXT NOT NULL,reconciled_at TEXT NOT NULL,batch_id TEXT NOT NULL,reason TEXT NOT NULL)');
for(let i=1;i<=7;i++)s.run('INSERT INTO staff_id_reconciliations VALUES(?,?,?,?,?,?,?)',`fixture-previous-${i}`,`fixture-local-${i}`,`local-${i}`,'employee',stamp,'fixture-prior-migration','synthetic');
createCentralAudit({store:s,identity:{}});
for(const [i,u] of users.entries()){
  s.run('INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES(?,?,?,?,?)',`attendance-${i}`,u.id,'2026-01-01',stamp,stamp);
  s.run('INSERT INTO corrections(id,user_id,day,check_in,check_out,reason,created_at,reviewer_id) VALUES(?,?,?,?,?,?,?,?)',`correction-${i}`,u.id,'2026-01-02',stamp,stamp,'Synthetic request',stamp,users[2].id);
  s.run('INSERT INTO notifications(id,user_id,title,body,section,created_at) VALUES(?,?,?,?,?,?)',`notice-${i}`,u.id,'Synthetic','Synthetic','profile',stamp);
  s.run('INSERT INTO notification_reads VALUES(?,?,?)',`notice-${i}`,u.id,stamp);
  s.run('INSERT INTO directory_maintenance VALUES(?,?,?,?,?)',u.id,'released','Synthetic',stamp,stamp);
  s.run('INSERT INTO access_requests(id,user_id,resource,team,days,note,created_at,reviewer_id) VALUES(?,?,?,?,?,?,?,?)',`grant-${i}`,u.id,'audit-report','A',1,'Synthetic',stamp,users[2].id);
  s.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,desired_json) VALUES(?,?,?,?,?,?,?,?)',`action-${i}`,users[3].id,u.id,'revoke','Synthetic',stamp,'synced',JSON.stringify({id:u.id}));
  s.run('INSERT INTO action_attempts(id,action_id,actor_id,note,request_id,started_at,state) VALUES(?,?,?,?,?,?,?)',`attempt-${i}`,`action-${i}`,users[3].id,'Synthetic',`request-${i}`,stamp,'synced');
  s.run('INSERT INTO lifecycle_workflows(id,kind,source,target_id,username,desired_json,before_json,creator_id,note,state,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)',`flow-${i}`,'change','ldap',u.id,u.username,'{}',JSON.stringify({id:u.id}),users[2].id,'Synthetic','synced',stamp,stamp);
  s.run('INSERT INTO lifecycle_history VALUES(?,?,?,?,?,?)',`history-${i}`,`flow-${i}`,users[2].id,'synced','Synthetic',stamp);
  s.run('INSERT INTO access_reviews VALUES(?,?,?,?,?,?)',`review-${i}`,users[3].id,stamp,'Synthetic',1,1);
  s.run('INSERT INTO access_review_items(id,review_id,user_id,finding,snapshot_json,reviewer_id) VALUES(?,?,?,?,?,?)',`item-${i}`,`review-${i}`,u.id,'Synthetic',JSON.stringify({id:u.id}),users[3].id);
  s.run('INSERT INTO directory_sync_jobs(id,provider_id,mode,state,actor_id,note,started_at) VALUES(?,?,?,?,?,?,?)',`job-${i}`,'fixture-provider-old','full','partial',users[3].id,'Synthetic',stamp);
  for(let j=0;j<3;j++)s.event({requestId:`event-${i}-${j}`,staff:u,method:'GET',path:'/api/profile'},200,'AUTHORIZED',u.id);
  for(let j=0;j<2;j++)s.run('INSERT INTO identity_events(id,time,type,user_id,username) VALUES(?,?,?,?,?)',`identity-${i}-${j}`,stamp,'LOGIN',u.id,u.username);
  const alert=s.alert({actorId:u.id,username:u.username,kind:'Synthetic',time:stamp,evidence:{source:'identity_events',id:`identity-${i}-0`}});
  s.run('INSERT INTO alert_history VALUES(?,?,?,?,?,?,?,?,?,?)',`alert-history-${i}`,alert,1,users[3].id,'Synthetic',`review-request-${i}`,stamp,'reviewing','Synthetic',JSON.stringify({actor:u.id}));
}
s.db.close();
fs.writeFileSync(path.join(root,'staff.json'),JSON.stringify([{id:'fixture-local-0',username:'local-0'}]));
fs.writeFileSync(path.join(root,'synthetic-identities.json'),JSON.stringify(users));
