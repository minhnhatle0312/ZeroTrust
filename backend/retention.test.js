const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openStore}=require('./store');
const {pruneAudit}=require('./retention');
const cutoff='2026-02-01T00:00:00.000Z',old='2026-01-01T00:00:00.000Z';
function fixture(fn){const s=openStore(':memory:');try{fn(s);}finally{s.db.close();}}
function event(s,time=old){return String(s.run('INSERT INTO events(request_id,time,username,method,path,status,decision,reason) VALUES(?,?,?,?,?,?,?,?)','synthetic-request',time,'synthetic-user','GET','/synthetic',403,'DENY','FIXTURE').lastInsertRowid);}
function identity(s,id){s.run('INSERT INTO identity_events(id,time,type,username) VALUES(?,?,?,?)',id,old,'LOGIN_ERROR','synthetic-user');return id;}
test('retention removes eligible uncited logs but keeps recent rows',()=>fixture(s=>{
  const expired=event(s),recent=event(s,'2026-03-01T00:00:00.000Z');identity(s,'expired-login');
  const result=pruneAudit(s,cutoff);assert.equal(result.events,1);assert.equal(result.identity_events,1);assert.equal(s.one('SELECT id FROM events WHERE id=?',expired),undefined);assert.ok(s.one('SELECT id FROM events WHERE id=?',recent));
}));
test('direct source evidence remains available for both open and closed incidents',()=>fixture(s=>{
  for(const state of ['open','reviewing','resolved','false_positive']){
    const e=event(s),login=identity(s,'login-'+state),id=s.alert({kind:'Synthetic '+state,time:old,evidence:{source:'events',id:e}});
    s.run('INSERT INTO alert_evidence(alert_id,source,event_id) VALUES(?,?,?)',id,'identity_events',login);s.run('UPDATE alerts SET status=? WHERE id=?',state,id);
  }
  const result=pruneAudit(s,cutoff);assert.equal(result.events,0);assert.equal(result.identity_events,0);assert.equal(s.one('SELECT COUNT(*) AS n FROM events').n,4);
}));
test('assessment, proposal and verification references protect follow-up evidence',()=>fixture(s=>{
  const refs=[event(s),event(s),event(s)],login=identity(s,'follow-up');const id=s.alert({kind:'Synthetic structured references',time:old});
  s.run('UPDATE alerts SET investigation_json=? WHERE id=?',JSON.stringify({assessment:{evidenceRefs:['events:'+refs[0]]},recommendations:[{evidenceRefs:['events:'+refs[1]]}],verification:{evidenceRefs:['events:'+refs[2],'identity_events:'+login]}}),id);
  assert.equal(pruneAudit(s,cutoff).events,0);assert.equal(s.one('SELECT COUNT(*) AS n FROM identity_events').n,1);
}));
test('previous verification and assessment citations remain readable in history',()=>fixture(s=>{
  const e=event(s),login=identity(s,'historical-proof'),id=s.alert({kind:'Synthetic history reference',time:old});
  s.run('INSERT INTO alert_history(id,alert_id,version,actor,actor_name,request_id,time,state,note,change_json) VALUES(?,?,?,?,?,?,?,?,?,?)','history',id,2,'synthetic-admin','synthetic-admin','synthetic-request',old,'reviewing','Synthetic historical review',JSON.stringify({before:{verification:{evidenceRefs:['events:'+e,'identity_events:'+login]}},after:{state:'reviewing'}}));
  pruneAudit(s,cutoff);assert.ok(s.one('SELECT id FROM events WHERE id=?',e));assert.ok(s.one('SELECT id FROM identity_events WHERE id=?',login));assert.equal(s.one('SELECT COUNT(*) AS n FROM alert_history').n,1);
}));
test('unreadable investigation metadata aborts pruning atomically',()=>fixture(s=>{
  const e=event(s),id=s.alert({kind:'Synthetic malformed metadata',time:old});s.run('UPDATE alerts SET investigation_json=? WHERE id=?','invalid-json',id);
  s.run('INSERT INTO notifications(id,title,body,section,created_at) VALUES(?,?,?,?,?)','synthetic-notification','Synthetic','Synthetic','alerts',old);
  assert.throws(()=>pruneAudit(s,cutoff));assert.ok(s.one('SELECT id FROM events WHERE id=?',e));assert.ok(s.one('SELECT id FROM notifications WHERE id=?','synthetic-notification'));
}));
test('invalid cutoff is rejected before any write',()=>fixture(s=>{const e=event(s);assert.throws(()=>pruneAudit(s,'invalid'),/cutoff/);assert.ok(s.one('SELECT id FROM events WHERE id=?',e));}));
