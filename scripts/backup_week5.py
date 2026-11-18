"""Create a local configuration/SQLite/PostgreSQL snapshot before IAM changes.

Backups contain credentials and must stay in the ignored backups directory.
PostgreSQL and SQLite snapshots are individually consistent; stop application
writes first when a coordinated recovery point is required.
"""
import hashlib
import json
import os
import shutil
import sqlite3
import subprocess
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from common import ROOT, admin_token, read_env, request


def create_backup(usernames=()):
    folder = ROOT / 'backups' / ('week5-' + datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%S%fZ'))
    folder.mkdir(parents=True, mode=0o700)
    token = admin_token()
    base = '/admin/realms/company-iam'

    def api(path):
        return request(base + path, token=token)

    realm = api('')
    clients = api('/clients')
    users = {}
    for username in usernames:
        matches = api('/users?exact=true&username=' + quote(username))
        users[username] = matches[0] if matches else None
    snapshot = {'realm': realm, 'requiredActions': api('/authentication/required-actions'),
                'flows': api('/authentication/flows'), 'clients': clients, 'users': users,
                'serviceRoles': None, 'userProfile': api('/users/profile')}
    control = next((c for c in clients if c['clientId'] == 'attendance-control'), None)
    management = next((c for c in clients if c['clientId'] == 'realm-management'), None)
    if control and management:
        service_user = api('/clients/' + control['id'] + '/service-account-user')
        snapshot['serviceRoles'] = {'userId': service_user['id'], 'clientId': management['id'],
                                    'roles': api('/users/' + service_user['id'] + '/role-mappings/clients/' + management['id'])}
    (folder / 'keycloak-config.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    for relative in ['.env', 'backend/.env', 'backend/data/staff.json', 'web-a/.env.local', 'web-b/.env.local', 'network/.local/config.json']:
        source = ROOT / relative
        if source.exists():
            destination = folder / 'files' / relative
            destination.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, destination)
    backend_env = read_env(ROOT / 'backend/.env')
    database = Path(backend_env.get('ATTENDANCE_DB', 'data/attendance.sqlite'))
    if not database.is_absolute():
        database = ROOT / 'backend' / database
    local_security = []
    if database.exists():
        source = sqlite3.connect(database.resolve().as_uri() + '?mode=ro', uri=True)
        destination = sqlite3.connect(folder / 'attendance.sqlite')
        try:
            source.backup(destination)
            columns = {row[1] for row in source.execute('PRAGMA table_info(staff)')}
            selection = ['id', 'username', 'disabled', 'revoked_before'] + [name for name in ['mfa_required', 'security_updated_at'] if name in columns]
            for row in source.execute('SELECT ' + ','.join(selection) + ' FROM staff'):
                value = dict(zip(selection, row))
                if value['username'] in usernames:
                    local_security.append(value)
        finally:
            destination.close()
            source.close()
    snapshot['localSecurity'] = local_security
    (folder / 'keycloak-config.json').write_text(json.dumps(snapshot, ensure_ascii=False, indent=2), encoding='utf-8')
    dump = folder / 'keycloak.pgdump'
    with dump.open('wb') as output:
        result = subprocess.run(['docker', 'compose', 'exec', '-T', 'postgres', 'sh', '-c',
                                 'exec pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc'],
                                cwd=ROOT, stdout=output, stderr=subprocess.PIPE)
    if result.returncode or not dump.stat().st_size:
        raise RuntimeError('PostgreSQL backup failed; authentication configuration has not been changed.')
    manifest = {'createdAt': datetime.now(timezone.utc).isoformat(), 'complete': True,
                'coordinatedSnapshot': False, 'writeQuiescenceRequiredForCrossStoreConsistency': True,
                'files': {str(p.relative_to(folder)): hashlib.sha256(p.read_bytes()).hexdigest()
                          for p in folder.rglob('*') if p.is_file()}}
    for command, key in [(['git', 'rev-parse', 'HEAD'], 'commit'), (['node', '--version'], 'node'),
                         (['docker', '--version'], 'docker')]:
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True)
        manifest[key] = result.stdout.strip() if result.returncode == 0 else 'unavailable'
    manifest['workingTreeHasChanges'] = bool(subprocess.run(['git', 'status', '--porcelain'], cwd=ROOT, capture_output=True, text=True).stdout)
    (folder / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    for file in folder.rglob('*'):
        if file.is_file():
            os.chmod(file, 0o600)
    return folder, snapshot


if __name__ == '__main__':
    folder, _ = create_backup()
    print('Backup completed:', folder.relative_to(ROOT))
    print('Keep this folder private. No test or authentication-flow change was performed.')
