const {test}=require('node:test');
const assert=require('node:assert/strict');
const {openStore}=require('./store');
const {createApp}=require('./app');
const NOW=new Date('2026-11-01T12:00:00Z');
async function fixture(options={}) {
  const store=openStore(':memory:');
  for(const s of [['a','admin','Quản trị','Điều hành','admin'],['e','employee','Nhật','Sản phẩm','employee'],['x','other','Tuấn','Vận hành','employee'],['m','manager','Quản lý','Sản phẩm','manager'],['u','auditor','Kiểm toán','Kiểm soát','auditor']])store.run('INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)',...s);
  const calls=[],sessions=new Map([['e',[{id:'s1',ipAddress:'10.0.0.2',clients:['employee-portal'],start:NOW.getTime(),lastAccess:NOW.getTime()}]],['x',[{id:'s2',ipAddress:'10.0.0.3',clients:['employee-portal']}]]]);
  const identity={async events(){if(options.offline)throw Error('offline');return options.events || [];},async sessions(id){if(options.offline)throw Error('offline');return sessions.get(id) || [];},async endSession(id,sid){calls.push('end-session');sessions.set(id,(sessions.get(id)||[]).filter(s=>s.id!==sid));},async createUser(b){if(options.offline)throw Error('offline');calls.push('create');return {id:'new-'+b.username};},async updateUser(){calls.push('profile');if(options.delay)await new Promise(r=>setTimeout(r,options.delay));if(options.offline)throw Error('offline');},async resetPassword(){calls.push('password');if(options.offline)throw Error('offline');},async remediate(){calls.push('contain');},async policy(){return{};}};
  const app=createApp({store,identity,now:()=>NOW,rateLimit:10000,verify:async token=>JSON.parse(Buffer.from(token,'base64url').toString())});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  async function req(id,path,method='GET',body,claims={}) {
    const user=store.one('SELECT * FROM staff WHERE id=?',id);
    const token=Buffer.from(JSON.stringify({sub:id,iat:NOW.getTime()/1000+2,realm_access:{roles:[user?.role || 'employee']},sid:id==='e'?'s1':'admin-session',...claims})).toString('base64url');
    const r=await fetch(base+path,{method,headers:{Authorization:'Bearer '+token,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:r.status,body:await r.json()};
  }
  return {store,app,req,calls,sessions,async close(){await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,fn,options){test(name,async()=>{const f=await fixture(options);try{await fn(f);}finally{await f.close();}});}
const password='TemporaryDemoPass123!';
const profile={name:'Nhật mới',team:'Vận hành',role:'manager',note:'Chuyển nhóm theo phân công mới.'};

scenario('OPS: non-admin cannot create/update/reset users or list other sessions',async f=>{
  for(const id of ['e','m','u'])for(const [path,method,body] of [['/api/admin/users','POST',{}],['/api/admin/users/e','PATCH',profile],['/api/admin/users/e/reset-password','POST',{password,note:profile.note}],['/api/admin/users/e/sessions','GET']])assert.equal((await f.req(id,path,method,body)).status,403);
});
scenario('OPS: create joins Keycloak ID and app registry without leaking password',async f=>{
  const r=await f.req('a','/api/admin/users','POST',{username:'newdemo',name:'Nhân viên mới',team:'Sản phẩm',role:'employee',password,email:'demo@example.test'});assert.equal(r.status,201);assert.equal(r.body.user.id,'new-newdemo');assert.equal(JSON.stringify(r.body).includes(password),false);assert.equal(f.store.all('SELECT * FROM events').some(e=>JSON.stringify(e).includes(password)),false);
});
scenario('OPS: duplicate username is rejected before remote work',async f=>{assert.equal((await f.req('a','/api/admin/users','POST',{username:'EMPLOYEE',name:'Nhân viên',team:'Nhóm mới',role:'employee',password,email:'demo@example.test'})).status,409);assert.deepEqual(f.calls,[]);});
scenario('OPS: cannot create or assign admin from application',async f=>{assert.equal((await f.req('a','/api/admin/users','POST',{username:'evil',name:'Nhân viên',team:'Nhóm mới',role:'admin',password,email:'demo@example.test'})).status,400);assert.equal((await f.req('a','/api/admin/users/e','PATCH',{...profile,role:'admin'})).status,400);});
scenario('OPS: weak password and mass-assigned fields are rejected',async f=>{
  assert.equal((await f.req('a','/api/admin/users/e/reset-password','POST',{password:'weak',note:profile.note})).status,400);
  assert.equal((await f.req('a','/api/admin/users/e','PATCH',{...profile,disabled:false})).status,400);
});
scenario('OPS: creation validates required profile fields and username type',async f=>{
  const user={username:'newdemo',name:'Nhân viên mới',team:'Nhóm thử',role:'employee',password,email:'demo@example.test'};
  for(const bad of [{email:''},{name:'Minh'},{username:1234},{email:'invalid-email'}])assert.equal((await f.req('a','/api/admin/users','POST',{...user,...bad})).status,400);
  assert.deepEqual(f.calls,[]);
});
scenario('OPS: server sorting is stable and cannot inject SQL',async f=>{
  for(const status of [403,401,200])f.store.run('INSERT INTO events(request_id,time,username,method,path,status,decision,reason) VALUES(?,?,?,?,?,?,?,?)','sort-'+status,NOW.toISOString(),'demo','GET','/example',status,status===200?'ALLOW':'DENY','TEST');
  const r=await f.req('u','/api/security/events?q=demo&sort=status&direction=asc');assert.deepEqual(r.body.items.map(e=>e.status),[200,401,403]);
  assert.equal((await f.req('u','/api/security/events?sort='+encodeURIComponent('status; DROP TABLE staff'))).status,400);
});
scenario('OPS: protected admin cannot be edited or password-reset',async f=>{assert.equal((await f.req('a','/api/admin/users/a','PATCH',profile)).status,403);assert.equal((await f.req('a','/api/admin/users/a/reset-password','POST',{password,note:profile.note})).status,403);});
scenario('OPS: profile changes persist and old role token is refused',async f=>{
  assert.equal((await f.req('a','/api/admin/users/e','PATCH',profile)).status,200);assert.equal(f.store.one('SELECT role FROM staff WHERE id=?','e').role,'manager');assert.equal(f.store.one('SELECT team FROM staff WHERE id=?','e').team,profile.team);
  assert.equal((await f.req('e','/api/profile','GET',undefined,{realm_access:{roles:['employee']}})).status,403);assert.equal((await f.req('e','/api/profile')).status,200);
});
scenario('OPS: failed profile sync contains account and retains old role',async f=>{assert.equal((await f.req('a','/api/admin/users/e','PATCH',profile)).status,503);const u=f.store.one('SELECT * FROM staff WHERE id=?','e');assert.equal(u.disabled,1);assert.equal(u.role,'employee');assert.equal(f.store.one('SELECT state FROM actions').state,'partial');},{offline:true});
scenario('OPS: concurrent profile changes serialize on target account',async f=>{const r=await Promise.all([f.req('a','/api/admin/users/e','PATCH',profile),f.req('a','/api/admin/users/e','PATCH',profile)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);},{delay:70});
scenario('OPS: password reset is audited without recording the secret',async f=>{assert.equal((await f.req('a','/api/admin/users/e/reset-password','POST',{password,note:profile.note})).status,200);assert.equal(f.store.one('SELECT action FROM actions').action,'reset-password');assert.equal(JSON.stringify(f.store.all('SELECT * FROM actions')).includes(password),false);});
scenario('OPS: Web B may manage users but still cannot access attendance',async f=>{const c={azp:'security-dashboard'};assert.equal((await f.req('a','/api/admin/users/e/sessions','GET',undefined,c)).status,200);assert.equal((await f.req('a','/api/me/sessions','GET',undefined,c)).status,200);assert.equal((await f.req('a','/api/attendance','GET',undefined,c)).status,403);});
scenario('OPS: own sessions identify current and cannot revoke another user session',async f=>{
  assert.equal((await f.req('e','/api/me/sessions')).body.sessions[0].current,true);assert.equal((await f.req('e','/api/me/sessions/revoke','POST',{sessionId:'s2',note:profile.note})).status,404);assert.equal(f.sessions.get('x').length,1);
  assert.equal((await f.req('e','/api/me/sessions/revoke','POST',{sessionId:'s1',note:profile.note})).status,200);assert.equal(f.sessions.get('e').length,0);
});
scenario('OPS: session outage is visible and never reports success',async f=>{assert.equal((await f.req('a','/api/admin/users/e/sessions')).status,503);},{offline:true});
scenario('OPS: security events can query beyond original last 100',async f=>{
  for(let i=0;i<155;i++)f.store.run('INSERT INTO events(request_id,time,username,method,path,status,decision,reason) VALUES(?,?,?,?,?,?,?,?)','old-'+i,'2026-10-30T20:00:00Z','Nhật','GET','/api/test',403,'DENY','EXAMPLE');
  const r=await f.req('u','/api/security/events?q=nhat&decision=DENY&from=2026-10-31&to=2026-10-31&page=8&limit=20');assert.equal(r.body.total,155);assert.equal(r.body.items.length,15);assert.equal(r.body.items[0].request_id,'old-14');
});
scenario('OPS: log query treats SQL payload as text and enforces date/page limits',async f=>{
  assert.equal((await f.req('u','/api/security/events?q='+encodeURIComponent("' OR 1=1 --"))).body.total,0);
  for(const q of ['limit=201','page=0','from=2026-11-02&to=2026-11-01','from=2026-02-30','decision=OTHER'])assert.equal((await f.req('u','/api/security/events?'+q)).status,400);
});
scenario('OPS: log detail carries all request correlation steps',async f=>{for(const s of [202,200])f.store.run('INSERT INTO events(request_id,time,username,method,path,status,decision,reason) VALUES(?,?,?,?,?,?,?,?)','same','2026-11-01T01:00:00Z','admin','POST','/api/test',s,'ALLOW','STEP');const r=await f.req('u','/api/security/events/1');assert.equal(r.body.related.length,2);});
scenario('OPS: employee cannot read global logs, summaries or identity events',async f=>{for(const p of ['/api/security/events','/api/security/summary','/api/security/login-events','/api/security/alert-list'])assert.equal((await f.req('e',p)).status,403);});
scenario('OPS: imported failed login creates alert and security notification once',async f=>{
  assert.equal((await f.req('a','/api/security/sync','POST',{})).body.imported,1);assert.equal((await f.req('a','/api/security/sync','POST',{})).body.imported,0);
  assert.equal(f.store.one('SELECT count FROM alerts').count,1);assert.equal(f.store.one('SELECT COUNT(*) AS n FROM notifications').n,1);assert.equal((await f.req('u','/api/security/login-events?type=LOGIN_ERROR')).body.items[0].ip_address,'10.0.0.8');
},{events:[{id:'kc-fail',time:NOW.getTime(),type:'LOGIN_ERROR',userId:'e',username:'employee',clientId:'employee-portal',ipAddress:'10.0.0.8',error:'invalid_user_credentials',details:{password}}]});
scenario('OPS: auditors cannot trigger sync, and offline sync returns 503',async f=>{assert.equal((await f.req('u','/api/security/sync','POST',{})).status,403);assert.equal((await f.req('a','/api/security/sync','POST',{})).status,503);},{offline:true});
scenario('OPS: notification scope and read state are private to each account',async f=>{
  f.store.tx(()=>{f.store.notify({userId:'e',title:'Riêng employee',body:'Dữ liệu riêng'});f.store.notify({audience:'security',title:'Cảnh báo',body:'Quản trị'});});
  const personal=(await f.req('e','/api/notifications')).body;assert.equal(personal.items.length,1);assert.equal((await f.req('x','/api/notifications/'+personal.items[0].id+'/read','PATCH',{})).status,404);
  assert.equal((await f.req('a','/api/notifications')).body.items.length,1);await f.req('a','/api/notifications/read-all','POST',{});assert.equal((await f.req('a','/api/notifications')).body.unread,0);assert.equal((await f.req('u','/api/notifications')).body.unread,1);
});
scenario('OPS: security alert context excludes unrelated users',async f=>{f.store.tx(()=>f.store.alert({actorId:'e',username:'employee',kind:'Thử nghiệm'}));const a=f.store.one('SELECT id FROM alerts');const r=await f.req('u','/api/security/alerts/'+a.id+'/context');assert.equal(r.status,200);assert.equal(r.body.alert.username,'employee');assert.ok(r.body.events.every(e=>e.username==='employee'));});
scenario('OPS: only owner can withdraw pending correction and review then fails',async f=>{
  const r=await f.req('e','/api/corrections','POST',{day:'2026-10-31',checkIn:'08:00',checkOut:'17:00',reason:'Quên chấm công khi vào làm việc.'});assert.equal(r.status,201);
  assert.equal((await f.req('x','/api/corrections/'+r.body.id+'/cancel','POST',{})).status,404);assert.equal((await f.req('e','/api/corrections/'+r.body.id+'/cancel','POST',{})).status,200);assert.equal((await f.req('a','/api/corrections/'+r.body.id,'PATCH',{decision:'approved',note:'Đã đối chiếu hồ sơ'})).status,409);
});
