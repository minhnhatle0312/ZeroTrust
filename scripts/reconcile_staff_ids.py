"""Offline local ID reconciliation. CLI defaults to read-only dry-run; never writes Keycloak.

Historical IDs are evidence, not authentication aliases. Only explicitly classified
business pointers move. The immutable ledger explains old IDs without rewriting events.
"""
import argparse
import copy
import hashlib
import json
import os
import re
import socket
import sqlite3
import sys
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from repair_security_dashboard import Api, BASE, PUBLIC, ROOT, TOKEN_PATH, RepairError, RepairHTTPError, identifier, read_env

TARGETS = {'employee01': 'employee', 'employee02': 'employee', 'manager01': 'manager',
           'manager02': 'manager', 'auditor01': 'auditor'}
ACCOUNTS = {'admin01': 'admin', **TARGETS}
MOVE = {
    'staff': ('id',), 'attendance': ('user_id',), 'corrections': ('user_id', 'reviewer_id'),
    'notifications': ('user_id',), 'notification_reads': ('user_id',),
    'directory_maintenance': ('user_id',),
    'access_requests': ('user_id', 'reviewer_id'),
    'lifecycle_workflows': ('target_id', 'creator_id', 'reviewer_id'),
}
# Every column of these tables is preserved, including embedded IDs in JSON/URLs.
HISTORY = {'events', 'identity_events', 'actions', 'action_attempts', 'alerts',
           'alert_evidence', 'alert_history', 'lifecycle_history', 'access_reviews',
           'access_review_items', 'directory_sync_jobs', 'audit_outbox'}
OTHER = {'collector_state', 'collector_gaps', 'audit_meta', 'audit_delivery', 'incident_migrations'}
LEDGER = 'staff_id_reconciliations'
LEDGER_SQL = '''CREATE TABLE staff_id_reconciliations (
 old_id TEXT PRIMARY KEY, new_id TEXT NOT NULL UNIQUE REFERENCES staff(id),
 username TEXT NOT NULL UNIQUE, role TEXT NOT NULL, reconciled_at TEXT NOT NULL,
 batch_id TEXT NOT NULL, reason TEXT NOT NULL)'''


class Stop(RepairError):
    pass


def require(condition, message):
    if not condition:
        raise Stop(message)


def digest(value):
    if not isinstance(value, bytes):
        value = json.dumps(value, sort_keys=True, ensure_ascii=True, separators=(',', ':')).encode()
    return hashlib.sha256(value).hexdigest()


def quote(name):
    return '"' + name.replace('"', '""') + '"'


def connect(path, writable=False):
    c = sqlite3.connect(Path(path).resolve().as_uri() + ('?mode=rw' if writable else '?mode=ro'), uri=True,
                        isolation_level=None, timeout=5)
    c.row_factory = sqlite3.Row
    c.execute('PRAGMA foreign_keys=ON')
    if not writable:
        c.execute('PRAGMA query_only=ON')
    return c


def integrity(c):
    require([r[0] for r in c.execute('PRAGMA integrity_check')] == ['ok'], 'SQLite integrity_check failed.')
    require(not c.execute('PRAGMA foreign_key_check').fetchall(), 'SQLite foreign_key_check failed.')


def snapshot(c):
    schema = [tuple(r) for r in c.execute('SELECT type,name,tbl_name,sql FROM sqlite_schema ORDER BY type,name')]
    tables = {}
    for r in c.execute("SELECT name FROM sqlite_schema WHERE type='table' ORDER BY name"):
        tables[r[0]] = [dict(row) for row in c.execute('SELECT * FROM ' + quote(r[0]))]
    return {'schema': schema, 'tables': tables}


def normalized(rows):
    return sorted(json.dumps(r, sort_keys=True, ensure_ascii=True) for r in rows)


def state_hash(state):
    return digest({'schema': state['schema'], 'tables': {t: normalized(rs) for t, rs in state['tables'].items()}})


class ReadOnlyKeycloak(Api):
    def _exchange(self, path, method='GET', data=None, form=False):
        allowed = (path == TOKEN_PATH and method == 'POST' and form) or (
            method == 'GET' and path.startswith(BASE + '/users') and not form and data is None)
        require(allowed, 'Non-read-only Keycloak operation blocked.')
        return super()._exchange(path, method, data, form)

    def users(self, username):
        require(username in ACCOUNTS, 'Username outside allowlist.')
        return self._send(BASE + '/users?' + urlencode({'username': username, 'exact': 'true', 'max': 100}))

    def roles(self, user_id):
        return self._send(BASE + '/users/' + identifier(user_id) + '/role-mappings/realm/composite')

    def exists(self, user_id):
        try:
            self._send(BASE + '/users/' + identifier(user_id))
            return True
        except RepairHTTPError as error:
            if error.status == 404:
                return False
            raise


def local(record):
    return (record.get('identity_source', 'local') == 'local' and
            not record.get('directory_provider_id') and record.get('directory_status', 'local') == 'local')


def resolve(c, seed, api):
    require(isinstance(seed, list), 'staff.json must be an array.')
    mapping = []
    for username, role in ACCOUNTS.items():
        rows = [dict(r) for r in c.execute('SELECT * FROM staff WHERE username=? COLLATE NOCASE', (username,))]
        seeds = [r for r in seed if isinstance(r, dict) and str(r.get('username', '')).casefold() == username]
        users = api.users(username)
        require(len(rows) == len(seeds) == len(users) == 1, 'Non-unique local/seed/Keycloak match: ' + username)
        row, item, user = rows[0], seeds[0], users[0]
        require(row['username'] == item.get('username') == user.get('username') == username, 'Username case mismatch: ' + username)
        require(row['role'] == item.get('role') == role, 'Local/seed role mismatch: ' + username)
        require(local(row) and local(item), 'LDAP or non-local profile blocked: ' + username)
        attributes = user.get('attributes') or {}
        require(not user.get('federationLink') and not user.get('serviceAccountClientId') and
                not any('ldap' in str(k).lower() for k in attributes), 'Federated/LDAP identity blocked: ' + username)
        require(user.get('enabled') is True and row.get('disabled', 0) == 0 and
                row.get('governance_state', 'active') == 'active', 'Account not active: ' + username)
        new = identifier(user.get('id'))
        effective = {r.get('name') for r in api.roles(new)} & set(ACCOUNTS.values())
        require(effective == {role}, 'Effective application role mismatch: ' + username)
        old = identifier(row['id'])
        require(item.get('id') == old, 'Seed/SQLite ID mismatch: ' + username)
        if username == 'admin01':
            require(old == new, 'admin01 must already match; never modified.')
        elif old != new:
            require(not c.execute('SELECT 1 FROM staff WHERE id=?', (new,)).fetchone(), 'New ID collision: ' + username)
            require(not api.exists(old), 'Old Keycloak ID still exists: ' + username)
            mapping.append({'username': username, 'role': role, 'old_id': old, 'new_id': new})
    require(len({m['new_id'] for m in mapping}) == len(mapping), 'Duplicate target IDs.')
    return mapping


def inventory(c, state, mapping):
    tables = state['tables']
    require(set(MOVE) | HISTORY | OTHER <= tables.keys(), 'Expected application schema missing; review migrations first.')
    old_ids = {m['old_id'] for m in mapping}
    # An FK newly added by a future release must not silently escape migration.
    foreign_keys, refs, blockers = [], [], []
    for table in tables:
        for fk in c.execute('PRAGMA foreign_key_list(' + quote(table) + ')'):
            foreign_keys.append({'table': table, 'column': fk['from'], 'parent': fk['table'], 'parentColumn': fk['to']})
            if fk['table'] == 'staff' and not (fk['to'] == 'id' and fk['from'] in MOVE.get(table, ())):
                if not (table == LEDGER and fk['from'] == 'new_id' and fk['to'] == 'id'):
                    blockers.append('Unclassified FK: ' + table + '.' + fk['from'])
        for column in [r['name'] for r in c.execute('PRAGMA table_info(' + quote(table) + ')')]:
            for m in mapping:
                hits = sum(isinstance(row[column], str) and m['old_id'] in row[column] for row in tables[table])
                if not hits:
                    continue
                exact = sum(row[column] == m['old_id'] for row in tables[table])
                moving = column in MOVE.get(table, ())
                classified = moving or table in HISTORY or (table == 'lifecycle_workflows' and column in {'desired_json', 'before_json', 'source_receipt'})
                if not classified or (moving and exact != hits):
                    blockers.append('Unclassified ID reference: ' + table + '.' + column)
                refs.append({'table': table, 'column': column, 'username': m['username'], 'rows': hits,
                             'policy': 'MOVE' if moving else 'PRESERVE'})
    for row in c.execute("SELECT name,tbl_name FROM sqlite_schema WHERE type='trigger'"):
        if row['tbl_name'] in MOVE or row['tbl_name'] == LEDGER:
            blockers.append('Trigger on changed table: ' + row['name'])
    if LEDGER in tables:
        for row in tables[LEDGER]:
            if row['old_id'] in old_ids or row['new_id'] in old_ids or row['username'] in {m['username'] for m in mapping}:
                blockers.append('Existing reconciliation chain/conflict; manual review required.')
    for row in tables['actions']:
        if (row['actor_id'] in old_ids or row['target_id'] in old_ids) and row['state'] not in {'synced', 'failed'}:
            blockers.append('Unfinished security action; resolve before migration.')
    for row in tables['lifecycle_workflows']:
        if any(row.get(k) in old_ids for k in ('target_id', 'creator_id', 'reviewer_id')) and row['state'] != 'synced' and row['approval'] != 'rejected':
            blockers.append('Unfinished lifecycle workflow; resolve before migration.')
    if any(row['state'] in {'pending', 'running'} for row in tables['directory_sync_jobs']):
        blockers.append('Directory synchronization in progress.')
    for row in tables['directory_maintenance']:
        if row['user_id'] in old_ids:
            blockers.append('Local profile has directory maintenance record.')
    require(not blockers, '; '.join(sorted(set(blockers))))
    return refs, foreign_keys


def changed_seed(raw, mapping):
    before = json.loads(raw)
    expected = copy.deepcopy(before)
    result = raw
    for m in mapping:
        old = json.dumps(m['old_id']).encode()
        require(result.count(old) == 1, 'Seed ID occurs more than once; no textual rewrite allowed.')
        result = result.replace(old, json.dumps(m['new_id']).encode(), 1)
        next(r for r in expected if r['username'] == m['username'])['id'] = m['new_id']
    require(json.loads(result) == expected, 'Seed transformation changed more than IDs.')
    return result


def plan(c, seed_path, api):
    integrity(c)
    raw = seed_path.read_bytes()
    state = snapshot(c)
    mapping = resolve(c, json.loads(raw), api)
    refs, fks = inventory(c, state, mapping)
    changed_seed(raw, mapping)
    database_path = next(row['file'] for row in c.execute('PRAGMA database_list') if row['name'] == 'main')
    return {'version': 2, 'databasePath': str(Path(database_path).resolve()), 'seedPath': str(seed_path.resolve()),
            'mapping': mapping, 'references': refs, 'foreignKeys': fks,
            'databaseHash': state_hash(state), 'seedHash': digest(raw)}, state, raw


def write_json(path, value):
    with path.open('x', encoding='utf-8') as f:
        json.dump(value, f, ensure_ascii=False, indent=2)
        f.flush()
        os.fsync(f.fileno())


BACKUP_FILES = ('attendance.sqlite', 'staff.json', 'plan.json')


def backup_file_entry(path):
    """Hash file bytes, distinct from the logical SQLite state hash in a plan."""
    sha = hashlib.sha256()
    size = 0
    with path.open('rb') as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b''):
            size += len(chunk)
            sha.update(chunk)
    return {'path': str(path.resolve()), 'sizeBytes': size, 'sha256': sha.hexdigest()}


def write_backup_manifest(backup, approved):
    """Exclusive creation; failure propagates before any business mutation."""
    manifest = {'version': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'backupDirectory': str(backup.resolve()),
                'sourceDatabase': approved['databasePath'], 'sourceSeed': approved['seedPath'],
                'files': {name: backup_file_entry(backup / name) for name in BACKUP_FILES}}
    write_json(backup / 'manifest.json', manifest)


def verify_backup_manifest(backup, approved):
    """Re-read manifest, bytes and semantic snapshot before the first mutation.

    Paths are fixed by the backup directory, never opened from manifest input.
    Hash agreement alone is insufficient: recheck the saved plan/seed/SQLite
    against the approved pre-migration state as well.
    """
    manifest = json.loads((backup / 'manifest.json').read_bytes())
    require(isinstance(manifest, dict) and manifest.get('version') == 1,
            'Invalid backup manifest version.')
    require(manifest.get('backupDirectory') == str(backup.resolve()) and
            manifest.get('sourceDatabase') == approved['databasePath'] and
            manifest.get('sourceSeed') == approved['seedPath'], 'Backup manifest path mismatch.')
    entries = manifest.get('files')
    require(isinstance(entries, dict) and set(entries) == set(BACKUP_FILES),
            'Backup manifest file list mismatch.')
    for name in BACKUP_FILES:
        path = backup / name
        require(not path.is_symlink() and path.is_file(), 'Backup file missing or redirected: ' + name)
        require(entries[name] == backup_file_entry(path), 'Backup manifest file verification failed: ' + name)
    require(json.loads((backup / 'plan.json').read_bytes()) == approved, 'Backup plan differs from approved plan.')
    require(digest((backup / 'staff.json').read_bytes()) == approved['seedHash'], 'Backup seed differs from approved state.')
    with closing(connect(backup / 'attendance.sqlite')) as saved:
        integrity(saved)
        require(state_hash(snapshot(saved)) == approved['databaseHash'], 'Backup database differs from approved state.')
    return manifest


def atomic_bytes(path, content):
    temp = path.with_name(path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('xb') as f:
            f.write(content)
            f.flush()
            os.fsync(f.fileno())
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def stopped(port):
    for host in ('127.0.0.1', '::1'):
        with socket.socket(socket.AF_INET6 if ':' in host else socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(1)
            require(s.connect_ex((host, port)) != 0, 'Backend port is active. Stop Backend and all SQLite writers before apply.')


def verify_changes(before, after, mapping, batch):
    ids = {m['old_id']: m['new_id'] for m in mapping}
    for table, rows in before['tables'].items():
        if table == LEDGER:
            continue
        expected = copy.deepcopy(rows)
        for row in expected:
            for column in MOVE.get(table, ()):
                row[column] = ids.get(row[column], row[column])
        require(normalized(expected) == normalized(after['tables'][table]), 'Unexpected data change: ' + table)
    previous = before['tables'].get(LEDGER, [])
    added = [r for r in after['tables'][LEDGER] if r['batch_id'] == batch]
    require(len(added) == len(mapping) and normalized(previous) == normalized([r for r in after['tables'][LEDGER] if r['batch_id'] != batch]), 'Reconciliation ledger verification failed.')


def apply(db_path, seed_path, api, approved, backup_root, ensure_stopped):
    """Used by CLI only after explicit --apply; tests use disposable fixture paths."""
    ensure_stopped()
    pending = seed_path.with_name(seed_path.name + '.reconcile-pending.json')
    require(not pending.exists(), 'Interrupted apply exists; use --recover with Backend stopped.')
    c = connect(db_path, writable=True)
    seed_written = False
    committed = False
    backup = None
    raw = None
    try:
        c.execute('BEGIN IMMEDIATE')
        current, before, raw = plan(c, seed_path, api)
        require(current == approved, 'Dry-run plan is stale or changed; generate and review a new plan.')
        if not current['mapping']:
            c.execute('ROLLBACK')
            return None
        ensure_stopped()
        batch = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:8]
        backup = backup_root / batch
        backup.mkdir(parents=True, exist_ok=False)
        # A separate read connection sees the same committed snapshot while our
        # BEGIN IMMEDIATE prevents other writers; includes committed WAL pages.
        with closing(connect(db_path)) as source, closing(sqlite3.connect(backup / 'attendance.sqlite')) as dest:
            source.backup(dest)
            integrity(dest)
        with closing(connect(backup / 'attendance.sqlite')) as saved:
            require(state_hash(snapshot(saved)) == current['databaseHash'], 'SQLite backup verification failed.')
        with (backup / 'staff.json').open('xb') as f:
            f.write(raw)
            f.flush()
            os.fsync(f.fileno())
        require((backup / 'staff.json').read_bytes() == raw, 'Seed backup verification failed.')
        write_json(backup / 'plan.json', current)
        write_backup_manifest(backup, current)
        verify_backup_manifest(backup, current)
        # All three backup files and the durable manifest have been read back
        # and verified while BEGIN IMMEDIATE still excludes database writers.
        new_seed = changed_seed(raw, current['mapping'])
        c.execute('PRAGMA defer_foreign_keys=ON')
        if LEDGER not in before['tables']:
            c.execute(LEDGER_SQL)
        for m in current['mapping']:
            for table, columns in MOVE.items():
                for column in columns:
                    c.execute('UPDATE ' + quote(table) + ' SET ' + quote(column) + '=? WHERE ' + quote(column) + '=?', (m['new_id'], m['old_id']))
            c.execute('INSERT INTO ' + LEDGER + ' VALUES(?,?,?,?,?,?,?)',
                      (m['old_id'], m['new_id'], m['username'], m['role'], datetime.now(timezone.utc).isoformat(), batch, 'Verified local username and role; operator approved rekey'))
        integrity(c)
        after = snapshot(c)
        verify_changes(before, after, current['mapping'], batch)
        require(seed_path.read_bytes() == raw, 'Seed changed concurrently.')
        # Durable recovery marker bridges SQLite commit and atomic file replacement.
        write_json(pending, {'backup': str(backup.resolve()), 'database': str(db_path.resolve()),
                            'before': current['databaseHash'], 'after': state_hash(after),
                            'oldSeed': digest(raw), 'newSeed': digest(new_seed)})
        atomic_bytes(seed_path, new_seed)
        seed_written = True
        require(seed_path.read_bytes() == new_seed, 'Seed post-write verification failed.')
        ensure_stopped()
        c.execute('COMMIT')
        committed = True
        pending.unlink()
        return backup
    except BaseException:
        if not committed:
            if c.in_transaction:
                c.execute('ROLLBACK')
            if seed_written:
                atomic_bytes(seed_path, raw)
            if pending.exists() and raw is not None and seed_path.read_bytes() == raw:
                pending.unlink()
        raise
    finally:
        c.close()


def recover(db_path, seed_path, ensure_stopped):
    """No DB restoration: SQLite handles its journal. Repair only a proven seed mismatch."""
    ensure_stopped()
    pending = seed_path.with_name(seed_path.name + '.reconcile-pending.json')
    marker = json.loads(pending.read_bytes())
    require(marker['database'] == str(db_path.resolve()), 'Recovery database path differs.')
    backup = Path(marker['backup'])
    raw = (backup / 'staff.json').read_bytes()
    saved_plan = json.loads((backup / 'plan.json').read_bytes())
    new = changed_seed(raw, saved_plan['mapping'])
    require(digest(raw) == marker['oldSeed'] and digest(new) == marker['newSeed'], 'Recovery backup hash mismatch.')
    with closing(connect(db_path, writable=True)) as c:
        c.execute('BEGIN IMMEDIATE')
        integrity(c)
        current = state_hash(snapshot(c))
        require(current in {marker['before'], marker['after']}, 'Database changed after interruption; manual recovery required.')
        require(digest(seed_path.read_bytes()) in {marker['oldSeed'], marker['newSeed']}, 'Seed changed after interruption; manual recovery required.')
        atomic_bytes(seed_path, raw if current == marker['before'] else new)
        c.execute('ROLLBACK')
    pending.unlink()


def main():
    parser = argparse.ArgumentParser(description='Reconcile five local demo IDs; default dry-run. No Keycloak writes.')
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--recover', action='store_true')
    parser.add_argument('--plan', type=Path, help='Dry-run output path (new file); required reviewed input for --apply.')
    parser.add_argument('--backend-stopped', action='store_true', help='Operator confirms all Backend/SQLite writers stopped.')
    args = parser.parse_args()
    env = read_env(ROOT / 'backend/.env')
    require(not any(k in os.environ for k in ('IAM_BACKEND_ENV', 'ATTENDANCE_DB', 'STAFF_FILE', 'PORT')), 'Backend environment override present; review paths first.')
    db = (ROOT / 'backend' / env.get('ATTENDANCE_DB', 'data/attendance.sqlite')).resolve()
    seed = (ROOT / 'backend' / env.get('STAFF_FILE', 'data/staff.json')).resolve()
    require(db.is_relative_to(ROOT) and seed.is_relative_to(ROOT), 'Database/seed outside workspace blocked.')
    require(db.is_file() and seed.is_file(), 'Database/seed missing; no initialization allowed.')
    port = int(env.get('PORT', '3001'))
    backup_root = ROOT / '.local/staff-id-backups'
    require(backup_root.resolve().is_relative_to(ROOT), 'Backup destination outside workspace blocked.')
    if args.apply or args.recover:
        require(args.backend_stopped, 'Explicit --backend-stopped required; stop all writers first.')
        stopped(port)
    if args.recover:
        recover(db, seed, lambda: stopped(port))
        print('Recovery verified. Database history unchanged; recovery marker cleared.')
        return
    require(not seed.with_name(seed.name + '.reconcile-pending.json').exists(), 'Interrupted apply marker exists; recovery required.')
    root_env = read_env(ROOT / '.env')
    require(root_env.get('KEYCLOAK_PUBLIC_URL', '').rstrip('/') == PUBLIC, 'Unexpected Keycloak URL.')
    api = ReadOnlyKeycloak(root_env)
    if args.apply:
        require(args.plan is not None, '--apply requires a previously reviewed --plan file.')
        approved = json.loads(args.plan.read_bytes())
        backup = apply(db, seed, api, approved, backup_root, lambda: stopped(port))
        print('Backup: ' + str(backup) if backup else 'Already synchronized; no writes or backup needed.')
        if backup:
            print('Manifest: ' + str(backup / 'manifest.json'))
            print('Manifest SHA-256: ' + digest((backup / 'manifest.json').read_bytes()))
        print('Verification passed; admin01 and historical events preserved.')
    else:
        with closing(connect(db)) as c:
            c.execute('BEGIN')
            result, _, _ = plan(c, seed, api)
            c.execute('ROLLBACK')
        print('DRY-RUN | Database: ' + str(db) + ' | Seed: ' + str(seed))
        print('username | role | old ID -> new ID')
        for m in result['mapping']:
            print(m['username'] + ' | ' + m['role'] + ' | ' + m['old_id'] + ' -> ' + m['new_id'])
        print('admin01: verified unchanged. Changes: ' + str(len(result['mapping'])))
        for r in result['references']:
            print('{policy} | {table}.{column} | {username} | {rows}'.format(**r))
        print('Foreign keys inspected: ' + str(len(result['foreignKeys'])))
        print('Backup on apply (not created by dry-run): ' + str(backup_root / '<UTC>-<random>'))
        if args.plan:
            args.plan.parent.mkdir(parents=True, exist_ok=True)
            write_json(args.plan, result)
            print('Plan: ' + str(args.plan.resolve()))


if __name__ == '__main__':
    try:
        main()
    except (RepairError, OSError, ValueError, sqlite3.Error, KeyError, TypeError):
        # No raw records, SQL parameters, env values, or upstream response bodies.
        error = sys.exc_info()[1]
        print('STOP: ' + (str(error) if isinstance(error, RepairError) else type(error).__name__ + '; details omitted.'), file=sys.stderr)
        sys.exit(1)
