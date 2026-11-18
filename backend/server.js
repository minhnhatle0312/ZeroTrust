const path = require('node:path');
const { preflight, openVerifiedStore } = require('./bootstrap');
const { createApp } = require('./app');
const { keycloakAdmin } = require('./keycloak-admin');
const { createVerifier, sessionChecker, accountChecker } = require('./auth');
const { directoryScheduleEnabled, startDirectorySchedule } = require('./directory-schedule');
async function start({checkOnly=process.argv.includes('--check-bootstrap')}={}) {
  const issuer = (process.env.KEYCLOAK_ISSUER || '').replace(/\/$/, '');
  const audience = process.env.API_AUDIENCE;
  if (!issuer || !audience || !process.env.FRONTEND_ORIGIN) throw new Error('Missing backend environment configuration');
  const directoryInterval=Number(process.env.DIRECTORY_SYNC_INTERVAL_SECONDS || 300);
  if(!Number.isInteger(directoryInterval)||directoryInterval<60||directoryInterval>86400)throw Error('DIRECTORY_SYNC_INTERVAL_SECONDS must be 60–86400');
  const directoryPeriodicEnabled=directoryScheduleEnabled(process.env.DIRECTORY_SYNC_ENABLED);
  const staffFile = path.resolve(__dirname,process.env.STAFF_FILE || 'data/staff.json');
  const internalIssuer=process.env.KEYCLOAK_INTERNAL_ISSUER || issuer;
  const identity=keycloakAdmin({issuer:internalIssuer,clientId:process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'attendance-control',clientSecret:process.env.KEYCLOAK_ADMIN_CLIENT_SECRET});
  const plan=await preflight({databasePath:path.resolve(__dirname,process.env.ATTENDANCE_DB || 'data/attendance.sqlite'),staffFile,identity});
  if(checkOnly){console.log('Bootstrap identity check passed; no database writes.');return;}
  const { createRemoteJWKSet } = await import('jose');
  const jwks = createRemoteJWKSet(new URL(`${internalIssuer}/protocol/openid-connect/certs`));
  const store=openVerifiedStore(plan);
  store.run("UPDATE actions SET state='partial',message='Backend restarted before remote confirmation; retry the action.' WHERE state='pending'");
  const app = createApp({ store, origin: [process.env.FRONTEND_ORIGIN,process.env.SECURITY_FRONTEND_ORIGIN || 'http://localhost:5174'],
    verify: await createVerifier({issuer,jwks,clients:{'employee-portal':audience,'security-dashboard':process.env.SECURITY_API_AUDIENCE || 'security-api'}}),
    issuer,identity,checkSession:sessionChecker(identity),checkAccount:accountChecker(identity),
    directoryOptions:{providerId:process.env.DIRECTORY_COMPONENT_ID || '',intervalSeconds:directoryInterval},
    centralAuditOptions:{url:process.env.AUDIT_SERVICE_URL || '',token:process.env.AUDIT_SERVICE_TOKEN || ''},
    collectorOptions:{sourceRetentionDays:Number(process.env.KEYCLOAK_EVENTS_RETENTION_DAYS || 7)},
  });
  const server = app.listen(Number(process.env.PORT || 3001),'127.0.0.1',()=>console.log(`Attendance API: http://localhost:${process.env.PORT || 3001}`));
  const collect=()=>app.locals.identityCollector.collect().catch(()=>console.error('Identity event collection unavailable; will retry.'));
  const central=()=>{app.locals.centralAudit.deliver().catch(()=>console.error('Audit outbox unavailable.'));app.locals.centralAudit.adminCollector.collect().catch(()=>console.error('Admin event collector unavailable; retry retained.'));};
  central();const centralTimer=setInterval(central,30000);centralTimer.unref();
  collect();const collectorTimer=setInterval(collect,30000);collectorTimer.unref();
  const directoryTimer=startDirectorySchedule(app.locals.directory,{enabled:directoryPeriodicEnabled,intervalSeconds:directoryInterval});
  console.log('Periodic LDAP sync: '+(directoryPeriodicEnabled?'enabled':'disabled (runtime)'));
  function retention(){
    const days=Number(process.env.AUDIT_RETENTION_DAYS || 0);
    if(!Number.isInteger(days)||days<1||days>3650)return;
    const cutoff=new Date(Date.now()-days*86400000).toISOString();
    try{require('./retention').pruneAudit(store,cutoff);}catch{console.error('Audit retention unavailable; existing records preserved by transaction.');}
  }
  const retentionTimer=setInterval(retention,86400000);retentionTimer.unref();
  const close=()=>{clearInterval(centralTimer);clearInterval(collectorTimer);clearInterval(retentionTimer);clearInterval(directoryTimer);server.close(()=>{store.db.close();process.exit(0);});};
  process.on('SIGINT',close);process.on('SIGTERM',close);
}
if(require.main===module){
  require('dotenv').config({path:process.env.IAM_BACKEND_ENV || path.join(__dirname,'.env')});
  start().catch(e=>{console.error('Attendance API startup failed:',e.message);process.exitCode=1;});
}
module.exports={start};
