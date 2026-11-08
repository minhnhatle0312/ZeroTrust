"""Read-only HTTP security probes. Requires explicit lab URL and scoped test tokens in environment."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlsplit
from urllib.request import Request, build_opener, ProxyHandler, HTTPSHandler, HTTPRedirectHandler
import ssl


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None  # Never forward scoped bearer credentials to a redirect target.


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True)
    parser.add_argument('--ca', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    endpoint = urlsplit(args.base)
    if endpoint.scheme not in {'http','https'} or endpoint.username or endpoint.password or endpoint.query or endpoint.fragment:
        raise ValueError('Explicit lab API origin required')
    if endpoint.scheme == 'http' and endpoint.hostname not in {'localhost','127.0.0.1','::1'}:
        raise ValueError('Use HTTPS and a trusted CA for a remote lab')
    context = ssl.create_default_context(cafile=str(args.ca) if args.ca else None)
    http = build_opener(ProxyHandler({}), HTTPSHandler(context=context), NoRedirect())
    cases = [('anonymous_profile','/api/profile',None,401), ('malformed_token','/api/profile','not-a-jwt',401),
             ('employee_admin','/api/admin',os.getenv('TEST_EMPLOYEE_TOKEN'),403),
             ('employee_audit','/api/security/central/events',os.getenv('TEST_EMPLOYEE_TOKEN'),403),
             ('auditor_admin','/api/admin',os.getenv('TEST_AUDITOR_TOKEN'),403)]
    rows = []
    for name, path, token, expected in cases:
        if name not in {'anonymous_profile','malformed_token'} and not token:
            rows.append({'case':name,'status':'SKIPPED','reason':'Missing scoped test token'})
            continue
        request = Request(args.base.rstrip('/') + path, headers={'Authorization':'Bearer '+token} if token else {})
        try:
            response = http.open(request, timeout=15)
        except HTTPError as error:
            response = error
        with response:
            status, headers = response.status, response.headers
            response.read(4096)  # Never save bodies or credentials in this probe output.
        passed = status == expected and bool(headers.get('X-Request-Id')) and headers.get('Cache-Control') == 'no-store'
        rows.append({'case':name,'status':'PASS' if passed else 'FAIL','expected':expected,'actual':status,'request_id':headers.get('X-Request-Id')})
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with args.output.open('x', encoding='utf-8') as stream:
        json.dump({'time':datetime.now(timezone.utc).isoformat(),'scope':'read-only probes; not full security acceptance','cases':rows}, stream, indent=2)
    if any(r['status'] != 'PASS' for r in rows):
        raise SystemExit(1)


if __name__ == '__main__':
    main()
