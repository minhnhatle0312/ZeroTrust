"""Collect real, sanitized evidence for the week-three report."""
import html
import json
import os
import re
import shutil
import subprocess
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'word/minh_chung/tuan3'
OUT.mkdir(parents=True, exist_ok=True)
sys.path[:0] = [str(ROOT / '.tools'), str(ROOT / 'scripts')]
from common import admin_token, read_env, request
from playwright.sync_api import sync_playwright, expect

sys.stdout.reconfigure(encoding='utf-8')
HTTP = urllib.request.build_opener(urllib.request.ProxyHandler({}))
report = {'capturedAt': datetime.now(timezone(timedelta(hours=7))).isoformat(),
          'environment': 'localhost; Keycloak thật; Authorization Code + PKCE S256',
          'checks': [], 'responses': []}
processes, handles = [], []


def check(name, actual, expected):
    report['checks'].append({'name': name, 'actual': actual, 'expected': expected,
                             'passed': actual == expected})
    print(('PASS ' if actual == expected else 'FAIL ') + name, flush=True)
    if actual != expected:
        raise AssertionError(name)


def ready(port, path='/'):
    try:
        with HTTP.open(f'http://127.0.0.1:{port}{path}', timeout=2) as response:
            return response.status == 200
    except Exception:
        return False


def start(port, command, cwd, path='/'):
    if ready(port, path):
        return
    log = open(ROOT / f'evidence/week3-report-review/service-{port}.log', 'w', encoding='utf-8')
    handles.append(log)
    process = subprocess.Popen(command, cwd=cwd, stdout=log, stderr=subprocess.STDOUT,
                               creationflags=subprocess.CREATE_NO_WINDOW)
    processes.append(process)
    for _ in range(40):
        if ready(port, path):
            return
        if process.poll() is not None:
            raise RuntimeError(f'Local service {port} exited')
        time.sleep(.5)
    raise RuntimeError(f'Local service {port} not ready')


def render(page, title, subtitle, body, filename):
    page.set_viewport_size({'width': 1400, 'height': 200})
    page.set_content('''<!doctype html><html lang="vi"><meta charset="utf-8">
    <style>*{box-sizing:border-box}body{margin:0;padding:28px 34px;background:#fff;color:#172638;
    font:21px/1.45 Arial,sans-serif}h1{font-size:30px;margin:0 0 8px}p{margin:6px 0 18px}
    .sub{font-size:19px;color:#4c5d6e}table{border-collapse:collapse;width:100%;font-size:20px}
    th,td{border:1px solid #bac5ce;padding:9px 12px;text-align:left}th{background:#edf2f5}
    .ok{color:#126139;font-weight:bold}pre{white-space:pre-wrap;overflow-wrap:anywhere;
    background:#f3f5f7;padding:14px;font:19px/1.45 Consolas,monospace;margin:16px 0}
    .foot{font-size:18px;color:#4c5d6e;margin-top:16px}</style>'''
                     + '<h1>' + html.escape(title) + '</h1><p class="sub">'
                     + html.escape(subtitle) + '</p>' + body)
    height = page.evaluate('document.documentElement.scrollHeight')
    page.set_viewport_size({'width': 1400, 'height': height})
    page.screenshot(path=str(OUT / filename), full_page=True)


def main():
    source = ROOT / 'word/BaoCaoTuan3_LeMinhNhat_NguyenMinhTuan.docx'
    backup = ROOT / 'evidence/week3-report-review/BaoCaoTuan3_ban_goc.docx'
    if not backup.exists():
        shutil.copy2(source, backup)
    check('Keycloak is ready', ready(8080, '/realms/company-iam/.well-known/openid-configuration'), True)
    token = admin_token()
    base = '/admin/realms/company-iam'
    client = request(base + '/clients?clientId=employee-portal', token=token)[0]
    full = request(base + '/clients/' + client['id'], token=token)
    mapper = request(base + '/clients/' + client['id'] + '/protocol-mappers/models', token=token)
    scopes = request(base + '/clients/' + client['id'] + '/default-client-scopes', token=token)
    roles = request(base + '/roles', token=token)
    check('Public OIDC client', full['publicClient'], True)
    check('Authorization Code flow', full['standardFlowEnabled'], True)
    check('PKCE S256', full['attributes']['pkce.code.challenge.method'], 'S256')
    check('Direct grants disabled', full['directAccessGrantsEnabled'], False)
    check('Audience mapper', any(m.get('config', {}).get('included.custom.audience') == 'employee-api'
                                 and m.get('config', {}).get('access.token.claim') == 'true' for m in mapper), True)
    check('Default roles scope', any(s['name'] == 'roles' for s in scopes), True)
    check('Application realm roles', {'admin', 'manager', 'employee', 'auditor'} <= {r['name'] for r in roles}, True)
    report['configuration'] = {'clientId': full['clientId'], 'publicClient': full['publicClient'],
        'standardFlowEnabled': full['standardFlowEnabled'],
        'pkce': full['attributes']['pkce.code.challenge.method'],
        'redirectUris': full['redirectUris'], 'webOrigins': full['webOrigins'],
        'defaultScopes': [s['name'] for s in scopes],
        'audience': 'employee-api', 'roles': ['admin', 'manager', 'employee', 'auditor']}
    node = shutil.which('node')
    start(3001, [node, 'server.js'], ROOT / 'backend', '/health')
    start(5173, [node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5173', '--strictPort'], ROOT / 'web-a')
    result = subprocess.run(['cmd.exe', '/d', '/c', 'npm.cmd test'], cwd=ROOT / 'backend',
                            capture_output=True, text=True, encoding='utf-8', errors='replace',
                            creationflags=subprocess.CREATE_NO_WINDOW)
    output = result.stdout + result.stderr
    (OUT / 'backend-tests.tap').write_text(output, encoding='utf-8')
    check('Backend test command exit', result.returncode, 0)
    counts = {k: int(re.search(r'^# ' + k + r' (\d+)', output, re.M).group(1))
              for k in ['tests', 'pass', 'fail', 'skipped']}
    check('Backend tests passed', counts['pass'], 54)
    check('Backend tests failed', counts['fail'], 0)
    report['backendTests'] = counts
    env = read_env()
    matrix = {'employee01': [200, 403, 403, 403], 'manager01': [200, 200, 403, 403],
              'admin01': [200, 200, 200, 200], 'auditor01': [200, 403, 403, 200]}
    matrix_actual = {}
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--no-proxy-server'])
        try:
            missing = browser.new_context()
            response = missing.request.get('http://localhost:3001/api/profile')
            check('Missing token /api/profile', response.status, 401)
            report['responses'].append({'user': 'anonymous', 'method': 'GET', 'path': '/api/profile',
                                       'http': response.status, 'body': response.json()})
            missing.close()
            for username, expected in matrix.items():
                context = browser.new_context(viewport={'width': 1440, 'height': 1050}, locale='vi-VN')
                page = context.new_page()
                page.set_default_timeout(30000)
                page.goto('http://localhost:5173')
                expect(page.locator('#username')).to_be_visible()
                page.locator('#username').fill(username)
                page.locator('#password').fill(env['TEST_' + username.upper() + '_PASSWORD'])
                page.locator('#kc-login').click()
                expect(page.locator('h1')).to_contain_text('Xin chào')
                expect(page.locator('.loading-line')).to_have_count(0)
                values = page.evaluate('''async () => {
                  const {default:kc} = await import('/src/keycloak.js');
                  await kc.updateToken(30);
                  const responses=[];
                  for (const path of ['profile','manager','admin','audit']) {
                    const r=await fetch('http://localhost:3001/api/'+path,{headers:{Authorization:'Bearer '+kc.token}});
                    const body=await r.json();
                    responses.push({path:'/api/'+path,http:r.status,
                      body:path==='audit'&&r.status===200?{status:body.status,eventCount:body.events.length,requestId:body.requestId}:body});
                  }
                  return {responses,issuer:kc.tokenParsed.iss,audience:kc.tokenParsed.aud,
                    roles:kc.tokenParsed.realm_access.roles.filter(r=>['employee','manager','admin','auditor'].includes(r))};
                }''')
                check(username + ' issuer', values['issuer'], 'http://localhost:8080/realms/company-iam')
                audience = values['audience'] if isinstance(values['audience'], list) else [values['audience']]
                check(username + ' audience employee-api', 'employee-api' in audience, True)
                matrix_actual[username] = []
                for row, wanted in zip(values['responses'], expected):
                    check(username + ' ' + row['path'], row['http'], wanted)
                    row.update(user=username, method='GET')
                    report['responses'].append(row)
                    matrix_actual[username].append(row['http'])
                if username == 'employee01':
                    page.screenshot(path=str(OUT / '03-web-a.png'), full_page=True)
                # Exercise the existing logout button, without exposing tokens.
                page.locator('.logout-button').click()
                expect(page.locator('#username')).to_be_visible()
                check(username + ' logout', '/protocol/openid-connect/auth' in page.url, True)
                context.close()
            context = browser.new_context(viewport={'width': 1400, 'height': 700}, device_scale_factor=1.5)
            page = context.new_page()
            stamp = report['capturedAt'][:19].replace('T', ' ') + ' (UTC+7)'
            rows = ''.join('<tr><td>' + name + '</td>' + ''.join('<td>' + str(v) + '</td>' for v in values)
                           + '<td class="ok">ĐẠT</td></tr>' for name, values in matrix_actual.items())
            missing_body = report['responses'][0]['body']
            denied = next(r for r in report['responses'] if r['user'] == 'employee01' and r['path'] == '/api/admin')
            blocks = 'GET /api/profile — không gửi token\nHTTP 401\n' + json.dumps(missing_body, ensure_ascii=False, indent=2)
            blocks += '\n\nGET /api/admin — employee01 đã đăng nhập\nHTTP 403\n' + json.dumps(denied['body'], ensure_ascii=False, indent=2)
            render(page, 'Kiểm thử xác thực và RBAC — HTTP 200 / 401 / 403',
                   'Gọi API thật trên localhost; đăng nhập qua Keycloak bằng Authorization Code + PKCE S256. ' + stamp,
                   '<table><tr><th>Tài khoản</th><th>/api/profile</th><th>/api/manager</th><th>/api/admin</th><th>/api/audit</th><th>Kết quả</th></tr>'
                   + rows + '</table><pre>' + html.escape(blocks) + '</pre><p class="foot">'
                   'Biên bản tự động từ HTTP response; không ghi token hoặc mật khẩu. Chi tiết: verification.json. '
                   'Các ô 200/403 khớp toàn bộ 16 kết quả mong đợi.</p>', '05-http-rbac.png')
            summary = '\n'.join(line for line in result.stdout.splitlines()
                                if line.startswith(('1..', '# tests ', '# pass ', '# fail ', '# cancelled ', '# skipped ', '# todo ', '# duration_ms ')))
            render(page, 'Kết quả kiểm thử backend: 54/54 đạt',
                   'Lệnh thực thi: cd backend; npm.cmd test — ' + stamp,
                   '<pre>' + html.escape(summary) + '</pre><p>'
                   'Kiểm tra JWT, RBAC, phạm vi nhóm, dữ liệu chấm công, audit và thu hồi phiên.</p>'
                   '<p class="foot">Bộ kiểm thử dùng JWT RS256 với khóa test riêng, SQLite riêng và mô phỏng Keycloak. '
                   'Đây là kết quả kiểm thử backend; luồng Keycloak thật được kiểm chứng riêng trong biên bản HTTP. '
                   'Log gốc: backend-tests.tap.</p>', '06-backend-tests.png')
            context.close()
        finally:
            browser.close()
    report['success'] = True


if '--render-only' in sys.argv:
    saved = json.loads((OUT / 'verification.json').read_text(encoding='utf-8'))
    assert saved['success']
    output = (OUT / 'backend-tests.tap').read_text(encoding='utf-8')
    summary = '\n'.join(line for line in output.splitlines()
                        if line.startswith(('1..', '# tests ', '# pass ', '# fail ', '# cancelled ', '# skipped ', '# todo ', '# duration_ms ')))
    with sync_playwright() as p:
        browser = p.chromium.launch(channel='chrome', headless=True, args=['--no-proxy-server'])
        try:
            page = browser.new_page(device_scale_factor=1.5)
            render(page, 'Kết quả kiểm thử backend: 54/54 đạt',
                   'Lệnh thực thi: cd backend; npm.cmd test — '
                   + saved['capturedAt'][:19].replace('T', ' ') + ' (UTC+7)',
                   '<pre>' + html.escape(summary) + '</pre><p>'
                   'Kiểm tra JWT, RBAC, phạm vi nhóm, dữ liệu chấm công, audit và thu hồi phiên.</p>'
                   '<p class="foot">Bộ kiểm thử dùng JWT RS256 với khóa test riêng, SQLite riêng và mô phỏng Keycloak. '
                   'Đây là kết quả kiểm thử backend; luồng Keycloak thật được kiểm chứng riêng trong biên bản HTTP. '
                   'Log gốc: backend-tests.tap.</p>', '06-backend-tests.png')
        finally:
            browser.close()
    print('Re-rendered saved test output; no tests or API calls repeated.')
    sys.exit(0)

try:
    main()
except Exception as error:
    report['success'] = False
    report['errorType'] = type(error).__name__
    print('Stopped:', type(error).__name__, flush=True)
finally:
    for process in reversed(processes):
        process.terminate()
        try:
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            process.kill()
    for handle in handles:
        handle.close()
    report['finishedAt'] = datetime.now(timezone(timedelta(hours=7))).isoformat()
    (OUT / 'verification.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Evidence success:', report.get('success'), flush=True)
sys.exit(0 if report.get('success') else 1)
