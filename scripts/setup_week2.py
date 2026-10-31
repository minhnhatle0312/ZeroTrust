"""Provision local attendance identities, server-side control client and hardening."""
import json
from urllib.parse import quote
import init_env
import setup_keycloak
from common import ROOT, admin_token, request


def main():
    setup_keycloak.main()
    token = admin_token()
    base = '/admin/realms/company-iam'
    def api(p, method='GET', data=None):
        return request(base + p, method, data, token)
    api('', 'PUT', {'bruteForceProtected': True, 'permanentLockout': False,
                    'failureFactor': 5, 'waitIncrementSeconds': 60, 'maxFailureWaitSeconds': 900,
                    'accessTokenLifespan': 300, 'registrationAllowed': False,
                    'passwordPolicy': 'length(12) and digits(1) and upperCase(1) and lowerCase(1)'})
    # Limit service-account privilege to the application realm. Never use master credentials in the API.
    spec = {'clientId': 'attendance-control', 'protocol': 'openid-connect', 'enabled': True,
            'publicClient': False, 'standardFlowEnabled': False, 'directAccessGrantsEnabled': False,
            'serviceAccountsEnabled': True, 'fullScopeAllowed': True}
    clients = api('/clients?clientId=attendance-control')
    if not clients:
        api('/clients', 'POST', spec)
        clients = api('/clients?clientId=attendance-control')
    client_id = clients[0]['id']
    api('/clients/' + client_id, 'PUT', {**clients[0], **spec})
    service_user = api('/clients/' + client_id + '/service-account-user')
    management = api('/clients?clientId=realm-management')[0]
    assigned = api('/users/' + service_user['id'] + '/role-mappings/clients/' + management['id'])
    needed = []
    for role in ('manage-users', 'view-users', 'view-realm', 'view-events'):
        if role not in [r['name'] for r in assigned]:
            needed.append(api('/clients/' + management['id'] + '/roles/' + role))
    if needed:
        api('/users/' + service_user['id'] + '/role-mappings/clients/' + management['id'], 'POST', needed)
    secret = api('/clients/' + client_id + '/client-secret')['value']
    config_path = ROOT / 'backend/.env'
    lines = config_path.read_text(encoding='utf-8-sig').splitlines()
    prefixes = ('KEYCLOAK_ADMIN_CLIENT_ID=', 'KEYCLOAK_ADMIN_CLIENT_SECRET=')
    lines = [line for line in lines if not line.startswith(prefixes)]
    lines += ['KEYCLOAK_ADMIN_CLIENT_ID=attendance-control', 'KEYCLOAK_ADMIN_CLIENT_SECRET=' + secret]
    config_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')
    staff = []
    config = json.loads((ROOT / 'keycloak/lab-config.json').read_text(encoding='utf-8'))
    for u in config['users']:
        existing = api('/users?exact=true&username=' + quote(u['username']))[0]
        staff.append({**u, 'id': existing['id']})
    destination = ROOT / 'backend/data/staff.json'
    destination.parent.mkdir(exist_ok=True)
    destination.write_text(json.dumps(staff, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Week 2 ready: 6 employees / 2 managed teams / brute-force protection / 5-minute tokens.')
    print('Server credential saved in backend/.env (not printed). Restart the backend to load staff.')


if __name__ == '__main__':
    main()
