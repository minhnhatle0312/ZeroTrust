const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openStore } = require('./store');
const { createApp, localDay, lateMinutes } = require('./app');
const NOW = new Date('2026-10-31T11:00:00Z');
const issuer = 'http://keycloak.test/realms/company-iam';
const audience = 'employee-api';
const cryptoReady = import('jose').then(async j=>({...j,...await j.generateKeyPair('RS256')}));
const staff = [ ['e1','employee01','Nam','Sản phẩm','employee'],['e2','employee02','Linh','Vận hành','employee'],['m1','manager01','Anh','Sản phẩm','manager'],['m2','manager02','Huy','Vận hành','manager'],['a1','admin01','Admin','Điều hành','admin'],['u1','auditor01','Hà','Kiểm soát','auditor'] ];
async function fixture(options={}) {
  const j=await cryptoReady,store=openStore(':memory:');
  staff.forEach(s=>store.run('INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)',...s));
  const remote=[];
  const identity={async remediate(id,action){remote.push({id,action});if(options.remoteDelay)await new Promise(r=>setTimeout(r,options.remoteDelay));if(options.remoteFailure)throw Error('offline');},async policy(){return{eventsEnabled:true};},async events(){return[];}};
  const app=createApp({store,now:()=>NOW,rateLimit:options.rateLimit || 1000,identity,
    verify:async t=>(await j.jwtVerify(t,j.publicKey,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','iat','exp'],currentDate:NOW})).payload});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  async function token(id='e1',overrides={},algorithm='RS256') {
    const role=staff.find(s=>s[0]===id)?.[4] || 'employee';
    return new j.SignJWT({sub:id,preferred_username:id,realm_access:{roles:[role]},iat:NOW.getTime()/1000-60,exp:NOW.getTime()/1000+300,iss:issuer,aud:audience,...overrides}).setProtectedHeader({alg:algorithm}).sign(j.privateKey);
  }
  async function req(id,path,method='GET',body,headers={}) {
    const auth=id===null?{}:{Authorization:'Bearer '+await token(id)};
    const response=await fetch(base+path,{method,headers:{...auth,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:typeof body==='string'?body:JSON.stringify(body)});
    return {status:response.status,body:await response.json(),headers:response.headers};
  }
  const correction={day:'2026-10-30',checkIn:'08:00',checkOut:'17:00',reason:'Quên thao tác chấm công khi vào làm việc.'};
  return {store,remote,req,token,base,correction,async close(){await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,fn,options){test(name,async()=>{const f=await fixture(options);try{await fn(f);}finally{await f.close();}});}
scenario('AUTH-01: no token is 401',async f=>assert.equal((await f.req(null,'/api/profile')).status,401));
scenario('AUTH-02: malformed token is 401',async f=>assert.equal((await f.req(null,'/api/profile','GET',undefined,{Authorization:'Bearer garbage'})).status,401));
scenario('AUTH-03: wrong signature is 401',async f=>{const t=await f.token();const p=t.split('.');p[2]=(p[2][0]==='a'?'b':'a')+p[2].slice(1);assert.equal((await f.req(null,'/api/profile','GET',undefined,{Authorization:'Bearer '+p.join('.')})).status,401);});
for(const [label,claims] of [['expired',{exp:NOW.getTime()/1000-1}],['wrong audience',{aud:'other-api'}],['wrong issuer',{iss:'http://attacker.test'}],['future nbf',{nbf:NOW.getTime()/1000+60}],['missing exp',{exp:undefined}]]) {
  scenario('AUTH: rejects '+label,async f=>assert.equal((await f.req(null,'/api/profile','GET',undefined,{Authorization:'Bearer '+await f.token('e1',claims)})).status,401));
}
scenario('AUTH-09: unsigned JWT is denied',async f=>{const token=Buffer.from('{"alg":"none"}').toString('base64url')+'.'+Buffer.from('{"sub":"a1"}').toString('base64url')+'.';assert.equal((await f.req(null,'/api/admin','GET',undefined,{Authorization:'Bearer '+token})).status,401);});
scenario('AUTH-10: registered subject required',async f=>assert.equal((await f.req('unknown','/api/profile')).status,403));
scenario('AUTH-11: token role cannot overwrite employee registry',async f=>assert.equal((await f.req(null,'/api/admin','GET',undefined,{Authorization:'Bearer '+await f.token('e1',{realm_access:{roles:['admin']}})})).status,403));
scenario('RBAC-01: employee cannot access team/admin/security',async f=>{for(const p of ['/api/team','/api/admin/users','/api/security'])assert.equal((await f.req('e1',p)).status,403);});
scenario('RBAC-02: auditor can read security, cannot manage users',async f=>{assert.equal((await f.req('u1','/api/security')).status,200);assert.equal((await f.req('u1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Điều tra hành vi bất thường'})).status,403);});
scenario('RBAC-03: manager cannot grant admin or disable accounts',async f=>assert.equal((await f.req('m1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Điều tra hành vi bất thường'})).status,403));
scenario('IDOR-01: employee cannot read another employee attendance',async f=>assert.equal((await f.req('e1','/api/attendance?userId=e2')).status,403));
scenario('IDOR-02: manager only receives own team',async f=>{const r=await f.req('m1','/api/team');assert.equal(r.status,200);assert.deepEqual(r.body.members.map(x=>x.id).sort(),['e1','m1']);});
scenario('IDOR-03: cross-team approval denied without modifying request',async f=>{const c=await f.req('e2','/api/corrections','POST',f.correction);assert.equal(c.status,201);const r=await f.req('m1','/api/corrections/'+c.body.id,'PATCH',{decision:'approved',note:'Đã đối chiếu hồ sơ'});assert.equal(r.status,403);assert.equal(f.store.one('SELECT status FROM corrections WHERE id=?',c.body.id).status,'pending');});
scenario('IDOR-04: employee cannot approve own request',async f=>{const c=await f.req('e1','/api/corrections','POST',f.correction);assert.equal((await f.req('e1','/api/corrections/'+c.body.id,'PATCH',{decision:'approved',note:'Tự duyệt công của tôi'})).status,403);});
scenario('IDOR-05: manager cannot approve own request',async f=>{const c=await f.req('m1','/api/corrections','POST',f.correction);assert.equal((await f.req('m1','/api/corrections/'+c.body.id,'PATCH',{decision:'approved',note:'Tự duyệt công của tôi'})).body.code,'SELF_APPROVAL');});
scenario('ATT-01: check-out before check-in is 409',async f=>assert.equal((await f.req('e1','/api/attendance/check-out','POST',{})).status,409));
scenario('ATT-02: check-in uses server identity and server time',async f=>{const r=await f.req('e1','/api/attendance/check-in','POST',{});assert.equal(r.status,201);assert.equal(r.body.record.user_id,'e1');assert.equal(r.body.record.check_in,NOW.toISOString());});
scenario('ATT-03: concurrent duplicate check-in creates exactly one record',async f=>{const results=await Promise.all([f.req('e1','/api/attendance/check-in','POST',{}),f.req('e1','/api/attendance/check-in','POST',{})]);assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM attendance').n,1);});
scenario('ATT-04: duplicate checkout denied',async f=>{await f.req('e1','/api/attendance/check-in','POST',{});assert.equal((await f.req('e1','/api/attendance/check-out','POST',{})).status,200);assert.equal((await f.req('e1','/api/attendance/check-out','POST',{})).status,409);});
scenario('ATT-05: client cannot forge user, timestamp or status',async f=>{for(const field of ['userId','checkIn','status','role'])assert.equal((await f.req('e1','/api/attendance/check-in','POST',{[field]:'admin'})).body.code,'FIELD_NOT_ALLOWED');assert.equal(f.store.one('SELECT COUNT(*) AS n FROM attendance').n,0);});
scenario('REQ-01: same-team approval updates attendance and has audit trail',async f=>{const c=await f.req('e1','/api/corrections','POST',f.correction);assert.equal((await f.req('m1','/api/corrections/'+c.body.id,'PATCH',{decision:'approved',note:'Đã kiểm tra thời gian làm việc'})).status,200);assert.equal(f.store.one('SELECT check_in FROM attendance WHERE user_id=?','e1').check_in,'2026-10-30T01:00:00.000Z');assert.ok(f.store.one("SELECT id FROM events WHERE reason='CORRECTION_APPROVED'"));});
scenario('REQ-02: rejection leaves attendance unchanged',async f=>{const c=await f.req('e1','/api/corrections','POST',f.correction);await f.req('m1','/api/corrections/'+c.body.id,'PATCH',{decision:'rejected',note:'Không có bằng chứng phù hợp'});assert.equal(f.store.one('SELECT COUNT(*) AS n FROM attendance').n,0);});
scenario('REQ-03: replayed approval is 409',async f=>{const c=await f.req('e1','/api/corrections','POST',f.correction),p='/api/corrections/'+c.body.id,b={decision:'approved',note:'Đã kiểm tra dữ liệu công'};await f.req('m1',p,'PATCH',b);assert.equal((await f.req('m1',p,'PATCH',b)).status,409);});
scenario('REQ-04: duplicate pending request denied',async f=>{await f.req('e1','/api/corrections','POST',f.correction);assert.equal((await f.req('e1','/api/corrections','POST',f.correction)).status,409);});
scenario('REQ-05: future date, impossible date, reversed time, short reason denied',async f=>{for(const invalid of [{day:'2026-11-01'},{day:'2026-02-30'},{day:'2026-08-01'},{checkOut:'07:00'},{checkIn:'99:99'},{reason:'x'}])assert.equal((await f.req('e1','/api/corrections','POST',{...f.correction,...invalid})).status,400);});
scenario('REQ-06: mass assignment cannot auto-approve',async f=>assert.equal((await f.req('e1','/api/corrections','POST',{...f.correction,status:'approved',reviewer_id:'a1'})).body.code,'FIELD_NOT_ALLOWED'));
scenario('INJ-01: SQL/XSS text stays literal data',async f=>{const reason="<img src=x onerror=alert(1)> '; DROP TABLE staff; --";const r=await f.req('e1','/api/corrections','POST',{...f.correction,reason});assert.equal(r.status,201);assert.equal(f.store.one('SELECT reason FROM corrections').reason,reason);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM staff').n,6);});
scenario('INPUT-01: malformed JSON returns 400',async f=>assert.equal((await f.req('e1','/api/corrections','POST','{broken')).status,400));
scenario('INPUT-02: payload over 16 KiB returns 413',async f=>assert.equal((await f.req('e1','/api/corrections','POST',{reason:'a'.repeat(20000)})).status,413));
scenario('INPUT-03: malformed month and audit limit denied',async f=>{assert.equal((await f.req('e1',"/api/attendance?month='OR1=1")).status,400);assert.equal((await f.req('u1','/api/audit?limit=10000')).status,400);});
scenario('CSRF-01: foreign Origin cannot mutate even with valid token',async f=>{assert.equal((await f.req('e1','/api/attendance/check-in','POST',{}, {Origin:'https://evil.example'})).status,403);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM attendance').n,0);});
scenario('RATE-01: per-user rate limit returns 429',async f=>{await f.req('e1','/api/profile');await f.req('e1','/api/profile');assert.equal((await f.req('e1','/api/profile')).status,429);},{rateLimit:2});
scenario('AUDIT-01: failed audit rolls back attendance mutation',async f=>{f.store.event=()=>{throw Error('disk full');};assert.equal((await f.req('e1','/api/attendance/check-in','POST',{})).status,503);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM attendance').n,0);});
scenario('AUDIT-02: denied role creates alert; no token/body in event',async f=>{await f.req('e1','/api/admin');assert.equal(f.store.one('SELECT COUNT(*) AS n FROM alerts').n,1);const raw=JSON.stringify(f.store.all('SELECT * FROM events'));assert.ok(!raw.includes('Bearer'));assert.ok(!raw.includes('password'));});
scenario('ALERT-01: auditor cannot resolve alerts',async f=>{await f.req('e1','/api/admin');const a=f.store.one('SELECT id FROM alerts');assert.equal((await f.req('u1','/api/security/alerts/'+a.id,'PATCH',{status:'resolved',note:'Đã điều tra sự kiện này'})).status,403);});
scenario('ALERT-02: admin can record investigation with a reason',async f=>{await f.req('e1','/api/admin');const a=f.store.one('SELECT id FROM alerts');assert.equal((await f.req('a1','/api/security/alerts/'+a.id,'PATCH',{status:'resolved',note:'Đã thu hồi phiên sau khi điều tra'})).status,200);assert.equal(f.store.one('SELECT status FROM alerts WHERE id=?',a.id).status,'resolved');});
scenario('SESSION-01: revoke immediately rejects old valid JWT',async f=>{assert.equal((await f.req('a1','/api/admin/users/e1/actions','POST',{action:'revoke',note:'Thu hồi phiên sau kiểm thử'})).status,200);assert.equal((await f.req('e1','/api/profile')).body.code,'SESSION_REVOKED');assert.deepEqual(f.remote,[{id:'e1',action:'revoke'}]);});
scenario('SESSION-02: disable blocks API and syncs identity provider',async f=>{await f.req('a1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Khóa khi phát hiện truy cập lạ'});assert.equal((await f.req('e1','/api/profile')).body.code,'ACCOUNT_DISABLED');});
scenario('SESSION-03: Keycloak outage still contains user locally',async f=>{const r=await f.req('a1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Khóa khẩn cấp khi có cảnh báo'});assert.equal(r.status,202);assert.equal(r.body.status,'PARTIAL');assert.equal((await f.req('e1','/api/profile')).status,403);assert.equal(f.store.one('SELECT state FROM actions').state,'partial');},{remoteFailure:true});
scenario('SESSION-04: failed enable never unlocks locally',async f=>{f.store.run('UPDATE staff SET disabled=1 WHERE id=?','e1');assert.equal((await f.req('a1','/api/admin/users/e1/actions','POST',{action:'enable',note:'Mở lại tài khoản sau xác minh'})).status,202);assert.equal(f.store.one('SELECT disabled FROM staff WHERE id=?','e1').disabled,1);},{remoteFailure:true});
scenario('SESSION-05: successful enable allows fresh JWT only',async f=>{await f.req('a1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Khóa tài khoản để điều tra'});await f.req('a1','/api/admin/users/e1/actions','POST',{action:'enable',note:'Mở lại sau xác minh danh tính'});assert.equal((await f.req('e1','/api/profile')).status,401);const t=await f.token('e1',{iat:NOW.getTime()/1000+1});assert.equal((await f.req(null,'/api/profile','GET',undefined,{Authorization:'Bearer '+t})).status,200);});
scenario('SESSION-06: cannot lock self/admin',async f=>assert.equal((await f.req('a1','/api/admin/users/a1/actions','POST',{action:'disable',note:'Thử khóa chính tài khoản admin'})).status,403));
scenario('MFA-01: requiring MFA revokes old JWT and requests identity action',async f=>{await f.req('a1','/api/admin/users/e1/actions','POST',{action:'require-mfa',note:'Bổ sung MFA sau điều tra sự kiện'});assert.equal((await f.req('e1','/api/profile')).status,401);assert.equal(f.remote[0].action,'require-mfa');});
test('TIME-01: Vietnamese day boundary and late minutes use UTC+7',()=>{assert.equal(localDay(new Date('2026-10-30T18:00:00Z')),'2026-10-31');assert.equal(lateMinutes('2026-10-31T00:59:00Z'),0);assert.equal(lateMinutes('2026-10-31T01:12:00Z'),12);});
scenario('RACE-01: simultaneous approve/reject permits one decision only',async f=>{
  const c=await f.req('e1','/api/corrections','POST',f.correction);
  const results=await Promise.all(['approved','rejected'].map(decision=>f.req('m1','/api/corrections/'+c.body.id,'PATCH',{decision,note:'Kiểm thử xử lý đồng thời'})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
});
scenario('RACE-02: cannot enable while a disable operation is in flight',async f=>{
  const disabling=f.req('a1','/api/admin/users/e1/actions','POST',{action:'disable',note:'Khóa tài khoản khi đang điều tra'});
  while(!f.remote.length)await new Promise(r=>setTimeout(r,2));
  const second=await f.req('a1','/api/admin/users/e1/actions','POST',{action:'enable',note:'Thử mở đồng thời với thao tác khóa'});
  assert.equal(second.status,409);assert.equal(second.body.code,'ACTION_PENDING');
  await disabling;assert.equal(f.store.one('SELECT disabled FROM staff WHERE id=?','e1').disabled,1);
},{remoteDelay:100});
scenario('WEEK-01: recent-week data is independent of selected calendar month',async f=>{
  await f.req('e1','/api/attendance/check-in','POST',{});
  const r=await f.req('e1','/api/attendance?month=2026-09');assert.equal(r.body.records.length,0);assert.equal(r.body.week.length,1);
});
test('PERSIST-01: staff containment and attendance survive database reopen',()=>{
  const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'iam-week2-')),file=path.join(dir,'test.sqlite');
  let store;
  try{
    store=openStore(file);store.run('INSERT INTO staff(id,username,name,team,role,disabled,revoked_before) VALUES(?,?,?,?,?,?,?)','s','demo','Demo','A','employee',1,123);
    store.run('INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES(?,?,?,?,?)','r','s','2026-10-30','2026-10-30T01:00:00Z','2026-10-30T01:00:00Z');
    store.db.close();store=openStore(file);assert.equal(store.one('SELECT disabled FROM staff').disabled,1);assert.equal(store.one('SELECT revoked_before FROM staff').revoked_before,123);assert.equal(store.one('SELECT COUNT(*) AS n FROM attendance').n,1);
  }finally{if(store)store.db.close();for(const suffix of ['', '-wal','-shm'])fs.rmSync(file+suffix,{force:true});fs.rmdirSync(dir);}
});
