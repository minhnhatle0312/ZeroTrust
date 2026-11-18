// Real application routes, in-memory SQLite, synthetic identity. Never load server.js or .env.
const {openStore}=require('../../backend/store');
const {createApp,localDay}=require('../../backend/app');
const crypto=require('node:crypto');

function createFixture({base,access,securityFixture=false}) {
  const store=openStore(':memory:'),now=new Date();
  const people=[['synthetic-admin','admin','QT thử nghiệm','Điều hành','admin'],['synthetic-manager','manager','QL thử nghiệm','Nhóm thử','manager'],['synthetic-employee','employee','NV thử nghiệm','Nhóm thử','employee'],['synthetic-other','other','NV ngoài nhóm','Nhóm khác','employee'],['synthetic-auditor','auditor','KT thử nghiệm','Kiểm soát','auditor']];
  for(let i=1;i<=24;i++)people.push(['fixture-'+i,'fixture'+String(i).padStart(2,'0'),'NV thử '+String(i).padStart(2,'0'),i<=12?'Nhóm thử':'Nhóm khác','employee']);
  for(const p of people)store.run('INSERT INTO staff(id,username,name,team,role,email) VALUES(?,?,?,?,?,?)',...p,p[1]+'@example.test');
  const history=new Date(now.getTime()+7*3600000);history.setUTCDate(1);history.setUTCMonth(history.getUTCMonth()-1);
  const historyMonth=history.toISOString().slice(0,7);
  for(const user of ['synthetic-employee','synthetic-manager','fixture-1','synthetic-other'])for(let i=1;i<=25;i++){
    const day=historyMonth+'-'+String(i).padStart(2,'0'),late=i%2?0:15;
    store.run('INSERT INTO attendance(id,user_id,day,check_in,check_out,late_minutes,updated_at) VALUES(?,?,?,?,?,?,?)',crypto.randomUUID(),user,day,day+'T01:'+String(late).padStart(2,'0')+':00.000Z',day+'T10:00:00.000Z',late,now.toISOString());
  }
  const day=localDay(new Date(now.getTime()-86400000));
  for(const [id,user,status] of [['review-approve','fixture-1','pending'],['review-reject','fixture-2','pending'],['own-manager','synthetic-manager','pending'],['outside','synthetic-other','pending'],['personal-approved','synthetic-employee','approved'],['personal-rejected','synthetic-employee','rejected']])
    store.run('INSERT INTO corrections(id,user_id,day,check_in,check_out,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)',id,user,day,day+'T01:00:00.000Z',day+'T10:00:00.000Z','Đề nghị đối chiếu công '+id,status,now.toISOString());
  for(let i=1;i<=20;i++)store.run('INSERT INTO corrections(id,user_id,day,check_in,check_out,reason,status,created_at) VALUES(?,?,?,?,?,?,?,?)','personal-history-'+i,'synthetic-employee',day,day+'T01:00:00.000Z',day+'T10:00:00.000Z','Đơn lịch sử thử nghiệm '+i,'approved',new Date(now.getTime()-i*1000).toISOString());
  store.notify({userId:'synthetic-employee',title:'Thông báo thử nghiệm',body:'Kiểm tra điều hướng đơn cá nhân.',section:'requests',time:now.toISOString()});
  const identity={
    async ready(){return true;},async policy(){return {bruteForceProtected:true,registrationAllowed:false,accessTokenLifespan:300};},async events(){return [];},
    async sessions(){return [];},async remediate(){},async updateUser(){},
    async createUser(){return {id:'created-'+crypto.randomUUID()};},async resetPassword(){},async endSession(){},
    async userSecurity(){return {enabled:true,required:false,configured:true,state:'enabled',credentialCount:1,requiredActions:[],observedAt:now.toISOString()};},
  };
  const checkAccount=async()=>({enabled:true,required:false,configured:true,requiredActions:[],credentialCount:1,credentials:[],state:'enabled'});
  const app=createApp({store,identity,issuer:base+'/fixture-idp/realms/company-iam',origin:base,rateLimit:10000,checkAccount,checkSession:async()=>true,
    centralAuditOptions:securityFixture?{url:base+'/synthetic-audit',token:'synthetic-fixture-only'}:{enabled:false},directoryOptions:{enabled:false},
    verify:async value=>{if(!access.has(value))throw Error('Unknown synthetic token');return JSON.parse(Buffer.from(value.split('.')[1],'base64url').toString());}});
  return {app,store,historyMonth};
}
module.exports={createFixture};
