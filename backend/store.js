const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
function openStore(filename) {
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
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
    CREATE INDEX IF NOT EXISTS alerts_time ON alerts(updated_at);`);
  return {
    db,
    one(sql, ...args) { return db.prepare(sql).get(...args); },
    all(sql, ...args) { return db.prepare(sql).all(...args); },
    run(sql, ...args) { return db.prepare(sql).run(...args); },
    tx(fn) { db.exec('BEGIN IMMEDIATE'); try { const r = fn(); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } },
    event(req, status, reason, target = null) {
      const time = new Date().toISOString(), u = req.staff;
      this.run('INSERT INTO events(request_id,time,actor_id,username,method,path,status,decision,reason,target) VALUES(?,?,?,?,?,?,?,?,?,?)', req.requestId,time,u?.id || null,u?.username || 'anonymous',req.method,(req.originalUrl || req.path).split('?')[0].slice(0,180),status,status < 400 ? 'ALLOW' : 'DENY',reason,target);
      const kinds = { INSUFFICIENT_ROLE:['Vượt quyền chức năng','high'], CROSS_TEAM:['Truy cập khác nhóm','high'], NOT_OWNER:['Truy cập dữ liệu người khác','high'], INVALID_TOKEN:['Token không hợp lệ','medium'], SESSION_REVOKED:['Sử dụng phiên đã thu hồi','high'], ACCOUNT_DISABLED:['Tài khoản đã khóa','high'], FIELD_NOT_ALLOWED:['Chèn trường ngoài cho phép','medium'], RATE_LIMIT:['Tần suất truy cập cao','medium'], ORIGIN_DENIED:['Nguồn truy cập không cho phép','medium'], SELF_APPROVAL:['Tự duyệt đơn của mình','high'] };
      if (kinds[reason]) {
        const [kind,severity] = kinds[reason];
        const old = this.one("SELECT id FROM alerts WHERE actor_id IS ? AND kind=? AND status IN ('open','reviewing') AND updated_at>? ORDER BY updated_at DESC LIMIT 1", u?.id || null,kind,new Date(Date.now()-600000).toISOString());
        if (old) this.run('UPDATE alerts SET count=count+1,updated_at=? WHERE id=?',time,old.id);
        else this.run('INSERT INTO alerts(id,actor_id,username,kind,severity,created_at,updated_at) VALUES(?,?,?,?,?,?,?)',randomUUID(),u?.id || null,u?.username || 'anonymous',kind,severity,time,time);
      }
    },
  };
}
module.exports = { openStore };
