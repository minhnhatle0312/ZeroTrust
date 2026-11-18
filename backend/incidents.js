// Investigation records only. This module cannot invoke identity/account/session actions.
const {randomUUID}=require('node:crypto');
const policy=require('../audit/incident-policy.json');
const states=['open','reviewing','resolved','false_positive'];
const executionEvent=/^(?:REMEDIATION_|ACCOUNT_CHANGE_|ALERT_REVIEW$|CENTRAL_INCIDENT_|INCIDENT_REVIEW$|SESSION_TERMINATED$)/;
const after=(a,b)=>Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Date.parse(a)>Date.parse(b);
const atOrAfter=(a,b)=>Number.isFinite(Date.parse(a))&&Number.isFinite(Date.parse(b))&&Date.parse(a)>=Date.parse(b);
const sensitive=/(?:Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN [^-]*PRIVATE KEY-----|(?:password|client_secret|refresh_token|access_token|otp_secret)\s*[:=])/i;
function migrate(db){
  db.exec('BEGIN IMMEDIATE');
  try{
    const columns=new Set(db.prepare('PRAGMA table_info(alerts)').all().map(c=>c.name));
    for(const [name,type] of [['version','INTEGER NOT NULL DEFAULT 1'],['detected_at','TEXT'],['last_observed_at','TEXT'],['investigation_json',"TEXT NOT NULL DEFAULT '{}'"]])if(!columns.has(name))db.exec('ALTER TABLE alerts ADD COLUMN '+name+' '+type);
    db.exec(`CREATE TABLE IF NOT EXISTS alert_evidence (
      alert_id TEXT NOT NULL REFERENCES alerts(id), source TEXT NOT NULL CHECK(source IN ('events','identity_events')),
      event_id TEXT NOT NULL, PRIMARY KEY(alert_id,source,event_id));
      CREATE TABLE IF NOT EXISTS alert_history (
      id TEXT PRIMARY KEY,alert_id TEXT NOT NULL REFERENCES alerts(id),version INTEGER NOT NULL,
      actor TEXT NOT NULL,actor_name TEXT NOT NULL,request_id TEXT NOT NULL,time TEXT NOT NULL,
      state TEXT NOT NULL,note TEXT NOT NULL,change_json TEXT NOT NULL,
      UNIQUE(alert_id,version));
      CREATE INDEX IF NOT EXISTS alert_history_time ON alert_history(alert_id,version);
      CREATE TABLE IF NOT EXISTS incident_migrations(version INTEGER PRIMARY KEY,applied_at TEXT NOT NULL);
      INSERT OR IGNORE INTO incident_migrations(version,applied_at) VALUES(1,strftime('%Y-%m-%dT%H:%M:%fZ','now'));`);
    db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}
}
const aliases={'Vượt quyền chức năng':'INSUFFICIENT_ROLE','Sử dụng phiên đã thu hồi':'SESSION_REVOKED','Truy cập Web B trái quyền':'DASHBOARD_ACCESS_DENIED','Token không hợp lệ':'INVALID_TOKEN','Tài khoản đã khóa':'ACCOUNT_DISABLED','Chưa hoàn tất thiết lập MFA':'MFA_SETUP_REQUIRED','Xung đột ánh xạ LDAP':'DIRECTORY_CONFLICT','Đăng nhập Keycloak thất bại':'LOGIN_ERROR'};
function eventView(row,source){
  return {ref:source+':'+row.id,source:source==='identity_events'?'keycloak':row.client_id==='employee-portal'?'web-a':row.client_id==='security-dashboard'?'web-b':'api',
    id:String(row.id),occurredAt:row.time,userId:row.actor_id??row.user_id??null,username:row.username??null,ip:row.ip_address??null,application:row.client_id??null,
    resource:row.path??null,requestId:row.request_id??null,sessionRef:row.session_ref??null,type:row.reason??row.type,
    decision:row.decision??(row.error||row.type?.endsWith('_ERROR')?'DENY':'ALLOW'),httpStatus:row.status??null};
}
function evidence(store,alert){
  const links=store.all('SELECT source,event_id FROM alert_evidence WHERE alert_id=? ORDER BY source,event_id LIMIT 501',alert.id);
  const items=[],missing=[];
  for(const link of links.slice(0,500)){
    const row=store.one('SELECT * FROM '+link.source+' WHERE id=?',link.event_id);
    if(row)items.push({...eventView(row,link.source),relation:'direct'});else missing.push(link.source+':'+link.event_id);
  }
  return {items:items.sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt)||a.ref.localeCompare(b.ref)),complete:links.length<=500,missing,
    provenance:links.length?'exact-source-links':'legacy-no-exact-links'};
}
function metadata(row){return JSON.parse(row.investigation_json);}
function detail(store,row,options={}){
  const proof=evidence(store,row),meta=metadata(row);
  const references=new Set([...(meta.assessment?.evidenceRefs||[]),...(meta.verification?.evidenceRefs||[]),...(meta.recommendations||[]).flatMap(r=>r.evidenceRefs)]);
  for(const ref of references){
    if(proof.items.some(e=>e.ref===ref))continue;
    if(proof.items.length>=500){proof.complete=false;break;}
    const match=/^(events|identity_events):(.{1,240})$/.exec(ref),event=match&&store.one('SELECT * FROM '+match[1]+' WHERE id=?',match[2]);
    if(event)proof.items.push({...eventView(event,match[1]),relation:'investigation'});else proof.missing.push(ref);
  }
  const size=options.limit||100,before=options.before;
  const history=store.all('SELECT * FROM alert_history WHERE alert_id=?'+(before?' AND version<?':'')+' ORDER BY version DESC LIMIT ?',row.id,...(before?[before]:[]),size+1);
  const changes=history.slice(0,size).map(h=>({...h,change:JSON.parse(h.change_json),change_json:undefined}));
  const handler=store.one('SELECT actor,actor_name,time FROM alert_history WHERE alert_id=? ORDER BY version DESC LIMIT 1',row.id);
  const actions=(meta.actionRefs||[]).map(ref=>{const a=store.one('SELECT id,actor_id,target_id,action,state,remote_state,time,updated_at,message FROM actions WHERE id=?',ref.slice(7));return a?{ref,kind:'recorded_execution',...a}: {ref,kind:'unavailable',missing:true};});
  const rule=aliases[row.kind]||row.kind;
  const guidance=proof.items.length?[{kind:'system_proposal',rule,policyVersion:policy.version,text:policy.rules[rule]||policy.fallback,evidenceRefs:proof.items.map(e=>e.ref),executed:false}]:[];
  const verification=meta.verification||null,last=row.last_observed_at||row.created_at;
  const verified=proof.complete&&!proof.missing.length&&verification?.result==='passed'&&verification.evidenceRefs.length>0&&verification.evidenceRefs.every(ref=>proof.items.some(e=>e.ref===ref&&e.decision===verification.expectedDecision&&after(e.occurredAt,last)&&Date.parse(e.occurredAt)<=Date.now()&&!executionEvent.test(e.type)))&&actions.every(a=>a.state==='synced'&&a.remote_state==='confirmed'&&a.updated_at&&verification.observations.every(e=>atOrAfter(e.time,a.updated_at)));
  const timeline=[...proof.items.map(e=>({kind:'source_event',time:e.occurredAt,ref:e.ref})),...(row.detected_at?[{kind:'detection',time:row.detected_at,source:'backend',incidentId:row.id}]:[]),...changes.map(h=>({kind:'investigation',time:h.time,version:h.version,actor:h.actor,state:h.state,note:h.note}))].sort((a,b)=>Date.parse(a.time)-Date.parse(b.time));
  return {schemaVersion:1,origin:'sqlite',incidentRef:'sqlite:'+row.id,id:row.id,type:row.kind,rule,severity:row.severity,state:row.status,version:row.version,
    occurredAt:row.created_at,detectedAt:row.detected_at,lastObservedAt:row.last_observed_at,updatedAt:row.updated_at,
    subject:{userId:row.actor_id||null,username:row.actor_id?row.username:null},
    facts:{count:row.count,ips:[...new Set(proof.items.map(e=>e.ip).filter(Boolean))],applications:[...new Set(proof.items.map(e=>e.application).filter(Boolean))],resources:[...new Set(proof.items.map(e=>e.resource).filter(Boolean))],requestIds:[...new Set(proof.items.map(e=>e.requestId).filter(Boolean))]},
    evidence:proof,assessment:meta.assessment||null,recommendations:{generated:guidance,recorded:meta.recommendations||[]},actions,verification,
    resolution:{verified:!!(row.status==='resolved'&&verified),basis:verification?'analyst_verification':'not_verified',legacy:!handler&&['resolved','false_positive'].includes(row.status)},
    legacyNote:!handler&&row.note?{text:row.note,source:'legacy_current_field',recordedAt:null}:null,
    handler:handler?{id:handler.actor,name:handler.actor_name,time:handler.time}:null,
    history:{items:changes,complete:history.length<=size,nextCursor:history.length>size?changes.at(-1).version:null},timeline:{items:timeline,complete:proof.complete&&history.length<=size},
    limitations:[...(!row.detected_at?['Legacy detection timestamp is not recorded.']:[]),...(!proof.items.length?['No exact source evidence is available; account context is not proof of causality.']:[])]};
}
function validText(value,min,max){return typeof value==='string'&&value.trim().length>=min&&value.length<=max&&!sensitive.test(value)&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);}
function validateUpdate(body,{fields,reject,actionPrefix='action'}){
  fields(body,['status','note','version','assessment','recommendation','actionRefs','verification']);
  if(!validText(body.note,10,500)||(body.status!==undefined&&!states.includes(body.status)))reject(400,'INVALID_REVIEW','Cần ghi chú 10–500 ký tự, không chứa credential, và trạng thái hợp lệ.');
  const structured=['assessment','recommendation','actionRefs','verification'].some(k=>Object.hasOwn(body,k));
  if((structured||body.version!==undefined)&&(!Number.isSafeInteger(body.version)||body.version<1))reject(400,'INVALID_VERSION','Cần phiên bản hiện tại trước khi cập nhật điều tra.');
  for(const key of ['assessment','recommendation','verification'])if(body[key]!==undefined){
    const v=body[key];fields(v,key==='assessment'?['text','confidence','evidenceRefs']:key==='recommendation'?['text','evidenceRefs']:['result','method','expectedDecision','evidenceRefs']);
    if(!validText(key==='verification'?v.method:v.text,10,1000)||!Array.isArray(v.evidenceRefs)||v.evidenceRefs.length>100||v.evidenceRefs.some(r=>!validText(r,1,300)))reject(400,'INVALID_INVESTIGATION','Nội dung và tham chiếu bằng chứng không hợp lệ.');
    if(key==='assessment'&&!['hypothesis','supported','confirmed','refuted'].includes(v.confidence))reject(400,'INVALID_ASSESSMENT','Mức xác minh nguyên nhân không hợp lệ.');
    if(key==='assessment'&&v.confidence!=='hypothesis'&&!v.evidenceRefs.length)reject(400,'EVIDENCE_REQUIRED','Nhận định đã xác minh cần bằng chứng.');
    if(key==='recommendation'&&!v.evidenceRefs.length)reject(400,'EVIDENCE_REQUIRED','Đề xuất cần có căn cứ.');
    if(key==='verification'&&(!['passed','failed','inconclusive'].includes(v.result)||!['ALLOW','DENY'].includes(v.expectedDecision)||!v.evidenceRefs.length))reject(400,'INVALID_VERIFICATION','Cần kết quả, phương pháp và bằng chứng kiểm tra thực tế.');
  }
  const actionPattern=actionPrefix==='audit'?/^audit:.{1,240}$/:/^action:[A-Za-z0-9-]{1,150}$/;
  if(body.actionRefs!==undefined&&(!Array.isArray(body.actionRefs)||body.actionRefs.length>100||body.actionRefs.some(r=>!validText(r,1,300)||!actionPattern.test(r))))reject(400,'INVALID_ACTION_REFERENCE','Chỉ liên kết hành động đã ghi nhận; API này không thực thi hành động.');
}
function update(store,req,row,body,c){
  const {reject,now}=c;
  if(body.version!==undefined&&body.version!==row.version)reject(409,'INCIDENT_CONFLICT','Sự cố vừa thay đổi. Tải lại trước khi cập nhật.');
  // Old clients may append a review note/open -> reviewing. They cannot overwrite structured facts or close unverified incidents.
  if(body.version===undefined&&body.status&&body.status!==row.status&&!(row.status==='open'&&body.status==='reviewing'))reject(409,'VERSION_REQUIRED','Cập nhật trạng thái này cần phiên bản và bằng chứng kiểm tra.');
  const meta=metadata(row),proof=evidence(store,row),direct=proof.items,available=new Map(direct.map(e=>[e.ref,e]));
  const resolveRef=ref=>{
    if(available.has(ref))return available.get(ref);
    const match=/^(events|identity_events):(.{1,240})$/.exec(ref);
    if(!match)reject(400,'INVALID_EVIDENCE','Tham chiếu không hợp lệ.');
    const source=match[1],r=store.one('SELECT * FROM '+source+' WHERE id=?',match[2]),e=r&&eventView(r,source);
    // No correlation based solely on anonymous usernames or a shared IP.
    if(!e||!row.actor_id||e.userId!==row.actor_id)reject(404,'EVIDENCE_NOT_FOUND','Không tìm thấy bằng chứng trong phạm vi danh tính của sự cố.');
    if(e.ref!==ref)reject(400,'INVALID_EVIDENCE','Sử dụng đúng tham chiếu chuẩn do API cung cấp.');
    available.set(ref,e);return e;
  };
  for(const key of ['assessment','recommendation','verification'])for(const ref of body[key]?.evidenceRefs||[])resolveRef(ref);
  const stamp=now().toISOString(),actor=req.staff.id;
  if(body.assessment)meta.assessment={...body.assessment,kind:'analyst_assessment',actor,time:stamp};
  if(body.recommendation){meta.recommendations=[...(meta.recommendations||[]),{...body.recommendation,id:randomUUID(),kind:'analyst_proposal',actor,time:stamp,executed:false}];if(meta.recommendations.length>100)reject(400,'INVESTIGATION_LIMIT','Đã đạt giới hạn 100 đề xuất.');}
  if(body.actionRefs){
    for(const ref of body.actionRefs){const a=store.one('SELECT target_id FROM actions WHERE id=?',ref.slice(7));if(!a||!row.actor_id||a.target_id!==row.actor_id)reject(404,'ACTION_NOT_FOUND','Hành động không thuộc danh tính của sự cố.');}
    meta.actionRefs=[...new Set([...(meta.actionRefs||[]),...body.actionRefs])];if(meta.actionRefs.length>100)reject(400,'INVESTIGATION_LIMIT','Đã đạt giới hạn liên kết hành động.');
  }
  const status=body.status||row.status;
  if(status==='open'||status==='reviewing')delete meta.verification;
  if(body.verification){
    const v=body.verification,observations=v.evidenceRefs.map(resolveRef),last=row.last_observed_at||row.created_at;
    if(v.result==='passed'){
      if(!direct.length)reject(400,'INCOMPLETE_EVIDENCE','Chưa có liên kết bằng chứng nguồn chính xác để xác nhận khắc phục.');
      if(observations.some(e=>e.decision!==v.expectedDecision||!after(e.occurredAt,last)||Date.parse(e.occurredAt)>Date.parse(stamp)||executionEvent.test(e.type)))reject(400,'INVALID_VERIFICATION','Cần bằng chứng kiểm tra độc lập sau sự kiện, không dùng thời gian tương lai hoặc nhật ký hành động thay kết quả kiểm tra.');
      for(const ref of meta.actionRefs||[]){const a=store.one('SELECT state,remote_state,updated_at FROM actions WHERE id=?',ref.slice(7));if(!a||a.state!=='synced'||a.remote_state!=='confirmed'||!a.updated_at||observations.some(e=>!atOrAfter(e.occurredAt,a.updated_at)))reject(409,'ACTION_NOT_VERIFIED','Hành động chưa xác nhận hoặc kiểm tra diễn ra trước hành động.');}
    }
    meta.verification={...v,kind:'analyst_verification',actor,time:stamp,observations:observations.map(e=>({ref:e.ref,time:e.occurredAt,decision:e.decision}))};
  }
  if(status==='resolved'&&meta.verification?.result!=='passed')reject(400,'VERIFICATION_REQUIRED','Chưa thể xác nhận khắc phục nếu thiếu kết quả kiểm tra đạt và bằng chứng.');
  if(status==='resolved'){
    if(!proof.complete||proof.missing.length)reject(400,'INCOMPLETE_EVIDENCE','Bằng chứng nguồn thiếu hoặc vượt giới hạn chi tiết; chưa xác nhận khắc phục.');
    const v=meta.verification,last=row.last_observed_at||row.created_at,observations=v.evidenceRefs.map(resolveRef);
    if(!observations.length||observations.some(e=>e.decision!==v.expectedDecision||!after(e.occurredAt,last)||Date.parse(e.occurredAt)>Date.parse(stamp)||executionEvent.test(e.type)))reject(400,'INVALID_VERIFICATION','Kết quả kiểm tra không còn phù hợp với bằng chứng nguồn.');
    for(const ref of meta.actionRefs||[]){const a=store.one('SELECT state,remote_state,updated_at FROM actions WHERE id=?',ref.slice(7));if(!a||a.state!=='synced'||a.remote_state!=='confirmed'||!a.updated_at||observations.some(e=>!atOrAfter(e.occurredAt,a.updated_at)))reject(409,'ACTION_NOT_VERIFIED','Cần kiểm tra lại kết quả hành động.');}
  }
  if(status==='false_positive'&&(!meta.assessment||!['supported','confirmed','refuted'].includes(meta.assessment.confidence)||!meta.assessment.evidenceRefs.length))reject(400,'ASSESSMENT_REQUIRED','Cần nhận định có bằng chứng để xác nhận cảnh báo hợp lệ/nhầm.');
  const result=store.run('UPDATE alerts SET status=?,note=?,reviewer=?,updated_at=?,version=version+1,investigation_json=? WHERE id=? AND version=?',status,body.note.trim(),req.staff.username,stamp,JSON.stringify(meta),row.id,row.version);
  if(result.changes!==1)reject(409,'INCIDENT_CONFLICT','Sự cố vừa thay đổi.');
  store.run('INSERT INTO alert_history(id,alert_id,version,actor,actor_name,request_id,time,state,note,change_json) VALUES(?,?,?,?,?,?,?,?,?,?)',randomUUID(),row.id,row.version+1,actor,req.staff.username,req.requestId,stamp,status,body.note.trim(),JSON.stringify({before:{state:row.status,note:row.note,reviewer:row.reviewer,updatedAt:row.updated_at,investigation:metadata(row)},after:{state:status,investigation:meta},legacyClient:body.version===undefined}));
  store.event(req,200,'ALERT_REVIEW',row.id);
  return {message:'Đã lưu điều tra. Không thực hiện hành động lên tài khoản.',version:row.version+1,legacyClient:body.version===undefined};
}
function registerIncidents(app,c){
  const {store,roles,send,fields,reject}=c;
  const get=id=>{if(typeof id!=='string'||id.length>150||!/^[A-Za-z0-9-]+$/.test(id))reject(404,'NOT_FOUND','Không tìm thấy sự cố.');const row=store.one('SELECT * FROM alerts WHERE id=?',id);if(!row)reject(404,'NOT_FOUND','Không tìm thấy sự cố.');return row;};
  app.get('/api/security/alerts/:id',roles('admin','auditor'),(req,res)=>{
    const row=get(req.params.id),limit=Number(req.query.historyLimit||100),before=req.query.historyBefore===undefined?undefined:Number(req.query.historyBefore);
    if(!Number.isSafeInteger(limit)||limit<1||limit>100||(before!==undefined&&(!Number.isSafeInteger(before)||before<1)))reject(400,'INVALID_HISTORY_PAGE','Giới hạn hoặc con trỏ lịch sử không hợp lệ.');
    send(req,res,200,{alert:{...row,investigation_json:undefined},detail:detail(store,row,{limit,before})});
  });
  app.patch('/api/security/alerts/:id',roles('admin'),(req,res)=>{
    validateUpdate(req.body,c);let result;store.tx(()=>{result=update(store,req,get(req.params.id),req.body,c);});res.json({...result,requestId:req.requestId});
  });
}
module.exports={migrate,detail,evidence,validateUpdate,update,registerIncidents,eventView,validText};
