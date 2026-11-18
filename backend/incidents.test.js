const {test}=require('node:test');
const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const path=require('node:path');
const http=require('node:http');
const {DatabaseSync}=require('node:sqlite');
const {openStore}=require('./store');
const {createApp}=require('./app');
const incidents=require('./incidents');
const cryptoReady=import('jose').then(async j=>({...j,...await j.generateKeyPair('RS256')}));
const note='Đối chiếu bằng chứng trong môi trường kiểm thử.';
const issuer='https://fixture.invalid/realms/test',audience='employee-api';
async function fixture(options={}){
  const store=openStore(':memory:'),j=await cryptoReady,calls=[];
  for(const [id,role] of [['a','admin'],['e','employee'],['x','employee'],['m','manager'],['u','auditor']])store.run('INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)',id,'fixture-'+id,'Fixture '+id,id==='x'?'other':'test',role);
  const app=createApp({store,issuer,rateLimit:10000,identity:{async remediate(){calls.push('remediate');},async events(){return [];},async policy(){return {};},...options.identity},centralAuditOptions:options.centralAuditOptions,
    verify:async value=>(await j.jwtVerify(value,j.publicKey,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','iat','exp']})).payload});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));const base='http://127.0.0.1:'+server.address().port;
  async function req(id,route,method='GET',body,claims={}){
    const role=store.one('SELECT role FROM staff WHERE id=?',id)?.role||'employee';
    const token=id===null?null:await new j.SignJWT({sub:id,iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+300,iss:issuer,aud:audience,azp:['admin','auditor'].includes(role)?'security-dashboard':'employee-portal',realm_access:{roles:[role]},...claims}).setProtectedHeader({alg:'RS256'}).sign(j.privateKey);
    const r=await fetch(base+route,{method,headers:{...(token?{Authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,body:await r.json()};
  }
  function event(user='e',when='2026-10-01T01:00:00.000Z',decision='DENY',reason='INSUFFICIENT_ROLE'){
    return String(store.run('INSERT INTO events(request_id,time,actor_id,username,method,path,status,decision,reason,client_id,ip_address) VALUES(?,?,?,?,?,?,?,?,?,?,?)',randomUUID(),when,user,'fixture-'+user,'GET','/api/admin',decision==='DENY'?403:200,decision,reason,'employee-portal','192.0.2.1').lastInsertRowid);
  }
  const eventId=event(),id=store.alert({actorId:'e',username:'fixture-e',kind:'Vượt quyền chức năng',severity:'high',time:'2026-10-01T01:00:00.000Z',evidence:{source:'events',id:eventId}});
  return {store,req,calls,id,eventId,event,async close(){await new Promise(r=>server.close(r));store.db.close();}};
}
function scenario(name,fn,options){test(name,async()=>{const f=await fixture(options);try{await fn(f);}finally{await f.close();}});}
scenario('INC-AUTH: missing JWT denied',async f=>assert.equal((await f.req(null,'/api/security/alerts/'+f.id)).status,401));
scenario('INC-AUTH: wrong audience and expired JWT denied',async f=>{for(const claims of [{aud:'wrong'},{exp:1}])assert.equal((await f.req('u','/api/security/alerts/'+f.id,'GET',undefined,claims)).status,401);});
for(const role of ['e','m'])scenario('INC-RBAC: role '+role+' cannot read or write incidents',async f=>{for(const [route,method,body] of [['/api/security/alerts/'+f.id,'GET'],['/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',version:1,note}],['/api/security/alert-list','GET']])assert.equal((await f.req(role,route,method,body)).status,403);});
scenario('INC-RBAC: auditor reads but cannot investigate',async f=>{assert.equal((await f.req('u','/api/security/alerts/'+f.id)).status,200);assert.equal((await f.req('u','/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',version:1,note})).status,403);});
scenario('INC-DETAIL: facts, exact event links and proposals never claim a cause/execution',async f=>{
  const r=await f.req('u','/api/security/alerts/'+f.id);assert.equal(r.status,200);const d=r.body.detail;
  assert.equal(d.schemaVersion,1);assert.equal(d.evidence.items[0].ref,'events:'+f.eventId);assert.equal(d.assessment,null);assert.equal(d.verification,null);assert.equal(d.resolution.verified,false);assert.equal(d.recommendations.generated[0].executed,false);assert.deepEqual(d.actions,[]);assert.equal(d.facts.ips[0],'192.0.2.1');assert.equal(d.timeline.items.some(e=>e.kind==='detection'),true);
});
scenario('INC-MISSING: nonexistent and malformed incident return 404',async f=>{for(const id of ['missing','%2F..','x'.repeat(151)])assert.equal((await f.req('u','/api/security/alerts/'+id)).status,404);});
scenario('INC-LEGACY: missing source stays unknown; anonymous context is never evidence',async f=>{
  const id=f.store.alert({kind:'Unknown fixture'});f.store.run('UPDATE alerts SET detected_at=NULL,note=?,status=? WHERE id=?',note,'resolved',id);
  const r=await f.req('u','/api/security/alerts/'+id);assert.equal(r.body.detail.detectedAt,null);assert.equal(r.body.detail.assessment,null);assert.equal(r.body.detail.evidence.items.length,0);assert.equal(r.body.detail.recommendations.generated.length,0);assert.equal(r.body.detail.resolution.verified,false);assert.equal(r.body.detail.legacyNote.text,note);
  const c=await f.req('u','/api/security/alerts/'+id+'/context');assert.deepEqual(c.body.events,[]);assert.deepEqual(c.body.logins,[]);assert.equal(c.body.contextIsEvidence,false);
});
scenario('INC-LEGACY: a follow-up alone cannot fill missing original source evidence',async f=>{
  const id=f.store.alert({actorId:'e',username:'fixture-e',kind:'Legacy unknown source',time:'2026-10-01T01:00:00.000Z'}),follow=f.event('e','2026-10-01T02:00:00.000Z','ALLOW','AUTHORIZED');assert.equal((await f.req('a','/api/security/alerts/'+id,'PATCH',{status:'resolved',version:1,note,verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+follow]}})).body.code,'INCOMPLETE_EVIDENCE');
});
scenario('INC-FILTER: status severity source and time filters preserve pagination shape',async f=>{
  for(const [query,total] of [['severity=high&source=web-a',1],['source=keycloak',0],['status=resolved',0],['from=2026-10-01&to=2026-10-01&timeField=occurred',1],['from=2026-10-02&timeField=occurred',0]]){const r=await f.req('u','/api/security/alert-list?'+query);assert.equal(r.status,200);assert.equal(r.body.total,total);assert.ok(Array.isArray(r.body.items));}
  for(const query of ['source=unknown','timeField=bad','page=0','from=2026-12-01&to=2026-01-01'])assert.equal((await f.req('u','/api/security/alert-list?'+query)).status,400);
});
scenario('INC-REVIEW: assessment, proposal and immutable history persist with audit',async f=>{
  const b={status:'reviewing',note,version:1,assessment:{text:note,confidence:'supported',evidenceRefs:['events:'+f.eventId]},recommendation:{text:note,evidenceRefs:['events:'+f.eventId]}};
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',b)).status,200);
  const r=await f.req('u','/api/security/alerts/'+f.id);assert.equal(r.body.detail.assessment.kind,'analyst_assessment');assert.equal(r.body.detail.recommendations.recorded[0].executed,false);assert.equal(r.body.detail.history.items[0].actor,'a');assert.ok(r.body.detail.history.items[0].request_id);assert.ok(f.store.one("SELECT id FROM events WHERE reason='ALERT_REVIEW' AND target=?",f.id));assert.equal(f.calls.length,0);
});
scenario('INC-CLOSE: unverified legacy and structured resolutions refused',async f=>{
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',note})).status,409);
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',note,version:1})).body.code,'VERIFICATION_REQUIRED');assert.equal(f.store.one('SELECT status FROM alerts WHERE id=?',f.id).status,'open');
});
scenario('INC-LEGACY: old client can append a review without destroying structured facts',async f=>{
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',note})).status,200);
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',note:note+' Again.'})).status,200);assert.equal(f.store.one('SELECT count(*) AS n FROM alert_history WHERE alert_id=?',f.id).n,2);
});
scenario('INC-IDOR: cross-identity evidence and actions refused',async f=>{
  const outside=f.event('x');f.store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state) VALUES(?,?,?,?,?,?,?)','outside-action','a','x','disable',note,'2026-10-01T02:00:00Z','synced');
  for(const b of [{assessment:{text:note,confidence:'supported',evidenceRefs:['events:'+outside]}},{actionRefs:['action:outside-action']}])assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{version:1,note,...b})).status,404);
});
scenario('INC-INPUT: malformed version, forged actor, unsupported fields and credential-like notes refused',async f=>{
  for(const b of [{version:0},{version:'1'},{actor:'x'},{assessment:{text:note,confidence:'confirmed',evidenceRefs:[]}},{recommendation:{text:note,evidenceRefs:[]}},{note:'Bearer '+randomUUID()}])assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{version:1,note,...b})).status,400);
});
scenario('INC-VERIFY: recorded follow-up result permits explicit analyst resolution',async f=>{
  const follow=f.event('e','2026-10-01T02:00:00.000Z','ALLOW','AUTHORIZED');
  const r=await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+follow]}});assert.equal(r.status,200);
  const d=(await f.req('u','/api/security/alerts/'+f.id)).body.detail;assert.equal(d.resolution.verified,true);assert.equal(d.verification.kind,'analyst_verification');assert.ok(d.evidence.items.some(e=>e.ref==='events:'+follow&&e.relation==='investigation'));assert.equal(f.calls.length,0);
});
scenario('INC-VERIFY: old/wrong-decision evidence cannot verify remediation',async f=>{
  for(const ref of [f.eventId,f.event('e','2026-10-01T02:00:00.000Z','DENY')])assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+ref]}})).status,400);
});
scenario('INC-VERIFY: execution and investigation logs cannot replace a follow-up test',async f=>{
  for(const reason of ['REMEDIATION_SYNCED','ALERT_REVIEW','INCIDENT_REVIEW']){const ref=f.event('e','2026-10-01T02:00:00.000Z','ALLOW',reason);assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+ref]}})).status,400);}
});
scenario('INC-VERIFY: future evidence and timezone-order bypass are rejected',async f=>{
  for(const when of ['2100-01-01T00:00:00.000Z','2026-10-01T02:00:00+07:00']){const ref=f.event('e',when,'ALLOW','AUTHORIZED');assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+ref]}})).status,400);}
});
scenario('INC-HISTORY: cursor returns older reviews without losing the latest handler',async f=>{
  for(let version=1;version<=3;version++)assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',version,note:note+version})).status,200);
  const first=(await f.req('u','/api/security/alerts/'+f.id+'?historyLimit=2')).body.detail;
  assert.equal(first.history.complete,false);const second=(await f.req('u','/api/security/alerts/'+f.id+'?historyLimit=2&historyBefore='+first.history.nextCursor)).body.detail;assert.equal(second.history.complete,true);assert.equal(second.history.items.length,1);assert.equal(second.handler.id,first.handler.id);
  assert.equal((await f.req('u','/api/security/alerts/'+f.id+'?historyLimit=101')).status,400);
});
scenario('INC-ACTION: partial execution cannot be reported as verified',async f=>{
  f.store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,remote_state,updated_at) VALUES(?,?,?,?,?,?,?,?,?)','partial-action','a','e','revoke',note,'2026-10-01T01:30:00Z','partial','unknown','2026-10-01T01:30:00Z');
  const follow=f.event('e','2026-10-01T02:00:00.000Z','ALLOW','AUTHORIZED');
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,actionRefs:['action:partial-action'],verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+follow]}})).status,409);assert.equal(f.calls.length,0);
});
scenario('INC-ACTION: confirmed recorded result and independent test remain distinct',async f=>{
  f.store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,remote_state,updated_at) VALUES(?,?,?,?,?,?,?,?,?)','confirmed-action','a','e','revoke',note,'2026-10-01T01:30:00Z','synced','confirmed','2026-10-01T01:40:00Z');const follow=f.event('e','2026-10-01T02:00:00.000Z','ALLOW','AUTHORIZED');assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'resolved',version:1,note,actionRefs:['action:confirmed-action'],verification:{result:'passed',method:note,expectedDecision:'ALLOW',evidenceRefs:['events:'+follow]}})).status,200);const d=(await f.req('u','/api/security/alerts/'+f.id)).body.detail;assert.equal(d.actions[0].actor_id,'a');assert.equal(d.actions[0].state,'synced');assert.equal(d.verification.kind,'analyst_verification');assert.equal(f.calls.length,0);
});
scenario('INC-FALSE-POSITIVE: needs evidence-backed assessment',async f=>{
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'false_positive',version:1,note})).status,400);
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'false_positive',version:1,note,assessment:{text:note,confidence:'refuted',evidenceRefs:['events:'+f.eventId]}})).status,200);
});
scenario('INC-CONCURRENCY: two writes with one version produce one commit and one conflict',async f=>{
  const results=await Promise.all([1,2].map(n=>f.req('a','/api/security/alerts/'+f.id,'PATCH',{status:'reviewing',version:1,note:note+n})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);assert.equal(f.store.one('SELECT count(*) AS n FROM alert_history WHERE alert_id=?',f.id).n,1);
});
scenario('INC-INGEST: new exact evidence increments version and invalidates stale review',async f=>{
  const next=f.event('e','2026-10-01T01:01:00.000Z');f.store.alert({actorId:'e',username:'fixture-e',kind:'Vượt quyền chức năng',time:'2026-10-01T01:01:00.000Z',evidence:{source:'events',id:next}});
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{version:1,status:'reviewing',note})).status,409);assert.equal((await f.req('u','/api/security/alerts/'+f.id)).body.detail.evidence.items.length,2);
});
scenario('INC-SQLITE: failed history/audit rolls back state and metadata',async f=>{
  const original=f.store.run.bind(f.store);f.store.run=(sql,...args)=>{if(sql.startsWith('INSERT INTO alert_history'))throw Error('Synthetic storage failure');return original(sql,...args);};
  assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{version:1,status:'reviewing',note})).status,503);assert.equal(f.store.one('SELECT version FROM alerts WHERE id=?',f.id).version,1);assert.equal(f.store.one('SELECT count(*) AS n FROM alert_history').n,0);
});
scenario('INC-SQLITE: failed mandatory audit rolls back investigation',async f=>{
  f.store.event=()=>{throw Error('Synthetic audit failure');};assert.equal((await f.req('a','/api/security/alerts/'+f.id,'PATCH',{version:1,status:'reviewing',note})).status,503);assert.equal(f.store.one('SELECT version FROM alerts WHERE id=?',f.id).version,1);assert.equal(f.store.one('SELECT count(*) AS n FROM alert_history').n,0);
});
scenario('INC-SQLITE: failed evidence read returns 503 without partial detail',async f=>{
  const original=f.store.all.bind(f.store);f.store.all=(sql,...args)=>{if(sql.includes('FROM alert_evidence'))throw Error('Synthetic read failure');return original(sql,...args);};const r=await f.req('u','/api/security/alerts/'+f.id);assert.equal(r.status,503);assert.equal(r.body.detail,undefined);
});
scenario('INC-MISSING-EVIDENCE: unavailable source is explicit and removes verification',async f=>{
  f.store.run('DELETE FROM events WHERE id=?',f.eventId);const d=(await f.req('u','/api/security/alerts/'+f.id)).body.detail;assert.deepEqual(d.evidence.missing,['events:'+f.eventId]);assert.equal(d.resolution.verified,false);
});
test('INC-MIGRATION: legacy SQLite rows survive additive migration and replay',()=>{
  const filename=path.join(process.env.IAM_TEST_ROOT,'incident-legacy-'+randomUUID()+'.sqlite'),db=new DatabaseSync(filename);
  db.exec("CREATE TABLE alerts(id TEXT PRIMARY KEY,actor_id TEXT,username TEXT NOT NULL,kind TEXT NOT NULL,severity TEXT NOT NULL,count INTEGER NOT NULL DEFAULT 1,status TEXT NOT NULL DEFAULT 'open',created_at TEXT NOT NULL,updated_at TEXT NOT NULL,note TEXT,reviewer TEXT)");
  db.prepare('INSERT INTO alerts(id,username,kind,severity,created_at,updated_at,note) VALUES(?,?,?,?,?,?,?)').run('legacy','fixture','Legacy','medium','2026-01-01','2026-01-02',note);
  const before=db.prepare('SELECT * FROM alerts').get();incidents.migrate(db);incidents.migrate(db);const after=db.prepare('SELECT * FROM alerts').get();for(const key of Object.keys(before))assert.equal(after[key],before[key]);assert.equal(after.detected_at,null);assert.equal(after.version,1);assert.equal(db.prepare('SELECT count(*) AS n FROM incident_migrations').get().n,1);db.close();
});
test('INC-MIGRATION: failed additive DDL rolls back completely',()=>{
  const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE alerts(id TEXT PRIMARY KEY)');const exec=db.exec.bind(db);db.exec=sql=>{if(sql.includes('CREATE TABLE IF NOT EXISTS alert_evidence'))throw Error('Synthetic DDL failure');return exec(sql);};assert.throws(()=>incidents.migrate(db));assert.deepEqual(db.prepare('PRAGMA table_info(alerts)').all().map(c=>c.name),['id']);db.close();
});
test('INC-OUTBOX: trigger migration preserves pending payloads and records real remediation targets',()=>{
  const store=openStore(':memory:'),create=require('./central-audit').createCentralAudit;
  try{
    create({store,identity:{}});store.event({requestId:'old',method:'GET',path:'/fixture',staff:{id:'a',username:'fixture',role:'admin'}},200,'AUTHORIZED');const before=store.one('SELECT payload FROM audit_outbox');
    store.run("UPDATE audit_meta SET value='1' WHERE key='projection_version'");create({store,identity:{}});assert.equal(store.one('SELECT payload FROM audit_outbox').payload,before.payload);
    store.event({requestId:'action',method:'POST',path:'/fixture',staff:{id:'a',username:'fixture',role:'admin'}},200,'REMEDIATION_SYNCED','target-fixture');const payload=JSON.parse(store.one('SELECT payload FROM audit_outbox ORDER BY seq DESC LIMIT 1').payload);assert.equal(payload.user_id,'a');assert.equal(payload.details.target_user_id,'target-fixture');
  }finally{store.db.close();}
});
test('INC-PROXY: central filters, trusted actor, version and outage handling',async()=>{
  const received=[];let outage=false,capVersion=1;
  const remote=http.createServer(async(req,res)=>{let body='';for await(const c of req)body+=c;received.push({url:req.url,body:body?JSON.parse(body):null});res.writeHead(outage?503:200,{'Content-Type':'application/json'});res.end(JSON.stringify({rows:[],total:0,message:'Fixture',capabilities:{incidentSchemaVersion:capVersion}}));});remote.listen(0,'127.0.0.1');await new Promise(r=>remote.once('listening',r));
  const f=await fixture({centralAuditOptions:{url:'http://127.0.0.1:'+remote.address().port,token:randomUUID()+randomUUID()}});
  try{
    assert.equal((await f.req('u','/api/security/central/incidents?source=web-a&severity=high&detector=detection&state=all&timeField=occurred')).status,200);assert.ok(received[0].url.includes('detector=detection'));assert.ok(received[0].url.includes('severity=high'));
    assert.equal((await f.req('u','/api/security/central/incidents?source=web-a&source=web-b')).status,400);
    const id='a'.repeat(64),route='/api/security/central/incidents/'+id;
    assert.equal((await f.req('u',route,'POST',{state:'reviewing',version:1,note})).status,403);assert.equal((await f.req('a',route,'POST',{state:'reviewing',version:1,note,actor:'forged'})).status,400);
    assert.equal((await f.req('a',route,'POST',{state:'reviewing',version:1,note})).status,200);assert.equal(received.at(-1).body.actor,'a');assert.ok(received.at(-1).body.requestId);assert.equal(f.calls.length,0);
    const writes=received.filter(r=>r.body).length;capVersion=0;assert.equal((await f.req('a',route,'POST',{state:'reviewing',version:1,note})).body.code,'INCIDENT_UPGRADE_REQUIRED');assert.equal(received.filter(r=>r.body).length,writes);
    capVersion=1;const event=f.store.event;f.store.event=()=>{throw Error('Synthetic local audit failure');};assert.equal((await f.req('a',route,'POST',{state:'reviewing',version:1,note})).status,503);assert.equal(received.filter(r=>r.body).length,writes);f.store.event=event;
    outage=true;assert.equal((await f.req('u',route)).status,503);
  }finally{await f.close();await new Promise(r=>remote.close(r));}
});
