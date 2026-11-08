const {randomUUID}=require('node:crypto');

const CATALOG=[
  {id:'team-report',name:'Báo cáo công của nhóm',scope:'Nhóm hiện tại',approver:'manager',description:'Xem tổng giờ và số ngày công của nhân viên trong cùng nhóm.'},
  {id:'team-export',name:'Xuất báo cáo nhóm',scope:'Nhóm hiện tại',approver:'manager',description:'Đọc dữ liệu báo cáo nhóm để xuất CSV trong thời hạn được duyệt.'},
  {id:'audit-report',name:'Tổng hợp truy cập cá nhân',scope:'Chính mình',approver:'admin',description:'Xem tổng số yêu cầu được phép/bị từ chối của chính mình trong 30 ngày.'},
];
const parse=value=>value?JSON.parse(value):null;
const snapshot=u=>({id:u.id,username:u.username,name:u.name,email:u.email,team:u.team,role:u.role,disabled:!!u.disabled,source:u.identity_source,provider:u.directory_provider_id || null,governanceState:u.governance_state});
const grantView=(r,stamp)=>({...r,state:r.state==='approved'&&r.expires_at<=stamp?'expired':r.state});

function registerGovernance(app,c){
  const {store,identity,roles,send,mutate,fields,reject,text,staffView,now,checkAccount}=c;
  const admin=roles('admin'),security=roles('admin','auditor'),approvers=roles('manager','admin');
  const stamp=()=>now().toISOString();
  store.run("UPDATE lifecycle_workflows SET state='partial',step='reconcile',version=version+1,message=?,updated_at=? WHERE state='running' AND step<>'source_write'",'Backend khởi động lại; giữ chặn và đối chiếu trước khi chạy lại.',stamp());
  const flow=id=>{const w=store.one('SELECT * FROM lifecycle_workflows WHERE id=?',id);if(!w)reject(404,'NOT_FOUND','Không tìm thấy quy trình.');return w;};
  const view=w=>({...w,desired:parse(w.desired_json),before:parse(w.before_json),desired_json:undefined,before_json:undefined});
  function record(w,actor,event,note){store.run('INSERT INTO lifecycle_history(id,workflow_id,actor_id,event,note,time) VALUES(?,?,?,?,?,?)',randomUUID(),w.id,actor || null,event,note,stamp());}
  function target(id){const u=store.one('SELECT * FROM staff WHERE id=?',id);if(!u)reject(404,'NOT_FOUND','Không tìm thấy nhân viên.');return u;}
  function protect(req,u){if(u.role==='admin'||u.id===req.staff.id)reject(403,'PROTECTED_ADMIN','Không xử lý vòng đời của admin hoặc chính người thực hiện.');}
  function page(req){const p=Number(req.query.page || 1);if(!Number.isSafeInteger(p)||p<1||p>100000)reject(400,'INVALID_PAGE','Trang không hợp lệ.');return p;}
  function expire(){store.run("UPDATE access_requests SET state='expired' WHERE state='approved' AND expires_at<=?",stamp());}
  function revokeGrants(userId,reason){
    store.run("UPDATE access_requests SET state=CASE WHEN state='pending' THEN 'cancelled' ELSE 'revoked' END,review_note=?,reviewed_at=? WHERE user_id=? AND state IN ('pending','approved')",reason,stamp(),userId);
  }
  const notify=(userId,title,body,section='access')=>store.notify({userId,title,body,section,time:stamp()});
  function busyTarget(userId){if(store.one("SELECT id FROM actions WHERE target_id=? AND state='pending'",userId))reject(409,'ACTION_PENDING','Tài khoản đang có thao tác bảo mật khác.');}
  function validateProfile(b){return text(b.name,3,100)&&b.name.trim().split(/\s+/).length>=2&&text(b.team,2,80)&&text(b.email,5,254)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email)&&['employee','manager','auditor'].includes(b.role);}
  const passwordValid=p=>typeof p==='string'&&p.length>=12&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p);

  app.get('/api/me/access',(req,res)=>{
    const requests=store.all('SELECT * FROM access_requests WHERE user_id=? ORDER BY created_at DESC LIMIT 100',req.staff.id).map(r=>grantView(r,stamp()));
    const history=store.all('SELECT h.*,w.kind FROM lifecycle_history h JOIN lifecycle_workflows w ON w.id=h.workflow_id WHERE w.target_id=? ORDER BY h.time DESC,h.rowid DESC LIMIT 100',req.staff.id);
    const grants=store.all("SELECT * FROM access_requests WHERE user_id=? AND state='approved' AND expires_at>? AND team=?",req.staff.id,stamp(),req.staff.team);
    send(req,res,200,{resources:CATALOG,requests,history,grants,basis:'Quyền bổ sung có thời hạn, không thay đổi realm role hoặc mở Web B.'});
  });
  app.post('/api/me/access/requests',(req,res)=>{
    fields(req.body,['resource','days','note']);const b=req.body;
    if(!CATALOG.some(r=>r.id===b.resource)||!Number.isInteger(b.days)||b.days<1||b.days>30||!text(b.note,10,500))reject(400,'INVALID_ACCESS_REQUEST','Chọn tài nguyên, 1–30 ngày và lý do 10–500 ký tự.');
    mutate(req,res,'ACCESS_REQUESTED',()=>{
      expire();if(store.one("SELECT id FROM access_requests WHERE user_id=? AND resource=? AND state IN ('pending','approved')",req.staff.id,b.resource))reject(409,'ACCESS_EXISTS','Bạn đã có quyền hoặc yêu cầu đang chờ cho tài nguyên này.');
      const id=randomUUID();store.run('INSERT INTO access_requests(id,user_id,resource,team,days,note,created_at) VALUES(?,?,?,?,?,?,?)',id,req.staff.id,b.resource,req.staff.team,b.days,b.note.trim(),stamp());
      const reviewers=store.all("SELECT id FROM staff WHERE disabled=0 AND governance_state='active' AND (role='admin' OR (role='manager' AND team=? AND ?<>'audit-report'))",req.staff.team,b.resource);
      for(const user of reviewers)if(user.id!==req.staff.id)notify(user.id,'Có yêu cầu cấp quyền mới',req.staff.name+' · '+CATALOG.find(r=>r.id===b.resource).name,'approvals');
      return {message:'Đã gửi yêu cầu. Chỉ được dùng tài nguyên sau khi duyệt.',id};
    },201);
  });
  app.post('/api/me/access/requests/:id/cancel',(req,res)=>{
    fields(req.body,[]);mutate(req,res,'ACCESS_REQUEST_CANCELLED',()=>{
      const r=store.one('SELECT * FROM access_requests WHERE id=? AND user_id=?',req.params.id,req.staff.id);
      if(!r)reject(404,'NOT_FOUND','Không tìm thấy yêu cầu của bạn.');if(r.state!=='pending')reject(409,'ALREADY_REVIEWED','Chỉ được rút yêu cầu đang chờ.');
      store.run("UPDATE access_requests SET state='cancelled',reviewed_at=? WHERE id=?",stamp(),r.id);return {message:'Đã rút yêu cầu.'};
    });
  });
  app.get('/api/governance/approvals',approvers,(req,res)=>{
    const p=page(req),q=String(req.query.q || '').trim();if(q.length>120)reject(400,'INVALID_QUERY','Từ khóa tối đa 120 ký tự.');
    const args=[],clauses=['1=1'];if(req.staff.role==='manager'){clauses.push("r.team=? AND s.team=? AND s.role='employee' AND r.resource IN ('team-report','team-export')");args.push(req.staff.team,req.staff.team);}
    if(q){clauses.push("instr(fold(s.username||' '||s.name||' '||r.note),fold(?))>0");args.push(q);}
    if(req.query.state){if(!['pending','approved','rejected','revoked','expired','cancelled'].includes(req.query.state))reject(400,'INVALID_FILTER','Trạng thái không hợp lệ.');clauses.push("(CASE WHEN r.state='approved' AND r.expires_at<=? THEN 'expired' ELSE r.state END)=?");args.push(stamp(),req.query.state);}
    const from=' FROM access_requests r JOIN staff s ON s.id=r.user_id WHERE '+clauses.join(' AND ');
    send(req,res,200,{items:store.all('SELECT r.*,s.username,s.name,s.role,s.team AS current_team'+from+' ORDER BY r.created_at DESC LIMIT 20 OFFSET ?',...args,(p-1)*20).map(r=>grantView(r,stamp())),total:store.one('SELECT COUNT(*) AS n'+from,...args).n,page:p,limit:20});
  });
  app.post('/api/governance/requests/:id/decision',approvers,(req,res)=>{
    fields(req.body,['decision','note']);if(!['approve','reject','revoke'].includes(req.body.decision)||!text(req.body.note,10,500))reject(400,'INVALID_DECISION','Chọn quyết định và lý do 10–500 ký tự.');
    mutate(req,res,'ACCESS_DECISION',()=>{
      expire();const r=store.one('SELECT * FROM access_requests WHERE id=?',req.params.id);if(!r)reject(404,'NOT_FOUND','Không tìm thấy yêu cầu.');
      const u=target(r.user_id);if(u.id===req.staff.id)reject(403,'SELF_APPROVAL','Không được tự duyệt hoặc thu hồi yêu cầu của mình.');
      if(req.staff.role==='manager'&&(u.role!=='employee'||u.team!==req.staff.team||r.team!==req.staff.team||!['team-report','team-export'].includes(r.resource)))reject(403,'CROSS_TEAM','Quản lý chỉ xét quyền báo cáo cho nhân viên cùng nhóm.');
      const revoke=req.body.decision==='revoke';if(r.state!==(revoke?'approved':'pending'))reject(409,'ALREADY_REVIEWED','Yêu cầu đã đổi trạng thái. Tải lại trước khi xử lý.');
      if(req.body.decision==='approve'&&(u.disabled||u.governance_state!=='active'||u.team!==r.team||(u.identity_source==='ldap'&&u.directory_status!=='active')))reject(409,'ACCESS_CONTEXT_CHANGED','Tài khoản hoặc phòng ban đã đổi; cần tạo yêu cầu mới.');
      if(req.body.decision==='approve'&&store.one("SELECT id FROM lifecycle_workflows WHERE target_id=? AND approval='approved' AND state='running'",u.id))reject(409,'GOVERNANCE_HOLD','Vòng đời đang xử lý; không cấp thêm quyền.');
      const state=revoke?'revoked':req.body.decision==='approve'?'approved':'rejected';
      const until=state==='approved'?new Date(now().getTime()+r.days*86400000).toISOString():r.expires_at;
      store.run('UPDATE access_requests SET state=?,reviewer_id=?,review_note=?,reviewed_at=?,expires_at=? WHERE id=?',state,req.staff.id,req.body.note.trim(),stamp(),until,r.id);
      notify(u.id,'Yêu cầu quyền đã được xử lý',CATALOG.find(v=>v.id===r.resource).name+' · '+req.body.note.trim());
      return {message:state==='approved'?'Đã cấp quyền có thời hạn.':state==='revoked'?'Đã thu hồi quyền bổ sung.':'Đã từ chối yêu cầu.'};
    });
  });
  app.get('/api/access/resources/:resource',(req,res)=>{
    const resource=CATALOG.find(r=>r.id===req.params.resource);if(!resource)reject(404,'NOT_FOUND','Không tìm thấy tài nguyên.');
    const grant=store.one("SELECT * FROM access_requests WHERE user_id=? AND resource=? AND state='approved' AND expires_at>? AND team=?",req.staff.id,resource.id,stamp(),req.staff.team);
    if(!grant)reject(403,'GRANT_REQUIRED','Chưa có quyền hợp lệ hoặc quyền đã hết hạn/bị thu hồi.');
    if(resource.id==='audit-report')return send(req,res,200,{resource,expiresAt:grant.expires_at,items:store.all("SELECT date(time,'+7 hours') AS day,COUNT(*) AS requests,SUM(decision='DENY') AS denied FROM events WHERE actor_id=? AND time>=? GROUP BY day ORDER BY day DESC",req.staff.id,new Date(now().getTime()-30*86400000).toISOString())});
    // The approved snapshot restricts access to the current team; no arbitrary team/user query.
    const localToday=new Date(now().getTime()+7*3600000).toISOString().slice(0,10),fromDay=new Date(now().getTime()+7*3600000-29*86400000).toISOString().slice(0,10);
    const items=store.all("SELECT s.username,s.name,s.team,COUNT(a.id) AS days,ROUND(COALESCE(SUM((julianday(a.check_out)-julianday(a.check_in))*24),0),2) AS hours FROM staff s LEFT JOIN attendance a ON a.user_id=s.id AND a.day>=? AND a.day<=? AND a.check_out IS NOT NULL WHERE s.team=? GROUP BY s.id ORDER BY s.name LIMIT 1001",fromDay,localToday,req.staff.team);
    send(req,res,200,{resource,expiresAt:grant.expires_at,items:items.slice(0,1000),complete:items.length<=1000,periodDays:30});
  });

  app.get('/api/security/governance',security,(req,res)=>{
    const counts=store.one("SELECT COUNT(*) AS total,SUM(approval='requested') AS awaitingApproval,SUM(state='partial') AS partial,SUM(state='running') AS running,SUM(state='synced') AS synced FROM lifecycle_workflows");
    const access=store.one("SELECT SUM(state='pending') AS pending,SUM(state='approved' AND expires_at>?) AS active FROM access_requests",stamp());
    send(req,res,200,{counts,access,resources:CATALOG,targets:store.all("SELECT * FROM staff WHERE role<>'admin' ORDER BY username LIMIT 1001").slice(0,1000).map(staffView),targetsComplete:store.one("SELECT COUNT(*) AS n FROM staff WHERE role<>'admin'").n<=1000,
      ldap:{configured:app.locals.directory.configured,writeMode:'operator-cli',note:'Ghi tại nguồn bằng công cụ được kiểm soát, sau đó chạy lại đối chiếu.'},observedAt:stamp()});
  });
  app.get('/api/security/governance/workflows',security,(req,res)=>{
    const p=page(req),q=String(req.query.q || '').trim(),args=[],clauses=[];if(q.length>120)reject(400,'INVALID_QUERY','Từ khóa quá dài.');
    if(q){clauses.push("instr(fold(username||' '||note),fold(?))>0");args.push(q);}
    if(req.query.state){if(!['pending','running','partial','failed','synced'].includes(req.query.state))reject(400,'INVALID_FILTER','Trạng thái không hợp lệ.');clauses.push('state=?');args.push(req.query.state);}
    const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
    send(req,res,200,{items:store.all('SELECT * FROM lifecycle_workflows'+where+' ORDER BY created_at DESC LIMIT 20 OFFSET ?',...args,(p-1)*20).map(view),total:store.one('SELECT COUNT(*) AS n FROM lifecycle_workflows'+where,...args).n,page:p,limit:20});
  });
  app.get('/api/security/governance/workflows/:id',security,(req,res)=>{
    const w=flow(req.params.id);send(req,res,200,{workflow:view(w),history:store.all('SELECT h.*,s.username AS actor FROM lifecycle_history h LEFT JOIN staff s ON s.id=h.actor_id WHERE workflow_id=? ORDER BY h.time,h.rowid',w.id),user:w.target_id?staffView(target(w.target_id)):null});
  });
  app.get('/api/security/governance/workflows/:id/observed',security,async(req,res)=>{
    const w=flow(req.params.id);
    try{
      const source=w.target_id?{id:w.target_id}:await identity.userByUsername(w.username);
      const [remote,sessions]=await Promise.all([identity.inspectUser(source.id),identity.sessions(source.id)]);
      const directory=w.source==='ldap'?await identity.directoryUser(source.id,app.locals.directory.configuration.mappings.map(m=>m.keycloakPath)):null;
      send(req,res,200,{local:store.one('SELECT * FROM staff WHERE id=?',source.id)?staffView(target(source.id)):null,remote,directory,sessions:sessions.length,observedAt:stamp(),note:'Ảnh chụp đọc hiện trạng; không tự đánh dấu đồng bộ hoặc bỏ biện pháp chặn.'});
    }catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa đọc đủ hiện trạng hoặc danh tính chưa được tạo. Không thay đổi trạng thái quy trình.');}
  });
  app.post('/api/security/governance/workflows',admin,(req,res)=>{
    fields(req.body,['kind','source','targetId','username','name','email','team','role','note']);const b=req.body;
    if(!['join','change','leave'].includes(b.kind)||!text(b.note,10,500))reject(400,'INVALID_WORKFLOW','Chọn quy trình và lý do 10–500 ký tự.');
    let u=null,source=b.source,username=b.username,desired={};
    if(b.kind==='join'){
      if(!['local','ldap'].includes(source)||!text(username,3,50)||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}$/.test(username)||!validateProfile({...b,role:'employee'}))reject(400,'INVALID_JOIN','Điền username, họ tên, email và phòng ban hợp lệ. Join luôn cấp role employee.');
      if(b.role&&b.role!=='employee')reject(400,'INVALID_JOIN','Gia nhập chỉ cấp quyền nhân viên mặc định.');
      if((source==='ldap')!==username.startsWith('ldap-'))reject(400,'INVALID_JOIN','Nguồn LDAP dùng prefix ldap-; nguồn local dùng tên khác prefix này.');
      if(source==='ldap'&&!app.locals.directory.configured)reject(409,'DIRECTORY_UNAVAILABLE','Cần áp dụng nguồn LDAP tuần 6 trước khi Join LDAP.');
      if(store.one('SELECT id FROM staff WHERE username=? COLLATE NOCASE',username))reject(409,'DUPLICATE_USER','Username đã có trong ứng dụng.');
      desired={name:b.name.trim().split(/\s+/).join(' '),email:b.email.trim(),team:b.team.trim(),role:'employee'};
    }else{
      u=target(b.targetId);protect(req,u);busyTarget(u.id);source=u.identity_source;username=u.username;
      if(u.governance_state!=='active')reject(409,'GOVERNANCE_HOLD','Tài khoản đang thuộc quy trình khác hoặc đã nghỉ việc.');
      if(b.kind==='change'){
        if(u.disabled||!validateProfile(b))reject(400,'INVALID_CHANGE','Tài khoản cần đang hoạt động; điền đủ họ tên, email, nhóm và vai trò hợp lệ.');
        if(source==='ldap'&&(b.name.trim()!==u.name||b.email.trim()!==u.email))reject(409,'DIRECTORY_READ_ONLY','Change LDAP hiện quản lý nhóm/role; họ tên và email giữ theo nguồn.');
        desired={name:b.name.trim().split(/\s+/).join(' '),email:b.email.trim(),team:b.team.trim(),role:b.role};
      }else desired={disabled:true};
    }
    mutate(req,res,'LIFECYCLE_REQUESTED',()=>{
      if(store.one("SELECT id FROM lifecycle_workflows WHERE username=? COLLATE NOCASE AND approval IN ('requested','approved') AND state<>'synced'",username))reject(409,'WORKFLOW_EXISTS','Danh tính đang có quy trình chưa kết thúc.');
      const id=randomUUID(),time=stamp();store.run('INSERT INTO lifecycle_workflows(id,kind,source,target_id,username,desired_json,before_json,creator_id,note,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)',id,b.kind,source,u?.id || null,username,JSON.stringify(desired),u?JSON.stringify(snapshot(u)):null,req.staff.id,b.note.trim(),time,time);
      record({id},req.staff.id,'REQUESTED',b.note.trim());store.notify({audience:'security',title:'Quy trình vòng đời chờ xét duyệt',body:b.kind.toUpperCase()+' · '+username,section:'governance',time});
      return {message:'Đã lập quy trình; chưa thay đổi quyền hoặc nguồn dữ liệu.',workflow:view(flow(id))};
    },201);
  });
  app.post('/api/security/governance/workflows/:id/decision',admin,(req,res)=>{
    fields(req.body,['decision','note','version']);if(!['approve','reject'].includes(req.body.decision)||!text(req.body.note,10,500)||!Number.isInteger(req.body.version))reject(400,'INVALID_DECISION','Cần quyết định, phiên bản và lý do.');
    mutate(req,res,'LIFECYCLE_DECISION',()=>{
      const w=flow(req.params.id);if(w.version!==req.body.version||w.attempts!==0||w.approval==='rejected'||w.state==='synced')reject(409,'WORKFLOW_CHANGED','Quy trình đã đổi hoặc đã bắt đầu; không được hủy biện pháp chặn bằng phê duyệt lại.');
      if(w.target_id)protect(req,target(w.target_id));
      store.run('UPDATE lifecycle_workflows SET approval=?,reviewer_id=?,review_note=?,version=version+1,updated_at=? WHERE id=?',req.body.decision==='approve'?'approved':'rejected',req.staff.id,req.body.note.trim(),stamp(),w.id);
      record(w,req.staff.id,req.body.decision==='approve'?'APPROVED':'REJECTED',req.body.note.trim());return {message:'Đã ghi quyết định.',workflow:view(flow(w.id))};
    });
  });
  async function perform(id,actor,password){
    let w=flow(id),u=w.target_id?target(w.target_id):null;const desired=parse(w.desired_json);
    let externalStarted=w.attempts>1||!!w.source_done;
    try{
      if(w.source==='ldap'&&!w.source_done){
        store.tx(()=>{store.run("UPDATE lifecycle_workflows SET state='partial',step='source_wait',message=?,version=version+1,updated_at=? WHERE id=?",'Đang chặn. Cần operator chạy scripts/process_governance.py rồi đối chiếu lại.',stamp(),id);record(w,actor,'SOURCE_REQUIRED','Chờ công cụ ghi tại nguồn LDAP.');});return;
      }
      await identity.ready();
      externalStarted=true;
      if(w.source==='local'&&w.kind==='join'){
        const joined=await identity.joinUser({requestId:w.id,username:w.username,...desired,password});
        store.tx(()=>{
          const collision=store.one('SELECT * FROM staff WHERE id=? OR username=? COLLATE NOCASE',joined.id,w.username);
          if(collision&&collision.id!==joined.id)throw Error('Join application collision');
          if(!collision)store.run("INSERT INTO staff(id,username,name,email,team,role,disabled,mfa_required,governance_state) VALUES(?,?,?,?,?,?,1,1,'onboarding')",joined.id,w.username,desired.name,desired.email,desired.team,desired.role);
          store.run("UPDATE lifecycle_workflows SET target_id=?,step='verify',updated_at=? WHERE id=?",joined.id,stamp(),id);
        });u=target(joined.id);
      }
      if(w.source==='ldap'){
        await app.locals.directory.synchronizeForGovernance();
        const source=await identity.userByUsername(w.username);
        if(source.providerId!==app.locals.directory.providerId)throw Error('Source identity mismatch');
        if(w.target_id&&source.id!==w.target_id)throw Error('Source subject changed');
        const result=await app.locals.directory.reconcileForGovernance(source.id);
        if(!result)throw Error('No directory identity');u=result.user;
        store.run('UPDATE lifecycle_workflows SET target_id=?,step=?,updated_at=? WHERE id=?',u.id,'verify',stamp(),id);
        if(w.kind==='leave'){if(u.directory_status!=='disabled')throw Error('Directory leave not observed');}
        else if(u.directory_status!=='active'||u.team!==desired.team||u.role!==desired.role||u.name!==desired.name||u.email!==desired.email)throw Error('Directory desired state mismatch');
        if(w.kind==='join')await identity.requireDirectoryEnrollment(u.id);
      }
      if(!u)throw Error('Missing application subject');
      if(w.kind==='leave')await identity.remediate(u.id,'disable');
      else{
        if(w.source==='local'&&w.kind==='change')await identity.updateUser(u.id,desired);
        // Revoke before enabling so prior sessions cannot retain the previous scope.
        await identity.remediate(u.id,'revoke');await identity.remediate(u.id,'enable');
      }
      const observed=await identity.inspectUser(u.id),expected=w.kind==='leave'?u.role:desired.role;
      if(observed.enabled!==(w.kind!=='leave')||(w.kind!=='leave'&&(observed.roles.length!==1||observed.roles[0]!==expected)))throw Error('Keycloak effective state mismatch');
      if(w.kind!=='leave'&&(observed.name!==desired.name||observed.email!==desired.email))throw Error('Keycloak attributes mismatch');
      if(w.kind==='join'&&!observed.security.required)throw Error('MFA policy missing');
      if((await identity.sessions(u.id)).length!==0)throw Error('Sessions remain after revocation');
      store.tx(()=>{
        const current=target(u.id);if(current.governance_state==='left'&&w.kind!=='leave')throw Error('Identity already left');
        if(w.kind==='leave')store.run("UPDATE staff SET disabled=1,governance_state='left',revoked_before=MAX(revoked_before,?),security_updated_at=? WHERE id=?",Math.floor(now().getTime()/1000),stamp(),u.id);
        else store.run("UPDATE staff SET name=?,email=?,team=?,role=?,disabled=0,governance_state='active',mfa_required=CASE WHEN ?='join' THEN 1 ELSE mfa_required END,revoked_before=MAX(revoked_before,?),security_updated_at=? WHERE id=?",desired.name,desired.email,desired.team,desired.role,w.kind,Math.floor(now().getTime()/1000),stamp(),u.id);
        revokeGrants(u.id,'Vòng đời danh tính thay đổi; cần yêu cầu quyền lại theo phòng ban mới.');
        store.run("UPDATE lifecycle_workflows SET state='synced',step='complete',message=?,version=version+1,updated_at=? WHERE id=?",w.kind==='join'?'Đã cấp hồ sơ; lần đăng nhập đầu phải hoàn tất mật khẩu/MFA theo nguồn.':'Đã đối chiếu nguồn, Keycloak, quyền và phiên.',stamp(),id);
        record(w,actor,'SYNCED','Đã xác nhận trạng thái đích; quyền bổ sung cũ được thu hồi.');
        notify(u.id,w.kind==='leave'?'Quyền truy cập đã kết thúc':'Vòng đời tài khoản đã cập nhật',w.note,'access');
        store.event({requestId:randomUUID(),method:'SYNC',originalUrl:'/governance/workflows',staff:{id:actor,username:'governance-worker',role:'admin'}},200,'LIFECYCLE_SYNCED',id);
      });checkAccount?.invalidate?.(u.id);
    }catch{
      // Remote work can already have committed: keep the local hold and reconcile explicitly.
      if(u)checkAccount?.invalidate?.(u.id);
      store.tx(()=>{
        store.run("UPDATE lifecycle_workflows SET state=?,step='reconcile',message=?,version=version+1,updated_at=? WHERE id=?",externalStarted?'partial':'failed',externalStarted?'Chưa xác nhận đầy đủ trạng thái nguồn/Keycloak/phiên. Giữ chặn; đối chiếu trước khi chạy lại.':'Chưa bắt đầu ghi: không kết nối được dịch vụ danh tính. Giữ chặn và thử lại sau khi khôi phục.',stamp(),id);
        record(w,actor,externalStarted?'PARTIAL':'FAILED','Không suy ra thành công từ thao tác đã gửi; không tự mở biện pháp chặn.');
        store.event({requestId:randomUUID(),method:'SYNC',originalUrl:'/governance/workflows',staff:{id:actor,username:'governance-worker',role:'admin'}},202,externalStarted?'LIFECYCLE_PARTIAL':'LIFECYCLE_FAILED',id);
      });
    }
  }
  app.post('/api/security/governance/workflows/:id/execute',admin,(req,res)=>{
    fields(req.body,['version','note','password']);if(!Number.isInteger(req.body.version)||!text(req.body.note,10,500))reject(400,'INVALID_EXECUTION','Cần phiên bản và lý do đối chiếu 10–500 ký tự.');
    const w=flow(req.params.id);if(w.version!==req.body.version||w.approval!=='approved'||!['pending','partial','failed'].includes(w.state))reject(409,'WORKFLOW_CHANGED','Quy trình chưa được duyệt, đã đổi hoặc đang chạy.');
    if(w.source==='local'&&w.kind==='join'&&w.attempts===0&&!passwordValid(req.body.password))reject(400,'INVALID_PASSWORD','Lần tạo đầu cần mật khẩu tạm thời 12–128 ký tự gồm chữ hoa, chữ thường và số.');
    if(w.source==='local'&&w.kind==='join'&&!w.target_id&&req.body.password!==undefined&&!passwordValid(req.body.password))reject(400,'INVALID_PASSWORD','Mật khẩu tạm thời 12–128 ký tự gồm chữ hoa, chữ thường và số.');
    if(req.body.password!==undefined&&(w.source!=='local'||w.kind!=='join'))reject(400,'FIELD_NOT_ALLOWED','Chỉ nhận mật khẩu ở Join local; không ghi mật khẩu LDAP vào trình duyệt.');
    store.tx(()=>{
      if(w.target_id){const u=target(w.target_id);protect(req,u);busyTarget(u.id);
        if(w.attempts===0&&JSON.stringify(snapshot(u))!==w.before_json)reject(409,'WORKFLOW_CONTEXT_CHANGED','Hồ sơ đã đổi từ lúc lập quy trình; từ chối và lập yêu cầu mới.');
        if(w.source==='ldap'&&store.one("SELECT user_id FROM directory_maintenance WHERE user_id=? AND state='writing'",u.id))reject(409,'DIRECTORY_BUSY','Có operator đang ghi nguồn; đợi hoàn tất trước khi đối chiếu.');
        store.run("UPDATE staff SET governance_state='processing',disabled=CASE WHEN ?='leave' THEN 1 ELSE disabled END,revoked_before=MAX(revoked_before,?) WHERE id=?",w.kind,Math.floor(now().getTime()/1000),u.id);
        revokeGrants(u.id,'Tạm thu hồi khi bắt đầu quy trình vòng đời.');
      }
      store.run("UPDATE lifecycle_workflows SET state='running',step='execute',attempts=attempts+1,version=version+1,updated_at=?,message=? WHERE id=?",stamp(),'Đang xử lý; chưa xác nhận đồng bộ.',w.id);
      record(w,req.staff.id,'EXECUTION_REQUESTED',req.body.note.trim());store.event(req,202,'LIFECYCLE_EXECUTION_REQUESTED',w.id);
    });
    let secret=req.body.password;delete req.body.password;
    setImmediate(()=>perform(w.id,req.staff.id,secret).catch(()=>{
      try{store.tx(()=>{
        store.run("UPDATE lifecycle_workflows SET state='partial',step='reconcile',message=?,version=version+1,updated_at=? WHERE id=? AND state='running' AND step<>'source_write'",'Tác vụ bị gián đoạn khi ghi nhật ký. Giữ chặn và kiểm tra trước khi đối chiếu lại.',stamp(),w.id);
        record(w,req.staff.id,'PARTIAL','Worker bị gián đoạn; không tự giải phóng biện pháp chặn.');
      });}catch{console.error('Lifecycle journal unavailable; containment remains. Workflow:',w.id);}
    }).finally(()=>{secret=undefined;}));
    res.status(202).json({status:'PENDING',message:'Đã nhận xử lý; xem trạng thái cuối trong quy trình.',workflow:view(flow(w.id)),requestId:req.requestId});
  });

  app.post('/api/security/governance/reviews',security,(req,res)=>{
    fields(req.body,['note']);if(!text(req.body.note,10,500))reject(400,'INVALID_REVIEW','Lý do rà soát 10–500 ký tự.');
    mutate(req,res,'ACCESS_REVIEW_CREATED',()=>{
      const users=store.all("SELECT s.*,(SELECT MAX(i.time) FROM identity_events i WHERE i.user_id=s.id AND i.type='LOGIN') AS last_login FROM staff s ORDER BY s.username LIMIT 1001"),complete=users.length<=1000,id=randomUUID(),cutoff=new Date(now().getTime()-30*86400000).toISOString();let count=0;
      store.run('INSERT INTO access_reviews(id,creator_id,created_at,note,total,complete) VALUES(?,?,?,?,0,?)',id,req.staff.id,stamp(),req.body.note.trim(),complete?1:0);
      const add=(u,finding,grant=null)=>{store.run('INSERT INTO access_review_items(id,review_id,user_id,grant_id,finding,snapshot_json) VALUES(?,?,?,?,?,?)',randomUUID(),id,u.id,grant?.id || null,finding,JSON.stringify({...snapshot(u),lastLogin:u.last_login,grant:grant?grantView(grant,stamp()):null}));count++;};
      for(const u of users.slice(0,1000)){
        if(u.role!=='employee')add(u,'PRIVILEGED_ROLE');
        if(u.last_login&&u.last_login<cutoff&&!u.disabled)add(u,'NO_RECENT_OBSERVED_LOGIN');
        if(!u.last_login&&!u.disabled)add(u,'LOGIN_HISTORY_UNKNOWN');
        if(!u.mfa_required&&!u.disabled)add(u,'MFA_POLICY_NOT_REQUIRED');
        if(u.governance_state!=='active'||(u.identity_source==='ldap'&&u.directory_status!=='active'))add(u,'IDENTITY_HOLD');
        for(const grant of store.all("SELECT * FROM access_requests WHERE user_id=? AND state='approved'",u.id))add(u,grant.expires_at<=stamp()?'EXPIRED_GRANT':grant.team!==u.team||u.disabled?'GRANT_CONTEXT_MISMATCH':'ACTIVE_GRANT',grant);
      }
      store.run('UPDATE access_reviews SET total=? WHERE id=?',count,id);return {message:'Đã lưu ảnh chụp rà soát; không tự thay đổi quyền.',id,complete,items:count};
    },201);
  });
  app.get('/api/security/governance/reviews',security,(req,res)=>send(req,res,200,{items:store.all('SELECT r.*,s.username AS creator FROM access_reviews r LEFT JOIN staff s ON s.id=r.creator_id ORDER BY r.created_at DESC LIMIT 50')}));
  app.get('/api/security/governance/reviews/:id',security,(req,res)=>{
    const review=store.one('SELECT * FROM access_reviews WHERE id=?',req.params.id);if(!review)reject(404,'NOT_FOUND','Không tìm thấy đợt rà soát.');const p=page(req);
    send(req,res,200,{review,page:p,limit:20,total:review.total,items:store.all('SELECT * FROM access_review_items WHERE review_id=? ORDER BY rowid LIMIT 20 OFFSET ?',review.id,(p-1)*20).map(r=>({...r,snapshot:parse(r.snapshot_json),snapshot_json:undefined}))});
  });
  app.post('/api/security/governance/review-items/:id',security,(req,res)=>{
    fields(req.body,['recommendation','note']);if(!['keep','revoke','investigate'].includes(req.body.recommendation)||!text(req.body.note,10,500))reject(400,'INVALID_REVIEW','Chọn khuyến nghị và ghi lý do 10–500 ký tự.');
    mutate(req,res,'ACCESS_REVIEW_RECORDED',()=>{const item=store.one('SELECT * FROM access_review_items WHERE id=?',req.params.id);if(!item)reject(404,'NOT_FOUND','Không tìm thấy mục rà soát.');
      store.run('UPDATE access_review_items SET recommendation=?,reviewer_id=?,note=?,reviewed_at=? WHERE id=?',req.body.recommendation,req.staff.id,req.body.note.trim(),stamp(),item.id);return {message:'Đã lưu khuyến nghị. Thu hồi thực tế cần admin/quản lý có quyền thực hiện.'};});
  });
  app.get('/api/security/governance/matrix',security,(req,res)=>{
    const p=page(req),q=String(req.query.q || '').trim();if(q.length>120)reject(400,'INVALID_QUERY','Từ khóa quá dài.');
    const where=" WHERE instr(fold(username||' '||name||' '||team),fold(?))>0";
    const users=store.all('SELECT * FROM staff'+where+' ORDER BY username LIMIT 20 OFFSET ?',q,(p-1)*20).map(u=>({...staffView(u),grants:store.all("SELECT id,resource,team,expires_at FROM access_requests WHERE user_id=? AND state='approved' AND expires_at>? AND team=?",u.id,stamp(),u.team)}));
    send(req,res,200,{items:users,total:store.one('SELECT COUNT(*) AS n FROM staff'+where,q).n,page:p,limit:20,basis:'Vai trò và quyền ứng dụng tại thời điểm đọc; trạng thái giữ chặn luôn có ưu tiên.'});
  });
}
module.exports={registerGovernance,CATALOG};
