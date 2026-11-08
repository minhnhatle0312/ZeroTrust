"""Private multi-store backup. Quiesce writes first for a coordinated recovery point."""
import argparse
import hashlib
import json
import shutil
import subprocess
from common import ROOT, read_env
from backup_week5 import create_backup
from backup_week6 import create_directory_backup


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--writes-quiesced', action='store_true', help='Operator attests all app/identity/directory/audit writers were stopped')
    args = parser.parse_args()
    settings = read_env(ROOT / 'backend/.env')
    folder, _ = create_directory_backup() if settings.get('DIRECTORY_COMPONENT_ID') else create_backup()
    manifest_path = folder / 'manifest.json'
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest.update(scope='week10', complete=False, coordinatedSnapshot=False,
                    operatorAttestsQuiescence=args.writes_quiesced)
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding='utf-8')
    for relative, name in [('network/.local','network-private'), ('audit/.local','audit-private')]:
        source = ROOT / relative
        if source.exists():
            shutil.copytree(source, folder / name)
    if settings.get('AUDIT_SERVICE_URL'):
        command = ['docker','compose','--env-file','.env','--env-file','audit/.local/compose.env',
                   '-f','docker-compose.yml','-f','audit/compose.week8.yml','exec','-T','audit-db',
                   'pg_dump','-U','audit','-d','audit','-Fc']
        target = folder / 'audit.pgdump'
        with target.open('wb') as output:
            result = subprocess.run(command, cwd=ROOT, stdout=output, stderr=subprocess.PIPE)
        if result.returncode or not target.stat().st_size:
            raise RuntimeError('Audit dump failed; manifest remains incomplete. Do not use as a full restore point.')
    manifest.update(complete=True, coordinatedSnapshot=args.writes_quiesced,
                    consistencyBasis='operator-attestation' if args.writes_quiesced else 'individually-consistent-snapshots')
    manifest['files'] = {p.relative_to(folder).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
                         for p in folder.rglob('*') if p.is_file() and p.name != 'manifest.json'}
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Private backup saved:', folder.relative_to(ROOT))
    print('Cross-store consistency depends on actual write quiescence. Restore has not been tested.')


if __name__ == '__main__':
    main()
