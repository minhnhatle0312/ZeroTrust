// Review-first identity reconciliation for the local admin01 account.
// Run from D:\ZeroTrust\backend: node fix-admin01-safe.js [--apply]
const fs = require('node:fs');
const path = require('node:path');
const { openStore } = require('./store');
const { backup: sqliteBackup } = require('node:sqlite');
require('dotenv').config({ path: process.env.IAM_BACKEND_ENV || '.env' });
const oldId = 'b5300ca8-911b-44c3-968f-6b9113a6edbd';
const newId = '659f01ed-ead4-4392-bb76-070644feea9f';
const apply = process.argv.includes('--apply');
const dbPath = path.resolve(__dirname, process.env.ATTENDANCE_DB || 'data/attendance.sqlite');
const staffPath = path.resolve(__dirname, process.env.STAFF_FILE || 'data/staff.json');
const quote = x => '"' + x.replace(/"/g, '""') + '"';
// Historical security/audit records deliberately retain the actor ID at event time.
const history = new Set(['events','alerts','identity_events','action_attempts','lifecycle_history','directory_sync_jobs']);
const fields = new Set(['user_id','staff_id','employee_id','actor_id','target_id','reviewer_id','creator_id']);
async function main() {
  if (!fs.existsSync(dbPath)) throw Error('Database not found: ' + dbPath);
  const store = openStore(dbPath), db = store.db;
  try {
    const old = store.one('SELECT * FROM staff WHERE id=?', oldId);
    if (!old || old.username !== 'admin01' || old.identity_source !== 'local') throw Error('Old identity is not the expected local admin01; no changes made');
    if (store.one('SELECT id FROM staff WHERE id=?', newId)) throw Error('New identity already exists; no changes made');
    const seed = fs.existsSync(staffPath) ? JSON.parse(fs.readFileSync(staffPath,'utf8')) : null;
    if (seed !== null && !Array.isArray(seed)) throw Error('staff.json is not an array');
    const seedOld = seed?.filter(x => x.id === oldId) || [];
    if (seedOld.length > 1 || seed?.some(x => x.id === newId && x.username !== 'admin01')) throw Error('Unexpected staff.json identity conflict');
    const updates = [];
    const tables = store.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
    for (const {name} of tables) {
      if (name === 'staff') continue;
      const cols = store.all(`PRAGMA table_info(${quote(name)})`);
      const fks = store.all(`PRAGMA foreign_key_list(${quote(name)})`);
      for (const c of cols) {
        const pointsToStaff = fks.some(f => f.from === c.name && f.table === 'staff' && f.to === 'id');
        if (!fields.has(c.name) && !pointsToStaff) continue;
        const count = store.one(`SELECT COUNT(*) AS n FROM ${quote(name)} WHERE ${quote(c.name)}=?`,oldId).n;
        if (count) updates.push({table:name,column:c.name,count,historical:history.has(name)});
      }
    }
    console.log('Database:',dbPath);
    console.log('Current staff:',JSON.stringify({id:old.id,username:old.username,role:old.role,identity_source:old.identity_source}));
    console.log('New Keycloak ID:',newId);
    console.log('References:',JSON.stringify(updates,null,2));
    console.log('Seed staff.json:',staffPath,'old ID entries:',seedOld.length);
    if (!apply) { console.log('DRY RUN ONLY. No data changed. Review above; then run node fix-admin01-safe.js --apply'); return; }
    // Node DatabaseSync.backup returns a Promise. Await before mutating the database.
    const backup = dbPath+'.pre-admin01-'+new Date().toISOString().replace(/[:.]/g,'-')+'.bak';
    await sqliteBackup(db, backup);
    if (!fs.existsSync(backup) || fs.statSync(backup).size === 0) throw Error('Backup was not created');
    let seedBackup;
    if (seed) {
      seedBackup = staffPath+'.pre-admin01-'+Date.now()+'.bak';
      fs.copyFileSync(staffPath,seedBackup,fs.constants.COPYFILE_EXCL);
    }
    console.log('SQLite backup:',backup);
    if (seedBackup) console.log('staff.json backup:',seedBackup);
    db.exec('PRAGMA foreign_keys=OFF');
    try {
      db.exec('BEGIN IMMEDIATE');
      // Preserve audit history. Update current operational references, including FK columns.
      for (const u of updates.filter(x => !x.historical)) {
        db.prepare(`UPDATE ${quote(u.table)} SET ${quote(u.column)}=? WHERE ${quote(u.column)}=?`).run(newId,oldId);
      }
      db.prepare('UPDATE staff SET id=? WHERE id=?').run(newId,oldId);
      const violations = db.prepare('PRAGMA foreign_key_check').all();
      const integrity = db.prepare('PRAGMA integrity_check').get();
      if (violations.length || integrity.integrity_check !== 'ok') throw Error('Database checks failed: '+JSON.stringify({violations,integrity}));
      // Prepare replacement seed before committing. If writing fails, DB rolls back.
      if (seed && seedOld.length) {
        const next = seed.map(x => x.id === oldId ? {...x,id:newId} : x);
        const temp = staffPath+'.tmp-admin01';
        fs.writeFileSync(temp,JSON.stringify(next,null,2)+'\n',{flag:'wx'});
        try { fs.renameSync(temp,staffPath); } catch(e) { try {fs.unlinkSync(temp);}catch{} throw e; }
      }
      db.exec('COMMIT');
      console.log('SUCCESS: admin01 local ID updated. Historical audit IDs intentionally unchanged.');
      console.log('Updated profile:',JSON.stringify(store.one('SELECT id,username,role,disabled,governance_state FROM staff WHERE id=?',newId)));
    } catch(e) {
      try {db.exec('ROLLBACK');}catch{}
      if (seedBackup) fs.copyFileSync(seedBackup,staffPath);
      throw e;
    } finally { db.exec('PRAGMA foreign_keys=ON'); }
  } finally { db.close(); }
}
main().catch(e=>{console.error('FAILED:',e.message);process.exitCode=1;});
