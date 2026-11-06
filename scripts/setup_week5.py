"""Prepare an isolated browser flow and selected MFA identities; never run tests.

Uses the Keycloak 26.8 Admin API. Original realm browser flow is retained;
only employee-portal/security-dashboard get a client-level flow override.
"""
import argparse
import json
import secrets
import sqlite3
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote

from common import ROOT, admin_token, read_env, request
from backup_week5 import create_backup

FLOW = 'nhip-week5-browser'
ATTRIBUTE = 'nhip.mfa.required'
DEMO = {'mfa-employee': 'employee', 'mfa-auditor': 'auditor'}


def configure(usernames):
    backup, snapshot = create_backup(usernames)
    print('Pre-change backup:', backup.relative_to(ROOT))
    backend_env = read_env(ROOT / 'backend/.env')
    database = Path(backend_env.get('ATTENDANCE_DB', 'data/attendance.sqlite'))
    if not database.is_absolute():
        database = ROOT / 'backend' / database
    if not database.exists():
        raise RuntimeError('Initialize the week 4 application database before applying week 5. No authentication changes were made.')
    token = admin_token()
    base = '/admin/realms/company-iam'

    def api(path, method='GET', data=None):
        return request(base + path, method, data, token)

    realm = snapshot['realm']
    if realm.get('browserFlow') == FLOW:
        raise RuntimeError('Week 5 flow must remain a client override, not the realm/master administration flow.')
    clients = {c['clientId']: c for c in api('/clients')}
    for name in ['employee-portal', 'security-dashboard', 'attendance-control', 'realm-management']:
        if name not in clients:
            raise RuntimeError('Prepare week 4 first; missing client: ' + name)

    # The enforcement flag must be administrator-managed, never an editable
    # self-service profile attribute that could disable the selected OTP flow.
    profile = api('/users/profile')
    attributes = [a for a in profile.get('attributes', []) if a['name'] != ATTRIBUTE]
    attributes.append({'name': ATTRIBUTE, 'displayName': 'Nhịp: bắt buộc MFA',
                       'permissions': {'view': ['admin'], 'edit': ['admin']},
                       'multivalued': False, 'validations': {'options': {'options': ['true', 'false']}}})
    api('/users/profile', 'PUT', {**profile, 'attributes': attributes})

    flow_list = api('/authentication/flows')
    if not any(f['alias'] == FLOW for f in flow_list):
        api('/authentication/flows/' + quote(realm.get('browserFlow', 'browser'), safe='') + '/copy',
            'POST', {'newName': FLOW})

    def rows(alias):
        return api('/authentication/flows/' + quote(alias, safe='') + '/executions')

    def alias_for(flow_id):
        return api('/authentication/flows/' + flow_id)['alias']

    def parent_alias(executions, execution):
        previous = executions[:executions.index(execution)]
        for item in reversed(previous):
            if item.get('authenticationFlow') and item['level'] < execution['level']:
                return alias_for(item['flowId'])
        return FLOW

    executions = rows(FLOW)
    password = next((e for e in executions if e.get('providerId') == 'auth-username-password-form'), None)
    configured = next((e for e in executions if e.get('providerId') == 'conditional-user-configured'), None)
    if not password or not configured:
        raise RuntimeError('Unexpected browser-flow structure; review the saved flow before continuing.')
    forms_alias = parent_alias(executions, password)
    existing_otp_alias = parent_alias(executions, configured)
    selected_alias = FLOW + '-selected-otp'
    if not any(f['alias'] == selected_alias for f in api('/authentication/flows')):
        api('/authentication/flows/' + quote(forms_alias, safe='') + '/executions/flow', 'POST',
            {'alias': selected_alias, 'type': 'basic-flow', 'provider': 'basic-flow',
             'description': 'OTP required for administrator-selected Nhịp accounts'})
    selected_flow = next(f for f in api('/authentication/flows') if f['alias'] == selected_alias)
    selected_execution = next(e for e in rows(forms_alias) if e.get('flowId') == selected_flow['id'])
    api('/authentication/flows/' + quote(forms_alias, safe='') + '/executions', 'PUT',
        {'id': selected_execution['id'], 'requirement': 'CONDITIONAL'})

    def execution(alias, provider):
        matches = [e for e in rows(alias) if e.get('providerId') == provider and e.get('level', 0) == 0]
        if not matches:
            api('/authentication/flows/' + quote(alias, safe='') + '/executions/execution', 'POST', {'provider': provider})
            matches = [e for e in rows(alias) if e.get('providerId') == provider and e.get('level', 0) == 0]
        result = matches[0]
        api('/authentication/flows/' + quote(alias, safe='') + '/executions', 'PUT',
            {'id': result['id'], 'requirement': 'REQUIRED'})
        return result

    def condition(alias, negate):
        item = execution(alias, 'conditional-user-attribute')
        config = {'alias': 'nhip-week5-' + ('unselected' if negate else 'selected'),
                  'config': {'attribute_name': ATTRIBUTE, 'attribute_expected_value': 'true',
                             'include_group_attributes': 'false', 'not': str(negate).lower(), 'regex': 'false'}}
        config_id = item.get('authenticationConfig')
        if config_id:
            api('/authentication/config/' + config_id, 'PUT', {**config, 'id': config_id})
        else:
            api('/authentication/executions/' + item['id'] + '/config', 'POST', config)

    condition(selected_alias, False)
    execution(selected_alias, 'auth-otp-form')
    # Existing configured users retain OTP; selected users execute it only in
    # the new mandatory branch, avoiding a second/replayed-code OTP challenge.
    condition(existing_otp_alias, True)
    execution(existing_otp_alias, 'auth-otp-form')
    required_actions = api('/authentication/required-actions')
    otp_action = next(a for a in required_actions if a['alias'] == 'CONFIGURE_TOTP')
    api('/authentication/required-actions/CONFIGURE_TOTP', 'PUT', {**otp_action, 'enabled': True, 'defaultAction': False})
    api('', 'PUT', {'otpPolicyType': 'totp', 'otpPolicyAlgorithm': 'HmacSHA1',
                    'otpPolicyDigits': 6, 'otpPolicyPeriod': 30, 'otpPolicyLookAheadWindow': 1,
                    'otpPolicyCodeReusable': False, 'accessTokenLifespan': 300,
                    'revokeRefreshToken': True, 'refreshTokenMaxReuse': 0,
                    'ssoSessionIdleTimeout': 1800, 'ssoSessionMaxLifespan': 28800,
                    'clientSessionIdleTimeout': 1800, 'clientSessionMaxLifespan': 28800})
    event_config = api('/events/config')
    event_config['enabledEventTypes'] = sorted(set(event_config.get('enabledEventTypes', [])) |
        {'LOGIN', 'LOGIN_ERROR', 'LOGOUT', 'LOGOUT_ERROR', 'UPDATE_PASSWORD', 'UPDATE_TOTP',
         'REMOVE_TOTP', 'RESET_PASSWORD', 'RESET_PASSWORD_ERROR', 'REFRESH_TOKEN', 'REFRESH_TOKEN_ERROR',
         'EXECUTE_ACTIONS', 'EXECUTE_ACTIONS_ERROR'})
    api('/events/config', 'PUT', {**event_config, 'eventsEnabled': True, 'adminEventsEnabled': True,
                                  'adminEventsDetailsEnabled': False})

    management = clients['realm-management']['id']
    service = api('/clients/' + clients['attendance-control']['id'] + '/service-account-user')
    role_path = '/users/' + service['id'] + '/role-mappings/clients/' + management
    needed = {'manage-users', 'view-users', 'view-realm', 'view-events', 'view-clients'}
    assigned = api(role_path)
    extra = [r for r in assigned if r['name'] not in needed]
    if extra:
        api(role_path, 'DELETE', extra)
    existing = {r['name'] for r in assigned}
    missing = [api('/clients/' + management + '/roles/' + role) for role in needed - existing]
    if missing:
        api(role_path, 'POST', missing)
    effective = {r['name'] for r in api(role_path + '/composite')}
    if effective & {'realm-admin', 'manage-realm', 'manage-clients', 'impersonation', 'manage-identity-providers'}:
        raise RuntimeError('Service account inherits excessive administration rights. Review groups/composites; client flow overrides have not been applied.')

    selected = []
    env = read_env()
    for username in usernames:
        users = api('/users?exact=true&username=' + quote(username))
        if not users:
            if username not in DEMO:
                raise RuntimeError('Selected account does not exist: ' + username)
            key = 'TEST_' + username.upper().replace('-', '_') + '_PASSWORD'
            password = env.get(key) or (secrets.token_hex(24) + 'Aa1!')
            if not env.get(key):
                with (ROOT / '.env').open('a', encoding='utf-8') as output:
                    output.write('\n' + key + '=' + password + '\n')
            api('/users', 'POST', {'username': username, 'enabled': True, 'firstName': 'MFA',
                'lastName': 'Demo', 'email': username + '@example.test', 'emailVerified': True,
                'credentials': [{'type': 'password', 'value': password, 'temporary': False}]})
            users = api('/users?exact=true&username=' + quote(username))
            role = api('/roles/' + DEMO[username])
            api('/users/' + users[0]['id'] + '/role-mappings/realm', 'POST', [role])
        user = users[0]
        roles = [r['name'] for r in api('/users/' + user['id'] + '/role-mappings/realm') if r['name'] in {'admin', 'manager', 'employee', 'auditor'}]
        if len(roles) != 1:
            raise RuntimeError('Selected account must have one application role: ' + username)
        credentials = api('/users/' + user['id'] + '/credentials')
        actions = list(user.get('requiredActions', []))
        if not any(c['type'] == 'otp' for c in credentials) and 'CONFIGURE_TOTP' not in actions:
            actions.append('CONFIGURE_TOTP')
        api('/users/' + user['id'], 'PUT', {'attributes': {**user.get('attributes', {}), ATTRIBUTE: ['true']},
                                           'requiredActions': actions})
        api('/users/' + user['id'] + '/logout', 'POST')
        selected.append({'id': user['id'], 'username': username, 'role': roles[0],
                         'name': username if username not in DEMO else 'Tài khoản MFA ' + roles[0], 'team': 'Kiểm thử MFA'})

    # Bind only the two public application clients after the cloned flow is complete.
    flow_id = next(f['id'] for f in api('/authentication/flows') if f['alias'] == FLOW)
    for name in ['employee-portal', 'security-dashboard']:
        client = api('/clients/' + clients[name]['id'])
        api('/clients/' + client['id'], 'PUT', {**client,
            'authenticationFlowBindingOverrides': {**client.get('authenticationFlowBindingOverrides', {}), 'browser': flow_id}})

    db = sqlite3.connect(database)
    try:
        columns = {r[1] for r in db.execute('PRAGMA table_info(staff)')}
        if 'mfa_required' not in columns:
            db.execute('ALTER TABLE staff ADD COLUMN mfa_required INTEGER NOT NULL DEFAULT 0')
        if 'security_updated_at' not in columns:
            db.execute('ALTER TABLE staff ADD COLUMN security_updated_at TEXT')
        stamp = datetime.now(timezone.utc)
        for user in selected:
            db.execute('INSERT OR IGNORE INTO staff(id,username,name,team,role) VALUES(?,?,?,?,?)',
                       tuple(user[k] for k in ['id', 'username', 'name', 'team', 'role']))
            db.execute('UPDATE staff SET mfa_required=1,revoked_before=?,security_updated_at=? WHERE id=?',
                       (int(stamp.timestamp()), stamp.isoformat(), user['id']))
        db.commit()
    finally:
        db.close()
    (backup / 'applied-week5.json').write_text(json.dumps({'flowId': flow_id, 'flowAlias': FLOW,
        'users': [u['username'] for u in selected], 'appliedAt': datetime.now(timezone.utc).isoformat(),
        'tested': False}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Week 5 configuration applied. Restart backend and applications.')
    print('Selected accounts:', ', '.join(usernames))
    print('Complete OTP registration interactively at Keycloak. No OTP secret or QR is saved by this script.')
    print('No tests were run; enrollment and security behavior remain unverified.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--users', nargs='+', default=list(DEMO), help='MFA accounts; defaults create two separate demo users')
    args = parser.parse_args()
    configure(list(dict.fromkeys(args.users)))
