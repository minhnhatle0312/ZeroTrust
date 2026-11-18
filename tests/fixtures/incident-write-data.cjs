// UI contract simulation only, not a substitute for PostgreSQL incident tests.
const original=require('./security-data.cjs'),records=new Map();
const local={};
function seed(store){
  function event(user,time,reason){return String(store.run('INSERT INTO events(request_id,time,actor_id,username,method,path,status,decision,reason,client_id) VALUES(?,?,?,?,?,?,?,?,?,?)','synthetic-probe-'+user,time,user,user,'GET','/api/fixture',200,'ALLOW',reason,'employee-portal').lastInsertRowid);}
  local.probe='events:'+event('synthetic-employee','2026-10-04T01:00:00.000Z','ACCESS_PROBE');
  local.wrong='events:'+event('synthetic-other','2026-10-04T01:00:00.000Z','ACCESS_PROBE');
  local.execution='events:'+event('synthetic-employee','2026-10-04T01:00:00.000Z','REMEDIATION_SYNCED');
  for(const [id,state,remote,target] of [['fixture-complete','synced','confirmed','synthetic-employee'],['fixture-partial','partial','unknown','synthetic-employee'],['fixture-other-action','synced','confirmed','synthetic-other']])store.run('INSERT INTO actions(id,actor_id,target_id,action,note,time,state,remote_state,updated_at,message) VALUES(?,?,?,?,?,?,?,?,?,?)',id,'synthetic-admin',target,'revoke','Synthetic previously performed action.','2026-10-02T01:00:00.000Z',state,remote,'2026-10-02T01:00:00.000Z','Synthetic source response '+state);
}
async function getBase(req,res,url,mode){let captured;await original.respond({...req,method:'GET'},res,url,{...mode,centralDown:false},(_res,status,data)=>{captured={status,data};});return captured;}
async function respond(req,res,url,mode,json){
  const route=url.pathname.slice('/synthetic-audit'.length),id=route.split('/').at(-1);
  if(!/^\/incidents\/[a-f0-9]{64}$/.test(route)||!['GET','POST'].includes(req.method))return original.respond(req,res,url,mode,json);
  const base=await getBase(req,res,url,mode);if(base.status!==200)return json(res,base.status,base.data);
  if(!records.has(id))records.set(id,structuredClone(base.data.detail));
  const current=records.get(id);
  if(req.method==='GET')return json(res,200,{incident:{...base.data.incident,state:current.state,version:current.version},detail:current,history:current.history.items});
  let raw='';for await(const chunk of req)raw+=chunk;const body=JSON.parse(raw);
  if(mode.centralWriteReject)return json(res,400,{message:'Synthetic rejection'});
  if(body.version!==current.version)return json(res,409,{message:'Synthetic version conflict'});
  if(!body.actor||!body.requestId||typeof body.note!=='string'||body.note.length<10)return json(res,400,{message:'Synthetic invalid body'});
  const next=structuredClone(current),time=new Date().toISOString();
  if(body.assessment)next.assessment={...body.assessment,kind:'analyst_assessment',actor:body.actor,time};
  if(body.recommendation)next.recommendations.recorded.push({...body.recommendation,kind:'analyst_proposal',executed:false,actor:body.actor,time});
  if(body.actionRefs)next.actions=body.actionRefs.map(ref=>({ref,kind:'recorded_execution_event',targetVerification:'recorded',event:{ref,type:'REMEDIATION_SYNCED',userId:'synthetic-admin',targetUserId:'synthetic-employee',occurredAt:'2026-10-02T01:00:00.000Z',decision:'ALLOW'}}));
  if(body.verification)next.verification={...body.verification,kind:'analyst_verification',actor:body.actor,time,observations:body.verification.evidenceRefs.map(ref=>({ref,time:'2026-10-04T01:00:00.000Z',decision:body.verification.expectedDecision}))};
  if(body.state)next.state=body.state;
  if(next.state==='resolved'&&next.verification?.result!=='passed')return json(res,400,{message:'Synthetic missing verification'});
  next.version++;next.updatedAt=time;next.resolution={verified:next.state==='resolved'&&next.verification?.result==='passed',basis:next.verification?'analyst_verification':'not_verified',legacy:false};next.handler={id:body.actor,time};
  const h={id:1000+next.version,version:next.version,actor:body.actor,request_id:body.requestId,note:body.note,time,state:next.state,change:{before:{state:current.state},after:{state:next.state}}};
  next.history.items.unshift(h);next.timeline.items.push({kind:'investigation',time,version:next.version,actor:body.actor,note:body.note,state:next.state});records.set(id,next);
  return json(res,200,{message:'Synthetic Audit acknowledged investigation.',version:next.version});
}
module.exports={respond,seed,local};
