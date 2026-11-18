"""Restore the audit dump into a NEW isolated recovery project; never replace the live database."""
import argparse
import hashlib
import json
import re
import subprocess
import time
from pathlib import Path
from common import ROOT


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup', type=Path)
    parser.add_argument('--project', required=True, help='New name beginning iam-recovery-')
    args = parser.parse_args()
    folder = args.backup.resolve()
    if not folder.is_relative_to((ROOT / 'backups').resolve()) or not re.fullmatch(r'iam-recovery-[a-z0-9-]{3,40}', args.project):
        raise ValueError('Use a private workspace backup and a new iam-recovery-* project')
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    if not manifest.get('complete') or manifest.get('scope') != 'week10':
        raise ValueError('A complete week-10 backup is required')
    for relative, digest in manifest['files'].items():
        item = (folder / relative).resolve()
        if not item.is_relative_to(folder) or not item.is_file() or hashlib.sha256(item.read_bytes()).hexdigest() != digest:
            raise ValueError('Backup integrity mismatch; restore not started')
    dump = folder / 'audit.pgdump'
    config = folder / 'audit-private/compose.env'
    if not dump.exists() or not config.exists():
        raise ValueError('Audit dump or private configuration missing')
    for kind in ('container', 'volume', 'network'):
        listing = ['docker',kind,'ls'] + (['-a'] if kind == 'container' else [])
        existing = subprocess.run(listing + ['-q','--filter','label=com.docker.compose.project='+args.project], cwd=ROOT, capture_output=True, check=True)
        if existing.stdout.strip():
            raise ValueError('Recovery project already has resources; choose a new name. Nothing was overwritten.')
    compose = ['docker','compose','--project-name',args.project,'--env-file',str(config),'-f','audit/compose.recovery.yml']
    subprocess.run(compose + ['up','-d'], cwd=ROOT, check=True)
    for _ in range(60):
        result = subprocess.run(compose + ['exec','-T','audit-db','pg_isready','-U','audit','-d','audit'], cwd=ROOT, capture_output=True)
        if not result.returncode:
            break
        time.sleep(1)
    else:
        raise RuntimeError('Recovery database did not become ready; isolated resources retained for inspection')
    with dump.open('rb') as stream:
        result = subprocess.run(compose + ['exec','-T','audit-db','pg_restore','--exit-on-error','--no-owner','--no-privileges','-U','audit','-d','audit'], cwd=ROOT, stdin=stream, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE)
    if result.returncode:
        raise RuntimeError('Restore failed; isolated resources retained. Live data was not replaced.')
    print('Audit dump restored into isolated project:', args.project)
    print('This is not full system recovery or validation. No application endpoint was switched.')


if __name__ == '__main__':
    main()
