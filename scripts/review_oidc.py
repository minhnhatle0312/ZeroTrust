"""Read-only OIDC checks. Never authenticates users or writes Keycloak settings."""
import argparse
import json
import ssl
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]


def review_client(client, app_url, audience):
    """Pure review of a supplied representation; no credentials are returned."""
    origin = '{0.scheme}://{0.netloc}'.format(urlsplit(app_url))
    redirects = client.get('redirectUris', [])
    mappers = client.get('protocolMappers', [])
    return {
        'publicClient': client.get('publicClient') is True,
        'codeFlowOnly': client.get('standardFlowEnabled') is True
            and client.get('implicitFlowEnabled') is False
            and client.get('directAccessGrantsEnabled') is False,
        'noServiceAccountInSPA': client.get('serviceAccountsEnabled') is False,
        'pkceS256': client.get('attributes', {}).get('pkce.code.challenge.method') == 'S256',
        'redirectsConfinedToApp': bool(redirects) and all(
            value in {app_url, app_url + '*', app_url.rstrip('/')} for value in redirects),
        'exactOrigins': client.get('webOrigins') == [origin],
        'scopedRedirectWildcardNeedsReview': any('*' in value for value in redirects),
        'accessTokenAudience': any(m.get('protocolMapper') == 'oidc-audience-mapper'
            and m.get('config', {}).get('included.custom.audience') == audience
            and m.get('config', {}).get('access.token.claim') == 'true'
            and m.get('config', {}).get('id.token.claim') == 'false' for m in mappers),
    }


def review_discovery(data, expected_issuer):
    origin = urlsplit(expected_issuer).netloc
    return {
        'issuerMatches': data.get('issuer') == expected_issuer,
        'codeResponseSupported': 'code' in data.get('response_types_supported', []),
        's256Supported': 'S256' in data.get('code_challenge_methods_supported', []),
        'rs256Advertised': 'RS256' in data.get('id_token_signing_alg_values_supported', []),
        'endpointsStayOnIssuerOrigin': all(
            isinstance(data.get(key), str) and urlsplit(data[key]).netloc == origin
            and urlsplit(data[key]).scheme == urlsplit(expected_issuer).scheme
            for key in ['authorization_endpoint', 'token_endpoint', 'jwks_uri', 'end_session_endpoint']),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--probe-public', action='store_true', help='GET discovery/health with TLS verification, no login')
    args = parser.parse_args()
    initial = json.loads((ROOT / 'keycloak/lab-config.json').read_text(encoding='utf-8-sig'))
    # Initial JSON stores its mapper separately; explicitly evaluate that representation.
    checks = review_client({**initial['client'], 'protocolMappers': [initial['audienceMapper']]},
                           'http://localhost:5173/', 'employee-api')
    result = {'mode':'read-only', 'scope':'initial source JSON, not live clients',
              'initialWebA':checks, 'liveClients':'NOT_VERIFIED', 'liveServiceAccount':'NOT_VERIFIED',
              'liveMfaSso':'NOT_VERIFIED', 'productionConfigurationApplied':False}
    if args.probe_public:
        config = json.loads((ROOT / 'network/.local/config.json').read_text(encoding='utf-8-sig'))
        public = config['publicUrl'].rstrip('/')
        if urlsplit(public).scheme != 'https':
            raise ValueError('Public probe requires HTTPS; no insecure fallback')
        context = ssl.create_default_context(cafile=str(ROOT / 'network/.local/ca.crt'))
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}), urllib.request.HTTPSHandler(context=context))
        expected = public + '/realms/company-iam'
        outcomes = {}
        for label, route in [('discovery','/realms/company-iam/.well-known/openid-configuration'),('health','/health'),('ready','/ready')]:
            try:
                request = urllib.request.Request(public + route, headers={'Accept':'application/json'})
                with opener.open(request, timeout=4) as response:
                    body = json.load(response)
                    outcomes[label] = {'reachable':True,'tlsVerified':True,'httpStatus':response.status}
                    if label == 'discovery':
                        outcomes[label]['checks'] = review_discovery(body, expected)
            except Exception as error:
                # Never echo response bodies, URLs, credentials, or raw exceptions.
                outcomes[label] = {'reachable':False,'tlsVerified':False,'failureType':type(error).__name__}
        result['publicProbe'] = outcomes
    target = ROOT / '.runtime/phase2-tests/oidc-review.json'
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
