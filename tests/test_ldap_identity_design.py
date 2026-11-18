"""Synthetic design tests. Never opens the operational database or contacts IAM."""
import copy
import json
import os
from pathlib import Path
import shutil
import sqlite3
import subprocess
import sys
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(ROOT / 'tests' / 'fixtures'))
import reconcile_staff_ids as core
from ldap_identity_design import SyntheticLab, SyntheticWorkspace, ISSUER, PROVIDER


class IdentityLinkDesignTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.base = SyntheticWorkspace()
        env = {k: v for k, v in os.environ.items() if k.upper() in
               {'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'SYSTEMDRIVE'}}
        env.update(IAM_TEST_ROOT=cls.base.name, TEMP=cls.base.name, TMP=cls.base.name)
        result = subprocess.run(['node', '--require', str(ROOT / 'tests/isolated-node.cjs'),
                                 str(ROOT / 'tests/ldap-link-fixture.cjs')], cwd=ROOT, env=env,
                                capture_output=True, text=True, timeout=45)
        if result.returncode:
            raise RuntimeError('Synthetic fixture failed: ' + result.stderr)

    @classmethod
    def tearDownClass(cls):
        cls.base.cleanup()

    def setUp(self):
        self.temp = SyntheticWorkspace()
        for name in ('attendance.sqlite', 'staff.json', 'synthetic-identities.json'):
            shutil.copyfile(Path(self.base.name) / name, Path(self.temp.name) / name)
        self.lab = SyntheticLab(self.temp)
        self.c = self.lab.c
        self.before = core.snapshot(self.c)
        self.plan = self.lab.plan()

    def tearDown(self):
        self.c.close()
        self.temp.cleanup()

    def unchanged(self):
        self.assertEqual(core.state_hash(self.before), core.state_hash(core.snapshot(self.c)))

    def prepared(self):
        return self.lab.rehearse(self.plan)

    def test_fixture_reproduces_four_conflicts(self):
        self.assertEqual(self.c.execute('SELECT COUNT(*) FROM staff').fetchone()[0], 25)
        for u in self.lab.users:
            self.assertIsNone(self.c.execute('SELECT id FROM staff WHERE id=?', (u['subject'],)).fetchone())
            self.assertEqual(self.c.execute('SELECT id FROM staff WHERE username=? COLLATE NOCASE AND id<>?', (u['username'], u['subject'])).fetchone()[0], u['id'])
        self.assertEqual(self.c.execute('SELECT COUNT(*) FROM staff WHERE directory_provider_id=?', (PROVIDER,)).fetchone()[0], 0)

    def test_all_six_existing_foreign_keys_are_exercised(self):
        refs = {(t, r['from']) for t in self.before['tables'] for r in self.c.execute('PRAGMA foreign_key_list(' + core.quote(t) + ')') if r['table'] == 'staff'}
        self.assertEqual(refs, {('attendance', 'user_id'), ('corrections', 'user_id'), ('notification_reads', 'user_id'), ('access_requests', 'user_id'), ('directory_maintenance', 'user_id'), ('staff_id_reconciliations', 'new_id')})
        for table, _ in refs:
            self.assertGreater(len(self.before['tables'][table]), 0)

    def test_only_eight_bindings_and_one_batch_added(self):
        self.prepared()
        after = core.snapshot(self.c)
        self.assertEqual(set(after['tables']) - set(self.before['tables']), {'staff_identity_bindings', 'identity_link_batches'})
        for table, rows in self.before['tables'].items():
            self.assertEqual(core.normalized(rows), core.normalized(after['tables'][table]), table)
        for schema_object in self.before['schema']:
            self.assertIn(schema_object, after['schema'])
        self.assertEqual(len(after['tables']['staff_identity_bindings']), 8)
        self.assertEqual(len(after['tables']['identity_link_batches']), 1)
        core.integrity(self.c)

    def test_audit_payloads_history_seven_ledger_rows_unchanged(self):
        self.assertEqual(len(self.before['tables']['audit_outbox']), 20)
        self.assertEqual(len(self.before['tables']['staff_id_reconciliations']), 7)
        self.prepared()
        after = core.snapshot(self.c)
        for table in ('events', 'identity_events', 'audit_outbox', 'alerts', 'alert_evidence', 'alert_history', 'actions', 'action_attempts', 'lifecycle_history', 'staff_id_reconciliations'):
            self.assertEqual(self.before['tables'][table], after['tables'][table], table)
        self.assertEqual(self.plan['seedHash'], core.digest(self.lab.seed.read_bytes()))

    def test_new_subject_resolves_old_local_id_and_ownership(self):
        self.prepared()
        for u in self.lab.users:
            staff = self.lab.principal(ISSUER, u['subject'])
            self.assertEqual(staff['id'], u['id'])
            self.assertEqual(staff['role'], u['role'])
            for table in ('attendance', 'corrections', 'notification_reads', 'access_requests'):
                self.assertEqual(self.c.execute('SELECT COUNT(*) FROM ' + table + ' WHERE user_id=?', (staff['id'],)).fetchone()[0], 1)
            self.assertEqual(self.lab.remote_subject(staff['id']), u['subject'])

    def test_retired_subject_not_usable_for_authentication(self):
        self.prepared()
        for u in self.lab.users:
            self.assertIsNone(self.lab.principal(ISSUER, u['id']))

    def test_unknown_subject_username_wrong_issuer_denied(self):
        self.prepared()
        u = self.lab.users[0]
        for issuer, subject in ((ISSUER, 'unknown'), (ISSUER, u['username']), ('https://other.invalid/realms/test', u['subject'])):
            self.assertIsNone(self.lab.principal(issuer, subject))

    def test_eight_local_and_thirteen_disabled_profiles_unchanged(self):
        self.prepared()
        for i in range(21):
            row = self.lab.principal(ISSUER, f'fixture-local-{i}')
            self.assertEqual(row['disabled'], int(i >= 8))
            self.assertEqual(self.lab.remote_subject(row['id']), row['id'])
        # Resolution is not authorization: real middleware must still deny disabled profiles.

    def test_current_provider_listing_uses_binding_not_legacy_column(self):
        self.prepared()
        rows = self.c.execute("SELECT s.id FROM staff s JOIN staff_identity_bindings b ON b.staff_id=s.id WHERE b.issuer=? AND b.provider_id=? AND b.state='active'", (ISSUER, PROVIDER)).fetchall()
        self.assertEqual({r[0] for r in rows}, {u['id'] for u in self.lab.users})
        self.assertEqual(self.c.execute('SELECT COUNT(*) FROM staff WHERE directory_provider_id=?', (PROVIDER,)).fetchone()[0], 0)

    def test_missing_scan_compares_remote_subjects(self):
        self.prepared()
        listed = {u['subject'] for u in self.lab.users}
        missing = [u['id'] for u in self.lab.users if self.lab.remote_subject(u['id']) not in listed]
        self.assertEqual(missing, [])
        listed.remove(self.lab.users[0]['subject'])
        self.assertEqual([u['id'] for u in self.lab.users if self.lab.remote_subject(u['id']) not in listed], [self.lab.users[0]['id']])

    def test_history_is_time_and_issuer_scoped_without_payload_rewrite(self):
        self.prepared()
        u = self.lab.users[0]
        self.assertEqual(self.lab.historical(ISSUER, u['id'], 99), u['id'])
        self.assertIsNone(self.lab.historical(ISSUER, u['id'], 100))
        self.assertEqual(self.lab.historical(ISSUER, u['subject'], 100), u['id'])
        self.assertIsNone(self.lab.historical('other', u['id'], 99))
        self.assertIsNone(self.lab.historical(ISSUER, u['subject'], 99))

    def test_no_proof_or_wrong_entry_uuid_blocks(self):
        for key, value in (('evidenceRef', ''), ('newEntry', 'different-entry'), ('mfaRequired', False), ('enabled', False)):
            with self.subTest(key=key):
                p = copy.deepcopy(self.plan)
                (p if key == 'evidenceRef' else p['mapping'][0])[key] = value
                with self.assertRaises(core.Stop):
                    self.lab.rehearse(p)
                self.unchanged()

    def test_wrong_provider_or_role_blocks(self):
        for key, value in (('oldProvider', 'unapproved-provider'), ('role', 'admin')):
            p = copy.deepcopy(self.plan)
            p['mapping'][0][key] = value
            with self.assertRaises(core.Stop):
                self.lab.rehearse(p)
            self.unchanged()

    def test_duplicate_subject_and_local_collision_block(self):
        for target in (self.plan['mapping'][1]['subject'], 'fixture-local-0'):
            p = copy.deepcopy(self.plan)
            p['mapping'][0]['subject'] = target
            with self.assertRaises(core.Stop):
                self.lab.rehearse(p)
            self.unchanged()

    def test_scope_not_exactly_four_blocks(self):
        p = copy.deepcopy(self.plan)
        p['mapping'].pop()
        with self.assertRaises(core.Stop):
            self.lab.rehearse(p)
        self.unchanged()

    def test_stale_database_plan_blocks(self):
        self.c.execute("UPDATE staff SET team='B' WHERE id='fixture-old-0'")
        changed = core.state_hash(core.snapshot(self.c))
        with self.assertRaisesRegex(core.Stop, 'STALE_PLAN'):
            self.lab.rehearse(self.plan)
        self.assertEqual(changed, core.state_hash(core.snapshot(self.c)))

    def test_stale_seed_plan_blocks(self):
        self.lab.seed.write_text('[]')
        with self.assertRaisesRegex(core.Stop, 'STALE_SEED'):
            self.lab.rehearse(self.plan)
        self.unchanged()

    def test_transaction_fault_rolls_back_schema_and_bindings(self):
        with self.assertRaisesRegex(RuntimeError, 'Injected'):
            self.lab.rehearse(self.plan, fail_after=1)
        self.unchanged()
        core.verify_backup_manifest(self.lab.root / 'backup', self.plan)

    def test_corrupt_backup_prevents_first_mutation(self):
        with self.assertRaises(core.Stop):
            self.lab.rehearse(self.plan, corrupt_backup=True)
        self.unchanged()

    def test_manifest_backup_contains_committed_wal_and_restore_works(self):
        self.c.execute('PRAGMA wal_autocheckpoint=0')
        self.c.execute("UPDATE staff SET team='Committed WAL fixture' WHERE id='fixture-local-0'")
        self.plan = self.lab.plan()
        expected = core.state_hash(core.snapshot(self.c))
        b = self.prepared()
        core.verify_backup_manifest(b, self.plan)
        with sqlite3.connect(':memory:') as restored:
            restored.row_factory = sqlite3.Row
            source = core.connect(b / 'attendance.sqlite')
            try:
                source.backup(restored)
            finally:
                source.close()
            core.integrity(restored)
            self.assertEqual(core.state_hash(core.snapshot(restored)), expected)
        restored.close()

    def test_sql_constraints_reject_duplicate_or_orphan_bindings(self):
        self.prepared()
        row = list(self.c.execute('SELECT * FROM staff_identity_bindings WHERE state=\'active\' LIMIT 1').fetchone())
        for change in ({1: 'new-subject'}, {1: 'other-subject', 2: 'no-staff'}):
            values = row[:]
            for key, value in change.items():
                values[key] = value
            with self.assertRaises(sqlite3.IntegrityError):
                self.c.execute('INSERT INTO staff_identity_bindings VALUES(?,?,?,?,?,?,?,?,?,?)', values)
        core.integrity(self.c)

    def test_reapply_old_plan_blocked(self):
        self.prepared()
        after = core.state_hash(core.snapshot(self.c))
        with self.assertRaisesRegex(core.Stop, 'STALE_PLAN'):
            self.lab.rehearse(self.plan)
        self.assertEqual(after, core.state_hash(core.snapshot(self.c)))

    def test_unique_entry_cannot_bind_two_profiles(self):
        p = copy.deepcopy(self.plan)
        for key in ('entry', 'oldEntry', 'newEntry'):
            p['mapping'][1][key] = p['mapping'][0][key]
        with self.assertRaises(sqlite3.IntegrityError):
            self.lab.rehearse(p)
        self.unchanged()

    def test_concurrent_sqlite_writer_blocks_before_backup(self):
        other = core.connect(self.lab.db, writable=True)
        try:
            other.execute('BEGIN IMMEDIATE')
            self.c.execute('PRAGMA busy_timeout=25')
            with self.assertRaises(sqlite3.OperationalError):
                self.lab.rehearse(self.plan)
            self.assertFalse((self.lab.root / 'backup').exists())
        finally:
            other.execute('ROLLBACK')
            other.close()
        self.unchanged()

    def test_backup_manifest_tampering_detected(self):
        b = self.prepared()
        manifest = json.loads((b / 'manifest.json').read_bytes())
        manifest['files']['attendance.sqlite']['sha256'] = '0' * 64
        (b / 'manifest.json').write_text(json.dumps(manifest))
        with self.assertRaises(core.Stop):
            core.verify_backup_manifest(b, self.plan)


if __name__ == '__main__':
    unittest.main(verbosity=2)
