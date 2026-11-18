const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {openStore}=require('./store');
const {createDirectory}=require('./directory');
const {createCentralAudit}=require('./central-audit');
const {keycloakAdmin}=require('./keycloak-admin');
const {batch,link,ISSUER}=require('../tests/fixtures/identity-binding-fixture.cjs');
const NOW=new Date('2026-11-18T00:00:00Z');

function fixture(collisions=4) {
  const store=openStore(':memory:');
  const users=Array.from({length:4},(_,i)=>({id:'synthetic-new-'+i,username:'ldap-synthetic-'+i,
    name:'Synthetic Profile',email:'fixture@example.test',providerId:'current-provider',enabled:true,
    team:'Fixture Team',sourceStatus:'active',mfaRequired:true,entryUuid:'synthetic-entry-'+i,directRoles:[],
    groups:[{path:'/directory/employees',roles:['employee']}]}));
  const remoteWrites=[];
  const identity={async directoryProvider(){return {enabled:true,editMode:'READ_ONLY',cachePolicy:'NO_CACHE'};},
    async directoryUsers(){return {users:users.map(u=>({id:u.id})),complete:true};},
    async directoryUser(id){return structuredClone(users.find(u=>u.id===id));},
    async syncDirectory(){return {added:0,updated:4,failed:0};},
    async remediate(...args){remoteWrites.push(args);}};
  createCentralAudit({store,identity});
  for(let i=0;i<collisions;i++)store.run("INSERT INTO staff(id,username,name,team,role,identity_source,directory_provider_id,directory_status) VALUES(?,?,?,?,'employee','ldap','old-provider','active')",'synthetic-old-'+i,users[i].username,'Old Synthetic Profile','Old Team');
  store.event({requestId:'synthetic-history',method:'GET',path:'/fixture'},200,'SYNTHETIC_HISTORY');
  const history=store.all('SELECT * FROM events'),outbox=store.all('SELECT * FROM audit_outbox'),staff=store.all('SELECT * FROM staff');
  const directory=createDirectory({store,identity,issuer:ISSUER,providerId:'current-provider',now:()=>NOW});
  return {store,users,identity,directory,remoteWrites,history,outbox,staff};
}
function approve(f,indices=[0,1,2,3]){
  batch(f.store);
  for(const i of indices){
    const u=f.users[i];let old=f.store.one('SELECT id FROM staff WHERE username=?',u.username);
    if(!old){old={id:'verified-local-'+i};f.store.run("INSERT INTO staff(id,username,name,email,team,role,identity_source,directory_provider_id,directory_status,directory_groups,mfa_required) VALUES(?,?,?,?,?,'employee','ldap','old-provider','active',?,1)",old.id,u.username,u.name,u.email,u.team,JSON.stringify(u.groups.map(g=>g.path)));}
    link(f.store,{localId:old.id,subject:u.id,entryUuid:u.entryUuid,provider:'current-provider'});
  }
}
async function run(f,{logger}={}) {
  const previous=console.warn,logs=[];
  console.warn=logger||((line)=>logs.push(JSON.parse(line)));
  try {
    const job=f.directory.queue();
    for(let i=0;i<1000;i++) {
      await new Promise(resolve=>setImmediate(resolve));
      const state=f.store.one('SELECT * FROM directory_sync_jobs WHERE id=?',job.id);
      if(!['pending','running'].includes(state.state))return {job:state,logs};
    }
    throw Error('Synthetic directory job did not finish');
  }finally{console.warn=previous;}
}

test('four old UUID/provider collisions reproduce zero profiles and four errors without rekey or history loss',async()=>{
  const f=fixture();try{
    assert.equal(f.directory.state().users.total,0);
    const {job,logs}=await run(f);
    assert.equal(job.state,'partial');assert.equal(job.error_count,4);assert.equal(job.imported,0);
    assert.equal(job.updated,0);assert.equal(logs.length,4);
    for(let i=0;i<4;i++)assert.deepEqual(logs[i],{event:'DIRECTORY_USER_SYNC_FAILED',jobId:job.id,
      userRef:createHash('sha256').update(f.users[i].id).digest('hex').slice(0,16),
      code:'DIRECTORY_CONFLICT',reason:'USERNAME_COLLISION',status:409});
    assert.deepEqual(f.store.all('SELECT * FROM staff'),f.staff);assert.deepEqual(f.remoteWrites,[]);
    assert.deepEqual(f.store.all('SELECT * FROM events WHERE request_id=?','synthetic-history'),f.history);
    for(const row of f.outbox)assert.deepEqual(f.store.one('SELECT * FROM audit_outbox WHERE seq=?',row.seq),row);
    assert.deepEqual(f.store.all('PRAGMA foreign_key_check'),[]);
    const output=JSON.stringify(logs);
    for(const u of f.users)for(const value of [u.id,u.username,u.name,u.email,u.team])assert.ok(!output.includes(value));
  }finally{f.store.db.close();}
});
test('verified links synchronize with MFA required and no error log; no automatic rekey/import',async()=>{
  const f=fixture(0);try{
    approve(f);
    const {job,logs}=await run(f);assert.equal(job.state,'synced');assert.equal(job.imported,0);assert.equal(job.error_count,0);assert.deepEqual(logs,[]);
    assert.equal(f.directory.state().users.total,4);
    assert.ok(f.store.all('SELECT * FROM staff').every(u=>u.mfa_required===1&&u.directory_status==='active'));
  }finally{f.store.db.close();}
});
test('one unverified collision does not prevent remaining verified identities from being processed',async()=>{
  const f=fixture(1);try{approve(f,[1,2,3]);const {job,logs}=await run(f);assert.equal(job.imported,0);assert.equal(f.directory.state().users.total,3);assert.equal(job.error_count,1);assert.equal(logs.length,1);assert.equal(job.state,'partial');}finally{f.store.db.close();}
});
test('remote read denial remains fail-closed and never logs exception details',async()=>{
  const f=fixture(0);try{
    f.identity.directoryUser=async()=>{throw Object.assign(Error('Bearer SYNTHETIC_TOKEN password=SYNTHETIC_SECRET'),{status:403,body:'private-profile'});};
    const {job,logs}=await run(f);assert.equal(job.error_count,4);assert.equal(job.imported,0);
    assert.ok(logs.every(x=>x.code==='DIRECTORY_UNAVAILABLE'&&x.status===503));
    assert.ok(!JSON.stringify(logs).includes('SYNTHETIC_'));assert.ok(!JSON.stringify(logs).includes('private-profile'));
  }finally{f.store.db.close();}
});
test('database error log is allowlisted and each failed profile update rolls back',async()=>{
  const f=fixture(0);try{
    approve(f);const before=f.store.all('SELECT * FROM staff');
    const original=f.store.run;
    f.store.run=(sql,...args)=>{if(sql.startsWith('UPDATE staff SET username'))throw Object.assign(Error('client_secret=SYNTHETIC_SECRET'),{code:'ERR_SQLITE_ERROR',stack:'private-stack',response:{access_token:'synthetic'}});return original(sql,...args);};
    const {job,logs}=await run(f);assert.equal(job.error_count,4);assert.deepEqual(f.store.all('SELECT * FROM staff'),before);
    assert.ok(logs.every(x=>x.code==='ERR_SQLITE_ERROR'&&x.reason==='UNCLASSIFIED'));
    assert.ok(!JSON.stringify(logs).includes('SYNTHETIC_SECRET'));assert.ok(!JSON.stringify(logs).includes('private-stack'));
  }finally{f.store.db.close();}
});
test('logging failure cannot abort the job or turn a failed identity into success',async()=>{
  const f=fixture();try{const {job}=await run(f,{logger(){throw Error('Synthetic log sink failure');}});assert.equal(job.error_count,4);assert.equal(job.state,'partial');assert.deepEqual(f.store.all('SELECT * FROM staff'),f.staff);}finally{f.store.db.close();}
});
test('missing-user revoke errors are not mislabeled as per-user import errors',async()=>{
  const f=fixture(1);try{
    approve(f,[0]);
    f.identity.directoryUsers=async()=>({users:[],complete:true});
    f.identity.remediate=async()=>{throw Error('Synthetic revoke failure');};
    const {job,logs}=await run(f);assert.equal(job.error_count,1);assert.equal(job.blocked,1);assert.deepEqual(logs,[]);
  }finally{f.store.db.close();}
});
test('unverified fresh LDAP identities do not create staff or bindings',async()=>{
  const f=fixture(0);try{const {job}=await run(f);assert.equal(job.error_count,4);assert.equal(job.imported,0);assert.equal(f.store.one('SELECT COUNT(*) n FROM staff').n,0);}finally{f.store.db.close();}
});
test('Keycloak directory adapter reads group effective roles and direct roles with service auth, no sync write',async()=>{
  const original=globalThis.fetch,calls=[];
  globalThis.fetch=async(url,input)=>{
    const p=new URL(url);calls.push({path:p.pathname,method:input.method});
    let body;
    if(p.pathname.endsWith('/token')){assert.equal(input.method,'POST');body={access_token:'synthetic-service-token',expires_in:60};}
    else {assert.equal(input.method,'GET');assert.equal(input.headers.Authorization,'Bearer synthetic-service-token');
      if(p.pathname.endsWith('/groups'))body=[{id:'synthetic-group',path:'/directory/employees'}];
      else if(p.pathname.endsWith('/composite'))body=[{name:'employee'}];
      else if(p.pathname.endsWith('/role-mappings/realm'))body=[];
      else body={id:'synthetic-user',username:'ldap-synthetic',enabled:true,federationLink:'synthetic-provider',firstName:'Test',lastName:'Synthetic',attributes:{'LDAP_ID':['synthetic-entry-uuid'],'nhip.directory.team':['Team'],'nhip.directory.status':['active'],'nhip.mfa.required':['true']}};
    }
    return new Response(JSON.stringify(body),{status:200});
  };
  try {
    const api=keycloakAdmin({issuer:'https://fixture.invalid/realms/test',clientId:'attendance-control',clientSecret:'synthetic-only'});
    const u=await api.directoryUser('synthetic-user',['/directory/employees']);
    assert.equal(u.mfaRequired,true);assert.equal(u.entryUuid,'synthetic-entry-uuid');assert.deepEqual(u.directRoles,[]);assert.deepEqual(u.groups,[{path:'/directory/employees',roles:['employee']}]);
    assert.equal(calls.filter(c=>c.method==='POST').length,1);assert.equal(calls.length,5);
  }finally{globalThis.fetch=original;}
});
