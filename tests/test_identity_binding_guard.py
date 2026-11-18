"""Legacy writer compatibility guard tests on newly created synthetic SQLite."""
import hashlib
import importlib
import sqlite3
import sys
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
from identity_binding_guard import require_legacy_identity_schema


class GuardTests(unittest.TestCase):
    def setUp(self):
        self.root = ROOT / '.runtime' / 'identity-binding-guard-tests' / uuid4().hex
        self.root.mkdir(parents=True)
        self.db = self.root / 'synthetic.sqlite'

    def create(self, binding=False):
        db = sqlite3.connect(self.db)
        try:
            db.execute('CREATE TABLE staff(id TEXT PRIMARY KEY)')
            db.execute("INSERT INTO staff VALUES('synthetic-user')")
            if binding:
                db.execute('CREATE TABLE staff_identity_bindings(subject TEXT)')
            db.commit()
        finally:
            db.close()

    def test_missing_database_is_not_created(self):
        require_legacy_identity_schema(self.db)
        self.assertFalse(self.db.exists())

    def test_legacy_schema_is_read_only_and_compatible(self):
        self.create()
        before = self.db.read_bytes()
        require_legacy_identity_schema(self.db)
        self.assertEqual(self.db.read_bytes(), before)

    def test_binding_schema_blocks_without_modification(self):
        self.create(binding=True)
        before = hashlib.sha256(self.db.read_bytes()).hexdigest()
        with self.assertRaisesRegex(RuntimeError, 'IDENTITY_BINDING_TOOL_UNSUPPORTED'):
            require_legacy_identity_schema(self.db)
        self.assertEqual(hashlib.sha256(self.db.read_bytes()).hexdigest(), before)

    def test_all_four_legacy_entrypoints_guard_before_credentials_or_writes(self):
        self.create(binding=True)
        for name, function, args in [('directory_user', 'maintain', [SimpleNamespace()]),
                                      ('process_governance', 'main', []),
                                      ('restore_week5', 'restore', ['unused']),
                                      ('restore_week6', 'restore', ['unused'])]:
            with self.subTest(name=name):
                module = importlib.import_module(name)
                with patch.object(module, 'read_env', return_value={'ATTENDANCE_DB': str(self.db)}), \
                     patch.object(module, 'command' if name == 'process_governance' else 'admin_token', side_effect=AssertionError('Remote access prohibited')) as remote:
                    with self.assertRaisesRegex(RuntimeError, 'IDENTITY_BINDING_TOOL_UNSUPPORTED'):
                        getattr(module, function)(*args)
                    remote.assert_not_called()


if __name__ == '__main__':
    unittest.main(verbosity=2)
