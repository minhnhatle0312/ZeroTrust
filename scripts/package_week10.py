"""Package source independently of Git ignore state; never provision services."""
import hashlib
import json
import re
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
SOURCE_ROOTS = frozenset({
    'audit', 'backend', 'deploy', 'directory', 'docs', 'keycloak', 'network',
    'scripts', 'shared', 'tests', 'web-a', 'web-b', 'word',
})
BLOCKED_PARTS = frozenset({
    '.git', '.codex', '.agents', '.aws', '.local', '.runtime', '.tools', '.venv',
    'venv', '__pycache__', '.pytest_cache', 'node_modules', 'dist', 'build',
    'data', 'runtime', 'backup', 'backups', 'evidence', 'minh_chung', 'logs',
    'coverage', 'test-results', '.test-results', 'playwright-report',
})
SOURCE_SUFFIXES = frozenset({
    '.js', '.jsx', '.mjs', '.cjs', '.css', '.html', '.md', '.py', '.sh',
    '.yml', '.yaml', '.template', '.svg',
})
# Exports and browser state cannot become source merely by having a JSON suffix.
SOURCE_JSON = frozenset({
    'backend/package.json', 'backend/package-lock.json',
    'web-a/package.json', 'web-a/package-lock.json',
    'web-b/package.json', 'web-b/package-lock.json',
    'directory/directory-config.json', 'keycloak/lab-config.json',
    'docs/interaction-inventory.json',
    'docs/interaction-inventory-phase2.json',
    'docs/interaction-inventory-phase3.json',
    'audit/incident-policy.json',
})
ENV_TEMPLATES = frozenset({
    '.env.example', 'backend/.env.example', 'web-a/.env.example',
    'web-b/.env.example', 'deploy/production-like.env.example',
})
PRIVATE_NAME = re.compile(
    r'(?:^|[._-])(?:credentials?|secrets?|passwords?|tokens?|sessions?|'
    r'staff|audit|storage[._-]?state)(?:[._-]|$)', re.IGNORECASE,
)
PRIVATE_SUFFIX = re.compile(
    r'\.(?:key|pem|p12|pfx|jks|keystore|sqlite\d*|db\d*|pgdump|dump|bak|backup)'
    r'(?:$|[.-])', re.IGNORECASE,
)


def source_path(relative):
    """Validate names before opening files, including files already tracked by Git."""
    if not isinstance(relative, str) or not relative or '\\' in relative:
        return None
    if any(ord(c) < 32 or c == '\x7f' for c in relative):
        return None
    parts = relative.split('/')
    if any(p in {'', '.', '..'} or ':' in p for p in parts):
        return None
    lowered = [p.casefold() for p in parts]
    if any(p in BLOCKED_PARTS or p.startswith('.') and p not in {'.env.example', '.gitignore', '.dockerignore'} for p in lowered):
        return None
    name = lowered[-1]
    if relative in ENV_TEMPLATES:
        return PurePosixPath(relative)
    if '.env' in name or PRIVATE_SUFFIX.search(name):
        return None
    path = PurePosixPath(relative)
    if len(parts) > 1 and parts[0] not in SOURCE_ROOTS:
        return None
    # Source modules named audit.* are intentional; audit.jsonl is not source.
    if name in {'staff.json', 'audit.jsonl'} or (
        PRIVATE_NAME.search(name) and path.suffix.lower() not in {'.py', '.js', '.jsx', '.mjs', '.md', '.css'}
    ):
        return None
    if path.suffix.lower() == '.json':
        return path if relative in SOURCE_JSON else None
    if path.suffix.lower() == '.sql':
        return path if relative == 'audit/schema.sql' else None
    if name in {'.gitignore', '.dockerignore', 'dockerfile'}:
        return path
    if path.suffix.lower() == '.txt':
        return path if name == 'requirements.txt' or name.startswith('requirements-') else None
    if len(parts) == 1 and path.suffix.lower() != '.md':
        return path if relative == 'docker-compose.yml' else None
    return path if path.suffix.lower() in SOURCE_SUFFIXES else None


def safe_source(root, candidate):
    """Reject symlinks/junctions, including links in parent directories."""
    source = root.joinpath(*candidate.parts)
    for part in [source, *source.parents]:
        if part == root:
            break
        if part.is_symlink() or getattr(part, 'is_junction', lambda: False)():
            return None
    if not source.is_file() or not source.resolve().is_relative_to(root):
        return None
    if source.stat().st_nlink > 1:
        return None
    return source


def build_archive(root, target, paths):
    """Tests supply synthetic names/files in a temporary repository.

    Existing archives are never overwritten. Binary reports and evidence are
    intentionally outside this source-only delivery.
    """
    root, target = Path(root).resolve(), Path(target)
    if target.suffix.lower() != '.zip' or not target.resolve().is_relative_to(root):
        raise ValueError('Choose a new ZIP inside the selected workspace')
    if target.exists() or target.is_symlink():
        raise FileExistsError('Archive already exists; nothing was overwritten')
    target.parent.mkdir(parents=True, exist_ok=True)
    manifest = {
        'createdAt': datetime.now(timezone.utc).isoformat(), 'kind': 'source-only',
        'runtimeBackup': False, 'testsRunByPackager': False,
        'validationReport': 'docs/KET_QUA_KIEM_THU_DOT_1.md', 'files': {},
        'policy': 'reviewed-source-paths-v2',
    }
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED) as bundle:
        for relative in sorted(set(paths)):
            candidate = source_path(relative)
            if candidate is None:
                continue
            source = safe_source(root, candidate)
            if source is None:
                continue
            raw = source.read_bytes()
            # Reject key material pasted into a source path without printing it.
            if raw.startswith(b'SQLite format 3\x00') or re.search(
                rb'-----BEGIN (?:[A-Z0-9]+ )?PRIVATE KEY-----', raw
            ):
                raise ValueError('Source contains private binary/key material; archive is incomplete')
            if b'\x00' in raw:
                raise ValueError('Binary content in a source path; archive is incomplete')
            name = candidate.as_posix()
            manifest['files'][name] = hashlib.sha256(raw).hexdigest()
            bundle.writestr(name, raw)
        bundle.writestr('SOURCE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    return target


def package():
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target = ROOT / 'backups' / ('week10-source-' + stamp + '.zip')
    paths = subprocess.run(['git','ls-files','-co','--exclude-standard','-z'], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8').split('\0')
    build_archive(ROOT, target, paths)
    print('Source snapshot:', target.relative_to(ROOT))
    print('Source only; no runtime data, services, tests or Git changes.')
    return target


if __name__ == '__main__':
    package()
