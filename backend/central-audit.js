const {randomUUID,createHash}=require('node:crypto');

function createCentralAudit({store,url='',token='',identity,collectorOptions={}}){
  const configured=!!url&&!!token;
  if(configured){const endpoint=new URL(url);if(!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname)&&endpoint.protocol!=='https:')throw Error('Remote audit requires HTTPS');}
  store.db.exec(`
    CREATE TABLE IF NOT EXISTS audit_meta(key TEXT PRIMARY KEY,value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS audit_outbox(seq INTEGER PRIMARY KEY AUTOINCREMENT,source TEXT NOT NULL,event_key TEXT NOT NULL,payload TEXT NOT NULL,delivered_at TEXT,UNIQUE(source,event_key));
    CREATE INDEX IF NOT EXISTS audit_pending ON audit_outbox(delivered_at,seq);
    CREATE TABLE IF NOT EXISTS audit_delivery(id INTEGER PRIMARY KEY CHECK(id=1),last_success TEXT,last_error TEXT,failures INTEGER NOT NULL DEFAULT 0,retry_at INTEGER NOT NULL DEFAULT 0);
    INSERT OR IGNORE INTO audit_delivery(id) VALUES(1);
  `);
  store.run('INSERT OR IGNORE INTO audit_meta(key,value) VALUES(?,?)','instance',randomUUID());
  const instance=store.one("SELECT value FROM audit_meta WHERE key='instance'").value;
  // Same projection for backfill and future inserts. No request bodies, credentials or arbitrary details.
  function projection(table,prefix){
    const r=prefix?prefix+'.':'';
    const col=name=>r+name;
    const source=table==='events'?`CASE ${col('client_id')} WHEN 'employee-portal' THEN 'web-a' WHEN 'security-dashboard' THEN 'web-b' ELSE 'api' END`:"'keycloak'";
    const fields=table==='events'?[['action',col('reason')],['resource',col('path')],['decision',col('decision')],['http_status',col('status')],['request_id',col('request_id')],['session_id',col('session_ref')],['user_id',col('actor_id')]]:
      [['action',col('type')],['decision',`CASE WHEN ${col('error')} IS NOT NULL OR ${col('type')} LIKE '%_ERROR' THEN 'DENY' ELSE 'ALLOW' END`],['user_id',col('user_id')],['session_id',col('session_ref')]];
    fields.push(['timestamp',col('time')],['source',source],['username',col('username')],['client_id',col('client_id')],['ip_address',col('ip_address')]);
    const details=table==='events'?`json_object('role',${col('role')},'method',${col('method')})`:`json_object('error',${col('error')})`;
    return `'${table}',CAST(${col('id')} AS TEXT),json_object(${fields.map(([k,v])=>`'${k}',${v}`).join(',')},'details',${details})`;
  }
  if(!store.all('PRAGMA table_info(identity_events)').some(c=>c.name==='session_ref'))store.db.exec('ALTER TABLE identity_events ADD COLUMN session_ref TEXT');
  for(const table of ['events','identity_events']){
    store.db.exec(`CREATE TRIGGER IF NOT EXISTS audit_${table}_insert AFTER INSERT ON ${table} BEGIN INSERT OR IGNORE INTO audit_outbox(source,event_key,payload) VALUES(${projection(table,'NEW')}); END;`);
    store.db.exec(`INSERT OR IGNORE INTO audit_outbox(source,event_key,payload) SELECT ${projection(table,'')} FROM ${table};`);
  }
  async function call(path,method='GET',body){
    if(!configured){const e=Error('Audit PostgreSQL chưa được cấu hình.');e.status=503;throw e;}
    let response;
    try{response=await fetch(url.replace(/\/$/,'')+path,{method,headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(15000),redirect:'error'});}
    catch{throw Error('Audit service unavailable');}
    const data=await response.json();if(!response.ok){const e=Error(data.message || 'Audit service unavailable');e.status=response.status;throw e;}return data;
  }
  let running;
  async function deliver({force=false}={}){
    const previous=store.one('SELECT * FROM audit_delivery WHERE id=1');
    if(!configured||(!force&&previous.retry_at>Date.now()))return health();
    try{
      for(let page=0;page<10;page++){
        const rows=store.all('SELECT * FROM audit_outbox WHERE delivered_at IS NULL ORDER BY seq LIMIT 200');
        if(!rows.length)break;
        const events=rows.map(row=>({...JSON.parse(row.payload),event_id:instance+':'+row.source+':'+row.event_key}));
        const result=await call('/ingest','POST',{events});
        if(result.accepted!==rows.length)throw Error('Incomplete audit acknowledgement');
        store.tx(()=>{for(const row of rows)store.run('UPDATE audit_outbox SET delivered_at=? WHERE seq=?',new Date().toISOString(),row.seq);});
      }
      store.run('UPDATE audit_delivery SET last_success=?,last_error=NULL,failures=0,retry_at=0 WHERE id=1',new Date().toISOString());
    }catch{
      const failures=previous.failures+1;
      store.run('UPDATE audit_delivery SET failures=?,last_error=?,retry_at=? WHERE id=1',failures,'Chưa gửi được audit; dữ liệu còn trong SQLite.',Date.now()+Math.min(300000,1000*2**Math.min(failures,9)));
    }
    return health();
  }
  function health(){return {configured,...store.one('SELECT * FROM audit_delivery WHERE id=1'),pending:store.one('SELECT count(*) AS n FROM audit_outbox WHERE delivered_at IS NULL').n,adminCollector:adminCollector.state};}
  const adminCollector=require('./identity-events').createIdentityCollector({store,identity,...collectorOptions,name:'keycloak-admin',
    fetchPage:options=>identity.adminEvents(options),persistCustom:e=>{
      if(!Number.isFinite(Number(e.time)))throw Error('Invalid administrative event time');
      const safe={timestamp:new Date(Number(e.time)).toISOString(),source:'keycloak-admin',user_id:e.userId || null,client_id:e.clientId || null,ip_address:e.ipAddress || null,
        action:String(e.operationType || 'UNKNOWN').slice(0,100),resource:String(e.resourcePath || '').split('?')[0].slice(0,300),decision:e.error?'DENY':'ALLOW',details:{error:e.error || null,resource_type:e.resourceType || null}};
      const id=String(e.id || createHash('sha256').update(JSON.stringify(safe)).digest('hex'));
      return Number(store.run('INSERT OR IGNORE INTO audit_outbox(source,event_key,payload) VALUES(?,?,?)','keycloak-admin',id,JSON.stringify(safe)).changes)>0;
    }});
  return {call,health,adminCollector,deliver(options){if(running)return running;running=deliver(options).finally(()=>{running=null;});return running;}};
}

function registerCentralAudit(app,{store,roles,send,fields,reject,text}){
  const audit=app.locals.centralAudit,reader=roles('admin','auditor'),admin=roles('admin');
  const proxy=async(req,res,path,method='GET',body)=>{
    try{const result=await audit.call(path,method,body);send(req,res,200,result,'CENTRAL_AUDIT_'+(method==='GET'?'READ':'UPDATE'));}
    catch(e){reject([400,404,409].includes(e.status)?e.status:503,'CENTRAL_AUDIT_UNAVAILABLE',e.status===409?'Dữ liệu vừa thay đổi. Hãy tải lại.':e.status===400?'Bộ lọc hoặc nội dung không hợp lệ.':'Chưa đọc được Audit PostgreSQL. Nhật ký SQLite vẫn được lưu.');}
  };
  const query=req=>{const q=new URLSearchParams();for(const key of ['from','to','source','decision','user_id','request_id','session_id','client_id','action','q','offset','limit','state'])if(typeof req.query[key]==='string')q.set(key,req.query[key]);return '?'+q;};
  app.get('/api/security/central/health',reader,async(req,res)=>{
    let remote=null;try{remote=await audit.call('/health');}catch{/* Health stays readable during an outage. */}
    send(req,res,200,{local:audit.health(),remote,identity:app.locals.identityCollector.state,directory:{configured:app.locals.directory.configured},gaps:store.all('SELECT * FROM collector_gaps ORDER BY detected_at DESC LIMIT 100')});
  });
  for(const resource of ['events','summary','incidents','operations'])app.get('/api/security/central/'+resource,reader,(req,res)=>proxy(req,res,'/'+resource+query(req)));
  for(const resource of ['events','incidents'])app.get('/api/security/central/'+resource+'/:id',reader,(req,res)=>proxy(req,res,'/'+resource+'/'+encodeURIComponent(req.params.id)));
  for(const resource of ['status','results','evaluations'])app.get('/api/security/central/detection/'+resource,reader,(req,res)=>{
    const q=new URLSearchParams();for(const key of ['prediction','offset'])if(typeof req.query[key]==='string')q.set(key,req.query[key]);
    return proxy(req,res,'/detection/'+resource+'?'+q);
  });
  for(const resource of ['run','evaluate','config'])app.post('/api/security/central/detection/'+resource,admin,(req,res)=>{
    fields(req.body,resource==='config'?['config','version']:[]);return proxy(req,res,'/detection/'+resource,'POST',{...req.body,actor:req.staff.id});
  });
  app.get('/api/security/central/detection/evaluations/:id',reader,(req,res)=>proxy(req,res,'/detection/evaluations/'+encodeURIComponent(req.params.id)));
  app.post('/api/security/central/detection/labels/:id',reader,(req,res)=>{
    fields(req.body,['label','split','note','scenario','version']);return proxy(req,res,'/detection/labels/'+encodeURIComponent(req.params.id),'POST',{...req.body,actor:req.staff.id});
  });
  app.post('/api/security/central/incidents/:id',admin,(req,res)=>{
    fields(req.body,['state','version','note']);if(!text(req.body.note,10,500)||!Number.isInteger(req.body.version))reject(400,'INVALID_REVIEW','Cần ghi chú 10–500 ký tự và phiên bản.');
    return proxy(req,res,'/incidents/'+encodeURIComponent(req.params.id),'POST',{...req.body,actor:req.staff.id});
  });
  app.post('/api/security/central/settings',admin,(req,res)=>{fields(req.body,['retention_days','login_threshold','deny_threshold']);return proxy(req,res,'/settings','POST',{...req.body,actor:req.staff.id});});
  app.post('/api/security/central/retention',admin,(req,res)=>{fields(req.body,['apply','confirm']);return proxy(req,res,'/retention','POST',{...req.body,actor:req.staff.id});});
  app.post('/api/security/central/retry',admin,async(req,res)=>{fields(req.body,[]);await audit.deliver({force:true});send(req,res,200,{local:audit.health()},'AUDIT_DELIVERY_RETRY');});
  app.post('/api/security/central/backfill',admin,(req,res)=>{
    fields(req.body,['source','from','note']);
    if(!['keycloak','keycloak-admin'].includes(req.body.source)||!text(req.body.note,10,300)||typeof req.body.from!=='string')reject(400,'INVALID_BACKFILL','Cần nguồn, thời điểm và lý do 10–300 ký tự.');
    const collector=req.body.source==='keycloak'?app.locals.identityCollector:audit.adminCollector;
    let state;try{store.tx(()=>{state=collector.backfill(req.body.from);store.event(req,200,'AUDIT_BACKFILL_REQUESTED',req.body.source);});}catch{reject(409,'BACKFILL_UNAVAILABLE','Collector đang chạy hoặc thời điểm vượt thời hạn lưu nguồn.');}
    res.json({state,message:'Đã đặt checkpoint để lấy bù trong lượt thu thập kế tiếp.',requestId:req.requestId});
  });
}
module.exports={createCentralAudit,registerCentralAudit};
