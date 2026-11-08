"""Create a source-only handoff ZIP from git-visible files; no tests or runtime data."""
import hashlib
import json
import subprocess
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def package():
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    target = ROOT / 'backups' / ('week10-source-' + stamp + '.zip')
    target.parent.mkdir(exist_ok=True)
    paths = subprocess.run(['git','ls-files','-co','--exclude-standard','-z'], cwd=ROOT, capture_output=True, check=True).stdout.decode('utf-8').split('\0')
    manifest = {'createdAt': datetime.now(timezone.utc).isoformat(), 'kind': 'source-only',
                'runtimeBackup': False, 'testsRunByPackager': False,
                'validationReport': 'docs/KET_QUA_KIEM_THU_2026_11_08.md', 'files': {}}
    blocked = {'.git','.codex','.agents','.aws','.local','node_modules','dist','evidence','backups','.runtime','.tools','__pycache__'}
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED) as bundle:
        for relative in sorted(set(paths)):
            if not relative:
                continue
            candidate = Path(relative)
            if any(part in blocked for part in candidate.parts) or (candidate.name.startswith('.env') and not candidate.name.endswith('.example')) or candidate.suffix.lower() in {'.key','.pem','.p12','.pfx','.sqlite','.pgdump'}:
                continue
            source = ROOT / candidate
            if not source.is_file() or source.is_symlink() or not source.resolve().is_relative_to(ROOT.resolve()):
                continue
            raw = source.read_bytes()
            manifest['files'][candidate.as_posix()] = hashlib.sha256(raw).hexdigest()
            bundle.writestr(candidate.as_posix(), raw)
        bundle.writestr('SOURCE_MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    print('Source snapshot:', target.relative_to(ROOT))
    print('No runtime data, dependency installation, tests or release acceptance included.')
    return target


if __name__ == '__main__':
    package()
