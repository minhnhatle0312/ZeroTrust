"""Local lab helpers. Never print passwords or tokens."""
import json
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, build_opener, ProxyHandler

ROOT = Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:8080"
LOCAL_HTTP = build_opener(ProxyHandler({}))


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
        # Do not echo server error bodies: they can contain submitted credentials.
        raise RuntimeError(f"Keycloak {method} {path}: HTTP {error.code}") from None


def admin_token():
    env = read_env()
    return request("/realms/master/protocol/openid-connect/token", "POST", {
        "grant_type": "password", "client_id": "admin-cli",
        "username": env["KEYCLOAK_ADMIN"], "password": env["KEYCLOAK_ADMIN_PASSWORD"],
    }, form=True)["access_token"]
