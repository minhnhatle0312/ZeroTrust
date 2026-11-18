"""Exercise real Keycloak browser login and API RBAC; save sanitized evidence."""
import json
import os
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / ".tools"), str(ROOT / "scripts")]
from common import admin_token, read_env, request
from playwright.sync_api import sync_playwright, expect

OUT = ROOT / "evidence" / "week1"
OUT.mkdir(parents=True, exist_ok=True)
ENV = read_env()
report = {"startedAt": datetime.now(timezone.utc).isoformat(), "checks": [], "screenshots": []}


def check(name, actual, expected):
    passed = actual == expected
    report["checks"].append({"name": name, "actual": actual, "expected": expected, "passed": passed})
    print(("PASS " if passed else "FAIL ") + name, flush=True)
    if not passed:
        raise AssertionError(name)


def screenshot(page, name):
    page.screenshot(path=str(OUT / name), full_page=True)
    report["screenshots"].append(name)


def capture_docker():
    commands = {
        "docker-ps.txt": ["docker", "compose", "ps"],
        "docker-images.txt": ["docker", "compose", "images"],
        "postgres-ready.txt": ["docker", "compose", "exec", "-T", "postgres", "sh", "-c", 'pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"'],
    }
    for filename, command in commands.items():
        result = subprocess.run(command, cwd=ROOT, capture_output=True, text=True, encoding="utf-8", errors="replace")
        (OUT / filename).write_text("Captured: " + report["startedAt"] + "\n$ " + " ".join(command) + "\n" + result.stdout + result.stderr, encoding="utf-8")
        check(filename, result.returncode, 0)


def main():
    capture_docker()
    with sync_playwright() as p:
        # Use the installed Chrome/Edge; no extra browser download is needed.
        browser = p.chromium.launch(channel=os.getenv("TEST_BROWSER_CHANNEL", "chrome"), headless=True,
                                    args=["--no-proxy-server"])
        try:
            context = browser.new_context(viewport={"width": 1440, "height": 1050}, locale="en-US")
            check("API health", context.request.get("http://127.0.0.1:3001/health").status, 200)
            missing = context.request.get("http://127.0.0.1:3001/api/profile")
            check("Missing token returns 401", missing.status, 401)
            invalid = context.request.get("http://127.0.0.1:3001/api/admin", headers={"Authorization": "Bearer invalid-token"})
            check("Malformed token returns 401", invalid.status, 401)
            (OUT / "unauthenticated.json").write_text(json.dumps({"missingToken": missing.json(), "invalidToken": invalid.json()}, indent=2), encoding="utf-8")
            context.close()
            matrix = {"employee01": [200, 403, 403, 403], "manager01": [200, 200, 403, 403],
                      "auditor01": [200, 403, 403, 200], "admin01": [200, 200, 200, 200]}
            paths = ["profile", "manager", "admin", "audit"]
            for username, expected in matrix.items():
                context = browser.new_context(viewport={"width": 1440, "height": 1050}, locale="en-US")
                page = context.new_page()
                page.set_default_timeout(30000)
                page.goto("http://localhost:5173")
                expect(page.locator("#username")).to_be_visible()
                if username == "employee01":
                    screenshot(page, "01-keycloak-login.png")
                page.locator("#username").fill(username)
                page.locator("#password").fill(ENV["TEST_" + username.upper() + "_PASSWORD"])
                page.locator("#kc-login").click()
                expect(page.locator(".topbar-name")).to_have_text(username)
                check(username + " browser login", page.locator(".topbar-name").inner_text(), username)
                for i, resource in enumerate(paths):
                    with page.expect_response(lambda r: r.url == "http://localhost:3001/api/" + resource) as response:
                        page.locator(".resource-card").nth(i).click()
                    check(username + " /api/" + resource, response.value.status, expected[i])
                    expect(page.locator(".response-status")).to_contain_text("HTTP " + str(expected[i]))
                    if (username, resource) in [("employee01", "profile"), ("employee01", "admin"),
                                               ("manager01", "manager"), ("auditor01", "audit"), ("admin01", "admin")]:
                        if resource == "audit":
                            # Keep the screenshot readable; API's complete result stays in the JSON evidence.
                            page.locator(".response-output pre").evaluate("el => { el.style.maxHeight='520px'; el.style.overflow='auto'; }")
                        screenshot(page, username + "-" + resource + ".png")
                    if username == "auditor01" and resource == "audit":
                        audit = response.value.json()
                        check("Audit contains DENY events", any(e["decision"] == "DENY" for e in audit["events"]), True)
                        check("Audit contains ALLOW events", any(e["decision"] == "ALLOW" for e in audit["events"]), True)
                        (OUT / "audit-sample.json").write_text(json.dumps(audit, ensure_ascii=False, indent=2), encoding="utf-8")
                # Use the already authenticated browser's in-memory token. Never save it.
                validations = page.evaluate("""async () => {
                    const { default: kc } = await import('/src/keycloak.js');
                    const pieces = kc.token.split('.');
                    pieces[2] = (pieces[2][0] === 'a' ? 'b' : 'a') + pieces[2].slice(1);
                    const tampered = await fetch('http://localhost:3001/api/profile', {headers: {Authorization: 'Bearer ' + pieces.join('.')}});
                    const r = await fetch('http://localhost:3001/api/audit?limit=invalid', {headers: {Authorization: 'Bearer ' + kc.token}});
                    return {tamperedStatus: tampered.status, limitStatus: r.status,
                            audience: kc.tokenParsed.aud, issuer: kc.tokenParsed.iss};
                }""")
                check(username + " tampered signature denied", validations["tamperedStatus"], 401)
                check(username + " invalid audit limit", validations["limitStatus"], 400 if username in ("auditor01", "admin01") else 403)
                aud = validations["audience"]
                check(username + " audience", "employee-api" in (aud if isinstance(aud, list) else [aud]), True)
                check(username + " issuer", validations["issuer"], "http://localhost:8080/realms/company-iam")
                page.get_by_role("button", name="Đăng xuất", exact=True).click()
                expect(page.locator("#username")).to_be_visible()
                check(username + " logout", "/protocol/openid-connect/auth" in page.url, True)
                context.close()

            # Take real Keycloak Admin Console screenshots after logging in as the bootstrap admin.
            context = browser.new_context(viewport={"width": 1440, "height": 1050}, locale="en-US")
            page = context.new_page()
            page.goto("http://localhost:8080/admin/master/console/#/company-iam/realm-settings")
            page.locator("#username").fill(ENV["KEYCLOAK_ADMIN"])
            page.locator("#password").fill(ENV["KEYCLOAK_ADMIN_PASSWORD"])
            page.locator("#kc-login").click()
            expect(page.get_by_role("textbox").first).to_have_value("company-iam", timeout=30000)
            screenshot(page, "keycloak-realm.png")
            for route, title, filename in [("roles", "Realm roles", "keycloak-roles.png"),
                                           ("clients", "Clients", "keycloak-clients.png"),
                                           ("events", "Events", "keycloak-events.png")]:
                page.goto("http://localhost:8080/admin/master/console/#/company-iam/" + route)
                expect(page.get_by_role("heading", name=title, exact=True)).to_be_visible()
                expect(page.locator("tbody tr").first).to_be_visible()
                screenshot(page, filename)
            context.close()
        finally:
            browser.close()
    token = admin_token()
    events = request("/admin/realms/company-iam/events?max=20", token=token)
    safe_events = [{k: e.get(k) for k in ("time", "type", "clientId", "userId", "error")} for e in events]
    (OUT / "keycloak-events.json").write_text(json.dumps(safe_events, indent=2), encoding="utf-8")
    check("Keycloak records LOGIN", any(e["type"] == "LOGIN" for e in events), True)
    audit_text = (ROOT / "backend/data/audit.jsonl").read_text(encoding="utf-8")
    check("Audit does not contain passwords", any(value in audit_text for key, value in ENV.items() if "PASSWORD" in key and value), False)
    check("Audit does not contain bearer tokens", "Bearer " in audit_text, False)


if __name__ == "__main__":
    try:
        main()
        report["success"] = True
    except Exception as error:
        report["success"] = False
        # Avoid writing Playwright call logs (form fills may include credentials).
        report["errorType"] = type(error).__name__
        print("Verification stopped:", type(error).__name__, flush=True)
    finally:
        report["finishedAt"] = datetime.now(timezone.utc).isoformat()
        (OUT / "verification.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(0 if report["success"] else 1)
