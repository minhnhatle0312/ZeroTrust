const express = require('express');
const { randomUUID } = require('node:crypto');
const ROLES = ['employee','manager','admin','auditor'];
function localDay(d=new Date()) { return new Date(d.getTime()+7*3600000).toISOString().slice(0,10); }
function lateMinutes(d) { const t=new Date(new Date(d).getTime()+7*3600000); return Math.max(0,t.getUTCHours()*60+t.getUTCMinutes()-480); }
class Rejection extends Error { constructor(status,code,message) { super(message); this.status=status; this.code=code; } }
function reject(status,code,message) { throw new Rejection(status,code,message); }
function fields(body, allowed) {
  if(!body || typeof body !== 'object' || Array.isArray(body)) reject(400,'INVALID_BODY','Dữ liệu phải là một đối tượng JSON.');
  if(Object.keys(body).some(k=>!allowed.includes(k))) reject(400,'FIELD_NOT_ALLOWED','Có trường dữ liệu không được phép.');
}
function text(v,min,max) { return typeof v==='string' && v.trim().length>=min && v.length<=max; }
function validDay(d) { return typeof d==='string' && /^\d{4}-\d{2}-\d{2}$/.test(d) && !Number.isNaN(Date.parse(d)) && new Date(d).toISOString().slice(0,10)===d; }
function createApp({store,verify,identity,origin='http://localhost:5173',now=()=>new Date(),rateLimit=120}) {
  const app=express(), buckets=new Map();
  app.disable('x-powered-by');
  app.use((req,res,next)=>{ req.requestId=randomUUID(); res.set({'X-Request-Id':req.requestId,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'none'; frame-ancestors 'none'"}); next(); });
  function send(req,res,status,body,reason='AUTHORIZED') { store.tx(()=>store.event(req,status,reason)); return res.status(status).json({...body,requestId:req.requestId}); }
  function mutate(req,res,action,fn,status=200) { const body=store.tx(()=>{const b=fn();store.event(req,status,action);return b;});return res.status(status).json({status:'ALLOW',...body,requestId:req.requestId}); }
  app.use((req,res,next)=>{
    const from=req.headers.origin;
    if(from && from!==origin) return next(new Rejection(403,'ORIGIN_DENIED','Nguồn truy cập không được phép.'));
    if(from) res.set({'Access-Control-Allow-Origin':origin,Vary:'Origin','Access-Control-Expose-Headers':'X-Request-Id'});
    if(req.method==='OPTIONS') {res.set({'Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS','Access-Control-Allow-Headers':'Authorization,Content-Type'});return res.sendStatus(204);} next();
  });
  app.use(express.json({limit:'16kb',strict:true}));
  app.get('/health',(_req,res)=>res.json({status:'OK',service:'Attendance API',version:2}));
  app.use('/api',async(req,res,next)=>{
    try {
      if(!/^Bearer \S+$/.test(req.headers.authorization || '')) reject(401,'MISSING_TOKEN','Vui lòng đăng nhập.');
      let p; try {p=await verify(req.headers.authorization.slice(7));} catch {reject(401,'INVALID_TOKEN','Phiên đăng nhập không hợp lệ hoặc đã hết hạn.');}
      req.claims=p;req.staff=store.one('SELECT * FROM staff WHERE id=?',p.sub || '');
      if(!req.staff) reject(403,'UNREGISTERED','Tài khoản chưa được cấp hồ sơ nhân viên.');
      if(req.staff.disabled) reject(403,'ACCOUNT_DISABLED','Tài khoản đã bị khóa. Liên hệ quản trị viên.');
      if(!Number.isInteger(p.iat) || p.iat<=req.staff.revoked_before) reject(401,'SESSION_REVOKED','Phiên đã bị thu hồi. Hãy đăng nhập lại.');
      const tokenRoles=Array.isArray(p.realm_access?.roles)?p.realm_access.roles:[];
      req.roles=tokenRoles.filter(r=>ROLES.includes(r) && r===req.staff.role);
      if(!req.roles.length) reject(403,'INSUFFICIENT_ROLE','Vai trò không khớp hồ sơ nhân viên.');
      const key=req.staff.id,current=Date.now();
      if(buckets.size>10000) for(const [k,v] of buckets) if(v.until<current) buckets.delete(k);
      let b=buckets.get(key);if(!b || b.until<current){b={count:0,until:current+60000};buckets.set(key,b);}
      if(++b.count>rateLimit){res.set('Retry-After','60');reject(429,'RATE_LIMIT','Quá nhiều yêu cầu. Thử lại sau 1 phút.');}next();
    }catch(e){next(e);}
  });
  const roles=(...list)=>(req,_res,next)=>{if(!req.roles.some(r=>list.includes(r)))return next(new Rejection(403,'INSUFFICIENT_ROLE','Bạn không có quyền thực hiện thao tác này.'));next();};
  function scope(req,target){if(req.roles.includes('admin') || (req.roles.includes('manager') && req.staff.team===target.team))return;reject(403,'CROSS_TEAM','Chỉ được truy cập nhân viên trong nhóm của mình.');}
  function month(req){const m=req.query.month || localDay(now()).slice(0,7);if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(m))reject(400,'INVALID_DATE','Tháng không hợp lệ.');return m;}
  const staffView=u=>({id:u.id,username:u.username,name:u.name,team:u.team,role:u.role,disabled:!!u.disabled});
  app.get('/api/profile',(req,res)=>send(req,res,200,{status:'ALLOW',...staffView(req.staff),roles:req.roles,serverTime:now().toISOString(),schedule:{start:'08:00',end:'17:00',timezone:'Asia/Ho_Chi_Minh'}}));
  app.get('/api/attendance',(req,res)=>{
    if(req.query.userId && req.query.userId!==req.staff.id)reject(403,'NOT_OWNER','Chỉ được xem bảng công của mình.');
    send(req,res,200,{records:store.all('SELECT * FROM attendance WHERE user_id=? AND day LIKE ? ORDER BY day DESC',req.staff.id,month(req)+'%'),today:store.one('SELECT * FROM attendance WHERE user_id=? AND day=?',req.staff.id,localDay(now())) || null,week:store.all('SELECT * FROM attendance WHERE user_id=? AND day>=? ORDER BY day',req.staff.id,localDay(new Date(now().getTime()-6*86400000)))});
  });
  app.post('/api/attendance/check-in',(req,res)=>{
    fields(req.body,[]);const stamp=now().toISOString(),day=localDay(now());
    mutate(req,res,'CHECK_IN',()=>{if(store.one('SELECT id FROM attendance WHERE user_id=? AND day=?',req.staff.id,day))reject(409,'ALREADY_CHECKED_IN','Bạn đã chấm công vào hôm nay.');const id=randomUUID();store.run('INSERT INTO attendance(id,user_id,day,check_in,late_minutes,updated_at) VALUES(?,?,?,?,?,?)',id,req.staff.id,day,stamp,lateMinutes(stamp),stamp);return {message:'Đã ghi nhận giờ vào.',record:store.one('SELECT * FROM attendance WHERE id=?',id)};},201);
  });
  app.post('/api/attendance/check-out',(req,res)=>{
    fields(req.body,[]);mutate(req,res,'CHECK_OUT',()=>{
      const row=store.one('SELECT * FROM attendance WHERE user_id=? AND day=?',req.staff.id,localDay(now()));
      if(!row)reject(409,'NO_CHECK_IN','Bạn chưa chấm công vào hôm nay.');if(row.check_out)reject(409,'ALREADY_CHECKED_OUT','Bạn đã chấm công ra hôm nay.');
      const stamp=now().toISOString();if(stamp<row.check_in)reject(409,'CLOCK_ERROR','Giờ máy chủ không hợp lệ.');
      store.run('UPDATE attendance SET check_out=?,updated_at=? WHERE id=?',stamp,stamp,row.id);return {message:'Đã ghi nhận giờ ra.',record:store.one('SELECT * FROM attendance WHERE id=?',row.id)};
    });
  });
  app.get('/api/corrections',(req,res)=>send(req,res,200,{requests:store.all('SELECT * FROM corrections WHERE user_id=? ORDER BY created_at DESC LIMIT 100',req.staff.id)}));
  app.post('/api/corrections',(req,res)=>{
    fields(req.body,['day','checkIn','checkOut','reason']);const {day,checkIn,checkOut,reason}=req.body;
    if(!validDay(day) || day>localDay(now()) || day<localDay(new Date(now().getTime()-31*86400000)))reject(400,'INVALID_DATE','Chỉ tạo đơn cho 31 ngày gần nhất, không dùng ngày tương lai.');
    if(![checkIn,checkOut].every(v=>typeof v==='string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(v)) || checkOut<=checkIn)reject(400,'INVALID_TIME','Giờ ra phải sau giờ vào trong cùng ngày.');
    if(!text(reason,10,500))reject(400,'INVALID_REASON','Lý do cần từ 10 đến 500 ký tự.');
    const i=new Date(`${day}T${checkIn}:00+07:00`).toISOString(),o=new Date(`${day}T${checkOut}:00+07:00`).toISOString();
    if(o>now().toISOString())reject(400,'FUTURE_TIME','Giờ đề nghị không được ở tương lai.');
    mutate(req,res,'CORRECTION_REQUEST',()=>{
      if(store.one("SELECT id FROM corrections WHERE user_id=? AND day=? AND status='pending'",req.staff.id,day))reject(409,'DUPLICATE_REQUEST','Đã có đơn đang chờ duyệt cho ngày này.');
      const id=randomUUID();store.run('INSERT INTO corrections(id,user_id,day,check_in,check_out,reason,created_at) VALUES(?,?,?,?,?,?,?)',id,req.staff.id,day,i,o,reason.trim(),now().toISOString());return {message:'Đã gửi đơn điều chỉnh.',id};
    },201);
  });
  app.get('/api/team',roles('manager','admin'),(req,res)=>{
    const m=month(req),members=req.roles.includes('admin')?store.all('SELECT * FROM staff ORDER BY name'):store.all('SELECT * FROM staff WHERE team=? ORDER BY name',req.staff.team),records=[],requests=[];
    for(const s of members){records.push(...store.all('SELECT a.*,s.name,s.team FROM attendance a JOIN staff s ON s.id=a.user_id WHERE a.user_id=? AND a.day LIKE ? ORDER BY day DESC',s.id,m+'%'));requests.push(...store.all("SELECT c.*,s.name,s.team FROM corrections c JOIN staff s ON s.id=c.user_id WHERE c.user_id=? AND c.status='pending' ORDER BY c.created_at DESC",s.id));}
    send(req,res,200,{members:members.map(staffView),records,requests});
  });
  app.patch('/api/corrections/:id',roles('manager','admin'),(req,res)=>{
    fields(req.body,['decision','note']);const {decision,note}=req.body;
    if(!['approved','rejected'].includes(decision) || !text(note,5,300))reject(400,'INVALID_REVIEW','Cần quyết định hợp lệ và ghi chú 5–300 ký tự.');
    mutate(req,res,'CORRECTION_'+decision.toUpperCase(),()=>{
      const row=store.one('SELECT c.*,s.team FROM corrections c JOIN staff s ON c.user_id=s.id WHERE c.id=?',req.params.id);
      if(!row)reject(404,'NOT_FOUND','Không tìm thấy đơn.');scope(req,row);
      if(row.user_id===req.staff.id)reject(403,'SELF_APPROVAL','Không được tự duyệt đơn của mình.');if(row.status!=='pending')reject(409,'ALREADY_REVIEWED','Đơn đã được xử lý.');
      const stamp=now().toISOString();store.run('UPDATE corrections SET status=?,reviewer_id=?,reviewed_at=?,review_note=? WHERE id=?',decision,req.staff.id,stamp,note.trim(),row.id);
      if(decision==='approved')store.run(`INSERT INTO attendance(id,user_id,day,check_in,check_out,late_minutes,updated_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET check_in=excluded.check_in,check_out=excluded.check_out,late_minutes=excluded.late_minutes,updated_at=excluded.updated_at`,randomUUID(),row.user_id,row.day,row.check_in,row.check_out,lateMinutes(row.check_in),stamp);
      return {message:decision==='approved'?'Đã duyệt và cập nhật bảng công.':'Đã từ chối đơn.'};
    });
  });
  app.get('/api/security',roles('admin','auditor'),(req,res)=>send(req,res,200,{openCount:store.one("SELECT COUNT(*) AS n FROM alerts WHERE status IN ('open','reviewing')").n,alerts:store.all('SELECT * FROM alerts ORDER BY updated_at DESC LIMIT 100'),events:store.all('SELECT * FROM events ORDER BY id DESC LIMIT 100'),actions:store.all('SELECT a.*,s.name AS target_name FROM actions a JOIN staff s ON s.id=a.target_id ORDER BY time DESC LIMIT 30')}));
  app.patch('/api/security/alerts/:id',roles('admin'),(req,res)=>{
    fields(req.body,['status','note']);if(!['reviewing','resolved','false_positive'].includes(req.body.status) || !text(req.body.note,10,500))reject(400,'INVALID_REVIEW','Chọn trạng thái và ghi chú điều tra ít nhất 10 ký tự.');
    mutate(req,res,'ALERT_REVIEW',()=>{const a=store.one('SELECT * FROM alerts WHERE id=?',req.params.id);if(!a)reject(404,'NOT_FOUND','Không tìm thấy cảnh báo.');store.run('UPDATE alerts SET status=?,note=?,reviewer=?,updated_at=? WHERE id=?',req.body.status,req.body.note.trim(),req.staff.username,now().toISOString(),a.id);return {message:'Đã cập nhật kết quả điều tra.'};});
  });
  app.get('/api/admin/users',roles('admin'),(req,res)=>send(req,res,200,{users:store.all('SELECT * FROM staff ORDER BY name').map(staffView)}));
  app.post('/api/admin/users/:id/actions',roles('admin'),async(req,res)=>{
    fields(req.body,['action','note']);const {action,note}=req.body;
    if(!['revoke','disable','enable','require-mfa'].includes(action) || !text(note,10,300))reject(400,'INVALID_ACTION','Cần thao tác hợp lệ và lý do ít nhất 10 ký tự.');
    const target=store.one('SELECT * FROM staff WHERE id=?',req.params.id);
    if(!target)reject(404,'NOT_FOUND','Không tìm thấy tài khoản.');if(target.id===req.staff.id || target.role==='admin')reject(403,'PROTECTED_ADMIN','Tài khoản quản trị được bảo vệ; quản lý trực tiếp trong Keycloak.');
    const id=randomUUID();
    store.tx(()=>{
      if(store.one("SELECT id FROM actions WHERE target_id=? AND state='pending'",target.id))reject(409,'ACTION_PENDING','Tài khoản đang có thao tác xử lý. Vui lòng chờ.');
      if(action!=='enable')store.run('UPDATE staff SET revoked_before=?,disabled=? WHERE id=?',Math.floor(now().getTime()/1000),action==='disable'?1:target.disabled,target.id);
      store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state) VALUES(?,?,?,?,?,?,?)',id,req.staff.id,target.id,action,note.trim(),now().toISOString(),'pending');store.event(req,202,'REMEDIATION_REQUESTED',target.id);
    });
    let synced=false;try{await identity.remediate(target.id,action);synced=true;}catch{/* Keep local containment if Keycloak is unavailable. */}
    const message=synced?'Đã áp dụng trên ứng dụng và Keycloak.':'Keycloak chưa đồng bộ. Biện pháp chặn cục bộ vẫn giữ; hãy thử lại thao tác khi Keycloak sẵn sàng.';
    store.tx(()=>{if(synced && action==='enable')store.run('UPDATE staff SET disabled=0 WHERE id=?',target.id);store.run('UPDATE actions SET state=?,message=? WHERE id=?',synced?'synced':'partial',message,id);store.event(req,synced?200:202,synced?'REMEDIATION_SYNCED':'REMEDIATION_PARTIAL',target.id);});
    res.status(synced?200:202).json({status:synced?'ALLOW':'PARTIAL',message,requestId:req.requestId});
  });
  app.get('/api/security/keycloak',roles('admin','auditor'),async(req,res)=>{try{const [policy,events]=await Promise.all([identity.policy(),identity.events()]);send(req,res,200,{connected:true,policy,events});}catch{send(req,res,503,{connected:false,message:'Không đọc được Keycloak. Kiểm tra service account.'},'IDENTITY_UNAVAILABLE');}});
  app.get('/api/manager',roles('manager','admin'),(req,res)=>send(req,res,200,{status:'ALLOW',resource:'Manager Dashboard'}));
  app.get('/api/admin',roles('admin'),(req,res)=>send(req,res,200,{status:'ALLOW',resource:'Admin Resource'}));
  app.get('/api/audit',roles('admin','auditor'),(req,res)=>{const n=Number(req.query.limit || 20);if(!Number.isInteger(n)||n<1||n>100)reject(400,'INVALID_LIMIT','limit phải từ 1 đến 100.');send(req,res,200,{status:'ALLOW',events:store.all('SELECT * FROM events ORDER BY id DESC LIMIT ?',n)});});
  app.use('/api',(_req,_res,next)=>next(new Rejection(404,'NOT_FOUND','Không có chức năng này.')));
  app.use((error,req,res,_next)=>{
    if(res.headersSent)return;let status=error.status || 503,code=error.code || 'SERVICE_UNAVAILABLE',message=error instanceof Rejection?error.message:'Dịch vụ tạm thời không sẵn sàng.';
    if(error.type==='entity.parse.failed'){status=400;code='INVALID_JSON';message='JSON không hợp lệ.';}if(error.type==='entity.too.large'){status=413;code='BODY_TOO_LARGE';message='Dữ liệu vượt kích thước cho phép.';}
    try{store.tx(()=>store.event(req,status,code));}catch{status=503;code='AUDIT_UNAVAILABLE';message='Không thể ghi nhật ký. Thao tác bị từ chối.';}
    res.status(status).json({status:'DENY',code,message,requestId:req.requestId});
  });
  return app;
}
module.exports={createApp,localDay,lateMinutes};
