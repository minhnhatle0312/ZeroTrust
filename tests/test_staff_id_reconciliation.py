import copy
import hashlib
import json
import os
import sqlite3
import subprocess
import sys
import uuid
import unittest
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import reconcile_staff_ids as r


class FakeKeycloak:
    def __init__(self):
        self.data = {name: {'id': 'kc-' + name, 'username': name, 'enabled': True} for name in r.ACCOUNTS}
        self.old_exists = False
        self.bad_roles = False

    def users(self, name):
        return [copy.deepcopy(self.data[name])]

    def roles(self, user_id):
        return [{'name': 'admin' if self.bad_roles else r.ACCOUNTS[user_id.removeprefix('kc-')]}]

    def exists(self, user_id):
        return self.old_exists


class ReconciliationTests(unittest.TestCase):
    def setUp(self):
        base = ROOT / '.runtime/staff-id-tests'
        base.mkdir(parents=True, exist_ok=True)
        # mkdir inherits workspace ACLs; Python 3.14 TemporaryDirectory's private
        # Windows ACL is inaccessible to the sandbox's child Node process.
        self.root = (base / ('fixture-' + uuid.uuid4().hex)).resolve()
        self.root.mkdir()
        self.env = {k: v for k, v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
        self.env.update(IAM_TEST_ROOT=str(self.root), TEMP=str(self.root), TMP=str(self.root), PYTHONDONTWRITEBYTECODE='1')
        fixture = subprocess.run(['node','--require',str(ROOT / 'tests/isolated-node.cjs'),str(ROOT / 'tests/staff-id-fixture.cjs')],
                       env=self.env, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=30)
        self.assertEqual(fixture.returncode, 0, fixture.stdout + fixture.stderr)
        self.db = self.root / 'attendance.sqlite'
        self.seed = self.root / 'staff.json'
        self.api = FakeKeycloak()
        self.original_seed = self.seed.read_bytes()
        self.original = self.state()

    def state(self):
        with closing(r.connect(self.db)) as c:
            return r.snapshot(c)

    def plan(self):
        with closing(r.connect(self.db)) as c:
            return r.plan(c, self.seed, self.api)[0]

    def apply(self, plan=None, guard=lambda: None):
        return r.apply(self.db, self.seed, self.api, plan or self.plan(), self.root / 'backups', guard)

    def sql(self, sql):
        with closing(sqlite3.connect(self.db)) as c:
            c.execute(sql)
            c.commit()

    def unchanged(self):
        self.assertEqual(r.state_hash(self.state()), r.state_hash(self.original))
        self.assertEqual(self.seed.read_bytes(), self.original_seed)

    def test_default_plan_read_only_and_complete_inventory(self):
        p = self.plan()
        self.assertEqual(len(p['mapping']), 5)
        self.assertEqual(len(p['foreignKeys']), 11)
        self.assertNotIn('admin01', [m['username'] for m in p['mapping']])
        self.assertIn({'table':'corrections','column':'reviewer_id','username':'manager01','rows':1,'policy':'MOVE'}, p['references'])
        self.unchanged()

    def test_apply_preserves_every_other_value_backup_and_idempotence(self):
        backup = self.apply()
        after = self.state()
        for table in r.HISTORY | r.OTHER:
            self.assertEqual(r.normalized(after['tables'][table]), r.normalized(self.original['tables'][table]), table)
        self.assertEqual(next(u for u in after['tables']['staff'] if u['username']=='admin01'), next(u for u in self.original['tables']['staff'] if u['username']=='admin01'))
        with closing(r.connect(backup / 'attendance.sqlite')) as c:
            self.assertEqual(r.state_hash(r.snapshot(c)), r.state_hash(self.original))
        self.assertEqual((backup / 'staff.json').read_bytes(), self.original_seed)
        self.assertEqual(after['tables']['corrections'][0]['reviewer_id'], 'kc-manager01')
        self.assertEqual(after['tables']['notification_reads'][0]['user_id'], 'kc-employee01')
        self.assertEqual(after['tables']['access_requests'][0]['user_id'], 'kc-employee01')
        self.assertEqual(self.plan()['mapping'], [])
        self.assertIsNone(self.apply())

    def test_all_six_backend_profiles_and_security_regression(self):
        command = ['node','--require',str(ROOT/'tests/isolated-node.cjs'), '--test','--test-isolation=none',str(ROOT/'tests/staff-id-backend.cjs')]
        baseline = subprocess.run(command, env={**self.env,'IAM_EXPECT_UNREGISTERED':'1'}, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=60)
        self.assertEqual(baseline.returncode, 0, baseline.stdout + baseline.stderr)
        self.apply()
        result = subprocess.run(command, env=self.env, cwd=ROOT, capture_output=True, text=True, encoding='utf-8', timeout=60)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)

    def assert_no_business_sql(self, statements):
        mutations = ('UPDATE ', 'INSERT ', 'DELETE ', 'CREATE ', 'ALTER ', 'DROP ', 'REPLACE ')
        self.assertFalse([sql for sql in statements if sql.strip().upper().startswith(mutations)])
        self.unchanged()

    def traced_connect(self, statements):
        connect = r.connect
        def traced(path, writable=False):
            connection = connect(path, writable)
            if writable and Path(path) == self.db:
                connection.set_trace_callback(statements.append)
            return connection
        return traced

    def test_manifest_records_readable_verified_bytes_without_overwrite(self):
        approved = self.plan()
        backup = self.apply(approved)
        manifest = r.verify_backup_manifest(backup, approved)
        self.assertEqual(set(manifest['files']), {'attendance.sqlite','staff.json','plan.json'})
        for name, entry in manifest['files'].items():
            raw = (backup/name).read_bytes()
            self.assertEqual(entry, {'path':str((backup/name).resolve()), 'sizeBytes':len(raw),
                                     'sha256':hashlib.sha256(raw).hexdigest()})
        original = (backup/'manifest.json').read_bytes()
        with self.assertRaises(FileExistsError): r.write_backup_manifest(backup, approved)
        self.assertEqual((backup/'manifest.json').read_bytes(), original)

    def test_manifest_write_failure_precedes_any_business_sql(self):
        write = r.write_json
        def failing(path, value):
            if path.name == 'manifest.json': raise OSError('synthetic manifest write failure')
            write(path, value)
        statements = []
        with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_json',failing):
            with self.assertRaises(OSError): self.apply()
        self.assert_no_business_sql(statements)

    def test_missing_manifest_precedes_any_business_sql(self):
        statements = []
        with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_backup_manifest',return_value=None):
            with self.assertRaises(FileNotFoundError): self.apply()
        self.assert_no_business_sql(statements)

    def test_truncated_manifest_precedes_any_business_sql(self):
        def truncated(backup, approved):
            with (backup/'manifest.json').open('xb') as f: f.write(b'{')
        statements = []
        with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_backup_manifest',truncated):
            with self.assertRaises(json.JSONDecodeError): self.apply()
        self.assert_no_business_sql(statements)

    def test_manifest_rejects_metadata_mismatch_before_business_sql(self):
        write = r.write_backup_manifest
        for field, value in [('path',str(self.root/'outside.json')), ('sizeBytes',-1), ('sha256','0'*64)]:
            with self.subTest(field=field):
                def corrupt(backup, approved):
                    write(backup, approved)
                    path = backup/'manifest.json'
                    manifest = json.loads(path.read_bytes())
                    manifest['files']['staff.json'][field] = value
                    path.write_text(json.dumps(manifest),encoding='utf-8')
                statements=[]
                with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_backup_manifest',corrupt):
                    with self.assertRaisesRegex(r.Stop,'manifest file verification'): self.apply()
                self.assert_no_business_sql(statements)

    def test_backup_corruption_after_manifest_precedes_business_sql(self):
        write = r.write_backup_manifest
        for name in r.BACKUP_FILES:
            with self.subTest(file=name):
                def corrupt(backup, approved):
                    write(backup, approved)
                    path=backup/name
                    data=path.read_bytes()
                    path.write_bytes(data[:-1]+bytes([data[-1]^1]))
                statements=[]
                with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_backup_manifest',corrupt):
                    with self.assertRaisesRegex(r.Stop,'manifest file verification'): self.apply()
                self.assert_no_business_sql(statements)

    def test_matching_hash_cannot_hide_wrong_database_snapshot(self):
        write = r.write_backup_manifest
        def corrupt_then_hash(backup, approved):
            with closing(sqlite3.connect(backup/'attendance.sqlite')) as c:
                c.execute("UPDATE staff SET name='synthetic changed backup'")
                c.commit()
            write(backup, approved)
        statements=[]
        with patch.object(r,'connect',self.traced_connect(statements)), patch.object(r,'write_backup_manifest',corrupt_then_hash):
            with self.assertRaisesRegex(r.Stop,'Backup database differs'): self.apply()
        self.assert_no_business_sql(statements)

    def test_manifest_backup_includes_committed_wal(self):
        with closing(sqlite3.connect(self.db)) as holder:
            self.assertEqual(holder.execute('PRAGMA journal_mode=WAL').fetchone()[0], 'wal')
            holder.execute('PRAGMA wal_autocheckpoint=0')
            holder.execute('UPDATE attendance SET late_minutes=9')
            holder.commit()
            self.assertGreater(Path(str(self.db)+'-wal').stat().st_size,0)
            self.original=self.state()
            approved=self.plan()
            backup=self.apply(approved)
            r.verify_backup_manifest(backup,approved)
            with closing(r.connect(backup/'attendance.sqlite')) as c:
                self.assertEqual(r.state_hash(r.snapshot(c)),r.state_hash(self.original))
                self.assertEqual(c.execute('SELECT late_minutes FROM attendance').fetchone()[0],9)

    def test_reject_ldap_and_role_mismatch(self):
        for key, value in [('federationLink','ldap-provider'), ('attributes',{'LDAP_ID':['synthetic']})]:
            with self.subTest(key=key):
                self.api.data['employee01'][key] = value
                with self.assertRaises(r.Stop): self.plan()
                del self.api.data['employee01'][key]
        self.api.bad_roles = True
        with self.assertRaises(r.Stop): self.plan()
        self.unchanged()

    def test_reject_local_ldap(self):
        self.sql("UPDATE staff SET identity_source='ldap' WHERE username='employee01'")
        with self.assertRaises(r.Stop): self.plan()

    def test_admin_mismatch_stops_everything(self):
        self.api.data['admin01']['id'] = 'kc-employee01'
        with self.assertRaises(r.Stop): self.plan()
        self.unchanged()

    def test_old_account_still_exists(self):
        self.api.old_exists = True
        with self.assertRaises(r.Stop): self.plan()
        self.unchanged()

    def test_duplicate_remote_username(self):
        original = self.api.users
        self.api.users = lambda name: original(name) * 2
        with self.assertRaises(r.Stop): self.plan()

    def test_seed_mismatch(self):
        seed = json.loads(self.original_seed)
        seed[1]['id'] = 'unrelated'
        self.seed.write_text(json.dumps(seed))
        with self.assertRaises(r.Stop): self.plan()

    def test_id_collision(self):
        self.sql("INSERT INTO staff(id,username,name,team,role) VALUES('kc-employee01','outsider','Other','A','employee')")
        with self.assertRaises(r.Stop): self.plan()

    def test_unknown_fk_even_empty_table(self):
        self.sql('CREATE TABLE future_relation(id TEXT REFERENCES staff(id))')
        with self.assertRaisesRegex(r.Stop,'Unclassified FK'): self.plan()

    def test_unknown_embedded_id(self):
        self.sql('CREATE TABLE future_relation(payload TEXT)')
        self.sql('INSERT INTO future_relation VALUES(\'{"subject":"old-employee01"}\')')
        with self.assertRaisesRegex(r.Stop,'Unclassified ID'): self.plan()

    def test_unfinished_action(self):
        self.sql("UPDATE actions SET state='partial'")
        with self.assertRaisesRegex(r.Stop,'Unfinished security'): self.plan()

    def test_trigger_on_mutated_table(self):
        self.sql("CREATE TRIGGER unexpected AFTER UPDATE ON staff BEGIN UPDATE events SET reason='CHANGED'; END")
        with self.assertRaisesRegex(r.Stop,'Trigger'): self.plan()

    def test_stale_plan(self):
        p = self.plan()
        self.sql("UPDATE attendance SET late_minutes=1")
        before = r.state_hash(self.state())
        with self.assertRaisesRegex(r.Stop,'stale'): self.apply(p)
        self.assertEqual(r.state_hash(self.state()), before)
        self.assertEqual(self.seed.read_bytes(), self.original_seed)

    def test_file_failure_rolls_back_database(self):
        with patch.object(r,'atomic_bytes',side_effect=OSError('simulated file failure')):
            with self.assertRaises(OSError): self.apply()
        self.unchanged()
        self.assertEqual(len(list((self.root/'backups').glob('*/attendance.sqlite'))), 1)

    def test_failure_after_seed_replace_restores_both(self):
        calls = []
        def guard():
            calls.append(1)
            if len(calls) == 3: raise r.Stop('Simulated late failure')
        with self.assertRaises(r.Stop): self.apply(guard=guard)
        self.unchanged()
        self.assertFalse(self.seed.with_name('staff.json.reconcile-pending.json').exists())

    def test_verification_failure_rolls_back(self):
        with patch.object(r,'verify_changes',side_effect=r.Stop('Simulated verification failure')):
            with self.assertRaises(r.Stop): self.apply()
        self.unchanged()

    def test_keycloak_transport_blocks_writes(self):
        api = object.__new__(r.ReadOnlyKeycloak)
        for method in ('PUT','DELETE','POST'):
            with self.assertRaises(r.Stop): api._exchange(r.BASE+'/users/kc-employee01',method,{})

    def test_backend_guard_stops_before_backup_or_mutation(self):
        with self.assertRaises(r.Stop): self.apply(guard=lambda: r.require(False,'Backend running'))
        self.assertFalse((self.root/'backups').exists())
        self.unchanged()

    def test_integrity_violation_stops_before_write(self):
        self.sql("INSERT INTO notification_reads(notification_id,user_id,read_at) VALUES('missing','old-employee01','2026-11-11')")
        with self.assertRaisesRegex(r.Stop,'foreign_key_check'): self.plan()

    def test_unfinished_workflow(self):
        self.sql("UPDATE lifecycle_workflows SET state='running'")
        with self.assertRaisesRegex(r.Stop,'Unfinished lifecycle'): self.plan()

    def test_crash_marker_after_commit_recovers_without_rewriting_db(self):
        original_unlink = Path.unlink
        def unlink(path, *args, **kwargs):
            if path.name == 'staff.json.reconcile-pending.json': raise OSError('simulated crash after commit')
            return original_unlink(path, *args, **kwargs)
        with patch.object(Path, 'unlink', unlink):
            with self.assertRaises(OSError): self.apply()
        state = r.state_hash(self.state())
        r.recover(self.db, self.seed, lambda: None)
        self.assertEqual(r.state_hash(self.state()), state)
        self.assertEqual(self.plan()['mapping'], [])

    def test_crash_marker_before_commit_recovers_original_seed(self):
        original_atomic = r.atomic_bytes
        calls = []
        def atomic(path, raw):
            calls.append(1)
            if len(calls)==2: raise OSError('simulated restoration interruption')
            return original_atomic(path, raw)
        checks=[]
        def guard():
            checks.append(1)
            if len(checks)==3: raise r.Stop('simulated interruption')
        with patch.object(r,'atomic_bytes',atomic):
            with self.assertRaises(OSError): self.apply(guard=guard)
        self.assertNotEqual(self.seed.read_bytes(), self.original_seed)
        r.recover(self.db, self.seed, lambda: None)
        self.unchanged()

    def test_recovery_refuses_database_changed_after_interruption(self):
        original_unlink = Path.unlink
        def unlink(path, *args, **kwargs):
            if path.name == 'staff.json.reconcile-pending.json': raise OSError('simulated interruption')
            return original_unlink(path,*args,**kwargs)
        with patch.object(Path,'unlink',unlink):
            with self.assertRaises(OSError): self.apply()
        self.sql("UPDATE attendance SET late_minutes=7")
        before=r.state_hash(self.state())
        with self.assertRaisesRegex(r.Stop,'Database changed'): r.recover(self.db,self.seed,lambda:None)
        self.assertEqual(r.state_hash(self.state()),before)


if __name__ == '__main__':
    unittest.main()
