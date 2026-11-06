"""Restore week-5 authentication settings from an explicit local backup.

Does not restore passwords/OTP secrets, delete users, or roll back revocation
timestamps. Full PostgreSQL/SQLite recovery is a separate offline procedure.
"""
import argparse
import hashlib
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import quote

from common import ROOT, admin_token, read_env, request

POLICY_KEYS = ['otpPolicyType', 'otpPolicyAlgorithm', 'otpPolicyDigits', 'otpPolicyPeriod',
               'otpPolicyLookAheadWindow', 'otpPolicyCodeReusable', 'accessTokenLifespan',
               'revokeRefreshToken', 'refreshTokenMaxReuse', 'ssoSessionIdleTimeout',
               'ssoSessionMaxLifespan', 'clientSessionIdleTimeout', 'clientSessionMaxLifespan']
ATTRIBUTE = 'nhip.mfa.required'


def restore(folder):
    folder = Path(folder).resolve()
    if not folder.is_relative_to((ROOT / 'backups').resolve()):
        raise RuntimeError('Select a backup inside this workspace backups directory.')
    manifest = json.loads((folder / 'manifest.json').read_text(encoding='utf-8'))
    if not manifest.get('complete'):
        raise RuntimeError('Backup is incomplete; no configuration changed.')
    for relative, checksum in manifest['files'].items():
        file = (folder / relative).resolve()
        if not file.is_relative_to(folder) or hashlib.sha256(file.read_bytes()).hexdigest() != checksum:
            raise RuntimeError('Backup integrity mismatch; no configuration changed.')
    snapshot = json.loads((folder / 'keycloak-config.json').read_text(encoding='utf-8'))
    token = admin_token()

    def api(path, method='GET', data=None):
        return request('/admin/realms/company-iam' + path, method, data, token)

    flow = next((f for f in api('/authentication/flows') if f['alias'] == 'nhip-week5-browser'), None)
    changes = []
    for client in snapshot['clients']:
        if client['clientId'] not in {'employee-portal', 'security-dashboard'}:
            continue
        current = api('/clients/' + client['id'])
        current_binding = current.get('authenticationFlowBindingOverrides', {}).get('browser')
        old_binding = client.get('authenticationFlowBindingOverrides', {}).get('browser')
        if current_binding not in {old_binding, flow['id'] if flow else None}:
            raise RuntimeError('Application client now uses another flow. Review before restoring: ' + client['clientId'])
        bindings = dict(current.get('authenticationFlowBindingOverrides', {}))
        if old_binding:
            bindings['browser'] = old_binding
        else:
            bindings.pop('browser', None)
        changes.append(('/clients/' + client['id'], {**current, 'authenticationFlowBindingOverrides': bindings}))
    for path, value in changes:
        api(path, 'PUT', value)
    api('', 'PUT', {key: snapshot['realm'][key] for key in POLICY_KEYS if key in snapshot['realm']})
    old_action = next((a for a in snapshot['requiredActions'] if a['alias'] == 'CONFIGURE_TOTP'), None)
    if old_action:
        api('/authentication/required-actions/CONFIGURE_TOTP', 'PUT', old_action)
    current_profile = api('/users/profile')
    profile_attributes = [a for a in current_profile.get('attributes', []) if a['name'] != ATTRIBUTE]
    profile_attributes += [a for a in snapshot['userProfile'].get('attributes', []) if a['name'] == ATTRIBUTE]
    api('/users/profile', 'PUT', {**current_profile, 'attributes': profile_attributes})
    local_previous = {u['username']: u for u in snapshot.get('localSecurity', [])}
    db_path = Path(read_env(ROOT / 'backend/.env').get('ATTENDANCE_DB', 'data/attendance.sqlite'))
    if not db_path.is_absolute():
        db_path = ROOT / 'backend' / db_path
    db = sqlite3.connect(db_path) if db_path.exists() else None
    try:
        columns = {r[1] for r in db.execute('PRAGMA table_info(staff)')} if db else set()
        for username, original in snapshot['users'].items():
            users = api('/users?exact=true&username=' + quote(username))
            if not users:
                continue
            current = users[0]
            attributes = dict(current.get('attributes', {}))
            if original and ATTRIBUTE in original.get('attributes', {}):
                attributes[ATTRIBUTE] = original['attributes'][ATTRIBUTE]
            else:
                attributes.pop(ATTRIBUTE, None)
            actions = [a for a in current.get('requiredActions', []) if a != 'CONFIGURE_TOTP']
            if original and 'CONFIGURE_TOTP' in original.get('requiredActions', []):
                actions.append('CONFIGURE_TOTP')
            value = {'attributes': attributes, 'requiredActions': actions}
            if original is None:
                value['enabled'] = False
            api('/users/' + current['id'], 'PUT', value)
            api('/users/' + current['id'] + '/logout', 'POST')
            if db and 'mfa_required' in columns:
                stamp = datetime.now(timezone.utc)
                previous = local_previous.get(username, {})
                db.execute('UPDATE staff SET mfa_required=?,security_updated_at=?,revoked_before=MAX(revoked_before,?) WHERE id=?',
                           (previous.get('mfa_required', 0), stamp.isoformat(), int(stamp.timestamp()), current['id']))
                if original is None:
                    db.execute('UPDATE staff SET disabled=1 WHERE id=?', (current['id'],))
        if db:
            db.commit()
    finally:
        if db:
            db.close()
    # Keep the copied flow and any enrolled credentials for review. Restoring
    # bindings does not require deleting those objects or erasing user history.
    print('Prior application flow bindings and OTP/session policy restored.')
    print('New MFA demo accounts were disabled; existing OTP credentials are retained.')
    print('Restart backend/applications. No tests or full database restore were performed.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('backup_directory')
    restore(parser.parse_args().backup_directory)
