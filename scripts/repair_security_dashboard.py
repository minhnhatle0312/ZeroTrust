"""Plan/check/repair only the localhost Web B OIDC client. No setup imports."""
import argparse
import copy
import json
import math
import os
import re
import sys
import time
import uuid
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import HTTPRedirectHandler, ProxyHandler, Request, build_opener
from common import relative_endpoint, safe_http_error

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = 'http://localhost:8080'
REALM = 'company-iam'
CLIENT = 'security-dashboard'
APP = 'http://localhost:5174/'
APP_URIS = [APP, 'http://127.0.0.1:5174/']
TOKEN_PATH = '/realms/master/protocol/openid-connect/token'
BASE = '/admin/realms/' + REALM
LOOKUP = '/clients?' + urlencode({'clientId': CLIENT})
SCOPES = ('basic', 'web-origins', 'acr', 'profile', 'roles', 'email')
ATTRIBUTES = {'pkce.code.challenge.method': 'S256', 'post.logout.redirect.uris': '##'.join(APP_URIS)}
FIELDS = {'clientId': CLIENT, 'protocol': 'openid-connect', 'enabled': True,
          'publicClient': True, 'bearerOnly': False, 'standardFlowEnabled': True,
          'directAccessGrantsEnabled': False, 'implicitFlowEnabled': False,
          'serviceAccountsEnabled': False, 'rootUrl': APP, 'baseUrl': APP,
          'redirectUris': APP_URIS, 'webOrigins': [uri.rstrip('/') for uri in APP_URIS]}
MAPPER = {'name': 'security-api-audience', 'protocol': 'openid-connect',
          'protocolMapper': 'oidc-audience-mapper', 'consentRequired': False,
          'config': {'included.custom.audience': 'security-api',
                     'access.token.claim': 'true', 'id.token.claim': 'false'}}
MAPPER_CONFIG_KEYS = set(MAPPER['config']) | {
    'included.client.audience', 'introspection.token.claim', 'lightweight.claim', 'userinfo.token.claim'}


class RepairError(Exception):
    """Messages here are fixed text; never include an upstream body or credential."""


class RepairHTTPError(RepairError):
    def __init__(self, safe_error):
        self.status = safe_error.status
        super().__init__(str(safe_error))


def read_env(path):
    values = {}
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if line.strip() and not line.lstrip().startswith('#') and '=' in line:
                key, value = line.split('=', 1)
                values[key.strip()] = value.strip().strip('\"\'')
    return values


def check_local_configuration(root=ROOT):
    env = read_env(root / '.env')
    if env.get('KEYCLOAK_PUBLIC_URL', '').rstrip('/') != PUBLIC:
        raise RepairError('Expected KEYCLOAK_PUBLIC_URL=http://localhost:8080; no changes made.')
    frontend = {**read_env(root / 'web-b/.env'), **read_env(root / 'web-b/.env.local')}
    expected = {'VITE_KEYCLOAK_URL': PUBLIC, 'VITE_KEYCLOAK_REALM': REALM,
                'VITE_KEYCLOAK_CLIENT_ID': CLIENT}
    for key, value in expected.items():
        if frontend.get(key, value).rstrip('/') != value:
            raise RepairError('Web B configuration differs from localhost repair target; review it first.')
        if key in os.environ and os.environ[key].rstrip('/') != value:
            raise RepairError('A Vite environment override differs from repair target; review it first.')
    backend = read_env(root / 'backend/.env')
    if backend.get('SECURITY_API_AUDIENCE', 'security-api') != 'security-api':
        raise RepairError('Backend security audience differs from repair target; review it first.')
    return env


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None


def identifier(value):
    if not isinstance(value, str) or not re.fullmatch(r'[A-Za-z0-9_-]{1,128}', value):
        raise RepairError('Unexpected Keycloak identifier; stopped.')
    return value


class Api:
    def __init__(self, env):
        self.opener = build_opener(ProxyHandler({}), NoRedirect())
        self.token = None
        self.refresh_token = None
        self.refresh_at = 0
        self.target = None
        self.scope_ids = set()
        self.read_scope_ids = set()
        self.mapper_ids = set()
        credentials = {'grant_type': 'password', 'client_id': 'admin-cli',
                       'username': env.get('KEYCLOAK_ADMIN'),
                       'password': env.get('KEYCLOAK_ADMIN_PASSWORD')}
        if not credentials['username'] or not credentials['password']:
            raise RepairError('Admin credentials missing from local .env; not printed or changed.')
        self._authenticate(credentials)

    def _authenticate(self, credentials):
        started = time.monotonic()
        data = self._send(TOKEN_PATH, 'POST', credentials, form=True)
        token = data.get('access_token') if isinstance(data, dict) else None
        lifetime = data.get('expires_in') if isinstance(data, dict) else None
        refresh = data.get('refresh_token') if isinstance(data, dict) else None
        # OAuth refresh responses may omit a replacement when rotation is off.
        if isinstance(data, dict) and 'refresh_token' not in data:
            refresh = credentials.get('refresh_token')
        if (not isinstance(token, str) or not token or type(lifetime) not in (int, float)
                or not math.isfinite(lifetime) or lifetime <= 0
                or (refresh is not None and (not isinstance(refresh, str) or not refresh))):
            raise RepairError('Admin authentication returned invalid token metadata; stopped.')
        # Use a monotonic deadline from BEFORE the network call, with a margin
        # for request latency. No JWT decoding, token logging, or policy changes.
        deadline = started + lifetime - min(30, lifetime / 2)
        if time.monotonic() >= deadline:
            raise RepairError('Admin token lifetime too short for request latency; stopped.')
        self.token, self.refresh_token, self.refresh_at = token, refresh, deadline

    def _refresh(self):
        refresh = self.refresh_token
        self.token, self.refresh_token, self.refresh_at = None, None, 0
        if not refresh:
            raise RepairError('Admin refresh token unavailable; run --check in a new session.')
        # Never fall back to repeated password login after a refresh failure.
        self._authenticate({'grant_type': 'refresh_token', 'client_id': 'admin-cli',
                            'refresh_token': refresh})

    def _send(self, path, method='GET', data=None, form=False):
        if form:
            return self._exchange(path, method, data, form=True)
        if time.monotonic() >= self.refresh_at:
            self._refresh()
        try:
            return self._exchange(path, method, data)
        except RepairHTTPError as error:
            if error.status != 401:
                raise
            if method != 'GET':
                raise RepairError(str(error) + ' Write not retried; partial changes may exist. Keep backup and run --check.') from None
        # A server-side rejection may precede our local deadline. Refresh once;
        # the second GET goes directly to transport, so persistent 401 cannot loop.
        self._refresh()
        try:
            return self._exchange(path, method, data)
        except RepairHTTPError as error:
            if error.status == 401:
                raise RepairError(str(error) + ' Still unauthorized after one refresh; stopped.') from None
            raise

    def _exchange(self, path, method='GET', data=None, form=False):
        headers = {'Accept': 'application/json'}
        if self.token and not form:
            headers['Authorization'] = 'Bearer ' + self.token
        body = None
        if data is not None:
            body = (urlencode(data) if form else json.dumps(data)).encode('utf-8')
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
        try:
            with self.opener.open(Request(PUBLIC + path, data=body, headers=headers, method=method), timeout=20) as response:
                raw = response.read()
                return json.loads(raw) if raw else None
        except HTTPError as error:
            raise RepairHTTPError(safe_http_error(error, method, path)) from None
        except (URLError, TimeoutError, OSError, ValueError):
            raise RepairError('Keycloak ' + method + ' ' + relative_endpoint(path) + ': connection/response failed; details omitted.') from None

    def request(self, path, method='GET', data=None):
        # No realm/user/role/delete endpoints, wildcard lookup, or other client writes.
        target = '/clients/' + self.target if self.target else None
        allowed = method == 'GET' and (path in {LOOKUP, '/client-scopes'} or
            (target is not None and path in {target, target + '/default-client-scopes',
                target + '/optional-client-scopes', target + '/protocol-mappers/models'}) or
            any(path == '/client-scopes/' + value + '/protocol-mappers/models'
                for value in self.scope_ids | self.read_scope_ids))
        if method == 'POST' and path == '/clients':
            allowed = self.target is None and data.get('clientId') == CLIENT
        if target and method == 'PUT' and path == target:
            allowed = data.get('clientId') == CLIENT and data.get('id') == self.target
        if target and method == 'PUT' and data is None:
            allowed = any(path == target + '/default-client-scopes/' + value for value in self.scope_ids)
        if target and data and data.get('name') == MAPPER['name']:
            if method == 'POST' and path == target + '/protocol-mappers/models':
                allowed = True
            if method == 'PUT' and data.get('id') in self.mapper_ids:
                allowed = path == target + '/protocol-mappers/models/' + data['id']
        if not allowed:
            raise RepairError('Request outside security-dashboard allowlist blocked.')
        return self._send(BASE + path, method, data)


def collect(api):
    api.mapper_ids = set()
    api.read_scope_ids = set()
    available = api.request('/client-scopes')
    scopes = {}
    for name in SCOPES:
        matches = [s for s in available if s.get('name') == name]
        if len(matches) != 1 or matches[0].get('protocol') != 'openid-connect':
            raise RepairError('Required built-in OIDC scope missing/ambiguous: ' + name + '; no global scope edits allowed.')
        scopes[name] = identifier(matches[0]['id'])
    api.scope_ids = set(scopes.values())
    scope_mappers = {}
    def read_mappers(scope_id):
        if scope_id not in scope_mappers:
            scope_mappers[scope_id] = api.request('/client-scopes/' + scope_id + '/protocol-mappers/models')
        return scope_mappers[scope_id]
    # Keycloak 26 basic uses SubMapper + UserSessionNoteMapper for auth_time.
    for name, claim in [('basic', 'sub'), ('basic', 'auth_time'), ('roles', 'realm_access.roles'), ('profile', 'preferred_username')]:
        mappers = read_mappers(scopes[name])
        if not any((m.get('protocolMapper') == 'oidc-sub-mapper' if claim == 'sub'
                    else m.get('config', {}).get('claim.name') == claim)
                   and m.get('config', {}).get('access.token.claim') == 'true' for m in mappers):
            raise RepairError('Required access-token claim mapper missing in scope: ' + name + '; review shared scope manually.')
    clients = api.request(LOOKUP)
    if any(c.get('clientId') != CLIENT for c in clients) or len(clients) > 1:
        raise RepairError('Client lookup was not an unambiguous exact match; stopped.')
    state = {'client': None, 'defaultScopes': [], 'optionalScopes': [], 'mapper': None, 'scopes': scopes}
    if not clients:
        api.target = None
        return state
    api.target = identifier(clients[0]['id'])
    path = '/clients/' + api.target
    client = api.request(path)
    if client.get('clientId') != CLIENT or client.get('id') != api.target:
        raise RepairError('Client identity changed during inspection; stopped.')
    if client.get('protocol') != 'openid-connect' or client.get('serviceAccountsEnabled'):
        raise RepairError('Existing client is not a normal OIDC SPA; manual impact review required.')
    state.update(client=client, defaultScopes=api.request(path + '/default-client-scopes'),
                 optionalScopes=api.request(path + '/optional-client-scopes'))
    mappers = api.request(path + '/protocol-mappers/models')
    matches = [m for m in mappers if m.get('name') == MAPPER['name']]
    if len(matches) > 1:
        raise RepairError('Duplicate audience mapper names; stopped.')
    if matches:
        mapper = matches[0]
        if mapper.get('protocolMapper') != MAPPER['protocolMapper'] or set(mapper.get('config', {})) - MAPPER_CONFIG_KEYS:
            raise RepairError('Existing audience mapper requires manual review; not overwritten.')
        api.mapper_ids = {identifier(mapper['id'])}
        state['mapper'] = mapper
    # Never add a second explicit audience under a different name or via an
    # assigned shared scope. Those mappings are outside this tool's write scope.
    other_mappers = [m for m in mappers if m.get('name') != MAPPER['name']]
    available_ids = {s['id'] for s in available}
    for scope in state['defaultScopes'] + state['optionalScopes']:
        scope_id = identifier(scope['id'])
        if scope_id not in available_ids:
            raise RepairError('Assigned scope not found in inspected scopes; stopped.')
        api.read_scope_ids.add(scope_id)
    # Also inspect required scopes that will be assigned by apply().
    for scope_id in sorted(api.scope_ids | api.read_scope_ids):
        other_mappers.extend(read_mappers(scope_id))
    if any(m.get('protocolMapper') == MAPPER['protocolMapper'] and
           any(m.get('config', {}).get(key) == 'security-api'
               for key in ('included.custom.audience', 'included.client.audience')) for m in other_mappers):
        raise RepairError('Another direct/shared security-api audience mapper exists; manual review required, no duplicate created.')
    return state


def desired_client(client=None):
    desired = copy.deepcopy(FIELDS)
    desired['attributes'] = {**(client or {}).get('attributes', {}), **ATTRIBUTES}
    if client:
        desired['id'] = client['id']
    else:
        desired.update(name='Nhịp Security', fullScopeAllowed=True)
    return desired


def client_issues(client):
    missing = []
    for key, value in FIELDS.items():
        actual = client.get(key)
        if isinstance(value, list) and isinstance(actual, list) and all(isinstance(v, str) for v in actual):
            actual, value = sorted(actual), sorted(value)
        if actual != value:
            missing.append(key)
    for key, value in ATTRIBUTES.items():
        actual = client.get('attributes', {}).get(key)
        if key == 'post.logout.redirect.uris' and isinstance(actual, str):
            actual, value = sorted(actual.split('##')), sorted(value.split('##'))
        if actual != value:
            missing.append(key)
    return missing


def audience_mapper_issues(mapper):
    """Compare the effective Keycloak model, allowing only documented defaults.

    Keycloak 26.8 AbstractOIDCProtocolMapper.getEffectiveModel adds UserInfo
    from id.token.claim and introspection from access.token.claim on GET.
    Normalize those two omitted keys only; do not ignore arbitrary extras or
    coerce booleans/empty values. Required audience and token flags stay exact.
    Return fixed field names only, never values from the server.
    """
    if not mapper:
        return ['missing']
    differences = [key for key, value in MAPPER.items()
                   if key != 'config' and mapper.get(key) != value]
    config = mapper.get('config')
    if not isinstance(config, dict):
        return differences + ['config']
    defaults = {'userinfo.token.claim': MAPPER['config']['id.token.claim'],
                'introspection.token.claim': MAPPER['config']['access.token.claim']}
    expected = {**MAPPER['config'], **defaults}
    effective = {**defaults, **config}
    differences += ['config.' + key for key, value in expected.items()
                    if effective.get(key) != value]
    if set(config) - set(expected):
        differences.append('config.unexpected_fields')
    return differences


def issues(state):
    client = state['client']
    if not client:
        return ['client_missing']
    missing = client_issues(client)
    assigned = {s['name'] for s in state['defaultScopes']}
    missing += ['scope:' + name for name in SCOPES if name not in assigned]
    if audience_mapper_issues(state['mapper']):
        missing.append('audience_mapper')
    return missing


def save_backup(state, root=ROOT):
    # Back up every field this tool changes; omit client secrets, tokens, unrelated
    # attributes and mapper configs. Global scope definitions are never changed.
    client = state['client']
    snapshot = {'schema': 1, 'createdAt': datetime.now(timezone.utc).isoformat(),
                'publicUrl': PUBLIC, 'realm': REALM, 'clientId': CLIENT,
                'clientExisted': client is not None,
                'managedClientBefore': {k: client[k] for k in (*FIELDS, 'id') if k in client} if client else None,
                'managedAttributesBefore': {k: client.get('attributes', {})[k] for k in ATTRIBUTES if k in client.get('attributes', {})} if client else {},
                'defaultScopesBefore': [{k: s[k] for k in ('id', 'name') if k in s} for s in state['defaultScopes']],
                'optionalScopesBefore': [{k: s[k] for k in ('id', 'name') if k in s} for s in state['optionalScopes']],
                'requiredScopeIds': state['scopes'],
                'audienceMapperBefore': {k: state['mapper'][k] for k in (*MAPPER, 'id') if k in state['mapper']} if state['mapper'] else None}
    directory = root / '.local/keycloak-client-backups'
    for folder in [root / '.local', directory]:
        if folder.is_symlink() or getattr(folder, 'is_junction', lambda: False)():
            raise RepairError('Backup directory link/junction refused; no changes made.')
    directory.mkdir(parents=True, exist_ok=True)
    if not directory.resolve().is_relative_to(root.resolve()):
        raise RepairError('Backup directory outside workspace; no changes made.')
    stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    path = directory / (CLIENT + '-' + stamp + '-' + uuid.uuid4().hex[:8] + '.json')
    with os.fdopen(os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600), 'w', encoding='utf-8') as file:
        json.dump(snapshot, file, ensure_ascii=False, indent=2)
        file.write('\n')
        file.flush()
        os.fsync(file.fileno())
    if json.loads(path.read_text(encoding='utf-8')) != snapshot:
        raise RepairError('Backup verification failed; no changes made.')
    return path


def apply(api, before, backup=save_backup):
    if not issues(before):
        print('Already configured; no writes or backup needed.')
        return
    path = backup(before)  # Must complete before the first configuration write.
    print('Backup:', path)
    if collect(api) != before:
        raise RepairError('Configuration changed after backup; stopped before writes. Run check again.')
    client = before['client']
    if client is None:
        api.request('/clients', 'POST', desired_client())
        current = collect(api)
        if current['client'] is None:
            raise RepairError('Client creation not confirmed; inspect before retrying.')
    elif client_issues(client):
        api.request('/clients/' + api.target, 'PUT', desired_client(client))
        current = collect(api)
    else:
        current = before
    target = '/clients/' + api.target
    assigned = {s['name'] for s in current['defaultScopes']}
    for name in SCOPES:
        if name not in assigned:
            api.request(target + '/default-client-scopes/' + current['scopes'][name], 'PUT')
    if audience_mapper_issues(current['mapper']):
        mapper = current['mapper']
        if mapper:
            api.request(target + '/protocol-mappers/models/' + mapper['id'], 'PUT', {**copy.deepcopy(MAPPER), 'id': mapper['id']})
        else:
            api.request(target + '/protocol-mappers/models', 'POST', copy.deepcopy(MAPPER))
    if issues(collect(api)):
        raise RepairError('Post-write verification failed; partial changes may exist. Keep backup; run --check, no automatic rollback.')
    print('Verified client/scopes/audience configuration. Browser login/MFA/SSO not tested by this script.')


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    group = parser.add_mutually_exclusive_group()
    group.add_argument('--plan', action='store_true', help='Offline plan only (default); no Keycloak calls')
    group.add_argument('--check', action='store_true', help='Authenticate admin; inspect configuration only')
    group.add_argument('--apply', action='store_true', help='Back up, then repair security-dashboard only')
    args = parser.parse_args(argv)
    try:
        env = check_local_configuration()
        if not args.check and not args.apply:
            print(json.dumps({'mode': 'OFFLINE_PLAN', 'publicUrl': PUBLIC, 'realm': REALM,
                'client': desired_client(), 'requiredDefaultScopes': SCOPES,
                'audienceMapper': MAPPER, 'liveState': 'NOT_CHECKED'}, indent=2))
            return 0
        api = Api(env)
        before = collect(api)
        if args.apply:
            apply(api, before)
        else:
            result = issues(before)
            print(json.dumps({'mode': 'CHECK_ONLY', 'clientExists': before['client'] is not None,
                              'configurationMatches': not result, 'differences': result,
                              **({'audienceMapperDifferences': audience_mapper_issues(before['mapper'])}
                                 if 'audience_mapper' in result else {})}))
            return 2 if result else 0
        return 0
    except RepairError as error:
        print('STOP:', str(error), file=sys.stderr)
        if args.apply:
            print('If configuration writes began, partial changes may exist; keep backup and run --check. No automatic rollback.', file=sys.stderr)
    except Exception:
        # No traceback/raw exceptions: responses/credentials must never enter logs.
        print('STOP: Operation failed; details omitted. If --apply began, partial changes may exist; keep backup and run --check.', file=sys.stderr)
    return 1


if __name__ == '__main__':
    raise SystemExit(main())
