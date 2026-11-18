require('dotenv').config();

const fs = require('fs');
const path = require('path');
const { openStore } = require('./store');

const oldId = 'b5300ca8-911b-44c3-968f-6b9113a6edbd';
const newId = '659f01ed-ead4-4392-bb76-070644feea9f';

const dbPath = path.resolve(
  process.env.ATTENDANCE_DB || 'data/attendance.sqlite'
);

if (!fs.existsSync(dbPath)) {
  throw new Error('Không tìm thấy database: ' + dbPath);
}

const store = openStore(dbPath);

try {
  const db = store.db;

  const oldUser = store.one('SELECT * FROM staff WHERE id=?', oldId);
  const newUser = store.one('SELECT * FROM staff WHERE id=?', newId);

  if (!oldUser || oldUser.username !== 'admin01') {
    throw new Error('Không tìm thấy hồ sơ admin01 với ID cũ.');
  }

  if (newUser) {
    throw new Error('ID mới đã tồn tại. Dừng để tránh ghi đè.');
  }

  const backup = dbPath + '.before-admin01-id-fix-' +
    new Date().toISOString().replace(/[:.]/g, '-') + '.bak';

  db.backup(backup);
  console.log('Backup:', backup);

  const columns = [
    'user_id',
    'staff_id',
    'employee_id',
    'actor_id',
    'target_id'
  ];

  const tables = store.all(
    "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
  );

  const updates = [];

  for (const row of tables) {
    const table = row.name;
    if (table === 'staff') continue;

    const escaped = table.replace(/"/g, '""');
    const schema = store.all(`PRAGMA table_info("${escaped}")`);

    for (const col of schema) {
      if (columns.includes(col.name)) {
        updates.push({ table, column: col.name });
      }
    }
  }

  db.exec('PRAGMA foreign_keys=OFF');

  try {
    db.exec('BEGIN IMMEDIATE');

    for (const item of updates) {
      const table = item.table.replace(/"/g, '""');
      const column = item.column.replace(/"/g, '""');

      db.prepare(
        `UPDATE "${table}" SET "${column}"=? WHERE "${column}"=?`
      ).run(newId, oldId);
    }

    db.prepare('UPDATE staff SET id=? WHERE id=?').run(newId, oldId);

    const violations = db.prepare('PRAGMA foreign_key_check').all();

    if (violations.length) {
      throw new Error('Foreign key check failed: ' +
        JSON.stringify(violations));
    }

    db.exec('COMMIT');
    console.log('SUCCESS: Đồng bộ ID admin01 thành công.');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.exec('PRAGMA foreign_keys=ON');
  }

  const user = store.one(
    'SELECT id, username, role, disabled FROM staff WHERE id=?',
    newId
  );

  console.log('Hồ sơ sau cập nhật:', user);
} catch (error) {
  console.error('FAILED:', error.message);
  process.exitCode = 1;
} finally {
  store.db.close();
}
