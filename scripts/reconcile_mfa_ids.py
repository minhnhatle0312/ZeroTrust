"""Separate two-account MFA reconciliation. Default is read-only dry-run.

Never provisions identities or changes seed/MFA policy. Apply needs a separately
reviewed MFA plan and confirmed writer downtime. The five-demo script is not run.
"""
import argparse
import copy
import json
import os
import sqlite3
import sys
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

import reconcile_staff_ids as core

TARGETS = {'mfa-employee': 'employee', 'mfa-auditor': 'auditor'}
KIND = 'mfa-staff-id-reconciliation'
REASON = 'Verified local MFA identity; separate operator-approved rekey'


class ReadOnlyKeycloak(core.ReadOnlyKeycloak):
    def users(self, username):
        core.require(username in set(TARGETS) | set(core.ACCOUNTS), 'Username outside MFA review scope.')
        return self._send(core.BASE + '/users?' + urlencode({'username': username, 'exact': 'true', 'max': 100}))


def marker_path(seed):
    # Reuse the startup interlock understood by backend/bootstrap.js. Only this
    # module's recover handles a marker carrying our kind; it never rewrites seed.
    return seed.with_name(seed.name + '.reconcile-pending.json')


def resolve(c, seed, api, state):
    core.require(isinstance(seed, list) and len(seed) == len(core.ACCOUNTS) and
                 {s.get('username') for s in seed} == set(core.ACCOUNTS), 'Seed must remain exactly the six demo profiles.')
    core.require(core.resolve(c, seed, api) == [], 'Completed demo migration no longer matches; never rerun it here.')
    core.require(core.LEDGER in state['tables'], 'Completed demo identity ledger missing.')
    ledger = state['tables'][core.LEDGER]
    non_mfa = [v for v in ledger if v['username'] not in TARGETS]
    core.require(len(non_mfa) == len(core.TARGETS) and {v['username'] for v in non_mfa} == set(core.TARGETS),
                 'Expected five preserved demo ledger entries.')
    for v in non_mfa:
        staff = c.execute('SELECT id,role FROM staff WHERE username=?', (v['username'],)).fetchone()
        core.require(staff and staff['id'] == v['new_id'] and staff['role'] == v['role'], 'Demo ledger/profile differs.')
    mapping, guards = [], {}
    for username, role in TARGETS.items():
        rows = [dict(v) for v in c.execute('SELECT * FROM staff WHERE username=? COLLATE NOCASE', (username,))]
        users = api.users(username)
        core.require(len(rows) == len(users) == 1, 'MFA identity must be unique: ' + username)
        row, user = rows[0], users[0]
        core.require(row['username'] == user.get('username') == username, 'MFA username case mismatch.')
        core.require(core.local(row) and row['disabled'] == 0 and row['governance_state'] == 'active', 'MFA local profile must be active/local.')
        attrs = user.get('attributes') or {}
        core.require(user.get('enabled') is True and not user.get('federationLink') and
                     not user.get('serviceAccountClientId') and not any('ldap' in k.lower() for k in attrs),
                     'MFA remote profile must be enabled/local.')
        effective = {v.get('name') for v in api.roles(user['id'])} & set(core.ACCOUNTS.values())
        core.require(row['role'] == role and effective == {role}, 'MFA role differs.')
        core.require(row['mfa_required'] == 1 and attrs.get('nhip.mfa.required') == ['true'], 'MFA requirement missing or changed.')
        actions = user.get('requiredActions') or []
        core.require(isinstance(actions, list) and all(isinstance(a, str) for a in actions), 'Invalid MFA required actions.')
        core.require(user.get('totp') is True or 'CONFIGURE_TOTP' in actions, 'MFA enrollment/enforcement state is unverified.')
        old, new = core.identifier(row['id']), core.identifier(user.get('id'))
        guards[username] = {'id': new, 'username': username, 'role': role, 'enabled': True,
                            'mfaRequired': True, 'totp': user.get('totp') is True,
                            'requiredActions': sorted(actions), 'createdTimestamp': user.get('createdTimestamp')}
        entries = [v for v in ledger if v['username'] == username]
        if old == new:
            core.require(len(entries) == 1 and entries[0]['new_id'] == new and entries[0]['role'] == role,
                         'Already-matched MFA profile lacks a verified ledger.')
            continue
        core.require(not entries and not any(v['old_id'] in {old, new} or v['new_id'] in {old, new} for v in ledger),
                     'MFA ledger chain/conflict exists.')
        core.require(not c.execute('SELECT 1 FROM staff WHERE id=?', (new,)).fetchone(), 'MFA target ID collision.')
        core.require(not api.exists(old), 'Old MFA Keycloak identity still exists.')
        mapping.append({'username': username, 'role': role, 'old_id': old, 'new_id': new})
    core.require(len(mapping) in (0, 2), 'Partial MFA reconciliation requires manual review.')
    core.require(len({v['new_id'] for v in mapping}) == len(mapping), 'Duplicate MFA target ID.')
    return mapping, guards


def plan(c, seed_path, api):
    core.integrity(c)
    state, raw = core.snapshot(c), seed_path.read_bytes()
    mapping, guards = resolve(c, json.loads(raw), api, state)
    refs, fks = core.inventory(c, state, mapping)
    reverse = [{**v, 'old_id': v['new_id'], 'new_id': v['old_id']} for v in mapping]
    new_refs, _ = core.inventory(c, state, reverse)
    # This plan deliberately changes only staff.id. New business references are
    # a reason to stop/review, not an excuse to widen the two-row migration.
    core.require(not any(v['policy'] == 'MOVE' and v['table'] != 'staff' for v in refs + new_refs),
                 'MFA business references exist outside the two staff rows; review separately.')
    scope = {v['username']: {v['old_id'], v['new_id'], v['username']} for v in mapping}
    audit = {}
    for username, terms in scope.items():
        hits = [row for row in state['tables']['audit_outbox'] if any(t in row['payload'] for t in terms)]
        audit[username] = {'rows': len(hits), 'delivered': sum(v['delivered_at'] is not None for v in hits),
                           'pending': sum(v['delivered_at'] is None for v in hits),
                           'contentHash': core.digest(core.normalized(hits))}
    db_path = next(v['file'] for v in c.execute('PRAGMA database_list') if v['name'] == 'main')
    value = {'kind': KIND, 'version': 1, 'scope': list(TARGETS), 'databasePath': str(Path(db_path).resolve()),
             'seedPath': str(seed_path.resolve()), 'mapping': mapping, 'remoteGuards': guards,
             'databaseHash': core.state_hash(state), 'seedHash': core.digest(raw),
             'foreignKeys': fks, 'oldIdReferences': refs, 'newIdReferences': new_refs,
             'preservedLedgerHash': core.digest(core.normalized(state['tables'][core.LEDGER])),
             'preservedAudit': audit, 'expectedChanges': {'staffRows': len(mapping), 'ledgerInserts': len(mapping),
                                                        'seedWrites': 0, 'auditWrites': 0}}
    return value, state, raw


def verified_backup(db, raw_seed, approved, backup):
    backup.mkdir(parents=True, exist_ok=False)
    # Same SQLite backup API/committed snapshot strategy as the tested demo
    # migration. Caller holds BEGIN IMMEDIATE; seed is backed up but never edited.
    with closing(core.connect(db)) as source, closing(sqlite3.connect(backup/'attendance.sqlite')) as dest:
        source.backup(dest)
        core.integrity(dest)
    with (backup/'staff.json').open('xb') as out:
        out.write(raw_seed)
        out.flush()
        os.fsync(out.fileno())
    core.write_json(backup/'plan.json', approved)
    core.write_backup_manifest(backup, approved)
    core.verify_backup_manifest(backup, approved)


def verify_delta(before, after, mapping, batch):
    core.require(before['schema'] == after['schema'] and before['tables'].keys() == after['tables'].keys(), 'Schema changed during MFA migration.')
    ids = {v['old_id']: v['new_id'] for v in mapping}
    for table, rows in before['tables'].items():
        if table == core.LEDGER:
            continue
        expected = copy.deepcopy(rows)
        if table == 'staff':
            for row in expected:
                row['id'] = ids.get(row['id'], row['id'])
        core.require(core.normalized(expected) == core.normalized(after['tables'][table]), 'Unexpected MFA data change: ' + table)
    added = [v for v in after['tables'][core.LEDGER] if v['batch_id'] == batch]
    existing = [v for v in after['tables'][core.LEDGER] if v['batch_id'] != batch]
    fields = ('old_id', 'new_id', 'username', 'role')
    core.require(core.normalized(existing) == core.normalized(before['tables'][core.LEDGER]) and
                 sorted(tuple(v[k] for k in fields) for v in added) == sorted(tuple(v[k] for k in fields) for v in mapping) and
                 all(v['reason'] == REASON for v in added), 'MFA ledger verification failed.')


def apply(db, seed, api, approved, backup_root, ensure_stopped):
    """Mutates only the passed database, after guard/plan/backup verification."""
    core.require(approved.get('kind') == KIND and approved.get('version') == 1 and approved.get('scope') == list(TARGETS), 'Not a reviewed two-account MFA plan.')
    ensure_stopped()
    pending = marker_path(seed)
    core.require(not pending.exists(), 'Recovery marker exists; do not reapply.')
    committed, marker_written = False, False
    with closing(core.connect(db, writable=True)) as c:
        try:
            c.execute('BEGIN IMMEDIATE')
            current, before, raw = plan(c, seed, api)
            core.require(current == approved, 'MFA plan stale or changed; review a new dry-run.')
            if not current['mapping']:
                c.execute('ROLLBACK')
                return None
            ensure_stopped()
            batch = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-mfa-' + uuid.uuid4().hex[:8]
            backup = backup_root/batch
            verified_backup(db, raw, current, backup)
            for v in current['mapping']:
                count = c.execute('UPDATE staff SET id=? WHERE id=? AND username=?', (v['new_id'],v['old_id'],v['username'])).rowcount
                core.require(count == 1, 'MFA staff update count differs.')
                c.execute('INSERT INTO '+core.LEDGER+' VALUES(?,?,?,?,?,?,?)',
                          (v['old_id'],v['new_id'],v['username'],v['role'],datetime.now(timezone.utc).isoformat(),batch,REASON))
            core.integrity(c)
            after = core.snapshot(c)
            verify_delta(before, after, current['mapping'], batch)
            core.require(seed.read_bytes() == raw, 'Seed changed concurrently; never overwrite it here.')
            marker = {'kind': KIND, 'backup': str(backup.resolve()), 'database': str(db.resolve()),
                      'before': current['databaseHash'], 'after': core.state_hash(after), 'seedHash': current['seedHash'],
                      'manifestHash': core.digest((backup/'manifest.json').read_bytes())}
            core.write_json(pending, marker)
            marker_written = True
            ensure_stopped()
            core.require(seed.read_bytes() == raw, 'Seed changed before commit.')
            c.execute('COMMIT')
            committed = True
            pending.unlink()
            return backup
        except BaseException:
            if not committed:
                if c.in_transaction:
                    c.execute('ROLLBACK')
                if marker_written and seed.read_bytes() == raw and core.state_hash(core.snapshot(c)) == current['databaseHash']:
                    pending.unlink()
            raise


def recover(db, seed, ensure_stopped):
    """Verify interrupted outcome, then clear only the marker. No DB/seed restore."""
    ensure_stopped()
    pending = marker_path(seed)
    marker = json.loads(pending.read_bytes())
    core.require(marker.get('kind') == KIND and marker.get('database') == str(db.resolve()), 'Not this MFA recovery marker.')
    backup = Path(marker['backup'])
    approved = json.loads((backup/'plan.json').read_bytes())
    core.require(approved.get('kind') == KIND and approved['databasePath'] == str(db.resolve()) and
                 approved['seedPath'] == str(seed.resolve()), 'Recovery plan paths differ.')
    core.require(core.digest((backup/'manifest.json').read_bytes()) == marker['manifestHash'], 'Recovery manifest changed.')
    core.verify_backup_manifest(backup, approved)
    core.require(marker['before'] == approved['databaseHash'] and marker['seedHash'] == approved['seedHash'] and
                 core.digest(seed.read_bytes()) == approved['seedHash'], 'Recovery seed or baseline changed.')
    with closing(core.connect(backup/'attendance.sqlite')) as saved:
        before = core.snapshot(saved)
    with closing(core.connect(db, writable=True)) as c:
        c.execute('BEGIN IMMEDIATE')
        try:
            core.integrity(c)
            state = core.snapshot(c)
            current = core.state_hash(state)
            core.require(current in {marker['before'],marker['after']}, 'Database changed after interruption; manual recovery required.')
            outcome = 'NOT_COMMITTED' if current == marker['before'] else 'COMMITTED'
            if outcome == 'COMMITTED':
                verify_delta(before, state, approved['mapping'], backup.name)
            ensure_stopped()
            core.require(core.digest(seed.read_bytes()) == approved['seedHash'], 'Seed changed during recovery.')
            pending.unlink()
        finally:
            c.execute('ROLLBACK')
    return outcome


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--apply', action='store_true')
    mode.add_argument('--recover', action='store_true')
    parser.add_argument('--plan', type=Path)
    parser.add_argument('--backend-stopped', action='store_true')
    args = parser.parse_args()
    env = core.read_env(core.ROOT/'backend/.env')
    core.require(not any(k in os.environ for k in ('IAM_BACKEND_ENV','ATTENDANCE_DB','STAFF_FILE','PORT')), 'Backend environment override present.')
    db = (core.ROOT/'backend'/env.get('ATTENDANCE_DB','data/attendance.sqlite')).resolve()
    seed = (core.ROOT/'backend'/env.get('STAFF_FILE','data/staff.json')).resolve()
    backups = core.ROOT/'.local/mfa-staff-id-backups'
    core.require(all(p.is_relative_to(core.ROOT) for p in (db,seed,backups.resolve())) and db.is_file() and seed.is_file(), 'Invalid MFA data paths.')
    guard = lambda: core.stopped(int(env.get('PORT','3001')))
    if args.apply or args.recover:
        core.require(args.backend_stopped, 'Explicit confirmed writer downtime required.')
        guard()
    if args.recover:
        print('MFA recovery verified: '+recover(db,seed,guard)+'; database and seed not rewritten.')
        return
    core.require(not marker_path(seed).exists(), 'Recovery marker exists; do not reapply.')
    root_env = core.read_env(core.ROOT/'.env')
    core.require(root_env.get('KEYCLOAK_PUBLIC_URL','').rstrip('/') == core.PUBLIC, 'Unexpected Keycloak URL.')
    api = ReadOnlyKeycloak(root_env)
    if args.apply:
        core.require(args.plan is not None, 'Reviewed MFA --plan required.')
        backup = apply(db,seed,api,json.loads(args.plan.read_bytes()),backups,guard)
        print('MFA verification passed. Seed, six demo profiles and audit history unchanged.')
        if backup:
            print('Backup: '+str(backup))
            print('Manifest SHA-256: '+core.digest((backup/'manifest.json').read_bytes()))
    else:
        with closing(core.connect(db)) as c:
            c.execute('BEGIN')
            result,_,_ = plan(c,seed,api)
            c.execute('ROLLBACK')
        print('DRY-RUN MFA | '+json.dumps(result['expectedChanges']))
        for v in result['mapping']:
            print(v['username']+' | '+v['old_id']+' -> '+v['new_id'])
        if args.plan:
            args.plan.parent.mkdir(parents=True,exist_ok=True)
            core.write_json(args.plan,result)
            print('Plan: '+str(args.plan.resolve()))


if __name__ == '__main__':
    try:
        main()
    except (core.RepairError,OSError,ValueError,sqlite3.Error,KeyError,TypeError):
        error=sys.exc_info()[1]
        print('STOP: '+(str(error) if isinstance(error,core.RepairError) else type(error).__name__+'; details omitted.'),file=sys.stderr)
        sys.exit(1)
