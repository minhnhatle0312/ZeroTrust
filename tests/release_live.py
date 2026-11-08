"""Live HTTPS/LDAP/MFA and release API checks; never writes tokens or OTP seeds to evidence."""
import base64
import hashlib
import hmac
import json
import struct
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / '.tools'), str(ROOT / 'scripts')]
from common import read_env
from playwright.sync_api import sync_playwright, expect

ENV = read_env()
PUBLIC = ENV['KEYCLOAK_PUBLIC_URL'].rstrip('/')
OUT = ROOT / 'evidence/release'
OUT.mkdir(parents=True, exist_ok=True)
PRIVATE = ROOT / '.runtime/release-otp.json'
checks = []


def check(name, actual, expected=True):
    checks.append({'name': name, 'actual': actual, 'expected': expected, 'passed': actual == expected})
    print(('PASS ' if actual == expected else 'FAIL ') + name, flush=True)
    assert actual == expected, name


def otp(seed, offset=0):
    key = base64.b32decode(seed.replace(' ', '').upper())
    digest = hmac.new(key, struct.pack('>Q', int(time.time()) // 30 + offset), hashlib.sha1).digest()
    index = digest[-1] & 15
    return str((struct.unpack('>I', digest[index:index+4])[0] & 0x7fffffff) % 1000000).zfill(6)


def login(browser, username, password, app='b', exercise_otp=False, new_password=None):
    ctx = browser.new_context(ignore_https_errors=True, viewport={'width':1440,'height':1000})
    page = ctx.new_page()
    page.set_default_timeout(30000)
    saved = {}
    def capture(req):
        if req.url == PUBLIC + '/api/profile' and req.header_value('authorization'):
            saved['authorization'] = req.header_value('authorization')
    page.on('request', capture)
    page.goto(PUBLIC + '/' + app + '/')
    page.locator('#username').fill(username)
    page.locator('#password').fill(password)
    page.locator('#kc-login').click()
    page.wait_for_timeout(1500)
    seeds = json.loads(PRIVATE.read_text()) if PRIVATE.exists() else {}
    if page.locator('#totp').count():
        if page.locator('#kc-totp-secret-key').count() == 0:
            link = page.locator('a[href*="mode=manual"]')
            if link.count(): link.click()
        seed = page.locator('#kc-totp-secret-key').inner_text().strip().replace(' ', '')
        seeds[username] = seed
        PRIVATE.parent.mkdir(exist_ok=True)
        PRIVATE.write_text(json.dumps(seeds), encoding='utf-8')
        page.locator('#totp').fill(otp(seed))
        if page.locator('#userLabel').count(): page.locator('#userLabel').fill('Release QA')
        page.locator('input[type=submit],button[type=submit]').last.click()
        check(username + ' enrolled TOTP', True)
    elif page.locator('#otp').count():
        seed = seeds[username]
        if exercise_otp:
            page.locator('#otp').fill(otp(seed, -10))
            page.locator('#kc-login').click()
            expect(page.locator('#otp')).to_be_visible()
            check(username + ' rejects expired OTP', True)
        # Avoid reuse of enrollment/login code within the same time step.
        time.sleep(31 - time.time() % 30)
        page.locator('#otp').fill(otp(seed))
        page.locator('#kc-login').click()
    if new_password:
        expect(page.locator('#password-new')).to_be_visible()
        page.locator('#password-new').fill(new_password)
        page.locator('#password-confirm').fill(new_password)
        page.locator('input[type=submit],button[type=submit]').last.click()
    expect(page.locator('.shell')).to_be_visible()
    expect(page.locator('.loading-line')).to_have_count(0)
    page.wait_for_timeout(500)
    return ctx, page, saved


def api(ctx, saved, path, method='GET', body=None):
    r = ctx.request.fetch(PUBLIC + path, method=method, headers=saved, data=body)
    return r.status, r.json()


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', args=['--no-proxy-server'])
        ctx, page, admin = login(browser, 'admin01', ENV['TEST_ADMIN01_PASSWORD'])
        for path in ['/api/security/directory','/api/security/directory/mappings','/api/security/governance',
                     '/api/security/governance/matrix','/api/security/central/health','/api/security/central/events',
                     '/api/security/central/summary','/api/security/central/incidents','/api/security/central/detection/status']:
            status, data = api(ctx, admin, path)
            check('admin GET ' + path, status, 200)
        status, data = api(ctx, admin, '/api/security/directory/sync', 'POST', {'mode':'full','note':'Release acceptance full LDAP synchronization'})
        check('LDAP sync accepted', status, 202)
        for _ in range(40):
            time.sleep(1)
            _, data = api(ctx, admin, '/api/security/directory')
            if data['lastJob']['state'] not in ['pending','running']: break
        (OUT / 'directory-sync.json').write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding='utf-8')
        check('LDAP full sync completed', data['lastJob']['state'], 'synced')
        _, users = api(ctx, admin, '/api/security/directory/users')
        check('Four LDAP profiles imported', users['total'] >= 4)
        credentials = json.loads((ROOT / 'directory/.local/credentials.json').read_text())['users']
        for user in ['ldap-employee01','ldap-auditor01']:
            c, a, token = login(browser, user, credentials[user], 'a', True)
            check(user + ' profile after MFA', api(c, token, '/api/profile')[0], 200)
            check(user + ' denied admin', api(c, token, '/api/admin')[0], 403)
            b = c.new_page()
            b.goto(PUBLIC + '/b/')
            if 'auditor' in user: expect(b.locator('.shell')).to_be_visible()
            else: expect(b.get_by_role('heading', name='Bạn chưa có quyền truy cập')).to_be_visible(timeout=30000)
            check(user + ' SSO no password prompt', b.locator('#password').count(), 0)
            a.screenshot(path=str(OUT / (user + '.png')), full_page=True)
            c.close()
        page.screenshot(path=str(OUT / 'security-overview.png'), full_page=True)
        browser.close()


if __name__ == '__main__':
    try:
        main()
    finally:
        (OUT / 'live-results.json').write_text(json.dumps({'checks':checks}, ensure_ascii=False, indent=2), encoding='utf-8')
