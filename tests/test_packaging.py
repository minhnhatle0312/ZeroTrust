"""Source packaging regression; all payloads are synthetic and contain no secrets."""
import hashlib
import importlib.util
import json
import subprocess
import tempfile
import unittest
import zipfile
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('source_packager', ROOT / 'scripts/package_week10.py')
packager = importlib.util.module_from_spec(spec)
spec.loader.exec_module(packager)


class PackagingRegression(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='iam-package-fixture-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name).resolve()
        self.target = self.root / 'backups/source.zip'

    def write(self, relative, content=b'fixture only; no credentials\n'):
        path = self.root / relative
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(content)
        return path

    def names(self):
        with zipfile.ZipFile(self.target) as archive:
            return set(archive.namelist())

    def test_source_templates_and_manifest_integrity(self):
        names = ['README.md', '.gitignore', 'backend/server.js', 'backend/package.json',
                 'web-a/src/App.jsx', 'web-b/src/App.jsx', 'shared/ui.css',
                 'audit/schema.sql', 'audit/incidents.py', 'audit/incident-policy.json', 'backend/incidents.js', 'backend/retention.js',
                 'directory/Dockerfile', 'directory/slapd.conf.template',
                 'keycloak/lab-config.json', 'docker-compose.yml', 'tests/test_packaging.py',
                 '.env.example', 'backend/.env.example', 'deploy/production-like.env.example']
        for name in names:
            self.write(name)
        packager.build_archive(self.root, self.target, names + names)
        self.assertEqual(self.names(), set(names) | {'SOURCE_MANIFEST.json'})
        with zipfile.ZipFile(self.target) as archive:
            manifest = json.loads(archive.read('SOURCE_MANIFEST.json'))
            self.assertEqual(set(manifest['files']), set(names))
            for name in names:
                self.assertEqual(manifest['files'][name], hashlib.sha256(archive.read(name)).hexdigest())
            self.assertFalse(manifest['runtimeBackup'])

    def test_tracked_private_runtime_files_never_opened_or_packaged(self):
        denied = [
            '.env', 'backend/.env', 'web-a/.env.local', 'web-b/.env.production',
            'deploy/private.env', 'deploy/private.env.example', 'scripts/.env.production.example',
            'network/.local/server.key', 'directory/.local/credentials.json',
            'backend/data/attendance.sqlite', 'backend/data/attendance.sqlite-wal',
            'backend/data/attendance.sqlite-shm', 'backend/attendance.sqlite-journal',
            'backend/attendance.sqlite3', 'backend/attendance.db', 'backend/attendance.db-wal',
            'backend/attendance.db-shm', 'backend/attendance.db-journal',
            'backend/staff.json', 'backend/audit.jsonl', 'backend/users-export.json',
            'tests/storage-state.json', 'tests/storage_state.json',
            'network/ca.key', 'network/ca.KEY', 'network/ca.pem', 'network/key.p12',
            'network/key.pfx', 'network/keys.jks', 'network/key.keystore',
            'deploy/database.pgdump', 'deploy/database.dump', 'deploy/database.sql',
            'backend/config.bak', 'backend/config.backup', 'backups/copy/server.js',
            'backend/backup/copy.js', '.runtime/context.json', '.tools/tool.py',
            'web-a/node_modules/module/index.js', 'web-b/dist/index.html',
            'evidence/report.json', 'word/minh_chung/result.json',
            'docs/ban_giao/ket-qua-kiem-thu.json', 'docs/report.pdf',
            '.aws/config', 'backend/.private/settings.js', 'unknown-folder/source.js',
        ]
        self.write('README.md')
        paths = [self.write(name) for name in denied]
        originals = {p: p.read_bytes() for p in paths}
        original_read = Path.read_bytes

        def guarded_read(path):
            if path in originals:
                raise AssertionError('Private fixture must be filtered before read')
            return original_read(path)

        with patch.object(Path, 'read_bytes', guarded_read):
            packager.build_archive(self.root, self.target, ['README.md', *denied])
        self.assertEqual(self.names(), {'README.md', 'SOURCE_MANIFEST.json'})
        for path, original in originals.items():
            self.assertEqual(path.read_bytes(), original)

    def test_path_escape_windows_drive_and_ambiguous_names_rejected(self):
        for name in ['/etc/config.py', '../outside.py', 'backend/../README.md',
                     'C:/private.py', 'D:private.py', 'backend\\server.js',
                     'backend//server.js', 'backend/file.js:stream', 'bad\x00.py',
                     'backend/./server.js', 'backend/server.js\n']:
            with self.subTest(path=name):
                self.assertIsNone(packager.source_path(name))

    def test_missing_source_is_skipped(self):
        packager.build_archive(self.root, self.target, ['backend/missing.js'])
        self.assertEqual(self.names(), {'SOURCE_MANIFEST.json'})

    def test_existing_archive_is_never_overwritten(self):
        self.write('backups/source.zip', b'preexisting fixture')
        with self.assertRaises(FileExistsError):
            packager.build_archive(self.root, self.target, [])
        self.assertEqual(self.target.read_bytes(), b'preexisting fixture')

    def test_archive_must_stay_in_selected_workspace(self):
        with self.assertRaises(ValueError):
            packager.build_archive(self.root, self.root.parent / 'outside.zip', [])
        with self.assertRaises(ValueError):
            packager.build_archive(self.root, self.root / 'output.txt', [])

    def test_binary_database_renamed_as_source_fails_without_echo(self):
        self.write('backend/renamed.js', b'SQLite format 3\x00fixture')
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            packager.build_archive(self.root, self.target, ['backend/renamed.js'])

    def test_private_key_marker_renamed_as_source_fails_without_echo(self):
        # Marker only; no actual key or credential is created.
        self.write('backend/renamed.js', b'-----BEGIN ' + b'PRIVATE KEY-----\nfixture')
        with self.assertRaisesRegex(ValueError, 'incomplete'):
            packager.build_archive(self.root, self.target, ['backend/renamed.js'])

    def test_links_are_rejected_without_reading_targets(self):
        original = self.write('private.txt')
        link = self.root / 'backend/link.js'
        link.parent.mkdir(parents=True)
        try:
            link.symlink_to(original)
        except OSError:
            self.skipTest('OS does not permit creating a synthetic symlink')
        packager.build_archive(self.root, self.target, ['backend/link.js'])
        self.assertEqual(self.names(), {'SOURCE_MANIFEST.json'})

    def test_linked_parent_cannot_expose_other_directory(self):
        source = self.root / 'private-source'
        source.mkdir()
        (source / 'module.js').write_text('fixture only', encoding='utf-8')
        try:
            (self.root / 'backend').symlink_to(source, target_is_directory=True)
        except OSError:
            self.skipTest('OS does not permit creating a synthetic symlink')
        packager.build_archive(self.root, self.target, ['backend/module.js'])
        self.assertEqual(self.names(), {'SOURCE_MANIFEST.json'})

    def test_hardlink_cannot_expose_private_content(self):
        original = self.write('private.txt')
        link = self.root / 'backend/link.js'
        link.parent.mkdir(parents=True)
        try:
            link.hardlink_to(original)
        except OSError:
            self.skipTest('OS does not support synthetic hardlinks')
        packager.build_archive(self.root, self.target, ['backend/link.js'])
        self.assertEqual(self.names(), {'SOURCE_MANIFEST.json'})

    def test_git_visible_tracked_private_file_is_excluded(self):
        # A real temporary Git index proves filtering does not rely on .gitignore.
        subprocess.run(['git', 'init', '--quiet', str(self.root)], check=True, capture_output=True)
        self.write('.gitignore', b'.env\nbackend/data/\n')
        self.write('.env')
        self.write('backend/data/staff.json')
        self.write('README.md')
        subprocess.run(['git', '-C', str(self.root), 'add', '-f', '.env', 'backend/data/staff.json', 'README.md'],
                       check=True, capture_output=True)
        paths = subprocess.run(['git', '-C', str(self.root), 'ls-files', '-co', '--exclude-standard', '-z'],
                               check=True, capture_output=True).stdout.decode().split('\0')
        self.assertIn('.env', paths)
        packager.build_archive(self.root, self.target, paths)
        self.assertNotIn('.env', self.names())
        self.assertNotIn('backend/data/staff.json', self.names())


if __name__ == '__main__':
    unittest.main()
