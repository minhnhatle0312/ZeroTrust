"""Local lab helpers. Never print passwords or tokens."""
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8080"
LOCAL_HTTP = build_opener(ProxyHandler({}))

# Never return free-form response text, even if it looks like an OAuth error.
OAUTH_ERRORS = frozenset({'invalid_request', 'invalid_client', 'invalid_grant',
    'unauthorized_client', 'unsupported_grant_type', 'invalid_scope', 'access_denied',
    'server_error', 'temporarily_unavailable'})
OAUTH_REASONS = {
    'Account is not fully set up': 'account_not_fully_set_up',
    'Invalid user credentials': 'invalid_user_credentials',
    'Account temporarily disabled': 'account_temporarily_disabled',
    'Account disabled': 'account_disabled',
    'Client not allowed for direct access grants': 'direct_access_grants_disabled',
    'Invalid client credentials': 'invalid_client_credentials',
    'Missing form parameter: grant_type': 'missing_grant_type',
}


def relative_endpoint(path):
    """Keep known route words; omit queries/fragments and mask variable segments."""
    try:
        parsed = urlsplit(path)
        if parsed.scheme or parsed.netloc or not parsed.path.startswith('/'):
            return '<invalid-relative-endpoint>'
        words = {'admin', 'realms', 'master', 'company-iam', 'protocol', 'openid-connect',
                 'token', 'clients', 'client-scopes', 'default-client-scopes',
                 'optional-client-scopes', 'protocol-mappers', 'models', 'users',
                 'roles', 'role-mappings', 'sessions', 'logout', 'events'}
        return '/'.join(part if part in words or not part else '<id>' for part in parsed.path.split('/'))
    except (TypeError, ValueError):
        return '<invalid-relative-endpoint>'


class KeycloakHTTPError(RuntimeError):
    """Structured, allowlisted metadata only; no response body/URL/credential."""
    def __init__(self, method, path, status, error_code, reason_code):
        self.endpoint = relative_endpoint(path)
        self.status = status
        self.error_code = error_code
        self.reason_code = reason_code
        verb = method if method in {'GET', 'POST', 'PUT', 'PATCH', 'DELETE'} else 'REQUEST'
        super().__init__(f'Keycloak {verb} {self.endpoint}: HTTP {status}; '
                         f'error={error_code}; reason={reason_code}; response omitted.')


def safe_http_error(error, method, path):
    error_code, reason_code = 'unclassified', 'unclassified'
    try:
        raw = error.read(8193)
        data = json.loads(raw) if len(raw) <= 8192 else None
        if isinstance(data, dict):
            value = data.get('error')
            if isinstance(value, str) and value in OAUTH_ERRORS:
                error_code = value
            description = data.get('error_description')
            if isinstance(description, str):
                reason_code = OAUTH_REASONS.get(description, 'unclassified')
    except Exception:
        pass  # Error parsing must never expose raw payloads or change safety.
    finally:
        try:
            error.close()
        except Exception:
            pass
    return KeycloakHTTPError(method, path, error.code, error_code, reason_code)


def read_env(path=None):
    values = {}
    for line in (path or ROOT / ".env").read_text(encoding="utf-8-sig").splitlines():
        if line.strip() and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            values[key.strip()] = value.strip().strip("\"'")
    return values


def request(path, method="GET", data=None, token=None, form=False):
    headers = {}
    if token:
        headers["Authorization"] = "Bearer " + token
    body = None
    if data is not None:
        body = (urlencode(data) if form else json.dumps(data)).encode()
        headers["Content-Type"] = "application/x-www-form-urlencoded" if form else "application/json"
    try:
        with LOCAL_HTTP.open(Request(BASE + path, data=body, headers=headers, method=method), timeout=20) as response:
            raw = response.read()
            return json.loads(raw) if raw else None
    except HTTPError as error:
        raise safe_http_error(error, method, path) from None


def admin_token():
    env = read_env()
    return request("/realms/master/protocol/openid-connect/token", "POST", {
        "grant_type": "password", "client_id": "admin-cli",
        "username": env["KEYCLOAK_ADMIN"], "password": env["KEYCLOAK_ADMIN_PASSWORD"],
    }, form=True)["access_token"]
