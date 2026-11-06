"""Configure separate public OIDC clients for Web A and B; preserve demo data."""
import json
from urllib.parse import quote
from common import ROOT, admin_token, read_env, request
import setup_week2


def configure():
    env = read_env()
    public = env.get('KEYCLOAK_PUBLIC_URL', 'http://localhost:8080').rstrip('/')
    network = public.startswith('https://')
    portals = [('employee-portal', public + '/a/' if network else 'http://localhost:5173/', 'employee-api'),
               ('security-dashboard', public + '/b/' if network else 'http://localhost:5174/', 'security-api')]
    token = admin_token()
    base = '/admin/realms/company-iam'

    def api(path, method='GET', data=None):
        return request(base + path, method, data, token)

    for client_id, app_url, audience in portals:
        from urllib.parse import urlsplit
        parsed = urlsplit(app_url)
        origin = parsed.scheme + '://' + parsed.netloc
        desired = {'clientId': client_id, 'name': 'Nhịp ' + ('Workspace' if client_id == 'employee-portal' else 'Security'),
                   'protocol': 'openid-connect', 'enabled': True, 'publicClient': True,
                   'standardFlowEnabled': True, 'directAccessGrantsEnabled': False,
                   'implicitFlowEnabled': False, 'serviceAccountsEnabled': False,
                   'fullScopeAllowed': True, 'rootUrl': app_url, 'baseUrl': app_url,
                   'redirectUris': [app_url, app_url + '*'], 'webOrigins': [origin],
                   'attributes': {'pkce.code.challenge.method': 'S256',
                                  'post.logout.redirect.uris': app_url},
                   'defaultClientScopes': ['basic', 'web-origins', 'acr', 'profile', 'roles', 'email']}
        clients = api('/clients?clientId=' + quote(client_id))
        if not clients:
            api('/clients', 'POST', desired)
            clients = api('/clients?clientId=' + quote(client_id))
        client = clients[0]
        path = '/clients/' + client['id']
        merged = {**client, **desired, 'attributes': {**client.get('attributes', {}), **desired['attributes']}}
        merged.pop('protocolMappers', None)
        api(path, 'PUT', merged)
        # Keycloak 26 maps sub/auth_time through the basic scope. Updating the
        # client representation alone does not reliably reconcile assigned scopes.
        available = {s['name']: s['id'] for s in api('/client-scopes')}
        assigned = {s['name'] for s in api(path + '/default-client-scopes')}
        for name in desired['defaultClientScopes']:
            if name not in available:
                raise RuntimeError('Missing built-in client scope: ' + name)
            if name not in assigned:
                api(path + '/default-client-scopes/' + available[name], 'PUT')
        mapper = {'name': ('employee-api-audience' if client_id == 'employee-portal' else 'security-api-audience'),
                  'protocol': 'openid-connect', 'protocolMapper': 'oidc-audience-mapper',
                  'consentRequired': False, 'config': {'included.custom.audience': audience,
                  'access.token.claim': 'true', 'id.token.claim': 'false'}}
        existing = next((m for m in api(path + '/protocol-mappers/models') if m['name'] == mapper['name']), None)
        if existing:
            api(path + '/protocol-mappers/models/' + existing['id'], 'PUT', {**mapper, 'id': existing['id']})
        else:
            api(path + '/protocol-mappers/models', 'POST', mapper)
        print('Ready:', client_id, '->', app_url, '/', audience, '/ PKCE S256')
    print('Web B authorization is enforced by backend: admin/auditor only.')


if __name__ == '__main__':
    setup_week2.main()
    configure()
