const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function openStore(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  const migrateNotifications=!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='notifications'").get();
  db.function('fold',value=>String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase());
  db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS staff (id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE, name TEXT NOT NULL, team TEXT NOT NULL, role TEXT NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, revoked_before INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS attendance (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES staff(id), day TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT, late_minutes INTEGER NOT NULL DEFAULT 0, updated_at TEXT NOT NULL, UNIQUE(user_id, day));
    CREATE TABLE IF NOT EXISTS corrections (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES staff(id), day TEXT NOT NULL, check_in TEXT NOT NULL, check_out TEXT NOT NULL, reason TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', created_at TEXT NOT NULL, reviewer_id TEXT, reviewed_at TEXT, review_note TEXT);
    CREATE UNIQUE INDEX IF NOT EXISTS one_pending ON corrections(user_id, day) WHERE status='pending';
    CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, request_id TEXT NOT NULL, time TEXT NOT NULL, actor_id TEXT, username TEXT NOT NULL, method TEXT NOT NULL, path TEXT NOT NULL, status INTEGER NOT NULL, decision TEXT NOT NULL, reason TEXT NOT NULL, target TEXT);
    CREATE TABLE IF NOT EXISTS alerts (id TEXT PRIMARY KEY, actor_id TEXT, username TEXT NOT NULL, kind TEXT NOT NULL, severity TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 1, status TEXT NOT NULL DEFAULT 'open', created_at TEXT NOT NULL, updated_at TEXT NOT NULL, note TEXT, reviewer TEXT);
    CREATE TABLE IF NOT EXISTS actions (id TEXT PRIMARY KEY, actor_id TEXT NOT NULL, target_id TEXT NOT NULL, action TEXT NOT NULL, note TEXT NOT NULL, time TEXT NOT NULL, state TEXT NOT NULL, message TEXT);
    CREATE INDEX IF NOT EXISTS events_time ON events(time);
    CREATE INDEX IF NOT EXISTS attendance_day ON attendance(day);
    CREATE INDEX IF NOT EXISTS alerts_time ON alerts(updated_at);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY,user_id TEXT,audience TEXT NOT NULL DEFAULT 'personal',title TEXT NOT NULL,body TEXT NOT NULL,section TEXT NOT NULL,created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notification_reads (notification_id TEXT NOT NULL REFERENCES notifications(id),user_id TEXT NOT NULL REFERENCES staff(id),read_at TEXT NOT NULL,PRIMARY KEY(notification_id,user_id));
    CREATE TABLE IF NOT EXISTS identity_events (id TEXT PRIMARY KEY,time TEXT NOT NULL,type TEXT NOT NULL,user_id TEXT,username TEXT NOT NULL,client_id TEXT,ip_address TEXT,error TEXT);
    CREATE INDEX IF NOT EXISTS identity_events_time ON identity_events(time);
    CREATE INDEX IF NOT EXISTS notification_time ON notifications(created_at);`);
  if(!db.prepare('PRAGMA table_info(staff)').all().some(c=>c.name==='email'))db.exec("ALTER TABLE staff ADD COLUMN email TEXT NOT NULL DEFAULT ''");
  // Additive migrations preserve the attendance and identity data of earlier weeks.
  function column(table,name,definition) {
    if(!db.prepare('PRAGMA table_info('+table+')').all().some(c=>c.name===name))db.exec('ALTER TABLE '+table+' ADD COLUMN '+name+' '+definition);
  }
  column('staff','mfa_required','INTEGER NOT NULL DEFAULT 0');
  column('staff','security_updated_at','TEXT');
  for(const name of ['client_id','ip_address','role','session_ref'])column('events',name,'TEXT');
  column('actions','desired_json','TEXT');
  column('actions','remote_state',"TEXT NOT NULL DEFAULT 'unconfirmed'");
  column('actions','updated_at','TEXT');
  column('actions','attempts','INTEGER NOT NULL DEFAULT 0');
  db.exec(`
    CREATE TABLE IF NOT EXISTS collector_state (
      name TEXT PRIMARY KEY, checkpoint_ms INTEGER NOT NULL DEFAULT 0,
      window_from_ms INTEGER, window_to_ms INTEGER, page_offset INTEGER NOT NULL DEFAULT 0,
      last_success TEXT, last_attempt TEXT, last_error TEXT, failures INTEGER NOT NULL DEFAULT 0,
      retry_after_ms INTEGER NOT NULL DEFAULT 0, imported INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS collector_gaps (
      id TEXT PRIMARY KEY, detected_at TEXT NOT NULL, from_ms INTEGER NOT NULL,
      to_ms INTEGER NOT NULL, reason TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'unverified'
    );
    CREATE TABLE IF NOT EXISTS action_attempts (
      id TEXT PRIMARY KEY, action_id TEXT NOT NULL REFERENCES actions(id), actor_id TEXT NOT NULL,
      note TEXT NOT NULL, request_id TEXT NOT NULL, started_at TEXT NOT NULL,
      finished_at TEXT, state TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS events_client_time ON events(client_id,time);
    CREATE INDEX IF NOT EXISTS events_actor_time ON events(actor_id,time);
    CREATE INDEX IF NOT EXISTS actions_state_time ON actions(state,time);
    CREATE INDEX IF NOT EXISTS identity_events_user_time ON identity_events(user_id,time);
  `);
  if(migrateNotifications)db.exec("INSERT INTO notifications(id,audience,title,body,section,created_at) SELECT 'legacy-alert:'||id,'security',kind,'Tài khoản: '||username,'alerts',updated_at FROM alerts WHERE status IN ('open','reviewing')");
  return {
    db,
    one(sql, ...args) { return db.prepare(sql).get(...args); },
    all(sql, ...args) { return db.prepare(sql).all(...args); },
    run(sql, ...args) { return db.prepare(sql).run(...args); },
    tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    notify({userId=null,audience='personal',title,body,section='overview',time=new Date().toISOString()}) {
      this.run('INSERT INTO notifications(id,user_id,audience,title,body,section,created_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),userId,audience,title,body,section,time);
    },
    alert({actorId=null,username='anonymous',kind,severity='medium',time=new Date().toISOString()}) {
      const old=this.one("SELECT id FROM alerts WHERE actor_id IS ? AND username=? AND kind=? AND status IN ('open','reviewing') AND updated_at>? AND updated_at<=? ORDER BY updated_at DESC LIMIT 1",actorId,username,kind,new Date(new Date(time).getTime()-600000).toISOString(),new Date(new Date(time).getTime()+600000).toISOString());
      if(old)this.run("UPDATE alerts SET count=count+1,updated_at=MAX(updated_at,?),severity=CASE WHEN severity='high' OR ?='high' THEN 'high' ELSE severity END WHERE id=?",time,severity,old.id);
      else {
        this.run('INSERT INTO alerts(id,actor_id,username,kind,severity,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),actorId,username,kind,severity,time,time);
        this.notify({audience:'security',title:kind,body:'Tài khoản: '+username,section:'alerts',time});
      }
    },
    event(req, status, reason, target = null) {
      const time = new Date().toISOString(), u = req.staff;
      const claims=req.claims || {};
      const sessionRef=claims.sid?require('node:crypto').createHash('sha256').update(String(claims.sid)).digest('hex').slice(0,24):null;
      this.run('INSERT INTO events(request_id,time,actor_id,username,method,path,status,decision,reason,target,client_id,ip_address,role,session_ref) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)', req.requestId,time,u?.id || null,u?.username || 'anonymous',req.method,(req.originalUrl || req.path).split('?')[0].slice(0,180),status,status < 400 ? 'ALLOW' : 'DENY',reason,target,claims.azp || null,String(req.ip || req.socket?.remoteAddress || '').slice(0,80) || null,u?.role || null,sessionRef);
      const kinds = { INSUFFICIENT_ROLE:['Vượt quyền chức năng','high'], CROSS_TEAM:['Truy cập khác nhóm','high'], NOT_OWNER:['Truy cập dữ liệu người khác','high'], INVALID_TOKEN:['Token không hợp lệ','medium'], SESSION_REVOKED:['Sử dụng phiên đã thu hồi','high'], ACCOUNT_DISABLED:['Tài khoản đã khóa','high'], FIELD_NOT_ALLOWED:['Chèn trường ngoài cho phép','medium'], RATE_LIMIT:['Tần suất truy cập cao','medium'], ORIGIN_DENIED:['Nguồn truy cập không cho phép','medium'], SELF_APPROVAL:['Tự duyệt đơn của mình','high'], CLIENT_SCOPE_DENIED:['Truy cập ngoài phạm vi ứng dụng','high'], DASHBOARD_ACCESS_DENIED:['Truy cập Web B trái quyền','high'], MFA_SETUP_REQUIRED:['Chưa hoàn tất thiết lập MFA','medium'], REQUIRED_ACTION_PENDING:['Chưa hoàn tất xác thực bắt buộc','medium'] };
      if (kinds[reason]) {
        const [kind,severity] = kinds[reason];
        this.alert({actorId:u?.id || null,username:u?.username || 'anonymous',kind,severity,time});
      }
    },
  };
}
module.exports = { openStore };
