const {randomUUID}=require('node:crypto');
const {createIdentityCollector,TYPES}=require('./identity-events');

function registerOperations(app,c) {
  const {store,identity,roles,send,mutate,fields,reject,text,validDay,staffView,now,checkAccount,collectorOptions}=c;
  const collector=createIdentityCollector({store,identity,...collectorOptions});
  app.locals.identityCollector=collector;
  const allowedRoles=['employee','manager','auditor'];
  const admin=roles('admin'),security=roles('admin','auditor');
  function target(req) {
    const u=store.one('SELECT * FROM staff WHERE id=?',req.params.id);
    if(!u)reject(404,'NOT_FOUND','Không tìm thấy nhân viên.');
    return u;
  }
  function protectedTarget(req) {const u=target(req);if(u.role==='admin'||u.id===req.staff.id)reject(403,'PROTECTED_ADMIN','Tài khoản quản trị được bảo vệ; quản lý trực tiếp trong Keycloak.');return u;}
  const validPassword=p=>typeof p==='string'&&p.length>=12&&p.length<=128&&/[a-z]/.test(p)&&/[A-Z]/.test(p)&&/\d/.test(p);
  const validEmail=v=>text(v,5,254)&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
  const validProfile=b=>text(b.name,2,100)&&b.name.trim().split(/\s+/).length>=2&&text(b.team,2,80)&&allowedRoles.includes(b.role)&&(!b.email||validEmail(b.email));
  const notifyStaff=(u,title,body,section='profile')=>store.notify({userId:u.id,title,body,section,time:now().toISOString()});
  function range(query,column,clauses,args) {
    for(const key of ['from','to'])if(query[key]&&!validDay(query[key]))reject(400,'INVALID_DATE','Ngày lọc không hợp lệ.');
    if(query.from&&query.to&&query.from>query.to)reject(400,'INVALID_DATE','Ngày kết thúc phải sau hoặc bằng ngày bắt đầu.');
    if(query.from){clauses.push(column+'>=?');args.push(new Date(query.from+'T00:00:00+07:00').toISOString());}
    if(query.to){clauses.push(column+'<?');args.push(new Date(new Date(query.to+'T00:00:00+07:00').getTime()+86400000).toISOString());}
  }
  function list(req,res,{table,columns,time='time',extra=[],extraArgs=[],order='time DESC'}) {
    const size=Number(req.query.limit || 20),page=Number(req.query.page || 1);
    if(!Number.isSafeInteger(size)||size<1||size>200||!Number.isSafeInteger(page)||page<1||page>100000)reject(400,'INVALID_PAGE','Trang phải từ 1 và số dòng từ 1 đến 200.');
    if(req.query.sort){
      const sortable={events:['time','username','path','status'],alerts:['kind','username','severity','count','updated_at','status'],identity_events:['time','username','type','client_id','ip_address','error']}[table];
      if(!sortable.includes(req.query.sort)||!['asc','desc'].includes(req.query.direction || 'desc'))reject(400,'INVALID_SORT','Cột hoặc hướng sắp xếp không hợp lệ.');
      order=req.query.sort+' '+(req.query.direction || 'desc')+',id DESC';
    }
    const clauses=[...extra],args=[...extraArgs];
    for(const [key,column] of [['user','username'],['client','client_id'],['ip','ip_address'],...(table==='events'?[['role','role']]:[])]) {
      if(req.query[key]) {
        if(!text(req.query[key],1,100))reject(400,'INVALID_FILTER','Bộ lọc quá dài.');
        if(table==='alerts'&&['client','ip'].includes(key))reject(400,'INVALID_FILTER','Cảnh báo không lưu trường lọc này. Hãy tra nhật ký liên quan.');
        if(key==='role'&&!['employee','manager','admin','auditor'].includes(req.query[key]))reject(400,'INVALID_FILTER','Vai trò lọc không hợp lệ.');
        clauses.push(column+'=?');args.push(req.query[key]);
      }
    }
    if(req.query.q){if(!text(req.query.q,1,120))reject(400,'INVALID_QUERY','Từ khóa tối đa 120 ký tự.');const q=req.query.q.trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase();clauses.push('('+columns.map(k=>'instr(fold(COALESCE('+k+",'')),?)>0").join(' OR ')+')');args.push(...columns.map(()=>q));}
    range(req.query,time,clauses,args);
    const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
    const total=store.one('SELECT COUNT(*) AS n FROM '+table+where,...args).n;
    send(req,res,200,{items:store.all('SELECT * FROM '+table+where+' ORDER BY '+order+' LIMIT ? OFFSET ?',...args,size,(page-1)*size),total,page,limit:size,pages:Math.ceil(total/size)});
  }
  app.get('/api/security/events',security,(req,res)=>{
    const d=req.query.decision;if(d&&!['ALLOW','DENY'].includes(d))reject(400,'INVALID_FILTER','Kết quả phải là ALLOW hoặc DENY.');
    list(req,res,{table:'events',columns:['username','path','reason','request_id'],order:'id DESC',extra:d?['decision=?']:[],extraArgs:d?[d]:[]});
  });
  app.get('/api/security/events/:id',security,(req,res)=>{
    const event=store.one('SELECT * FROM events WHERE id=?',req.params.id);if(!event)reject(404,'NOT_FOUND','Không tìm thấy nhật ký.');
    const related=store.all('SELECT * FROM events WHERE request_id=? ORDER BY id',event.request_id);
    send(req,res,200,{event,related});
  });
  app.get('/api/security/login-events',security,(req,res)=>{
    if(req.query.type&&!TYPES.has(req.query.type))reject(400,'INVALID_FILTER','Loại sự kiện không hợp lệ.');
    list(req,res,{table:'identity_events',columns:['username','type','client_id','ip_address','error'],extra:req.query.type?['type=?']:[],extraArgs:req.query.type?[req.query.type]:[]});
  });
  app.get('/api/security/alert-list',security,(req,res)=>{
    const extra=[],extraArgs=[];
    for(const [key,values] of [['status',['open','reviewing','resolved','false_positive']],['severity',['high','medium']]])if(req.query[key]){if(!values.includes(req.query[key]))reject(400,'INVALID_FILTER','Bộ lọc cảnh báo không hợp lệ.');extra.push(key+'=?');extraArgs.push(req.query[key]);}
    list(req,res,{table:'alerts',columns:['username','kind','note'],time:'updated_at',order:'updated_at DESC',extra,extraArgs});
  });
  app.get('/api/security/alerts/:id/context',security,(req,res)=>{
    const alert=store.one('SELECT * FROM alerts WHERE id=?',req.params.id);if(!alert)reject(404,'NOT_FOUND','Không tìm thấy cảnh báo.');
    send(req,res,200,{alert,events:store.all('SELECT * FROM events WHERE username=? ORDER BY id DESC LIMIT 20',alert.username),logins:store.all('SELECT * FROM identity_events WHERE username=? ORDER BY time DESC LIMIT 20',alert.username)});
  });
  app.get('/api/security/summary',security,(req,res)=>{
    const clauses=[],args=[];range(req.query,'time',clauses,args);const where=clauses.length?' WHERE '+clauses.join(' AND '):'';
    const totals=store.one("SELECT COUNT(*) AS requests,COALESCE(SUM(decision='DENY'),0) AS denied FROM events"+where,...args);
    send(req,res,200,{...totals,openAlerts:store.one("SELECT COUNT(*) AS n FROM alerts WHERE status IN ('open','reviewing')").n,staff:store.one('SELECT COUNT(*) AS n FROM staff').n,disabled:store.one('SELECT COUNT(*) AS n FROM staff WHERE disabled=1').n,series:store.all("SELECT date(time,'+7 hours') AS day,COUNT(*) AS total,SUM(decision='DENY') AS denied FROM events"+where+" GROUP BY day ORDER BY day DESC LIMIT 14",...args).reverse(),collector:collector.state});
  });
  app.post('/api/security/sync',admin,async(req,res)=>{fields(req.body,[]);try{const result=await collector.collect({force:true});send(req,res,200,{message:result.backlog?'Đã lưu một phần; collector sẽ tiếp tục từ checkpoint.':'Đã đồng bộ sự kiện Keycloak.',...result});}catch{reject(503,'IDENTITY_UNAVAILABLE','Không đồng bộ được Keycloak. Kiểm tra kết nối và thử lại.');}});
  app.post('/api/admin/users',admin,async(req,res)=>{
    fields(req.body,['username','name','email','team','role','password']);const b=req.body;
    if(!text(b.username,3,50)||!/^[a-zA-Z0-9][a-zA-Z0-9._-]{2,49}$/.test(b.username)||!validProfile(b)||!validPassword(b.password))reject(400,'INVALID_USER','Tên đăng nhập 3–50 ký tự; họ tên/nhóm hợp lệ; mật khẩu 12–128 ký tự gồm chữ hoa, chữ thường và số. Chỉ cấp vai trò nhân viên, quản lý hoặc kiểm toán viên.');
    if(!validEmail(b.email))reject(400,'INVALID_EMAIL','Cần email hợp lệ và họ tên gồm cả họ và tên để hoàn tất hồ sơ đăng nhập Keycloak.');
    if(store.one('SELECT id FROM staff WHERE username=? COLLATE NOCASE',b.username))reject(409,'DUPLICATE_USER','Tên đăng nhập đã tồn tại.');
    let created;try{created=await identity.createUser({...b,name:b.name.trim()});}catch(e){reject(e.status===409?409:503,e.status===409?'DUPLICATE_USER':'IDENTITY_UNAVAILABLE',e.status===409?'Tên đăng nhập đã tồn tại ở Keycloak.':'Chưa tạo được tài khoản tại Keycloak. Hãy thử lại.');}
    try{mutate(req,res,'USER_CREATED',()=>{store.run('INSERT INTO staff(id,username,name,team,role,email) VALUES(?,?,?,?,?,?)',created.id,b.username,b.name.trim(),b.team.trim(),b.role,b.email.trim());return {message:'Đã tạo nhân viên. Người dùng phải đổi mật khẩu ở lần đăng nhập đầu.',user:staffView(store.one('SELECT * FROM staff WHERE id=?',created.id))};},201);}
    catch(e){await identity.remediate(created.id,'disable').catch(()=>{});throw e;}
  });
  app.get('/api/admin/users/:id',admin,(req,res)=>{const u=target(req);send(req,res,200,{user:staffView(u),events:store.all('SELECT * FROM events WHERE actor_id=? ORDER BY id DESC LIMIT 20',u.id),actions:store.all('SELECT * FROM actions WHERE target_id=? ORDER BY time DESC LIMIT 20',u.id)});});
  async function change(req,res,action,remote,commit) {
    const u=protectedTarget(req),id=randomUUID();
    store.tx(()=>{
      if(store.one("SELECT id FROM actions WHERE target_id=? AND state='pending'",u.id))reject(409,'ACTION_PENDING','Tài khoản đang có thao tác khác.');
      const desired=action==='update-profile'?{name:req.body.name.trim(),team:req.body.team.trim(),role:req.body.role,email:req.body.email?.trim() || u.email,disabled:!!u.disabled}:null;
      store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,desired_json) VALUES(?,?,?,?,?,?,?,?)',id,req.staff.id,u.id,action,req.body.note.trim(),now().toISOString(),'pending',desired?JSON.stringify(desired):null);
      store.run('UPDATE staff SET revoked_before=?,disabled=? WHERE id=?',Math.floor(now().getTime()/1000),action==='update-profile'?1:u.disabled,u.id);store.event(req,202,'ACCOUNT_CHANGE_REQUESTED',u.id);
    });
    try{await remote(u);checkAccount?.invalidate?.(u.id);}catch {
      if(action==='update-profile')await identity.remediate(u.id,'disable').catch(()=>{});
      store.tx(()=>{store.run("UPDATE actions SET state='partial',message=? WHERE id=?",'Chưa xác nhận được Keycloak. Kiểm tra tài khoản rồi thực hiện lại.',id);store.event(req,503,'ACCOUNT_CHANGE_PARTIAL',u.id);});
      reject(503,'IDENTITY_UNAVAILABLE',action==='update-profile'?'Chưa đồng bộ hồ sơ; tài khoản được tạm khóa để kiểm tra. Hãy lưu lại hồ sơ rồi mở tài khoản khi đồng bộ thành công.':'Chưa xác nhận được thao tác với Keycloak. Kiểm tra rồi thử lại.');
    }
    try {
      mutate(req,res,'ACCOUNT_CHANGE_SYNCED',()=>{commit(u);store.run("UPDATE actions SET state='synced',remote_state='confirmed',updated_at=?,message=? WHERE id=?",now().toISOString(),'Đã xác nhận tại Keycloak.',id);notifyStaff(u,'Tài khoản được cập nhật','Quản trị viên đã cập nhật '+(action==='reset-password'?'mật khẩu tạm thời. Hãy đăng nhập lại và đổi mật khẩu.':'hồ sơ hoặc quyền của bạn. Hãy đăng nhập lại.'));return {message:'Đã cập nhật. Người dùng cần đăng nhập lại.'};});
    } catch(error) {
      // The remote operation may already have committed. Keep a durable task;
      // never replay a password reset from an audit record.
      try{store.run("UPDATE actions SET state='partial',remote_state='confirmed',message=?,updated_at=? WHERE id=?",'Keycloak đã cập nhật; dữ liệu ứng dụng cần đối chiếu.',now().toISOString(),id);}catch{}
      throw error;
    }
  }
  app.patch('/api/admin/users/:id',admin,async(req,res)=>{
    fields(req.body,['name','email','team','role','note']);if(!validProfile(req.body)||!text(req.body.note,10,300))reject(400,'INVALID_USER','Cần họ và tên, nhóm, vai trò hợp lệ và lý do ít nhất 10 ký tự.');
    await change(req,res,'update-profile',u=>identity.updateUser(u.id,{name:req.body.name.trim(),role:req.body.role,email:req.body.email?.trim()}),u=>store.run('UPDATE staff SET name=?,team=?,role=?,email=?,disabled=? WHERE id=?',req.body.name.trim(),req.body.team.trim(),req.body.role,req.body.email?.trim() || u.email,u.disabled,u.id));
  });
  app.post('/api/admin/users/:id/reset-password',admin,async(req,res)=>{
    fields(req.body,['password','note']);if(!validPassword(req.body.password)||!text(req.body.note,10,300))reject(400,'INVALID_PASSWORD','Mật khẩu 12–128 ký tự gồm chữ hoa, chữ thường và số; lý do ít nhất 10 ký tự.');
    await change(req,res,'reset-password',u=>identity.resetPassword(u.id,req.body.password),()=>{});
  });
  async function sessions(req,res,u){try{const items=await identity.sessions(u.id);send(req,res,200,{sessions:items.map(s=>({...s,current:s.id===req.claims.sid}))});}catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa đọc được phiên đăng nhập từ Keycloak.');}}
  app.get('/api/admin/users/:id/sessions',admin,(req,res)=>sessions(req,res,target(req)));
  app.get('/api/me/sessions',(req,res)=>sessions(req,res,req.staff));
  async function endSession(req,res,u) {
    fields(req.body,['sessionId','note']);if(!text(req.body.sessionId,1,150)||!text(req.body.note,10,300))reject(400,'INVALID_SESSION','Cần phiên đăng nhập và lý do ít nhất 10 ký tự.');
    let existing;try{existing=await identity.sessions(u.id);}catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa đọc được phiên Keycloak.');}
    if(!existing.some(s=>s.id===req.body.sessionId))reject(404,'NOT_FOUND','Phiên không tồn tại hoặc không thuộc tài khoản này.');
    try{await identity.endSession(u.id,req.body.sessionId);}catch{reject(503,'IDENTITY_UNAVAILABLE','Chưa kết thúc được phiên đăng nhập.');}
    mutate(req,res,'SESSION_TERMINATED',()=>{notifyStaff(u,'Một phiên đăng nhập đã kết thúc',req.body.note.trim());return {message:'Đã kết thúc phiên. API từ chối phiên đã kết thúc sau tối đa 5 giây.'};});
  }
  app.post('/api/admin/users/:id/sessions/revoke',admin,(req,res)=>endSession(req,res,protectedTarget(req)));
  app.post('/api/me/sessions/revoke',(req,res)=>endSession(req,res,req.staff));
  const visible=req=>({sql:"(n.user_id=? OR (n.audience='security' AND ?=1))",args:[req.staff.id,['admin','auditor'].includes(req.staff.role)?1:0]});
  app.get('/api/notifications',(req,res)=>{
    const v=visible(req);send(req,res,200,{items:store.all("SELECT n.*,r.read_at FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=? WHERE "+v.sql+' ORDER BY n.created_at DESC,n.id DESC LIMIT 100',req.staff.id,...v.args),unread:store.one('SELECT COUNT(*) AS n FROM notifications n LEFT JOIN notification_reads r ON r.notification_id=n.id AND r.user_id=? WHERE '+v.sql+' AND r.read_at IS NULL',req.staff.id,...v.args).n});
  });
  app.post('/api/notifications/read-all',(req,res)=>{fields(req.body,[]);const v=visible(req);mutate(req,res,'NOTIFICATIONS_READ',()=>{store.run('INSERT OR IGNORE INTO notification_reads(notification_id,user_id,read_at) SELECT n.id,?,? FROM notifications n WHERE '+v.sql,req.staff.id,now().toISOString(),...v.args);return {message:'Đã đánh dấu thông báo đã đọc.'};});});
  app.patch('/api/notifications/:id/read',(req,res)=>{fields(req.body,[]);const v=visible(req);mutate(req,res,'NOTIFICATION_READ',()=>{if(!store.one('SELECT n.id FROM notifications n WHERE n.id=? AND '+v.sql,req.params.id,...v.args))reject(404,'NOT_FOUND','Không tìm thấy thông báo.');store.run('INSERT OR IGNORE INTO notification_reads(notification_id,user_id,read_at) VALUES(?,?,?)',req.params.id,req.staff.id,now().toISOString());return {message:'Đã đọc thông báo.'};});});
  app.post('/api/corrections/:id/cancel',(req,res)=>{fields(req.body,[]);mutate(req,res,'CORRECTION_CANCELLED',()=>{const r=store.one('SELECT * FROM corrections WHERE id=? AND user_id=?',req.params.id,req.staff.id);if(!r)reject(404,'NOT_FOUND','Không tìm thấy đơn của bạn.');if(r.status!=='pending')reject(409,'ALREADY_REVIEWED','Chỉ được rút đơn đang chờ duyệt.');store.run("UPDATE corrections SET status='cancelled',reviewed_at=?,review_note=? WHERE id=?",now().toISOString(),'Người gửi đã rút đơn.',r.id);return {message:'Đã rút đơn điều chỉnh.'};});});
}
module.exports={registerOperations};
