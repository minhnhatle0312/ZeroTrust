"""Synthetic Admin API tests. No sockets, real credentials, or Keycloak writes."""
import contextlib
import copy
import importlib.util
import io
import json
import unittest
import uuid
import sys
from pathlib import Path
from unittest.mock import patch
from unittest.mock import MagicMock
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('security_dashboard_repair', ROOT / 'scripts/repair_security_dashboard.py')
repair = importlib.util.module_from_spec(spec)
sys.path.insert(0, str(ROOT / 'scripts'))
try:
    spec.loader.exec_module(repair)
finally:
    sys.path.pop(0)
common = sys.modules['common']


class FakeApi(repair.Api):
    def __init__(self, existing=False):
        self.target = None
        self.scope_ids, self.mapper_ids = set(), set()
        self.read_scope_ids = set()
        self.scopes = [{'id': 'scope-' + name, 'name': name, 'protocol': 'openid-connect'} for name in repair.SCOPES]
        self.claims = {
            'basic': [{'protocolMapper': 'oidc-sub-mapper', 'config': {'access.token.claim': 'true'}},
                      {'protocolMapper': 'oidc-usersessionmodel-note-mapper', 'config': {'claim.name': 'auth_time', 'access.token.claim': 'true'}}],
            'roles': [{'config': {'claim.name': 'realm_access.roles', 'access.token.claim': 'true'}}],
            'profile': [{'config': {'claim.name': 'preferred_username', 'access.token.claim': 'true'}}]}
        self.client = dict(repair.desired_client(), id='target-client') if existing else None
        self.defaults, self.optional, self.mappers, self.writes = [], [], [], []
        self.employee = {'clientId': 'employee-portal', 'attributes': {'unchanged': 'yes'}}

    def _send(self, full, method='GET', data=None, form=False):
        path = full.removeprefix(repair.BASE)
        if method == 'GET':
            if path == '/client-scopes': return copy.deepcopy(self.scopes)
            if path.startswith('/client-scopes/'):
                name = path.split('/')[2].removeprefix('scope-')
                return copy.deepcopy(self.claims.get(name, []))
            if path == repair.LOOKUP: return [copy.deepcopy(self.client)] if self.client else []
            if path == '/clients/target-client': return copy.deepcopy(self.client)
            if path.endswith('/default-client-scopes'): return copy.deepcopy(self.defaults)
            if path.endswith('/optional-client-scopes'): return copy.deepcopy(self.optional)
            if path.endswith('/protocol-mappers/models'): return copy.deepcopy(self.mappers)
        self.writes.append((path, method, copy.deepcopy(data)))
        if method == 'POST' and path == '/clients':
            self.client = dict(copy.deepcopy(data), id='target-client')
        elif method == 'PUT' and path == '/clients/target-client':
            self.client.update(copy.deepcopy(data))
        elif '/default-client-scopes/' in path:
            scope = next(s for s in self.scopes if s['id'] == path.split('/')[-1])
            if scope not in self.defaults: self.defaults.append(copy.deepcopy(scope))
            self.optional = [s for s in self.optional if s['id'] != scope['id']]
        elif '/protocol-mappers/models' in path:
            mapper = dict(copy.deepcopy(data), id=data.get('id', 'audience-id'))
            self.mappers = [m for m in self.mappers if m['id'] != mapper['id']] + [mapper]
        else:
            raise AssertionError('Unexpected fake request')
        return None


class EffectiveMapperApi(FakeApi):
    """Keycloak 26.8 GET returns effective config, not the POST/PUT payload.

    ProtocolMappersResource calls AbstractOIDCProtocolMapper.getEffectiveModel:
    omitted UserInfo follows ID token; omitted introspection follows access token.
    The client endpoint is also the Admin Console's dedicated scope.
    """
    def _send(self, full, method='GET', data=None, form=False):
        result = super()._send(full, method, data, form)
        if method == 'GET' and full == repair.BASE + '/clients/target-client/protocol-mappers/models':
            for mapper in result:
                config = mapper.get('config', {})
                if 'id.token.claim' in config:
                    config.setdefault('userinfo.token.claim', config['id.token.claim'])
                if 'access.token.claim' in config:
                    config.setdefault('introspection.token.claim', config['access.token.claim'])
        return result


class RepairTests(unittest.TestCase):
    def setUp(self):
        # Even an accidentally instantiated real Api cannot leave the process.
        self.network = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Network forbidden in unit tests'))
        self.network.start()
        self.addCleanup(self.network.stop)

    def apply(self, api, backup=lambda state: Path('synthetic-backup.json')):
        with contextlib.redirect_stdout(io.StringIO()):
            repair.apply(api, repair.collect(api), backup)

    def test_offline_default_does_not_instantiate_api(self):
        with patch.object(repair, 'check_local_configuration', return_value={}), patch.object(repair, 'Api', side_effect=AssertionError('No API')), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(repair.main([]), 0)
        self.assertEqual(json.loads(output.getvalue())['liveState'], 'NOT_CHECKED')

    def test_create_only_target_after_backup_and_rerun_is_noop(self):
        api = FakeApi()
        employee = copy.deepcopy(api.employee)
        checkpoints = []
        def backup(state):
            self.assertEqual(api.writes, [])
            self.assertIsNone(state['client'])
            checkpoints.append('backup')
            return Path('synthetic-backup.json')
        self.apply(api, backup)
        self.assertEqual(checkpoints, ['backup'])
        self.assertEqual(api.employee, employee)
        self.assertEqual(repair.issues(repair.collect(api)), [])
        count = len(api.writes)
        self.apply(api, lambda state: self.fail('No backup needed on noop'))
        self.assertEqual(len(api.writes), count)
        self.assertEqual(api.client['redirectUris'], ['http://localhost:5174/', 'http://127.0.0.1:5174/'])
        self.assertEqual(api.client['webOrigins'], ['http://localhost:5174', 'http://127.0.0.1:5174'])

    def test_existing_client_keeps_unrelated_settings_and_mappers(self):
        api = FakeApi(existing=True)
        api.client.update(fullScopeAllowed=False, attributes={'unrelated.setting': 'keep'})
        api.mappers = [{'id': 'unrelated-mapper', 'name': 'other-mapper', 'config': {'claim.name': 'unchanged'}}]
        original = copy.deepcopy(api.mappers[0])
        self.apply(api)
        self.assertFalse(api.client['fullScopeAllowed'])
        self.assertEqual(api.client['attributes']['unrelated.setting'], 'keep')
        self.assertIn(original, api.mappers)

    def test_existing_wrong_audience_mapper_is_updated_in_place(self):
        api = FakeApi(existing=True)
        mapper = dict(copy.deepcopy(repair.MAPPER), id='existing-audience')
        mapper['config']['included.custom.audience'] = 'old-audience'
        api.mappers = [mapper]
        self.apply(api)
        self.assertEqual(len(api.mappers), 1)
        self.assertEqual(api.mappers[0]['id'], 'existing-audience')
        self.assertEqual(api.mappers[0]['config'], repair.MAPPER['config'])

    def test_required_scope_moves_from_optional_to_default_only_on_target(self):
        api = FakeApi(existing=True)
        api.optional = [copy.deepcopy(api.scopes[0])]
        self.apply(api)
        self.assertEqual(api.optional, [])
        self.assertEqual({s['name'] for s in api.defaults}, set(repair.SCOPES))

    def test_missing_global_scope_stops_before_backup_or_write(self):
        api = FakeApi()
        api.scopes.pop()
        with self.assertRaisesRegex(repair.RepairError, 'scope missing'):
            self.apply(api, lambda state: self.fail('Must not back up or write'))
        self.assertEqual(api.writes, [])

    def test_missing_claim_mapper_stops_without_global_repair(self):
        api = FakeApi()
        api.claims['basic'].pop()
        with self.assertRaisesRegex(repair.RepairError, 'claim mapper missing'):
            repair.collect(api)
        self.assertEqual(api.writes, [])

    def test_backup_failure_prevents_all_configuration_writes(self):
        api = FakeApi()
        def failed(state): raise OSError('Synthetic backup failure')
        with self.assertRaises(OSError): self.apply(api, failed)
        self.assertEqual(api.writes, [])

    def test_concurrent_change_after_backup_is_not_overwritten(self):
        api = FakeApi(existing=True)
        def concurrent(state):
            api.client['attributes']['concurrent.setting'] = 'new'
            return Path('synthetic-backup.json')
        with self.assertRaisesRegex(repair.RepairError, 'changed after backup'):
            self.apply(api, concurrent)
        self.assertEqual(api.writes, [])

    def test_backup_is_unique_verified_and_excludes_unmanaged_sensitive_fields(self):
        api = FakeApi(existing=True)
        api.client['secret'] = 'synthetic-marker-not-a-credential'
        api.client['attributes']['unrelated.private.setting'] = 'synthetic-marker-not-a-credential'
        state = repair.collect(api)
        base = ROOT / '.runtime/security-client-tests'
        base.mkdir(parents=True, exist_ok=True)
        root = base / ('synthetic-' + uuid.uuid4().hex)
        root.mkdir()
        first, second = repair.save_backup(state, root), repair.save_backup(state, root)
        self.assertNotEqual(first, second)
        raw = first.read_text(encoding='utf-8')
        self.assertNotIn('synthetic-marker-not-a-credential', raw)
        saved = json.loads(raw)
        self.assertTrue(saved['clientExisted'])
        self.assertEqual(saved['managedClientBefore']['redirectUris'], repair.APP_URIS)
        self.assertEqual(saved['managedAttributesBefore'], repair.ATTRIBUTES)

    def test_other_client_user_role_and_delete_routes_are_blocked(self):
        api = FakeApi(existing=True)
        repair.collect(api)
        for path, method, data in [('/clients/employee-portal', 'PUT', {'clientId': 'employee-portal'}),
                ('/users', 'POST', {}), ('/roles', 'POST', {}), ('', 'PUT', {}),
                ('/clients/target-client', 'DELETE', None), ('/client-scopes/scope-basic', 'PUT', {}),
                ('/clients', 'POST', {'clientId': 'employee-portal'})]:
            with self.assertRaisesRegex(repair.RepairError, 'allowlist'):
                api.request(path, method, data)
        self.assertEqual(api.writes, [])

    def test_check_reports_missing_client_without_writes(self):
        api = FakeApi()
        with patch.object(repair, 'check_local_configuration', return_value={}), patch.object(repair, 'Api', return_value=api), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(repair.main(['--check']), 2)
        self.assertEqual(json.loads(output.getvalue())['differences'], ['client_missing'])
        self.assertEqual(api.writes, [])

    def test_unexpected_failure_is_not_printed(self):
        with patch.object(repair, 'check_local_configuration', side_effect=RuntimeError('synthetic-private-marker')), contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(repair.main(['--apply']), 1)
        self.assertNotIn('synthetic-private-marker', output.getvalue())

    def test_nonlocal_configuration_stops_before_authentication(self):
        with patch.object(repair, 'read_env', return_value={'KEYCLOAK_PUBLIC_URL': 'https://other.example.test'}), patch.object(repair, 'Api', side_effect=AssertionError('No API')), contextlib.redirect_stderr(io.StringIO()):
            self.assertEqual(repair.main(['--apply']), 1)

    def test_unexpected_mapper_and_service_account_require_manual_review(self):
        api = FakeApi(existing=True)
        api.mappers = [dict(copy.deepcopy(repair.MAPPER), id='mapper', config={'unknown.setting': 'value'})]
        with self.assertRaisesRegex(repair.RepairError, 'manual review'): repair.collect(api)
        api.mappers = []
        api.client['serviceAccountsEnabled'] = True
        with self.assertRaisesRegex(repair.RepairError, 'impact review'): repair.collect(api)
        self.assertEqual(api.writes, [])

    def test_http_redirects_cannot_forward_admin_credentials(self):
        self.assertIsNone(repair.NoRedirect().redirect_request(None, None, 302, '', {}, 'https://other.example.test'))

    def test_partial_client_only_missing_mapper_has_one_write_and_reruns_noop(self):
        api = FakeApi(existing=True)
        api.defaults = copy.deepcopy(api.scopes)
        self.assertEqual(repair.issues(repair.collect(api)), ['audience_mapper'])
        self.apply(api)
        self.assertEqual([(path, method) for path, method, _ in api.writes],
                         [('/clients/target-client/protocol-mappers/models', 'POST')])
        self.apply(api, lambda state: self.fail('Rerun must be noop'))
        self.assertEqual(len(api.writes), 1)

    def test_callback_and_logout_allow_exact_loopback_urls_only(self):
        api = FakeApi(existing=True)
        api.defaults = copy.deepcopy(api.scopes)
        api.mappers = [dict(copy.deepcopy(repair.MAPPER), id='audience-id')]
        api.client['redirectUris'] = [repair.APP]
        api.client['webOrigins'] = [repair.APP.rstrip('/')]
        api.client['attributes']['post.logout.redirect.uris'] = repair.APP
        self.apply(api)
        self.assertEqual(len(api.writes), 1)
        self.assertEqual(api.writes[0][1], 'PUT')
        self.assertEqual(api.client['attributes']['post.logout.redirect.uris'].split('##'), repair.APP_URIS)
        self.assertFalse(any('*' in uri for uri in api.client['redirectUris'] + api.client['webOrigins']))
        # Keycloak collections need not retain insertion order.
        api.client['redirectUris'].reverse()
        api.client['webOrigins'].reverse()
        api.client['attributes']['post.logout.redirect.uris'] = '##'.join(reversed(repair.APP_URIS))
        self.apply(api, lambda state: self.fail('Ordering alone must not cause a write'))

    def test_duplicate_client_or_named_mapper_stops_before_write(self):
        api = FakeApi(existing=True)
        original = api._send
        def duplicate(path, *args, **kwargs):
            result = original(path, *args, **kwargs)
            return result * 2 if path == repair.BASE + repair.LOOKUP else result
        with patch.object(api, '_send', side_effect=duplicate), self.assertRaisesRegex(repair.RepairError, 'unambiguous'):
            self.apply(api)
        api.mappers = [dict(copy.deepcopy(repair.MAPPER), id=value) for value in ('one', 'two')]
        with self.assertRaisesRegex(repair.RepairError, 'Duplicate audience'): self.apply(api)
        self.assertEqual(api.writes, [])

    def test_equivalent_audience_under_other_name_or_scope_is_not_duplicated(self):
        for location in ('direct', 'required', 'default', 'optional'):
            with self.subTest(location=location):
                api = FakeApi(existing=True)
                mapper = dict(copy.deepcopy(repair.MAPPER), id='other-audience', name='other-name')
                if location == 'direct': api.mappers = [mapper]
                elif location == 'required': api.claims['roles'].append(mapper)
                else:
                    scope = {'id': 'scope-custom', 'name': 'custom', 'protocol': 'openid-connect'}
                    api.scopes.append(scope)
                    (api.defaults if location == 'default' else api.optional).append(scope)
                    api.claims['custom'] = [mapper]
                with self.assertRaisesRegex(repair.RepairError, 'no duplicate created'): self.apply(api)
                self.assertEqual(api.writes, [])

    def test_response_lost_after_mapper_creation_is_reconciled_without_duplicate(self):
        api = FakeApi(existing=True)
        api.defaults = copy.deepcopy(api.scopes)
        original = api._send
        def lost_response(path, method='GET', data=None, form=False):
            result = original(path, method, data, form)
            if method == 'POST': raise repair.RepairError('Synthetic response lost after commit')
            return result
        with patch.object(api, '_send', side_effect=lost_response), self.assertRaises(repair.RepairError):
            self.apply(api)
        self.apply(api, lambda state: self.fail('Committed mapper must be detected on rerun'))
        self.assertEqual(len(api.mappers), 1)
        self.assertEqual(len(api.writes), 1)

    def test_inspecting_extra_scope_does_not_authorize_assignment_or_global_writes(self):
        api = FakeApi(existing=True)
        scope = {'id': 'scope-custom', 'name': 'custom', 'protocol': 'openid-connect'}
        api.scopes.append(scope)
        api.optional.append(scope)
        repair.collect(api)
        for path in ('/clients/target-client/default-client-scopes/scope-custom',
                     '/client-scopes/scope-custom/protocol-mappers/models'):
            with self.assertRaisesRegex(repair.RepairError, 'allowlist'): api.request(path, 'PUT')
        self.assertEqual(api.writes, [])

    def effective_api(self):
        api = EffectiveMapperApi(existing=True)
        api.defaults = copy.deepcopy(api.scopes)
        api.mappers = [dict(copy.deepcopy(repair.MAPPER), id='existing-audience')]
        return api

    def test_keycloak_effective_defaults_check_passes_without_configuration_writes(self):
        api = self.effective_api()
        with patch.object(repair, 'check_local_configuration', return_value={}), patch.object(repair, 'Api', return_value=api), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(repair.main(['--check']), 0)
        result = json.loads(output.getvalue())
        self.assertTrue(result['configurationMatches'])
        self.assertEqual(result['differences'], [])
        self.assertEqual(api.writes, [])

    def test_keycloak_effective_defaults_existing_mapper_apply_is_noop(self):
        api = self.effective_api()
        self.apply(api, lambda state: self.fail('Correct effective mapper needs no backup or write'))
        self.assertEqual(api.writes, [])

    def test_keycloak_effective_defaults_create_verifies_and_rerun_does_not_duplicate(self):
        api = EffectiveMapperApi()
        self.apply(api)
        self.assertEqual(repair.issues(repair.collect(api)), [])
        writes = copy.deepcopy(api.writes)
        self.apply(api, lambda state: self.fail('Rerun must not write'))
        self.assertEqual(api.writes, writes)
        self.assertEqual(sum(method == 'POST' and path.endswith('/protocol-mappers/models') for path, method, _ in writes), 1)
        self.assertEqual(len(api.mappers), 1)

    def test_keycloak_effective_defaults_wrong_audience_is_fixed_in_place(self):
        api = self.effective_api()
        api.mappers[0]['config']['included.custom.audience'] = 'wrong-audience'
        self.assertIn('audience_mapper', repair.issues(repair.collect(api)))
        self.apply(api)
        self.assertEqual(len(api.writes), 1)
        self.assertEqual(api.writes[0][:2], ('/clients/target-client/protocol-mappers/models/existing-audience', 'PUT'))
        self.assertEqual(api.mappers[0]['id'], 'existing-audience')
        self.assertEqual(repair.issues(repair.collect(api)), [])

    def test_keycloak_effective_defaults_do_not_rewrite_mapper_during_client_repair(self):
        api = self.effective_api()
        api.client['redirectUris'] = [repair.APP]
        self.apply(api)
        self.assertEqual([(path, method) for path, method, _ in api.writes], [('/clients/target-client', 'PUT')])

    def test_effective_comparison_still_rejects_changed_missing_or_extra_claim_settings(self):
        cases = [
            ('included.custom.audience', 'wrong-audience'),
            ('access.token.claim', 'false'), ('id.token.claim', 'true'),
            ('introspection.token.claim', 'false'), ('userinfo.token.claim', 'true'),
            ('access.token.claim', True), ('id.token.claim', False),
            ('introspection.token.claim', None), ('userinfo.token.claim', None),
            ('included.client.audience', 'security-api'), ('included.client.audience', ''),
            ('lightweight.claim', 'true'),
        ]
        for key, value in cases:
            with self.subTest(key=key, value=value):
                api = self.effective_api()
                api.mappers[0]['config'][key] = value
                self.assertIn('audience_mapper', repair.issues(repair.collect(api)))
        for key in repair.MAPPER['config']:
            with self.subTest(missing=key):
                api = self.effective_api()
                del api.mappers[0]['config'][key]
                self.assertIn('audience_mapper', repair.issues(repair.collect(api)))

    def test_post_write_verification_still_fails_if_server_keeps_wrong_mapper(self):
        api = self.effective_api()
        api.mappers = []
        original = api._send
        def wrong_after_write(full, method='GET', data=None, form=False):
            result = original(full, method, data, form)
            if method == 'POST' and full.endswith('/protocol-mappers/models'):
                api.mappers[0]['config']['access.token.claim'] = 'false'
            return result
        with patch.object(api, '_send', side_effect=wrong_after_write), self.assertRaisesRegex(repair.RepairError, 'Post-write verification failed'):
            self.apply(api)
        self.assertEqual(len(api.writes), 1)

    def test_mapper_difference_diagnostics_never_echo_unexpected_values(self):
        api = self.effective_api()
        api.mappers[0]['config']['included.custom.audience'] = 'synthetic-private-marker'
        with patch.object(repair, 'check_local_configuration', return_value={}), patch.object(repair, 'Api', return_value=api), contextlib.redirect_stdout(io.StringIO()) as output:
            self.assertEqual(repair.main(['--check']), 2)
        self.assertEqual(json.loads(output.getvalue())['audienceMapperDifferences'], ['config.included.custom.audience'])
        self.assertNotIn('synthetic-private-marker', output.getvalue())


class TokenLifecycleTests(unittest.TestCase):
    def setUp(self):
        self.network = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.now = 100.0
        self.clock = patch.object(repair.time, 'monotonic', side_effect=lambda: self.now)
        self.clock.start()
        self.addCleanup(self.clock.stop)
        self.opener = MagicMock()
        self.builder = patch.object(repair, 'build_opener', return_value=self.opener)
        self.builder.start()
        self.addCleanup(self.builder.stop)
        self.env = {'KEYCLOAK_ADMIN': 'synthetic-user', 'KEYCLOAK_ADMIN_PASSWORD': 'synthetic-password'}

    def response(self, value):
        response = MagicMock()
        response.__enter__.return_value.read.return_value = json.dumps(value).encode()
        return response

    def token(self, number=1, **changes):
        return self.response(dict({'access_token': 'synthetic-access-' + str(number),
            'refresh_token': 'synthetic-refresh-' + str(number), 'expires_in': 60}, **changes))

    def error(self, status):
        return HTTPError('http://localhost:8080/omitted', status, 'omitted', {},
                         io.BytesIO(b'{"error":"synthetic-private-marker"}'))

    def requests(self):
        return [call.args[0] for call in self.opener.open.call_args_list]

    def test_proactive_refresh_and_rotated_refresh_token_before_get_and_write(self):
        self.opener.open.side_effect = [self.token(), self.token(2), self.response([]), self.token(3), self.response(None)]
        api = repair.Api(self.env)
        self.now = 131
        api.request('/client-scopes')
        self.now = 162
        api.request('/clients', 'POST', repair.desired_client())
        requests = self.requests()
        self.assertEqual(parse_qs(requests[1].data.decode())['refresh_token'], ['synthetic-refresh-1'])
        self.assertEqual(parse_qs(requests[3].data.decode())['refresh_token'], ['synthetic-refresh-2'])
        self.assertEqual(requests[4].get_header('Authorization'), 'Bearer synthetic-access-3')
        for index in (0, 1, 3):
            self.assertIsNone(requests[index].get_header('Authorization'))
        for index in (1, 3):
            self.assertNotIn('password', parse_qs(requests[index].data.decode()))

    def test_get_401_refreshes_once_and_retries_with_new_token(self):
        self.opener.open.side_effect = [self.token(), self.error(401), self.token(2), self.response([])]
        api = repair.Api(self.env)
        self.assertEqual(api.request('/client-scopes'), [])
        self.assertEqual(self.opener.open.call_count, 4)
        self.assertEqual(self.requests()[-1].get_header('Authorization'), 'Bearer synthetic-access-2')

    def test_refresh_without_rotation_retains_previous_refresh_token(self):
        self.opener.open.side_effect = [self.token(),
            self.response({'access_token': 'synthetic-new-access', 'expires_in': 60}), self.response([])]
        api = repair.Api(self.env)
        self.now = 131
        api.request('/client-scopes')
        self.assertEqual(api.refresh_token, 'synthetic-refresh-1')
        self.assertEqual(self.requests()[-1].get_header('Authorization'), 'Bearer synthetic-new-access')

    def test_persistent_401_stops_after_one_refresh_without_leaking_secrets(self):
        self.opener.open.side_effect = [self.token(), self.error(401), self.token(2), self.error(401)]
        api = repair.Api(self.env)
        with self.assertRaisesRegex(repair.RepairError, 'after one refresh') as caught:
            api.request('/client-scopes')
        self.assertNotIn('synthetic-', str(caught.exception))
        self.assertEqual(self.opener.open.call_count, 4)

    def test_403_5xx_and_network_failures_are_not_retried(self):
        for failure in (self.error(403), self.error(500), URLError('synthetic-private-marker'), TimeoutError('synthetic-private-marker')):
            with self.subTest(failure=type(failure).__name__):
                self.opener.reset_mock()
                self.opener.open.side_effect = [self.token(), failure]
                api = repair.Api(self.env)
                with self.assertRaises(repair.RepairError) as caught: api.request('/client-scopes')
                self.assertNotIn('synthetic-', str(caught.exception))
                self.assertEqual(self.opener.open.call_count, 2)

    def test_write_401_is_never_replayed(self):
        for method in ('POST', 'PUT'):
            with self.subTest(method=method):
                self.opener.reset_mock()
                self.opener.open.side_effect = [self.token(), self.error(401)]
                api = repair.Api(self.env)
                path, payload = '/clients', repair.desired_client()
                if method == 'PUT':
                    api.target = 'target-client'
                    path, payload = '/clients/target-client', dict(payload, id=api.target)
                with self.assertRaisesRegex(repair.RepairError, 'Write not retried'):
                    api.request(path, method, payload)
                self.assertEqual(self.opener.open.call_count, 2)

    def test_refresh_rejection_never_falls_back_to_password_or_replays_get(self):
        self.opener.open.side_effect = [self.token(), self.error(401), self.error(400)]
        api = repair.Api(self.env)
        with self.assertRaisesRegex(repair.RepairError, 'token: HTTP 400'): api.request('/client-scopes')
        self.assertEqual(self.opener.open.call_count, 3)
        self.assertIsNone(api.token)
        self.assertIsNone(api.refresh_token)

    def test_missing_refresh_token_stops_without_reauthentication(self):
        self.opener.open.side_effect = [self.token(refresh_token=None)]
        api = repair.Api(self.env)
        self.now = 200
        with self.assertRaisesRegex(repair.RepairError, 'refresh token unavailable'): api.request('/client-scopes')
        self.assertEqual(self.opener.open.call_count, 1)

    def test_invalid_or_missing_expiry_metadata_stops_before_admin_calls(self):
        for lifetime in (None, 0, -1, '60', True, float('inf'), float('nan')):
            with self.subTest(lifetime=lifetime):
                self.opener.reset_mock()
                self.opener.open.side_effect = [self.token(expires_in=lifetime)]
                with self.assertRaisesRegex(repair.RepairError, 'invalid token metadata'): repair.Api(self.env)
                self.assertEqual(self.opener.open.call_count, 1)

    def test_token_response_latency_is_counted_and_cannot_cause_refresh_loop(self):
        def delayed(*args, **kwargs):
            self.now += 31
            return self.token()
        self.opener.open.side_effect = delayed
        with self.assertRaisesRegex(repair.RepairError, 'lifetime too short'): repair.Api(self.env)
        self.assertEqual(self.opener.open.call_count, 1)

    def test_forbidden_route_cannot_trigger_auth_refresh(self):
        self.opener.open.side_effect = [self.token()]
        api = repair.Api(self.env)
        self.now = 200
        with self.assertRaisesRegex(repair.RepairError, 'allowlist'): api.request('/users', 'POST', {})
        self.assertEqual(self.opener.open.call_count, 1)

    def test_slow_apply_survives_expiry_and_get_401_after_creation_without_duplicates(self):
        # Exercise the real allowlist, transport and refresh logic against an
        # in-process fake Keycloak. Every round trip advances the clock.
        remote = FakeApi()
        grants, expires_at, access, injected = [], 0, None, False
        def wire(request, **kwargs):
            nonlocal expires_at, access, injected
            path = request.full_url.removeprefix(repair.PUBLIC)
            self.now += 6
            if path == repair.TOKEN_PATH:
                form = parse_qs(request.data.decode())
                grants.append(form['grant_type'][0])
                access = 'synthetic-access-' + str(len(grants))
                expires_at = self.now + 60
                return self.token(len(grants))
            if request.get_header('Authorization') != 'Bearer ' + access or self.now >= expires_at:
                raise self.error(401)
            if remote.client and request.method == 'GET' and not injected:
                injected = True
                raise self.error(401)
            value = remote._send(path, request.method, json.loads(request.data) if request.data else None)
            return self.response(value)
        self.opener.open.side_effect = wire
        api = repair.Api(self.env)
        before = repair.collect(api)
        with contextlib.redirect_stdout(io.StringIO()):
            repair.apply(api, before, lambda state: Path('synthetic-backup.json'))
            repair.apply(api, repair.collect(api), lambda state: self.fail('No backup on rerun'))
        self.assertEqual(repair.issues(repair.collect(api)), [])
        self.assertTrue(injected)
        self.assertEqual(grants.count('password'), 1)
        self.assertGreater(grants.count('refresh_token'), 1)
        self.assertEqual(sum(path == '/clients' and method == 'POST' for path, method, _ in remote.writes), 1)
        self.assertEqual(sum(method == 'POST' and path.endswith('/protocol-mappers/models') for path, method, _ in remote.writes), 1)
        self.assertEqual(len(remote.mappers), 1)


class DiagnosticTests(unittest.TestCase):
    def setUp(self):
        self.network = patch('urllib.request.OpenerDirector.open', side_effect=AssertionError('Network forbidden'))
        self.network.start()
        self.addCleanup(self.network.stop)

    def error(self, body, status=400):
        raw = body if isinstance(body, bytes) else json.dumps(body).encode()
        return HTTPError('http://localhost:8080/omitted', status, 'omitted', {}, io.BytesIO(raw))

    def test_admin_token_error_identifies_stage_without_exposing_credentials(self):
        opener = MagicMock()
        opener.open.side_effect = self.error({'error': 'invalid_grant', 'error_description': 'Invalid user credentials',
                                             'access_token': 'synthetic-response-marker'})
        env = {'KEYCLOAK_ADMIN': 'synthetic-user', 'KEYCLOAK_ADMIN_PASSWORD': 'synthetic-request-marker'}
        with patch.object(repair, 'build_opener', return_value=opener), self.assertRaises(repair.RepairError) as caught:
            repair.Api(env)
        message = str(caught.exception)
        self.assertIn('POST /realms/master/protocol/openid-connect/token: HTTP 400', message)
        self.assertIn('error=invalid_grant; reason=invalid_user_credentials', message)
        self.assertNotIn('synthetic-response-marker', message)
        self.assertNotIn('synthetic-request-marker', message)
        self.assertNotIn('synthetic-user', message)
        self.assertEqual(opener.open.call_count, 1)
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, 'http://localhost:8080/realms/master/protocol/openid-connect/token')
        self.assertEqual(request.get_header('Content-type'), 'application/x-www-form-urlencoded')
        form = parse_qs(request.data.decode())
        self.assertEqual(form['grant_type'], ['password'])
        self.assertEqual(form['client_id'], ['admin-cli'])

    def test_common_admin_token_uses_same_authentication_and_safe_error(self):
        opener = MagicMock()
        opener.open.side_effect = self.error({'error': 'invalid_grant', 'error_description': 'Account is not fully set up'})
        env = {'KEYCLOAK_ADMIN': 'synthetic-user', 'KEYCLOAK_ADMIN_PASSWORD': 'synthetic-request-marker'}
        with patch.object(common, 'read_env', return_value=env), patch.object(common, 'LOCAL_HTTP', opener), self.assertRaises(common.KeycloakHTTPError) as caught:
            common.admin_token()
        error = caught.exception
        self.assertEqual(error.endpoint, '/realms/master/protocol/openid-connect/token')
        self.assertEqual(error.status, 400)
        self.assertEqual(error.reason_code, 'account_not_fully_set_up')
        self.assertNotIn('synthetic-request-marker', str(error))
        request = opener.open.call_args.args[0]
        self.assertEqual(request.full_url, common.BASE + error.endpoint)
        self.assertEqual(parse_qs(request.data.decode())['client_id'], ['admin-cli'])

    def test_admin_client_scope_error_is_distinguished_from_token_endpoint(self):
        api = object.__new__(repair.Api)
        api.opener, api.token, api.target, api.scope_ids = MagicMock(), None, None, set()
        api.read_scope_ids, api.refresh_at = set(), float('inf')
        api.opener.open.side_effect = self.error({'error': 'invalid_request'})
        with self.assertRaises(repair.RepairError) as caught:
            api.request('/client-scopes')
        self.assertIn('GET /admin/realms/company-iam/client-scopes: HTTP 400', str(caught.exception))
        self.assertNotIn('/realms/master/', str(caught.exception))

    def test_arbitrary_error_and_description_are_not_echoed(self):
        for body in [{'error': 'synthetic-private-marker', 'error_description': 'synthetic-private-marker'},
                     {'error': {'nested': 'synthetic-private-marker'}, 'error_description': ['synthetic-private-marker']}]:
            error = common.safe_http_error(self.error(body), 'POST', '/realms/master/protocol/openid-connect/token')
            self.assertEqual(error.error_code, 'unclassified')
            self.assertEqual(error.reason_code, 'unclassified')
            self.assertNotIn('synthetic-private-marker', str(error))

    def test_raw_html_malformed_and_oversized_bodies_are_not_echoed(self):
        for raw in [b'<html>synthetic-private-marker</html>', b'{', b'x' * 8193]:
            error = common.safe_http_error(self.error(raw, 502), 'GET', '/admin/realms/company-iam/client-scopes')
            self.assertEqual(error.status, 502)
            self.assertEqual(error.error_code, 'unclassified')
            self.assertNotIn('synthetic-private-marker', str(error))

    def test_error_route_hides_query_fragment_and_variable_segments(self):
        error = common.safe_http_error(self.error({'error': 'invalid_request'}), 'GET',
            '/admin/realms/company-iam/clients/synthetic-private-marker?token=synthetic-query-marker#synthetic-fragment')
        self.assertEqual(error.endpoint, '/admin/realms/company-iam/clients/<id>')
        self.assertNotIn('synthetic-', str(error))
        self.assertEqual(common.relative_endpoint('http://user:synthetic-marker@example.test/token'), '<invalid-relative-endpoint>')

    def test_check_token_failure_never_reaches_collect_or_apply(self):
        opener = MagicMock()
        opener.open.side_effect = self.error({'error': 'invalid_grant', 'error_description': 'Invalid user credentials'})
        env = {'KEYCLOAK_ADMIN': 'synthetic-user', 'KEYCLOAK_ADMIN_PASSWORD': 'synthetic-request-marker'}
        with patch.object(repair, 'check_local_configuration', return_value=env), patch.object(repair, 'build_opener', return_value=opener), patch.object(repair, 'collect') as collect, patch.object(repair, 'apply') as apply, contextlib.redirect_stderr(io.StringIO()) as output:
            self.assertEqual(repair.main(['--check']), 1)
        collect.assert_not_called()
        apply.assert_not_called()
        self.assertIn('reason=invalid_user_credentials', output.getvalue())
        self.assertEqual(opener.open.call_count, 1)

    def test_description_requires_exact_allowlisted_match(self):
        error = common.safe_http_error(self.error({'error': 'invalid_grant',
            'error_description': 'Invalid user credentials: synthetic-private-marker'}), 'POST',
            '/realms/master/protocol/openid-connect/token')
        self.assertEqual(error.error_code, 'invalid_grant')
        self.assertEqual(error.reason_code, 'unclassified')
        self.assertNotIn('synthetic-private-marker', str(error))


if __name__ == '__main__':
    unittest.main()
