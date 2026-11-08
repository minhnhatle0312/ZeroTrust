const {randomUUID}=require('node:crypto');
const configuration=require('../directory/directory-config.json');

function createDirectory({store,identity,providerId='',intervalSeconds=300,now=()=>new Date(),checkAccount}) {
  const cache=new Map(),pending=new Map(),paths=configuration.mappings.map(m=>m.keycloakPath);
  let running=false,providerCache=null;
  const configured=!!providerId;
  if(configured)store.run("UPDATE directory_sync_jobs SET state='partial',finished_at=?,message=? WHERE provider_id=? AND state IN ('pending','running')",now().toISOString(),'Tiến trình khởi động lại trước khi xác nhận đầy đủ. Hãy đồng bộ lại.',providerId);
  const policyError=(code,message)=>Object.assign(new Error(message),{code,status:code==='DIRECTORY_UNAVAILABLE'?503:409});
  async function providerState(){
    if(providerCache?.until>Date.now())return providerCache.value;
    let value;try{value=await identity.directoryProvider(providerId);}catch{providerCache=null;throw policyError('DIRECTORY_UNAVAILABLE','Chưa đọc được cấu hình nguồn LDAP.');}
    if(!value.enabled||value.editMode!=='READ_ONLY'||value.cachePolicy!=='NO_CACHE')throw policyError('DIRECTORY_UNAVAILABLE','Nguồn LDAP đã tắt hoặc chính sách khác cấu hình được phép.');
    providerCache={until:Date.now()+5000,value};return value;
  }
  async function entry(id,fresh=false) {
    if(!configured)throw policyError('DIRECTORY_UNAVAILABLE','Chưa cấu hình nguồn LDAP.');
    await providerState();
    const old=cache.get(id);if(!fresh&&old&&old.until>Date.now())return old.value;
    let value;
    try{value=await identity.directoryUser(id,paths);}catch{cache.delete(id);throw policyError('DIRECTORY_UNAVAILABLE','Chưa đọc được dữ liệu LDAP qua Keycloak.');}
    if(value.providerId!==providerId)return null;
    const mapped=value.groups.filter(g=>paths.includes(g.path));
    const mapping=mapped.length===1?configuration.mappings.find(m=>m.keycloakPath===mapped[0].path):null;
    const businessRoles=mapping?mapped[0].roles.filter(r=>['admin','employee','manager','auditor'].includes(r)):[];
    const valid=!!mapping&&businessRoles.length===1&&businessRoles[0]===mapping.role&&value.directRoles.length===0&&
      typeof value.team==='string'&&value.team.trim().length>=2&&value.team.length<=80&&
      typeof value.username==='string'&&/^ldap-[a-zA-Z0-9._-]{1,45}$/.test(value.username)&&
      typeof value.name==='string'&&value.name.length>=2&&value.name.length<=100&&value.mfaRequired===true&&
      ['active','disabled'].includes(value.sourceStatus);
    const result={...value,role:mapping?.role || null,state:valid?(value.sourceStatus==='active'?'active':'disabled'):'conflict',groups:mapped.map(g=>g.path),observedAt:now().toISOString()};
    cache.set(id,{until:Date.now()+5000,value:result});return result;
  }
  async function apply(id,fresh=false) {
    if(pending.has(id))return pending.get(id);
    const task=(async()=>{
      if(store.one("SELECT user_id FROM directory_maintenance WHERE user_id=? AND state='writing'",id))throw policyError('DIRECTORY_UNAVAILABLE','Danh tính đang được cập nhật tại LDAP; giữ chặn cho đến khi thao tác nguồn hoàn tất.');
      const value=await entry(id,fresh);if(!value)return null;
      const old=store.one('SELECT * FROM staff WHERE id=?',id);
      if(old&&old.identity_source!=='ldap')throw policyError('DIRECTORY_CONFLICT','Không ghi đè tài khoản local bằng nguồn LDAP.');
      if(old&&old.directory_provider_id!==providerId)throw policyError('DIRECTORY_CONFLICT','Hồ sơ đang thuộc một nguồn danh tính khác.');
      if(store.one('SELECT id FROM staff WHERE username=? COLLATE NOCASE AND id<>?',value.username,id))throw policyError('DIRECTORY_CONFLICT','Tên LDAP trùng hồ sơ hiện có; cần đối chiếu thủ công.');
      const changed=old&&(old.username!==value.username||old.name!==value.name||old.email!==value.email||old.team!==value.team||old.role!==value.role||old.directory_status!==value.state||old.directory_groups!==JSON.stringify(value.groups));
      if(changed){
        store.tx(()=>store.run("UPDATE staff SET revoked_before=?,directory_status='pending' WHERE id=?",Math.floor(now().getTime()/1000),id));
        try{await identity.remediate(id,'revoke');}catch{throw policyError('DIRECTORY_UNAVAILABLE','Chưa xác nhận thu hồi phiên; tài khoản vẫn tạm chặn đồng bộ.');}
      }
      const stamp=value.observedAt;
      store.tx(()=>{
        if(store.one("SELECT user_id FROM directory_maintenance WHERE user_id=? AND state='writing'",id))throw policyError('DIRECTORY_UNAVAILABLE','Giữ chặn: thao tác ghi LDAP chưa hoàn tất.');
        if(old)store.run('UPDATE staff SET username=?,name=?,email=?,team=?,role=?,mfa_required=1,identity_source=?,directory_provider_id=?,directory_status=?,directory_groups=?,directory_synced_at=?,security_updated_at=? WHERE id=?',value.username,value.name,value.email,value.team,value.role || old.role,'ldap',providerId,value.state,JSON.stringify(value.groups),stamp,stamp,id);
        else {
          const join=store.one("SELECT id FROM lifecycle_workflows WHERE kind='join' AND source='ldap' AND username=? COLLATE NOCASE AND approval='approved' AND state<>'synced'",value.username);
          store.run('INSERT INTO staff(id,username,name,email,team,role,mfa_required,identity_source,directory_provider_id,directory_status,directory_groups,directory_synced_at,security_updated_at,governance_state) VALUES(?,?,?,?,?,?,1,?,?,?,?,?,?,?)',id,value.username,value.name,value.email,value.team || 'Chưa ánh xạ',value.role || 'employee','ldap',providerId,value.state,JSON.stringify(value.groups),stamp,stamp,join?'onboarding':'active');
        }
        store.run("UPDATE directory_maintenance SET state='released',finished_at=? WHERE user_id=? AND state='ready'",stamp,id);
        if(!old||changed){
          store.event({requestId:randomUUID(),method:'SYNC',originalUrl:'/directory/users',staff:{id:null,username:'directory-sync',role:'service'},claims:{azp:'directory-sync'}},200,'DIRECTORY_PROFILE_SYNCED',id);
          store.notify({userId:id,title:old?'Danh tính LDAP đã thay đổi':'Hồ sơ LDAP đã được cấp',body:'Hồ sơ, nhóm và quyền được lấy từ thư mục. '+(old?'Hãy đăng nhập lại để dùng quyền mới.':''),section:'profile',time:stamp});
        }
        if(value.state==='conflict')store.alert({actorId:id,username:value.username,kind:'Xung đột ánh xạ LDAP',severity:'high',time:stamp});
      });
      checkAccount?.invalidate?.(id);
      return {user:store.one('SELECT * FROM staff WHERE id=?',id),created:!old,changed:!!changed};
    })().finally(()=>pending.delete(id));
    pending.set(id,task);return task;
  }
  async function refresh(id) {
    const current=store.one('SELECT * FROM staff WHERE id=?',id);
    // A maintenance hold is released only by an explicit/periodic directory sync.
    if(current?.directory_status==='maintenance')return current;
    const result=await apply(id);
    if(!result&&current)throw policyError('DIRECTORY_CONFLICT','Liên kết nguồn LDAP không còn khớp.');
    return result?.user || null;
  }
  function jobView(job){if(!job)return null;const {remote_json,...safe}=job;return {...safe,remote:remote_json?JSON.parse(remote_json):null};}
  function state() {
    return {configured,providerId:providerId || null,name:configuration.name,editMode:'READ_ONLY',
      scheduleSeconds:intervalSeconds,authCacheSeconds:5,users:store.one("SELECT COUNT(*) AS total,SUM(directory_status='active') AS active,SUM(directory_status IN ('conflict','missing','pending','maintenance')) AS issues FROM staff WHERE identity_source='ldap' AND directory_provider_id=?",providerId),
      lastJob:jobView(store.one('SELECT * FROM directory_sync_jobs WHERE provider_id=? ORDER BY rowid DESC LIMIT 1',providerId)),mappings:configuration.mappings};
  }
  async function perform(jobId,mode) {
    let imported=0,updated=0,blocked=0,errors=0,conflicts=0,remote=null,complete=false;
    const seen=new Set();
    store.run("UPDATE directory_sync_jobs SET state='running' WHERE id=?",jobId);
    try {
      const provider=await identity.directoryProvider(providerId);
      if(!provider.enabled||provider.editMode!=='READ_ONLY'||provider.cachePolicy!=='NO_CACHE')throw Error('Unsafe federation configuration');
      remote=await identity.syncDirectory(providerId,mode);
      const listed=await identity.directoryUsers(providerId);
      // Group membership changes can be independent from a user's modifyTimestamp,
      // so even a changed sync reconciles all imported users within the scan limit.
      for(const u of listed.users){
        seen.add(u.id);
        try{const result=await apply(u.id,true);if(!result){errors++;continue;}if(result.created)imported++;else if(result.changed)updated++;if(result.user.directory_status!=='active'||result.user.disabled)blocked++;if(['conflict','pending','maintenance'].includes(result.user.directory_status))conflicts++;}
        catch{errors++;}
      }
      complete=listed.complete&&Number(remote?.failed || 0)===0&&Number(remote?.ignored || 0)===0;
      if(complete){
        for(const u of store.all("SELECT * FROM staff WHERE identity_source='ldap' AND directory_provider_id=?",providerId)){
          if(seen.has(u.id))continue;
          store.run("UPDATE staff SET directory_status='missing',revoked_before=?,directory_synced_at=? WHERE id=?",Math.floor(now().getTime()/1000),now().toISOString(),u.id);
          checkAccount?.invalidate?.(u.id);cache.delete(u.id);blocked++;conflicts++;
          try{await identity.remediate(u.id,'revoke');}catch{errors++;}
        }
      }
      const status=complete&&errors===0&&conflicts===0?'synced':'partial';
      store.run('UPDATE directory_sync_jobs SET state=?,finished_at=?,imported=?,updated=?,blocked=?,error_count=?,message=?,remote_json=? WHERE id=?',status,now().toISOString(),imported,updated,blocked,errors,status==='synced'?'Đã đối chiếu nguồn LDAP, Keycloak và hồ sơ ứng dụng.':'Có mục bị chặn, lỗi hoặc danh sách chưa đầy đủ. Kiểm tra trước khi sử dụng.',JSON.stringify({added:remote?.added || 0,updated:remote?.updated || 0,failed:remote?.failed || 0,complete}),jobId);
    } catch {
      store.run("UPDATE directory_sync_jobs SET state='failed',finished_at=?,imported=?,updated=?,blocked=?,error_count=?,message=? WHERE id=?",now().toISOString(),imported,updated,blocked,errors+1,'Chưa xác nhận được nguồn LDAP/Keycloak hoặc quyền dịch vụ. Không suy ra danh sách rỗng và không báo thành công.',jobId);
    } finally {running=false;}
  }
  function queue({actorId=null,note='Đồng bộ nguồn LDAP định kỳ.',mode='full',request=null}={}) {
    if(!configured)throw policyError('DIRECTORY_UNAVAILABLE','Chưa cấu hình LDAP. Áp dụng scripts/setup_week6.py khi sẵn sàng.');
    if(running||store.one("SELECT id FROM directory_sync_jobs WHERE provider_id=? AND state IN ('pending','running')",providerId))throw policyError('DIRECTORY_BUSY','Một lượt đồng bộ LDAP đang được xử lý.');
    const id=randomUUID();
    store.tx(()=>{store.run('INSERT INTO directory_sync_jobs(id,provider_id,mode,state,actor_id,note,started_at) VALUES(?,?,?,?,?,?,?)',id,providerId,mode,'pending',actorId,note,now().toISOString());store.event(request || {requestId:randomUUID(),method:'SYNC',originalUrl:'/directory/sync',staff:{id:null,username:'directory-sync',role:'service'},claims:{azp:'directory-sync'}},202,'DIRECTORY_SYNC_QUEUED',id);});
    running=true;setImmediate(()=>perform(id,mode).catch(()=>{running=false;}));return jobView(store.one('SELECT * FROM directory_sync_jobs WHERE id=?',id));
  }
  return {configured,providerId,configuration,state,entry,refresh,provision:refresh,queue,jobView,reconcileForGovernance:id=>apply(id,true),
    async synchronizeForGovernance(){
      if(!configured||running)throw policyError('DIRECTORY_BUSY','Nguồn chưa cấu hình hoặc đang đồng bộ.');
      running=true;
      try{await providerState();const result=await identity.syncDirectory(providerId,'full');if(Number(result?.failed || 0)||Number(result?.ignored || 0))throw policyError('DIRECTORY_UNAVAILABLE','Lượt nhập LDAP chưa đầy đủ.');return result;}
      finally{running=false;}
    },
    async allowEnable(user){const value=await entry(user.id,true);if(!value||value.state!=='active')throw policyError('DIRECTORY_CONFLICT','Nguồn LDAP chưa active hoặc còn xung đột; không được mở tài khoản bằng cách bỏ qua nguồn.');},
    async observe(){if(!configured)return {...state(),connection:{status:'not_configured',observedAt:null}};try{return {...state(),provider:await identity.directoryProvider(providerId),connection:{status:'keycloak_reachable',observedAt:now().toISOString(),note:'Đọc được cấu hình Keycloak; kết quả bind LDAP được xác nhận bởi lượt đồng bộ, không suy từ HTTP 200.'}};}catch{return {...state(),connection:{status:'unavailable',observedAt:now().toISOString()}};}}
  };
}

function registerDirectory(app,{directory,store,roles,send,mutate,fields,text,reject}) {
  const security=roles('admin','auditor');
  app.get('/api/security/directory',security,async(req,res)=>send(req,res,200,await directory.observe()));
  app.get('/api/security/directory/users',security,(req,res)=>{
    const page=Number(req.query.page || 1),limit=Number(req.query.limit || 20),q=String(req.query.q || '').trim();
    if(!Number.isSafeInteger(page)||page<1||page>100000||!Number.isSafeInteger(limit)||limit<1||limit>100||q.length>120)reject(400,'INVALID_QUERY','Trang, số dòng hoặc từ khóa không hợp lệ.');
    const args=[directory.providerId],conditions=["identity_source='ldap'",'directory_provider_id=?'];
    if(q){conditions.push("instr(fold(username||' '||name||' '||team),fold(?))>0");args.push(q);}
    if(req.query.state){if(!['active','disabled','missing','pending','maintenance','conflict'].includes(req.query.state))reject(400,'INVALID_FILTER','Trạng thái LDAP không hợp lệ.');conditions.push('directory_status=?');args.push(req.query.state);}
    const where=conditions.join(' AND '),total=store.one('SELECT COUNT(*) AS n FROM staff WHERE '+where,...args).n;
    const items=store.all('SELECT id,username,name,email,team,role,disabled,mfa_required,directory_status,directory_groups,directory_synced_at FROM staff WHERE '+where+' ORDER BY username LIMIT ? OFFSET ?',...args,limit,(page-1)*limit).map(u=>({...u,disabled:!!u.disabled,groups:JSON.parse(u.directory_groups)}));
    send(req,res,200,{items,total,page,limit});
  });
  app.get('/api/security/directory/mappings',security,(req,res)=>send(req,res,200,{items:directory.configuration.mappings,editMode:'READ_ONLY',teamAttribute:'ou',statusAttribute:'employeeType',mfaAttribute:'businessCategory'}));
  app.get('/api/security/directory/jobs',security,(req,res)=>send(req,res,200,{items:store.all('SELECT * FROM directory_sync_jobs WHERE provider_id=? ORDER BY rowid DESC LIMIT 50',directory.providerId).map(directory.jobView)}));
  app.post('/api/security/directory/sync',roles('admin'),(req,res)=>{
    fields(req.body,['mode','note']);if(!['full','changed'].includes(req.body.mode)||!text(req.body.note,10,300))reject(400,'INVALID_SYNC','Chọn full/changed và ghi lý do 10–300 ký tự.');
    const job=directory.queue({actorId:req.staff.id,mode:req.body.mode,note:req.body.note.trim(),request:req});
    res.status(202).json({status:'PENDING',message:'Đã xếp lịch đồng bộ. Theo dõi kết quả, không đóng cửa sổ để suy ra thành công.',job,requestId:req.requestId});
  });
}
module.exports={createDirectory,registerDirectory};
