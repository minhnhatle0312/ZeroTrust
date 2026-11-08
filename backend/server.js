require('dotenv').config({path:process.env.IAM_BACKEND_ENV || '.env'});
const path = require('node:path');
const fs = require('node:fs');
const { openStore } = require('./store');
const { createApp } = require('./app');
const { keycloakAdmin } = require('./keycloak-admin');
const { createVerifier, sessionChecker, accountChecker } = require('./auth');
async function start() {
  const issuer = (process.env.KEYCLOAK_ISSUER || '').replace(/\/$/, '');
  const audience = process.env.API_AUDIENCE;
  if (!issuer || !audience || !process.env.FRONTEND_ORIGIN) throw new Error('Missing backend environment configuration');
  const directoryInterval=Number(process.env.DIRECTORY_SYNC_INTERVAL_SECONDS || 300);
  if(!Number.isInteger(directoryInterval)||directoryInterval<60||directoryInterval>86400)throw Error('DIRECTORY_SYNC_INTERVAL_SECONDS must be 60–86400');
  const store = openStore(path.resolve(__dirname, process.env.ATTENDANCE_DB || 'data/attendance.sqlite'));
  store.run("UPDATE actions SET state='partial',message='Backend restarted before remote confirmation; retry the action.' WHERE state='pending'");
  const staffFile = path.resolve(__dirname,process.env.STAFF_FILE || 'data/staff.json');
  if (fs.existsSync(staffFile)) store.tx(() => {
    for (const s of JSON.parse(fs.readFileSync(staffFile, 'utf8'))) store.run(`INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?) ON CONFLICT(id) DO NOTHING`, s.id,s.username,s.name,s.team,s.role);
  });
  const { createRemoteJWKSet } = await import('jose');
  const internalIssuer=process.env.KEYCLOAK_INTERNAL_ISSUER || issuer;
  const jwks = createRemoteJWKSet(new URL(`${internalIssuer}/protocol/openid-connect/certs`));
  const identity=keycloakAdmin({issuer:internalIssuer,clientId:process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'attendance-control',clientSecret:process.env.KEYCLOAK_ADMIN_CLIENT_SECRET});
  const app = createApp({ store, origin: [process.env.FRONTEND_ORIGIN,process.env.SECURITY_FRONTEND_ORIGIN || 'http://localhost:5174'],
    verify: await createVerifier({issuer,jwks,clients:{'employee-portal':audience,'security-dashboard':process.env.SECURITY_API_AUDIENCE || 'security-api'}}),
    identity,checkSession:sessionChecker(identity),checkAccount:accountChecker(identity),
    directoryOptions:{providerId:process.env.DIRECTORY_COMPONENT_ID || '',intervalSeconds:directoryInterval},
    centralAuditOptions:{url:process.env.AUDIT_SERVICE_URL || '',token:process.env.AUDIT_SERVICE_TOKEN || ''},
    collectorOptions:{sourceRetentionDays:Number(process.env.KEYCLOAK_EVENTS_RETENTION_DAYS || 7)},
  });
  const server = app.listen(Number(process.env.PORT || 3001),'127.0.0.1',()=>console.log(`Attendance API: http://localhost:${process.env.PORT || 3001}`));
  const collect=()=>app.locals.identityCollector.collect().catch(()=>console.error('Identity event collection unavailable; will retry.'));
  const central=()=>{app.locals.centralAudit.deliver().catch(()=>console.error('Audit outbox unavailable.'));app.locals.centralAudit.adminCollector.collect().catch(()=>console.error('Admin event collector unavailable; retry retained.'));};
  central();const centralTimer=setInterval(central,30000);centralTimer.unref();
  collect();const collectorTimer=setInterval(collect,30000);collectorTimer.unref();
  const directoryTimer=setInterval(()=>{if(app.locals.directory.configured){try{app.locals.directory.queue();}catch{/* Existing job or unavailable configuration is shown by the Directory API. */}}},directoryInterval*1000);
  directoryTimer.unref();
  function retention(){
    const days=Number(process.env.AUDIT_RETENTION_DAYS || 0);
    if(!Number.isInteger(days)||days<1||days>3650)return;
    const cutoff=new Date(Date.now()-days*86400000).toISOString();
    try{store.tx(()=>{
      store.run('DELETE FROM notification_reads WHERE notification_id IN (SELECT id FROM notifications WHERE created_at<?)',cutoff);
      store.run('DELETE FROM notifications WHERE created_at<?',cutoff);
      store.run('DELETE FROM events WHERE time<?',cutoff);
      store.run('DELETE FROM identity_events WHERE time<?',cutoff);
    });}catch{console.error('Audit retention unavailable; existing records preserved by transaction.');}
  }
  const retentionTimer=setInterval(retention,86400000);retentionTimer.unref();
  const close=()=>{clearInterval(centralTimer);clearInterval(collectorTimer);clearInterval(retentionTimer);clearInterval(directoryTimer);server.close(()=>{store.db.close();process.exit(0);});};
  process.on('SIGINT',close);process.on('SIGTERM',close);
}
start().catch(e=>{console.error('Attendance API startup failed:',e.message);process.exitCode=1;});
