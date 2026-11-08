const {randomUUID,createHash}=require('node:crypto');

function permissions(user) {
  const resources=[
    {resource:'Công và đơn cá nhân',client:'Web A',operations:'Đọc, chấm công, gửi/rút đơn',scope:'Chính mình'},
    {resource:'Hồ sơ và phiên',client:'Web A / Web B theo quyền',operations:'Đọc, kết thúc phiên',scope:'Chính mình'},
  ];
  if(['manager','admin'].includes(user.role))resources.push({resource:'Quản lý nhóm',client:'Web A',operations:'Đọc công, duyệt/từ chối đơn',scope:user.role==='admin'?'Toàn bộ; không tự duyệt':'Nhóm '+user.team+'; không tự duyệt'});
  if(['admin','auditor'].includes(user.role))resources.push({resource:'Giám sát bảo mật',client:'Web A / Web B',operations:'Đọc audit, cảnh báo, xác thực, ma trận quyền',scope:'Dữ liệu giám sát đã lưu'});
  if(user.role==='admin')resources.push({resource:'Quản trị danh tính',client:'Web A / Web B',operations:'Quản lý user, MFA, phiên và đối chiếu đồng bộ',scope:'Tài khoản thường; bảo vệ admin và chính mình'});
  const blocked=!!user.disabled||user.governance_state!=='active'||(user.identity_source==='ldap'&&user.directory_status!=='active');
  return resources.map(p=>({...p,effective:!blocked,condition:blocked?'Tài khoản đang khóa':'Cần token đúng client, phiên hoạt động và hoàn tất bước xác thực bắt buộc'}));
}

function registerWeek5(app,c) {
  const {store,identity,roles,send,mutate,fields,reject,text,staffView,now,checkAccount,readiness}=c;
  const admin=roles('admin'),securityRole=roles('admin','auditor');
  function target(req) {
    const user=store.one('SELECT * FROM staff WHERE id=?',req.params.id);
    if(!user)reject(404,'NOT_FOUND','Không tìm thấy tài khoản.');
    return user;
  }
  function protectedTarget(req) {
    const user=target(req);
    if(user.id===req.staff.id||user.role==='admin')reject(403,'PROTECTED_ADMIN','Tài khoản quản trị được bảo vệ.');
    if(user.governance_state!=='active')reject(409,'GOVERNANCE_HOLD','Tài khoản đang xử lý vòng đời hoặc đã nghỉ việc.');
    return user;
  }
  async function securityState(user) {
    try {
      const result=await identity.userSecurity(user.id);
      return {...result,required:!!user.mfa_required||result.required,updatedAt:user.security_updated_at || result.observedAt};
    }catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa đọc được trạng thái bảo mật tại Keycloak.');}
  }
  app.get('/api/me/security',async(req,res)=>send(req,res,200,{security:await securityState(req.staff),permissions:permissions(req.staff)}));
  app.get('/api/admin/users/:id/security',admin,async(req,res)=>{
    const user=target(req);
    send(req,res,200,{user:staffView(user),security:await securityState(user),permissions:permissions(user),
      history:store.all('SELECT a.id,a.action,a.note,a.time,a.state,a.message,a.remote_state,s.username AS actor FROM actions a JOIN staff s ON s.id=a.actor_id WHERE target_id=? ORDER BY a.rowid DESC LIMIT 50',user.id)});
  });
  app.post('/api/admin/users/:id/mfa/recovery',admin,async(req,res)=>{
    fields(req.body,['note','verification']);
    if(!text(req.body.note,10,300)||!text(req.body.verification,10,200))reject(400,'INVALID_RECOVERY','Cần lý do và mã tham chiếu xác minh danh tính; không nhập mã OTP hoặc bí mật.');
    const authTime=req.claims.auth_time,current=Math.floor(now().getTime()/1000);
    if(!Number.isInteger(authTime)||authTime>current+30||current-authTime>120)reject(401,'REAUTH_REQUIRED','Đăng nhập xác thực lại trong 2 phút trước khi khôi phục MFA.');
    const actorSecurity=req.accountSecurity || await securityState(req.staff);
    if(!actorSecurity.configured)reject(403,'MFA_REQUIRED_FOR_RECOVERY','Quản trị viên cần đăng ký MFA trước khi thực hiện khôi phục thiết bị.');
    const user=protectedTarget(req),id=randomUUID(),stamp=now().toISOString();
    store.tx(()=>{
      if(store.one("SELECT id FROM actions WHERE target_id=? AND state='pending'",user.id))reject(409,'ACTION_PENDING','Tài khoản đang có thao tác khác.');
      store.run('UPDATE staff SET mfa_required=1,revoked_before=?,security_updated_at=? WHERE id=?',current,stamp,user.id);
      store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,desired_json) VALUES(?,?,?,?,?,?,?,?)',id,req.staff.id,user.id,'recover-mfa',req.body.note.trim(),stamp,'pending',JSON.stringify({verification:req.body.verification.trim()}));
      store.event(req,202,'MFA_RECOVERY_REQUESTED',user.id);
    });
    let synced=false;
    try{await identity.recoverMfa(user.id);synced=true;}catch{}
    checkAccount?.invalidate?.(user.id);
    const message=synced?'Đã thu hồi phiên và yêu cầu đăng ký lại thiết bị OTP.':'Chưa xác nhận được khôi phục tại Keycloak; yêu cầu MFA và chặn token cũ vẫn giữ.';
    try{store.tx(()=>{
      store.run('UPDATE actions SET state=?,remote_state=?,message=?,updated_at=? WHERE id=?',synced?'synced':'partial',synced?'confirmed':'unknown',message,now().toISOString(),id);
      store.event(req,synced?200:202,synced?'MFA_RECOVERY_SYNCED':'MFA_RECOVERY_PARTIAL',user.id);
      store.notify({userId:user.id,title:'Đăng ký lại thiết bị xác thực',body:'Thiết bị OTP được quản trị xử lý. Hãy đăng nhập và hoàn tất cấu hình mới.',section:'profile',time:now().toISOString()});
    });}catch(error){try{store.run("UPDATE actions SET state='partial',remote_state=?,message=? WHERE id=?",synced?'confirmed':'unknown','Cần đối chiếu trạng thái MFA tại Keycloak.',id);}catch{}throw error;}
    res.status(synced?200:202).json({status:synced?'ALLOW':'PARTIAL',message,requestId:req.requestId});
  });
  app.get('/api/security/health',securityRole,async(req,res)=>{
    const result=await readiness();
    send(req,res,result.status==='ready'?200:503,{...result,collector:app.locals.identityCollector.state,sessionCacheSeconds:5,sessionPollSeconds:15},'READINESS_OBSERVED');
  });

  let sessionStats=null,sessionStatsUntil=0,sessionRequest=null;
  async function sessions() {
    if(sessionStats&&sessionStatsUntil>Date.now())return sessionStats;
    if(!sessionRequest)sessionRequest=identity.activeSessionCount().then(result=>{
      sessionStats={...result,available:true};sessionStatsUntil=Date.now()+30000;return sessionStats;
    }).catch(()=>({count:null,available:false,complete:false,observedAt:null})).finally(()=>{sessionRequest=null;});
    return sessionRequest;
  }
  app.get('/api/security/analytics',securityRole,async(req,res)=>{
    const liveSessions=await sessions();
    const counts=store.one("SELECT COUNT(*) AS requests,COALESCE(SUM(decision='DENY'),0) AS denied FROM events");
    const login=store.one("SELECT COALESCE(SUM(type='LOGIN'),0) AS success,COALESCE(SUM(type='LOGIN_ERROR'),0) AS failure FROM identity_events");
    const users=store.one('SELECT COUNT(*) AS total,COALESCE(SUM(disabled=1),0) AS disabled,COALESCE(SUM(mfa_required=1),0) AS mfaRequired FROM staff');
    send(req,res,200,{...counts,login,users,sessions:liveSessions,
      openAlerts:store.one("SELECT COUNT(*) AS n FROM alerts WHERE status IN ('open','reviewing')").n,
      partialActions:store.one("SELECT COUNT(*) AS n FROM actions WHERE state IN ('pending','partial')").n,
      series:store.all("SELECT date(time,'+7 hours') AS day,SUM(type='LOGIN') AS success,SUM(type='LOGIN_ERROR') AS failure FROM identity_events GROUP BY day ORDER BY day DESC LIMIT 14").reverse(),
      distribution:store.all('SELECT type,COUNT(*) AS total FROM identity_events GROUP BY type ORDER BY total DESC'),
      collector:app.locals.identityCollector.state,observedAt:now().toISOString()});
  });
  app.get('/api/security/access-matrix',securityRole,(req,res)=>{
    const page=Number(req.query.page || 1),limit=Number(req.query.limit || 50),q=req.query.q || '';
    if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>200||typeof q!=='string'||q.length>120)reject(400,'INVALID_PAGE','Trang hoặc từ khóa không hợp lệ.');
    const where=[],args=[];
    if(q){where.push("(instr(fold(username),fold(?))>0 OR instr(fold(name),fold(?))>0 OR instr(fold(team),fold(?))>0)");args.push(q,q,q);}
    if(req.query.role){if(!['admin','manager','employee','auditor'].includes(req.query.role))reject(400,'INVALID_FILTER','Vai trò không hợp lệ.');where.push('role=?');args.push(req.query.role);}
    const clause=where.length?' WHERE '+where.join(' AND '):'';
    const total=store.one('SELECT COUNT(*) AS n FROM staff'+clause,...args).n;
    const users=store.all('SELECT * FROM staff'+clause+' ORDER BY username LIMIT ? OFFSET ?',...args,limit,(page-1)*limit);
    send(req,res,200,{users:users.map(staffView),items:users.flatMap(user=>permissions(user).map(p=>({username:user.username,name:user.name,role:user.role,team:user.team,mfaRequired:!!user.mfa_required,...p}))),total,page,limit,pages:Math.ceil(total/limit),basis:'Chính sách ứng dụng và trạng thái local; quyền còn phụ thuộc token và phiên thực tế.'});
  });
  app.get('/api/me/workspace',(req,res)=>{
    const month=req.query.month || new Date(now().getTime()+7*3600000).toISOString().slice(0,7);
    if(typeof month!=='string'||!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))reject(400,'INVALID_DATE','Tháng không hợp lệ.');
    const records=store.all('SELECT * FROM attendance WHERE user_id=? AND day LIKE ? ORDER BY day',req.staff.id,month+'%');
    const requests=store.all('SELECT c.*,s.name AS reviewer_name FROM corrections c LEFT JOIN staff s ON s.id=c.reviewer_id WHERE c.user_id=? AND c.day LIKE ? ORDER BY c.created_at DESC',req.staff.id,month+'%');
    send(req,res,200,{month,records,requests,kpi:{days:records.length,lateDays:records.filter(r=>r.late_minutes>0).length,lateMinutes:records.reduce((n,r)=>n+r.late_minutes,0),hours:records.reduce((n,r)=>n+(r.check_out?Math.max(0,(Date.parse(r.check_out)-Date.parse(r.check_in))/3600000):0),0),pending:requests.filter(r=>r.status==='pending').length,approved:requests.filter(r=>r.status==='approved').length},scope:'self'});
  });

  app.get('/api/security/actions',securityRole,(req,res)=>{
    const page=Number(req.query.page || 1),limit=Number(req.query.limit || 20);
    if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isInteger(limit)||limit<1||limit>200)reject(400,'INVALID_PAGE','Trang không hợp lệ.');
    const state=req.query.state;
    if(state&&!['pending','partial','synced'].includes(state))reject(400,'INVALID_FILTER','Trạng thái không hợp lệ.');
    const clause=state?' WHERE a.state=?':'',args=state?[state]:[];
    const total=store.one('SELECT COUNT(*) AS n FROM actions a'+clause,...args).n;
    const items=store.all('SELECT a.id,a.target_id,a.action,a.note,a.time,a.state,a.remote_state,a.message,a.updated_at,a.attempts,s.username AS actor,t.username AS username,t.name AS target_name FROM actions a JOIN staff s ON s.id=a.actor_id JOIN staff t ON t.id=a.target_id'+clause+' ORDER BY a.rowid DESC LIMIT ? OFFSET ?',...args,limit,(page-1)*limit);
    send(req,res,200,{items,total,page,limit,pages:Math.ceil(total/limit)});
  });
  async function reconciliation(req) {
    const user=protectedTarget(req);
    let remote;try{remote=await identity.inspectUser(user.id);}catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa đối chiếu được Keycloak. Không thay đổi trạng thái đồng bộ.');}
    if(remote.roles.includes('admin'))reject(403,'PROTECTED_ADMIN','Keycloak đang cấp quyền admin; cần quản trị trực tiếp trước khi xử lý.');
    const actions=store.all("SELECT id,action,note,time,state,remote_state,message,desired_json FROM actions WHERE target_id=? AND state IN ('pending','partial') ORDER BY rowid DESC LIMIT 30",user.id);
    const local=staffView(user);
    const version=createHash('sha256').update(JSON.stringify({local,remote:{id:remote.id,name:remote.name,email:remote.email,enabled:remote.enabled,roles:[...remote.roles].sort(),security:{required:remote.security.required,configured:remote.security.configured,requiredActions:[...remote.security.requiredActions].sort()}}})).digest('hex');
    return {local,remote,version,actions:actions.map(a=>({...a,desired:a.action==='update-profile'&&a.desired_json?JSON.parse(a.desired_json):null,desired_json:undefined,retryable:a.state==='partial'&&['disable','enable','revoke','require-mfa','update-profile'].includes(a.action)})),observedAt:now().toISOString()};
  }
  app.get('/api/admin/users/:id/reconciliation',admin,async(req,res)=>send(req,res,200,await reconciliation(req)));
  app.post('/api/admin/users/:id/actions/:actionId/retry',admin,async(req,res)=>{
    fields(req.body,['note','version']);if(!text(req.body.note,10,300)||typeof req.body.version!=='string'||!/^[a-f0-9]{64}$/.test(req.body.version))reject(400,'INVALID_ACTION','Cần lý do và bản đối chiếu mới nhất trước khi xử lý lại.');
    const snapshot=await reconciliation(req),user=target(req);
    if(snapshot.version!==req.body.version)reject(409,'RECONCILIATION_CHANGED','Trạng thái tài khoản đã thay đổi. Đóng hộp thoại và đối chiếu lại trước khi xác nhận.');
    const action=store.one('SELECT * FROM actions WHERE id=? AND target_id=?',req.params.actionId,user.id);
    if(!action)reject(404,'NOT_FOUND','Không tìm thấy thao tác.');
    if(user.identity_source==='ldap'&&['update-profile','reset-password','require-mfa'].includes(action.action))reject(409,'DIRECTORY_READ_ONLY','Không phát lại thay đổi thuộc tính hoặc mật khẩu local lên người dùng LDAP.');
    if(user.identity_source==='ldap'&&action.action==='enable')await app.locals.directory.allowEnable(user);
    if(action.state!=='partial')reject(409,'ACTION_PENDING','Chỉ xử lý lại thao tác partial sau khi đối chiếu.');
    if(store.one('SELECT id FROM actions WHERE target_id=? ORDER BY rowid DESC LIMIT 1',user.id)?.id!==action.id)reject(409,'STALE_ACTION','Đã có thao tác mới hơn; không phát lại quyết định cũ.');
    if(!snapshot.actions.find(a=>a.id===action.id)?.retryable)reject(409,'MANUAL_RECONCILIATION_REQUIRED','Mật khẩu và khôi phục MFA cần thao tác mới với xác minh mới; không phát lại dữ liệu bí mật.');
    const desired=action.action==='update-profile'&&action.desired_json?JSON.parse(action.desired_json):null;
    if(action.action==='update-profile'&&(!desired||!['employee','manager','auditor'].includes(desired.role)))reject(409,'MANUAL_RECONCILIATION_REQUIRED','Thiếu bản thay đổi hồ sơ cần đối chiếu.');
    const attempt=randomUUID(),stamp=now().toISOString();
    store.tx(()=>{
      if(target(req).governance_state!=='active')reject(409,'GOVERNANCE_HOLD','Quy trình vòng đời vừa bắt đầu; giữ biện pháp chặn.');
      if(store.one('SELECT id FROM actions WHERE target_id=? ORDER BY rowid DESC LIMIT 1',user.id)?.id!==action.id||store.one('SELECT state FROM actions WHERE id=?',action.id)?.state!=='partial')reject(409,'STALE_ACTION','Trạng thái thao tác đã thay đổi. Hãy đối chiếu lại.');
      if(store.one("SELECT id FROM actions WHERE target_id=? AND state='pending'",user.id))reject(409,'ACTION_PENDING','Có thao tác khác đang xử lý.');
      store.run("UPDATE actions SET state='pending',attempts=attempts+1,updated_at=? WHERE id=?",stamp,action.id);
      if(action.action!=='enable')store.run('UPDATE staff SET revoked_before=?,disabled=? WHERE id=?',Math.floor(now().getTime()/1000),['disable','update-profile'].includes(action.action)?1:user.disabled,user.id);
      store.run('INSERT INTO action_attempts(id,action_id,actor_id,note,request_id,started_at,state) VALUES(?,?,?,?,?,?,?)',attempt,action.id,req.staff.id,req.body.note.trim(),req.requestId,stamp,'pending');
      store.event(req,202,'RECONCILIATION_REQUESTED',user.id);
    });
    let confirmed=false;
    try{if(desired)await identity.updateUser(user.id,desired);else await identity.remediate(user.id,action.action);confirmed=true;}catch{}
    checkAccount?.invalidate?.(user.id);
    const message=confirmed?(desired?'Hồ sơ đã đồng bộ; tài khoản vẫn khóa để kiểm tra trước khi mở.':'Đã xác nhận thao tác tại Keycloak và ứng dụng.'):'Chưa xác nhận được Keycloak. Giữ biện pháp chặn và đối chiếu lại sau.';
    try{store.tx(()=>{
      if(confirmed&&desired)store.run('UPDATE staff SET name=?,email=?,team=?,role=?,disabled=1 WHERE id=?',desired.name,desired.email || '',desired.team,desired.role,user.id);
      if(confirmed&&action.action==='enable')store.run('UPDATE staff SET disabled=0 WHERE id=?',user.id);
      if(action.action==='require-mfa')store.run('UPDATE staff SET mfa_required=1,security_updated_at=? WHERE id=?',now().toISOString(),user.id);
      store.run('UPDATE actions SET state=?,remote_state=?,message=?,updated_at=? WHERE id=?',confirmed?'synced':'partial',confirmed?'confirmed':'unknown',message,now().toISOString(),action.id);
      store.run('UPDATE action_attempts SET state=?,finished_at=? WHERE id=?',confirmed?'synced':'partial',now().toISOString(),attempt);
      store.event(req,confirmed?200:202,confirmed?'RECONCILIATION_SYNCED':'RECONCILIATION_PARTIAL',user.id);
    });}catch(error){try{store.run("UPDATE actions SET state='partial',remote_state=? WHERE id=?",confirmed?'confirmed':'unknown',action.id);}catch{}throw error;}
    res.status(confirmed?200:202).json({status:confirmed?'ALLOW':'PARTIAL',message,requestId:req.requestId});
  });
}
module.exports={registerWeek5,permissions};
