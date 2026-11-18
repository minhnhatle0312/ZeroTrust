"""Prepare a canonical HTTPS LAN/VPN URL, certificates and application settings."""
import argparse
import ipaddress
import json
import re
import shutil
import subprocess
from pathlib import Path
from common import ROOT, read_env


def write_env(path, updates):
    values = path.read_text(encoding='utf-8-sig').splitlines() if path.exists() else []
    values = [line for line in values if line.partition('=')[0] not in updates]
    values.extend(f'{key}={value}' for key, value in updates.items())
    path.write_text('\n'.join(values) + '\n', encoding='utf-8')


def configure(host=None, port=8443, local=False):
    if not local:
        if not host or not (re.fullmatch(r'[a-zA-Z0-9][a-zA-Z0-9.-]*', host)):
            raise SystemExit('Use --host with the server LAN IPv4 address or a resolvable VPN/DNS hostname.')
        if not 1024 <= port <= 65535:
            raise SystemExit('Port must be between 1024 and 65535.')
    public = 'http://localhost:8080' if local else f'https://{host}:{port}'
    origin_a = 'http://localhost:5173' if local else public
    origin_b = 'http://localhost:5174' if local else public
    url_a = origin_a + '/' if local else public + '/a/'
    url_b = origin_b + '/' if local else public + '/b/'
    if not local:
        directory = ROOT / 'network/.local'
        directory.mkdir(parents=True, exist_ok=True)
        openssl = shutil.which('openssl') or next((str(p) for p in [Path('C:/Program Files/Git/usr/bin/openssl.exe')] if p.exists()), None)
        if not openssl:
            raise SystemExit('Install OpenSSL (included in Git for Windows) before preparing HTTPS.')

        def run(*args):
            result = subprocess.run([openssl, *args], cwd=directory, capture_output=True)
            if result.returncode:
                raise SystemExit('OpenSSL could not generate the lab certificates. Existing application secrets were not changed.')

        if not (directory / 'ca.crt').exists():
            run('req', '-x509', '-newkey', 'rsa:3072', '-sha256', '-nodes', '-days', '365',
                '-keyout', 'ca.key', '-out', 'ca.crt', '-subj', '/CN=Nhip IAM Lab CA',
                '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
                '-addext', 'keyUsage=critical,keyCertSign,cRLSign')
        try:
            ipaddress.ip_address(host)
            san = 'IP:' + host
        except ValueError:
            san = 'DNS:' + host
        (directory / 'server.ext').write_text('subjectAltName=' + san + '\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n', encoding='ascii')
        run('req', '-new', '-newkey', 'rsa:2048', '-nodes', '-keyout', 'server.key', '-out', 'server.csr', '-subj', '/CN=' + host)
        run('x509', '-req', '-in', 'server.csr', '-CA', 'ca.crt', '-CAkey', 'ca.key', '-CAcreateserial', '-out', 'server.crt', '-days', '90', '-sha256', '-extfile', 'server.ext')
        (directory / 'config.json').write_text(json.dumps({'publicUrl': public, 'host': '0.0.0.0', 'port': port}, indent=2) + '\n')
    write_env(ROOT / '.env', {'KEYCLOAK_PUBLIC_URL': public})
    write_env(ROOT / 'backend/.env', {'KEYCLOAK_ISSUER': public + '/realms/company-iam',
              'KEYCLOAK_INTERNAL_ISSUER': 'http://127.0.0.1:8080/realms/company-iam',
              'API_AUDIENCE': 'employee-api', 'SECURITY_API_AUDIENCE': 'security-api',
              'FRONTEND_ORIGIN': origin_a, 'SECURITY_FRONTEND_ORIGIN': origin_b})
    for app, client in [('web-a', 'employee-portal'), ('web-b', 'security-dashboard')]:
        write_env(ROOT / app / '.env.local', {'VITE_KEYCLOAK_URL': public,
                  'VITE_KEYCLOAK_REALM': 'company-iam', 'VITE_KEYCLOAK_CLIENT_ID': client,
                  'VITE_API_URL': 'http://localhost:3001' if local else public,
                  'VITE_SECURITY_URL': url_b, 'VITE_PORTAL_URL': url_a})
    print('Configuration ready. Start with: python scripts/run_week3.py' + ('' if local else ' --network'))
    print('Web A:', url_a)
    print('Web B:', url_b)
    if not local:
        print('Import network/.local/ca.crt on each demo device before signing in. Never share *.key.')
        print('Only TCP', port, 'must be reachable over the private LAN/VPN.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--host')
    parser.add_argument('--port', type=int, default=8443)
    parser.add_argument('--local', action='store_true')
    args = parser.parse_args()
    configure(args.host, args.port, args.local)
