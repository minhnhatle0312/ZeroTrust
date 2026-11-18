"""Real browser acceptance tests on demo accounts. Creates labeled attendance requests."""
import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / '.tools'), str(ROOT / 'scripts')]
from common import read_env, admin_token, request
from playwright.sync_api import sync_playwright, expect

OUT = ROOT / 'evidence/week2'
OUT.mkdir(parents=True, exist_ok=True)
ENV = read_env()
report = {'startedAt': datetime.now(timezone.utc).isoformat(), 'checks': [], 'screenshots': []}
contexts = []


def check(name, value, expected=True):
    report['checks'].append({'name':name, 'actual':value, 'expected':expected, 'passed':value == expected})
    print(('PASS ' if value == expected else 'FAIL ') + name, flush=True)
    if value != expected:
        raise AssertionError(name)


def shot(page, filename):
    page.screenshot(path=str(OUT / filename), full_page=True)
    report['screenshots'].append(filename)


def api(page, path, method='GET', body=None):
    return page.evaluate('''async ({path, method, body}) => {
      const {default:kc} = await import('/src/keycloak.js');
      await kc.updateToken(30);
      const r = await fetch('http://localhost:3001'+path,{method,headers:{Authorization:'Bearer '+kc.token,...(body===null?{}:{'Content-Type':'application/json'})},body:body===null?undefined:JSON.stringify(body)});
      return {status:r.status,data:await r.json()};
    }''', {'path':path,'method':method,'body':body})


def login(browser, username, mobile=False):
    context = browser.new_context(viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1100},locale='vi-VN')
    contexts.append(context)
    page = context.new_page()
    page.set_default_timeout(30000)
    page.goto('http://localhost:5173')
    page.locator('#username').fill(username)
    page.locator('#password').fill(ENV['TEST_'+username.upper()+'_PASSWORD'])
    page.locator('#kc-login').click()
    expect(page.locator('h1')).to_contain_text('Xin chào')
    expect(page.locator('.loading-line')).to_have_count(0)
    check(username+' login', api(page,'/api/profile')['status'],200)
    return page


def main():
    restore_user = None
    restore_mfa = None
    admin = None
    with sync_playwright() as p:
        browser = p.chromium.launch(channel=os.getenv('TEST_BROWSER_CHANNEL','chrome'), headless=True, args=['--no-proxy-server'])
        try:
            employee=login(browser,'employee01')
            yesterday=(datetime.now(timezone(timedelta(hours=7)))-timedelta(days=1)).date().isoformat()
            today=api(employee,'/api/attendance')['data']['today']
            if not today:
                employee.get_by_role('button',name='Chấm công vào',exact=True).click()
                expect(employee.get_by_role('button',name='Chấm công ra',exact=True)).to_be_visible()
            shot(employee,'01-employee-dashboard.png')
            check('Employee cannot access admin users',api(employee,'/api/admin/users')['status'],403)
            check('Employee cannot spoof check-in owner',api(employee,'/api/attendance/check-in','POST',{'userId':'another-user'})['status'],400)
            reason='Minh chứng tuần 2: quên chấm công; <img src=x onerror=alert(1)> chỉ là văn bản.'
            existing=api(employee,'/api/corrections')['data']['requests']
            if not any(r['day']==yesterday and r['status']=='pending' for r in existing):
                employee.get_by_role('button',name='Tạo đơn điều chỉnh',exact=True).click()
                employee.get_by_label('Ngày cần điều chỉnh').fill(yesterday)
                employee.get_by_label('Lý do điều chỉnh').fill(reason)
                employee.get_by_role('button',name='Gửi đề nghị',exact=True).click()
                expect(employee.locator('dialog')).to_have_count(0)
            employee.get_by_role('navigation').get_by_role('button',name='Đơn điều chỉnh',exact=False).click()
            expect(employee.locator('.request-item').filter(has_text=reason).first).to_be_visible()
            check('XSS payload rendered as text',employee.locator('.request-item img').count(),0)
            shot(employee,'02-correction-request.png')
            correction=next(r for r in api(employee,'/api/corrections')['data']['requests'] if r['status']=='pending' and r['day']==yesterday)

            other=login(browser,'employee02')
            other_id=api(other,'/api/profile')['data']['id']
            check('Cross-user read denied',api(employee,'/api/attendance?userId='+other_id)['status'],403)
            c2=api(other,'/api/corrections','POST',{'day':yesterday,'checkIn':'08:00','checkOut':'17:00','reason':'Minh chứng tuần 2: đơn từ nhóm Vận hành.'})
            if c2['status']==409:
                c2={'data':next(r for r in api(other,'/api/corrections')['data']['requests'] if r['status']=='pending' and r['day']==yesterday)}
            manager=login(browser,'manager01')
            team=api(manager,'/api/team')['data']
            check('Manager sees own team only',all(m['team']=='Sản phẩm' for m in team['members']))
            check('Cross-team review denied',api(manager,'/api/corrections/'+c2['data']['id'],'PATCH',{'decision':'approved','note':'Thử duyệt đơn khác nhóm trái quyền'})['status'],403)
            manager.get_by_role('button',name='Quản lý nhóm',exact=True).click()
            row=manager.locator('.request-item').filter(has_text=reason).first
            row.get_by_role('button',name='Duyệt đơn',exact=True).click()
            manager.get_by_label('Ghi chú duyệt đơn').fill('Đã đối chiếu minh chứng tuần 2 và xác nhận giờ công.')
            manager.get_by_role('button',name='Xác nhận',exact=True).click()
            expect(manager.locator('dialog')).to_have_count(0)
            expect(manager.locator('.loading-line')).to_have_count(0)
            check('Approved request updates attendance',any(r['day']==yesterday and r['check_out'] for r in api(employee,'/api/attendance')['data']['records']))
            shot(manager,'03-manager-team.png')

            admin=login(browser,'admin01')
            admin.get_by_role('button',name='Trung tâm bảo mật',exact=True).click()
            expect(admin.locator('.loading-line')).to_have_count(0)
            check('Keycloak policy integration',api(admin,'/api/security/keycloak')['data']['connected'])
            shot(admin,'04-security-center.png')
            # Save the old signed token only inside the isolated browser context.
            other.evaluate("async()=>{const {default:k}=await import('/src/keycloak.js');window.oldTestToken=k.token;}")
            admin.get_by_role('button',name='Tài khoản & truy cập',exact=True).click()
            admin.locator('tr').filter(has_text='employee02').get_by_role('button',name='Quản lý truy cập').click()
            admin.get_by_label('Biện pháp xử lý').select_option('revoke')
            admin.get_by_label('Lý do / kết quả điều tra').fill('Minh chứng tuần 2: thu hồi phiên sau truy cập bất thường.')
            admin.get_by_role('button',name='Xác nhận',exact=True).click()
            expect(admin.locator('dialog')).to_have_count(0)
            revoked=other.evaluate("async()=>{const r=await fetch('http://localhost:3001/api/profile',{headers:{Authorization:'Bearer '+window.oldTestToken}});return r.status;}")
            check('Revocation denies old real Keycloak JWT',revoked,401)
            restore_user = other_id
            r=api(admin,'/api/admin/users/'+other_id+'/actions','POST',{'action':'disable','note':'Minh chứng tuần 2: khóa tài khoản thử nghiệm.'})
            check('Disable synced with Keycloak',r['status'],200)
            token=admin_token()
            check('Keycloak user disabled',request('/admin/realms/company-iam/users/'+other_id,token=token)['enabled'],False)
            admin.get_by_role('button',name='Làm mới dữ liệu').click()
            expect(admin.locator('.loading-line')).to_have_count(0)
            shot(admin,'05-account-containment.png')
            r=api(admin,'/api/admin/users/'+other_id+'/actions','POST',{'action':'enable','note':'Kết thúc minh chứng tuần 2, mở lại tài khoản.'})
            check('Enable synced with Keycloak',r['status'],200)
            check('Keycloak user enabled',request('/admin/realms/company-iam/users/'+other_id,token=token)['enabled'])
            restore_user = None
            original_actions=request('/admin/realms/company-iam/users/'+other_id,token=token).get('requiredActions',[])
            restore_mfa=(other_id,original_actions)
            r=api(admin,'/api/admin/users/'+other_id+'/actions','POST',{'action':'require-mfa','note':'Minh chứng tuần 2: yêu cầu thiết lập OTP sau điều tra.'})
            check('MFA request synced with Keycloak',r['status'],200)
            check('Keycloak requires CONFIGURE_TOTP','CONFIGURE_TOTP' in request('/admin/realms/company-iam/users/'+other_id,token=token).get('requiredActions',[]))
            request('/admin/realms/company-iam/users/'+other_id,'PUT',{'requiredActions':original_actions},token)
            restore_mfa=None
            alerts=api(admin,'/api/security')['data']['alerts']
            check('Blocked behavior generated alerts',len(alerts)>0)
            check('Admin records investigation',api(admin,'/api/security/alerts/'+alerts[0]['id'],'PATCH',{'status':'resolved','note':'Đã kiểm thử, thu hồi phiên và xác nhận cơ chế từ chối hoạt động.'})['status'],200)
            auditor=login(browser,'auditor01')
            check('Auditor reads alerts',api(auditor,'/api/security')['status'],200)
            check('Auditor cannot remediate',api(auditor,'/api/admin/users/'+other_id+'/actions','POST',{'action':'disable','note':'Kiểm thử auditor không được sửa'})['status'],403)
            mobile=login(browser,'employee01',True)
            check('Mobile has no horizontal overflow',mobile.evaluate('document.documentElement.scrollWidth <= window.innerWidth'))
            shot(mobile,'06-mobile-attendance.png')
            employee.get_by_role('navigation').get_by_role('button',name='Tổng quan',exact=True).click()
            expect(employee.locator('.loading-line')).to_have_count(0)
            if employee.get_by_role('button',name='Chấm công ra',exact=True).count():
                employee.get_by_role('button',name='Chấm công ra',exact=True).click()
            expect(employee.get_by_role('button',name='Đã hoàn thành hôm nay',exact=True)).to_be_visible()
            check('Real check-out recorded',bool(api(employee,'/api/attendance')['data']['today']['check_out']))
            shot(employee,'08-completed-day.png')
            admin.get_by_role('button',name='Trung tâm bảo mật',exact=True).click()
            expect(admin.locator('.loading-line')).to_have_count(0)
            shot(admin,'07-security-investigation.png')
            report['success']=True
        finally:
            if restore_mfa:
                user_id,required_actions=restore_mfa
                request('/admin/realms/company-iam/users/'+user_id,'PUT',{'requiredActions':required_actions},admin_token())
            if restore_user and admin:
                restored=api(admin,'/api/admin/users/'+restore_user+'/actions','POST',{'action':'enable','note':'Hoàn nguyên tài khoản demo sau kiểm thử tuần 2.'})
                report['cleanupRestoredUser'] = restored['status'] == 200
            for context in contexts:
                context.close()
            browser.close()


if __name__=='__main__':
    try:
        main()
    except Exception as error:
        report['success']=False
        report['errorType']=type(error).__name__
        # Keep failed call logs out of output because login fills can include credentials.
        message = str(error)
        for key, value in ENV.items():
            if 'PASSWORD' in key and value:
                message = message.replace(value, '[REDACTED]')
        print('Stopped:',type(error).__name__,message[:2200],flush=True)
    finally:
        report['finishedAt']=datetime.now(timezone.utc).isoformat()
        (OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    sys.exit(0 if report.get('success') else 1)
