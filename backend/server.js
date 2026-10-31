require('dotenv').config();
const path = require('node:path');
const fs = require('node:fs');
const { openStore } = require('./store');
const { createApp } = require('./app');
const { keycloakAdmin } = require('./keycloak-admin');
async function start() {
  const issuer = (process.env.KEYCLOAK_ISSUER || '').replace(/\/$/, '');
  const audience = process.env.API_AUDIENCE;
  if (!issuer || !audience || !process.env.FRONTEND_ORIGIN) throw new Error('Missing backend environment configuration');
  const store = openStore(path.resolve(__dirname, process.env.ATTENDANCE_DB || 'data/attendance.sqlite'));
  store.run("UPDATE actions SET state='partial',message='Backend restarted before remote confirmation; retry the action.' WHERE state='pending'");
  const staffFile = path.join(__dirname, 'data/staff.json');
  if (fs.existsSync(staffFile)) store.tx(() => {
    for (const s of JSON.parse(fs.readFileSync(staffFile, 'utf8'))) store.run(`INSERT INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,name=excluded.name,team=excluded.team,role=excluded.role`, s.id,s.username,s.name,s.team,s.role);
  });
  const { jwtVerify, createRemoteJWKSet } = await import('jose');
  const jwks = createRemoteJWKSet(new URL(`${issuer}/protocol/openid-connect/certs`));
  const app = createApp({ store, origin: process.env.FRONTEND_ORIGIN,
    verify: async token => (await jwtVerify(token,jwks,{issuer,audience,algorithms:['RS256'],requiredClaims:['sub','iat','exp']})).payload,
    identity: keycloakAdmin({issuer,clientId:process.env.KEYCLOAK_ADMIN_CLIENT_ID || 'attendance-control',clientSecret:process.env.KEYCLOAK_ADMIN_CLIENT_SECRET}),
  });
  const server = app.listen(Number(process.env.PORT || 3001),'127.0.0.1',()=>console.log(`Attendance API: http://localhost:${process.env.PORT || 3001}`));
  const close=()=>server.close(()=>{store.db.close();process.exit(0);});
  process.on('SIGINT',close);process.on('SIGTERM',close);
}
start().catch(e=>{console.error('Attendance API startup failed:',e.message);process.exitCode=1;});
