// Synthetic Phase 4 DTOs for browser tests only. Production never imports this module.
const crypto=require('node:crypto');
const time='2026-10-01T01:00:00.000Z';
const pgId=crypto.createHash('sha256').update('synthetic-pg-incident').digest('hex');
const legacyId=crypto.createHash('sha256').update('synthetic-pg-legacy').digest('hex');
const event={ref:'audit:fixture-event',id:'fixture-event',source:'web-a',occurredAt:time,userId:'synthetic-employee',username:'employee',ip:'192.0.2.10',application:'employee-portal',resource:'/api/fixture',requestId:'fixture-request',type:'INSUFFICIENT_ROLE',decision:'DENY',httpStatus:403,relation:'direct'};
const rows=Array.from({length:31},(_,i)=>({id:i===0?pgId:i===1?legacyId:crypto.createHash('sha256').update('synthetic-'+i).digest('hex'),event_id:i===0?'fixture-event':'fixture-event-'+i,rule:i===0?'PYTHON_BASELINE':'LOGIN_FAILURE_BURST',severity:i%2?'medium':'high',state:i===1?'resolved':i%3?'open':'reviewing',summary:'Synthetic incident '+i,created_at:time,occurred_at:time,updated_at:time,version:32,event_source:i%2?'keycloak':'web-a',detector:i===0?'detection':'audit'}));
function history(id){return Array.from({length:31},(_,i)=>({id:100-i,incident_id:id,version:32-i,actor:'synthetic-admin',request_id:'fixture-review-'+i,time:'2026-10-02T'+String(23-Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'00':'30')+':00.000Z',state:'reviewing',note:'Recorded investigation '+i,change:{before:{state:'open'},after:{state:'reviewing'}}}));}
function detail(row,p,mode){
  const all=history(row.id),before=Number(p.get('historyBefore')||Infinity),limit=Number(p.get('historyLimit')||25),selected=all.filter(h=>h.version<before),items=selected.slice(0,limit),legacy=row.id===legacyId;
  const proof=legacy?[]:[event,{...event,ref:'audit:fixture-probe',id:'fixture-probe',type:'ACCESS_PROBE',occurredAt:'2026-10-03T01:00:00.000Z',decision:'DENY',relation:'investigation'}];
  return {schemaVersion:1,origin:'postgresql',incidentRef:'audit:'+row.id,id:row.id,type:row.rule,rule:row.rule,detector:row.detector,severity:row.severity,state:row.state,version:mode.bumpVersion?33:32,
    occurredAt:legacy?null:time,detectedAt:legacy?null:time,lastObservedAt:time,updatedAt:time,subject:{userId:legacy?null:'synthetic-employee',username:legacy?null:'employee'},facts:{ips:legacy?[]:['192.0.2.10'],applications:legacy?[]:['employee-portal'],resources:legacy?[]:['/api/fixture'],requestIds:legacy?[]:['fixture-request']},
    evidence:{items:proof,missing:legacy?['audit:fixture-missing']:[],complete:!legacy,provenance:legacy?'legacy-no-exact-links':'exact-source-links'},
    assessment:legacy?null:{kind:'analyst_assessment',text:'Synthetic hypothesis requiring evidence review.',confidence:'hypothesis',evidenceRefs:['audit:fixture-event'],actor:'synthetic-admin',time},
    recommendations:{generated:legacy?[]:[{kind:'system_proposal',rule:'PYTHON_BASELINE',policyVersion:'fixture-policy',text:'Review recorded denials before changing account access.',evidenceRefs:['audit:fixture-event'],executed:false}],recorded:[]},
    actions:legacy?[]:[{ref:'audit:fixture-execution',kind:'recorded_execution_event',event:{...event,type:'REMEDIATION_TEST',targetUserId:'synthetic-employee'},targetVerification:'recorded'}],
    verification:legacy?null:{kind:'analyst_verification',result:'inconclusive',method:'Synthetic independent access probe',expectedDecision:'DENY',evidenceRefs:['audit:fixture-probe'],actor:'synthetic-admin',time,observations:[{ref:'audit:fixture-probe',time:'2026-10-03T01:00:00.000Z',decision:'DENY'}]},resolution:{verified:false,basis:legacy?'not_verified':'analyst_verification',legacy},handler:legacy?null:{id:'synthetic-admin',time},
    history:{items:legacy?[]:items,complete:legacy||selected.length<=limit,nextCursor:!legacy&&selected.length>limit?items.at(-1).version:null},timeline:{items:legacy?[]:[{kind:'source_event',ref:event.ref,time},...items.map(h=>({kind:'investigation',time:h.time,version:h.version,actor:h.actor,state:h.state,note:h.note}))],complete:!legacy&&selected.length<=limit},
    detection:legacy?null:{event_id:'fixture-event',run_id:'fixture-run',prediction:'Anomaly',rules:['deny_burst'],detected_at:time,features:{deny_count:4},version:'fixture-v1'},limitations:legacy?['Synthetic legacy data has no exact surviving evidence.']:[]};
}
function seed(store){
  for(let i=0;i<31;i++){
    const record=store.run('INSERT INTO events(request_id,time,actor_id,username,method,path,status,decision,reason,client_id,ip_address,role) VALUES(?,?,?,?,?,?,?,?,?,?,?,?)','fixture-request-'+i,time,'synthetic-employee','employee','GET','/api/fixture',403,'DENY','FIXTURE_DENIAL','employee-portal','192.0.2.10','employee');
    const id=store.alert({actorId:'synthetic-employee',username:'employee',kind:'Fixture incident '+String(i).padStart(2,'0'),severity:i%2?'medium':'high',time,evidence:{source:'events',id:record.lastInsertRowid}});
    if(i===0){
      const ref='events:'+record.lastInsertRowid;
      store.run('UPDATE alerts SET version=?,investigation_json=? WHERE id=?',32,JSON.stringify({assessment:{kind:'analyst_assessment',text:'Synthetic local hypothesis with recorded evidence.',confidence:'hypothesis',evidenceRefs:[ref],actor:'synthetic-admin',time}}),id);
      for(let j=2;j<=32;j++)store.run('INSERT INTO alert_history(id,alert_id,version,actor,actor_name,request_id,time,state,note,change_json) VALUES(?,?,?,?,?,?,?,?,?,?)','fixture-history-'+j,id,j,'synthetic-admin','admin','fixture-history-request',time,'reviewing','Synthetic history '+j,JSON.stringify({before:{state:'open'},after:{state:'reviewing'}}));
    }
  }
}
async function respond(req,res,url,mode,json){
  const p=url.searchParams,path=url.pathname.slice('/synthetic-audit'.length);
  if(mode.centralDown){json(res,503,{message:'Synthetic central outage'});return;}
  if(req.method!=='GET'){json(res,405,{message:'Fixture is read only'});return;}
  if(path==='/health'){json(res,200,{settings:{retention_days:0,login_threshold:5,deny_threshold:5},capabilities:{incidentSchemaVersion:1}});return;}
  if(path==='/incidents'){
    let selected=rows.filter(r=>(!p.get('state')||p.get('state')==='all'||r.state===p.get('state'))&&(!p.get('severity')||r.severity===p.get('severity'))&&(!p.get('source')||r.event_source===p.get('source'))&&(!p.get('detector')||r.detector===p.get('detector')));
    const offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||25);json(res,200,{rows:selected.slice(offset,offset+limit),total:selected.length,complete:offset+limit>=selected.length,offset,limit});return;
  }
  if(path.startsWith('/incidents/')){if(mode.detailDelay)await new Promise(r=>setTimeout(r,mode.detailDelay));const row=rows.find(r=>r.id===path.split('/').at(-1));if(!row){json(res,404,{message:'Synthetic missing'});return;}const d=detail(row,p,mode);json(res,200,{incident:row,detail:d,history:d.history.items});return;}
  const events=rows.map((r,i)=>({event_id:r.event_id,timestamp:time,source:r.event_source,username:'employee',user_id:'synthetic-employee',action:'LOGIN_ERROR',decision:'DENY',resource:'/api/fixture',request_id:'fixture-request',ip_address:'192.0.2.10',client_id:'employee-portal'}));
  if(path==='/events'){let selected=events.filter(e=>(!p.get('q')||Object.values(e).some(v=>String(v).includes(p.get('q'))))&&(!p.get('source')||e.source===p.get('source'))&&(!p.get('decision')||e.decision===p.get('decision')));const offset=Number(p.get('offset')||0),limit=Number(p.get('limit')||25);json(res,200,{rows:selected.slice(offset,offset+limit),total:selected.length,complete:offset+limit>=selected.length});return;}
  if(path.startsWith('/events/')){const selected=events.find(e=>e.event_id===decodeURIComponent(path.split('/').at(-1)));json(res,selected?200:404,selected?{event:selected,related:[],complete:true}:{message:'Synthetic missing event'});return;}
  if(path==='/summary'){json(res,200,{daily:[{day:'2026-10-01',decision:'DENY',count:31}],topFailures:[{username:'employee',count:31}],sources:[{source:'web-a',count:16},{source:'keycloak',count:15}]});return;}
  if(path==='/detection/status'){json(res,200,{config:{enabled:false,version:1,login_threshold:5,deny_threshold:5,request_threshold:100,business_start:8,business_end:18,utc_offset:7},state:{last_success:time},pending:0,runs:[{id:'fixture-run',created_at:time,state:'completed',processed:31,anomalies:1,message:'Synthetic analysis'}]});return;}
  if(path==='/detection/results'){let selected=events.map((e,i)=>({...e,prediction:i?'Normal':'Anomaly',rules:i?[]:['deny_burst'],features:{deny_count:i?0:4}})).filter(e=>!p.get('prediction')||e.prediction===p.get('prediction'));const offset=Number(p.get('offset')||0);json(res,200,{rows:selected.slice(offset,offset+25),total:selected.length});return;}
  if(path==='/detection/evaluations'){json(res,200,{rows:[]});return;}
  json(res,404,{message:'Synthetic unsupported route'});
}
module.exports={respond,seed,pgId,legacyId};
