"""Executable design, NOT a production migrator. No CLI, network or live DB access.

Every connection is owned by SyntheticLab in a newly allocated test workspace.
The plan is generated solely from synthetic-identities.json built by the test runner.
"""
import json
import sqlite3
from uuid import uuid4
from pathlib import Path

import reconcile_staff_ids as core

ISSUER = 'https://iam.fixture.invalid/realms/test'
PROVIDER = 'fixture-provider-new'
SCHEMA = (
    '''CREATE TABLE identity_link_batches (
       id TEXT PRIMARY KEY, plan_hash TEXT NOT NULL, manifest_hash TEXT NOT NULL,
       verified_at TEXT NOT NULL, evidence_ref TEXT NOT NULL)''',
    '''CREATE TABLE staff_identity_bindings (
       issuer TEXT NOT NULL, subject TEXT NOT NULL, staff_id TEXT NOT NULL REFERENCES staff(id),
       provider_id TEXT NOT NULL, source_instance TEXT NOT NULL, entry_uuid TEXT NOT NULL,
       state TEXT NOT NULL CHECK(state IN ('active','retired')),
       valid_from INTEGER NOT NULL, valid_until INTEGER,
       batch_id TEXT NOT NULL REFERENCES identity_link_batches(id),
       PRIMARY KEY(issuer,subject),
       CHECK((state='active' AND valid_until IS NULL) OR
             (state='retired' AND valid_until>valid_from)))''',
    "CREATE UNIQUE INDEX binding_active_staff ON staff_identity_bindings(issuer,staff_id) WHERE state='active'",
    "CREATE UNIQUE INDEX binding_active_entry ON staff_identity_bindings(issuer,source_instance,entry_uuid) WHERE state='active'",
)


class SyntheticWorkspace:
    def __init__(self):
        repo = Path(__file__).resolve().parents[2]
        parent = repo / '.runtime' / 'ldap-identity-design'
        parent.mkdir(parents=True, exist_ok=True)
        if not parent.resolve().is_relative_to(repo) or parent.is_symlink() or parent.is_junction():
            raise ValueError('Test root redirected')
        folder = parent / uuid4().hex
        folder.mkdir(exist_ok=False)
        self.name = str(folder)

    def cleanup(self):
        # Keep synthetic artifacts for review; no recursive deletion.
        pass


class SyntheticLab:
    def __init__(self, temporary_directory):
        # Accept only our fresh workspace object, never a database path from CLI.
        if not isinstance(temporary_directory, SyntheticWorkspace):
            raise ValueError('Synthetic workspace required')
        self.root = Path(temporary_directory.name).resolve()
        self.db = self.root / 'attendance.sqlite'
        self.seed = self.root / 'staff.json'
        self.users = json.loads((self.root / 'synthetic-identities.json').read_bytes())
        assert len(self.users) == 4 and all(u['id'].startswith('fixture-old-') for u in self.users)
        self.c = core.connect(self.db, writable=True)

    def plan(self):
        core.integrity(self.c)
        return dict(databasePath=str(self.db), seedPath=str(self.seed),
                    databaseHash=core.state_hash(core.snapshot(self.c)), seedHash=core.digest(self.seed.read_bytes()),
                    issuer=ISSUER, provider=PROVIDER, sourceInstance='fixture-source',
                    evidenceRef='fixture-verified-entryUUID-history', cutover=100,
                    mapping=[dict(u, oldProvider='fixture-provider-old', oldEntry=u['entry'],
                                  newEntry=u['entry'], enabled=True, mfaRequired=True) for u in self.users])

    def validate(self, p):
        core.require(p['databasePath'] == str(self.db) and p['seedPath'] == str(self.seed), 'PATH')
        core.require(p['databaseHash'] == core.state_hash(core.snapshot(self.c)), 'STALE_PLAN')
        core.require(p['seedHash'] == core.digest(self.seed.read_bytes()), 'STALE_SEED')
        core.require(p['issuer'] == ISSUER and p['provider'] == PROVIDER and p['sourceInstance'] == 'fixture-source', 'SOURCE')
        core.require(p['evidenceRef'] == 'fixture-verified-entryUUID-history', 'EVIDENCE_REQUIRED')
        core.require(len(p['mapping']) == 4 and {u['id'] for u in p['mapping']} == {u['id'] for u in self.users}, 'SCOPE')
        core.require(len({u['subject'] for u in p['mapping']}) == 4, 'DUPLICATE_SUBJECT')
        for u in p['mapping']:
            row = self.c.execute('SELECT * FROM staff WHERE id=?', (u['id'],)).fetchone()
            core.require(row and row['identity_source'] == 'ldap' and not row['disabled'], 'LOCAL_PROFILE')
            core.require(row['username'] == u['username'] and row['role'] == u['role'] and
                         row['directory_provider_id'] == u['oldProvider'], 'PROFILE_CHANGED')
            core.require(u['enabled'] and u['mfaRequired'] and u['oldEntry'] == u['newEntry'] == u['entry'] and u['entry'], 'IDENTITY_PROOF')
            core.require(not self.c.execute('SELECT 1 FROM staff WHERE id=?', (u['subject'],)).fetchone(), 'SUBJECT_COLLISION')
        core.integrity(self.c)

    def rehearse(self, p, fail_after=None, corrupt_backup=False):
        """Only synthetic DB; exercise tested backup helpers before first schema/write."""
        self.c.execute('BEGIN IMMEDIATE')
        try:
            self.validate(p)
            b = self.root / 'backup'
            b.mkdir(exist_ok=False)
            with core.connect(self.db) as source, sqlite3.connect(b / 'attendance.sqlite') as dest:
                source.backup(dest)
            # Context-manager does not close sqlite connections on Windows.
            source.close()
            dest.close()
            (b / 'staff.json').write_bytes(self.seed.read_bytes())
            core.write_json(b / 'plan.json', p)
            core.write_backup_manifest(b, p)
            if corrupt_backup:
                (b / 'staff.json').write_bytes(b'corrupt fixture')
            core.verify_backup_manifest(b, p)
            for sql in SCHEMA:
                self.c.execute(sql)
            self.c.execute('INSERT INTO identity_link_batches VALUES(?,?,?,?,?)',
                           ('fixture-batch', core.digest(p), core.digest((b / 'manifest.json').read_bytes()),
                            '2026-01-02T00:00:00Z', p['evidenceRef']))
            for i, u in enumerate(p['mapping']):
                for state, subject, provider, start, end in (
                    ('retired', u['id'], u['oldProvider'], 0, p['cutover']),
                    ('active', u['subject'], p['provider'], p['cutover'], None)):
                    self.c.execute('INSERT INTO staff_identity_bindings VALUES(?,?,?,?,?,?,?,?,?,?)',
                                   (ISSUER, subject, u['id'], provider, p['sourceInstance'], u['entry'], state, start, end, 'fixture-batch'))
                if fail_after == i:
                    raise RuntimeError('Injected transaction failure')
            core.integrity(self.c)
            self.c.execute('COMMIT')
            return b
        except BaseException:
            if self.c.in_transaction:
                self.c.execute('ROLLBACK')
            raise

    def principal(self, issuer, subject):
        """Called AFTER real JWT validation in proposed architecture, not a verifier."""
        if issuer != ISSUER:
            return None
        binding = self.c.execute('SELECT * FROM staff_identity_bindings WHERE issuer=? AND subject=?', (issuer, subject)).fetchone()
        if binding:
            if binding['state'] != 'active' or binding['provider_id'] != PROVIDER:
                return None
            return self.c.execute('SELECT * FROM staff WHERE id=?', (binding['staff_id'],)).fetchone()
        return self.c.execute("SELECT * FROM staff WHERE id=? AND identity_source='local'", (subject,)).fetchone()

    def remote_subject(self, staff_id):
        binding = self.c.execute("SELECT subject FROM staff_identity_bindings WHERE issuer=? AND staff_id=? AND state='active' AND provider_id=?", (ISSUER, staff_id, PROVIDER)).fetchone()
        if binding:
            return binding['subject']
        row = self.c.execute("SELECT id FROM staff WHERE id=? AND identity_source='local'", (staff_id,)).fetchone()
        return row['id'] if row else None

    def historical(self, issuer, subject, timestamp):
        row = self.c.execute('''SELECT staff_id FROM staff_identity_bindings WHERE issuer=? AND subject=?
            AND valid_from<=? AND (valid_until IS NULL OR ?<valid_until)''', (issuer, subject, timestamp, timestamp)).fetchone()
        return row['staff_id'] if row else None
