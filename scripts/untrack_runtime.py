"""Stop tracking ignored runtime/private artifacts without deleting local files.

Default is read-only. --apply changes only the Git index, never history, working
files, remotes or credentials. No private file contents are read or logged.
"""
import argparse
import json
import subprocess
from collections import Counter
from pathlib import Path, PurePosixPath

ROOT = Path(__file__).resolve().parents[1]
RUNTIME_PARTS = {
    'node_modules', 'dist', '__pycache__', '.venv', '.tools', '.runtime',
    '.local', 'backups', 'evidence', '.aws', '.codex', '.agents',
    '.pytest_cache', '.test-results', 'coverage', 'playwright-report', 'test-results',
}
PRIVATE_SUFFIXES = {'.key', '.pem', '.p12', '.pfx', '.jks', '.keystore',
                    '.db', '.db3', '.pgdump', '.dump', '.bak', '.backup', '.log', '.pyc', '.pyo'}


def git(*args, data=None):
    return subprocess.run(['git', *args], cwd=ROOT, input=data,
                          capture_output=True, check=True).stdout


def permitted(name):
    path = PurePosixPath(name)
    if path.is_absolute() or any(part in {'..', '.'} for part in path.parts):
        return False
    lowered = [part.casefold() for part in path.parts]
    base = lowered[-1]
    if any(part in RUNTIME_PARTS for part in lowered) or name.startswith('backend/data/'):
        return True
    if (base.startswith('.env') or '.env.' in base or base.endswith('.env')) and not base.endswith('.example'):
        return True
    return (path.suffix.lower() in PRIVATE_SUFFIXES or '.sqlite' in base
            or base.endswith(('.db-wal', '.db-shm', '.db-journal', '-password.txt'))
            or base in {'staff.json', 'audit.jsonl', 'credentials.json'}
            or base.startswith(('storage-state', 'storage_state')) and base.endswith('.json'))


def metadata(name):
    try:
        stat = (ROOT / name).lstat()
        return stat.st_ino, stat.st_mode, stat.st_size, stat.st_mtime_ns
    except FileNotFoundError:
        return None


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--apply', action='store_true', help='Change Git index only; preserve files and history')
    args = parser.parse_args()
    names = sorted(set(git('ls-files', '-ci', '--exclude-standard', '-z').decode('utf-8').split('\0')) - {''})
    if any(not permitted(name) for name in names):
        raise RuntimeError('An ignored source path needs review; index was not changed')
    categories = dict(Counter(name.split('/')[0] for name in names))
    print(json.dumps({'mode': 'apply-index-only' if args.apply else 'read-only',
                      'candidates': len(names), 'categories': categories}, ensure_ascii=False))
    if not args.apply:
        return
    staged = set(git('diff', '--cached', '--name-only', '-z').decode('utf-8').split('\0')) - {''}
    if staged.intersection(names):
        raise RuntimeError('Candidate has pre-existing staged changes; review before index update')
    baseline = {name: metadata(name) for name in names}
    if names:
        payload = b'\0'.join(name.encode('utf-8') for name in names) + b'\0'
        # --cached never removes a working-tree file. No -f, reset, clean,
        # history rewriting, credential change, commit or push is performed.
        git('rm', '--cached', '--ignore-unmatch', '--pathspec-from-file=-', '--pathspec-file-nul', data=payload)
    unchanged = sum(metadata(name) == state for name, state in baseline.items())
    if unchanged != len(names):
        raise RuntimeError('Local metadata changed during operation; inspect before proceeding')
    remaining = set(git('ls-files', '-ci', '--exclude-standard', '-z').decode('utf-8').split('\0')) - {''}
    if remaining:
        raise RuntimeError('Ignored tracked paths remain; no automatic retry')
    report = {'indexOnly': True, 'untrackedFromIndex': len(names),
              'localMetadataPreserved': unchanged, 'previouslyAbsent': sum(v is None for v in baseline.values()),
              'ignoredStillTracked': 0, 'historyRewritten': False, 'committed': False, 'pushed': False,
              'categories': categories}
    destination = ROOT / '.runtime/phase1-tests/untrack-summary.json'
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(report, ensure_ascii=False))


if __name__ == '__main__':
    main()
