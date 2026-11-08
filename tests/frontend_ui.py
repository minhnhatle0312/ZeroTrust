"""Real UI acceptance checks for the redesigned lab. Uses labeled demo data."""
import json
import re
import sys
from datetime import datetime,timedelta,timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'.tools'),str(ROOT/'scripts')]
from common import read_env
from playwright.sync_api import sync_playwright,expect

OUT=ROOT/'evidence/ui-upgrade'
OUT.mkdir(parents=True,exist_ok=True)
ENV=read_env()
PUBLIC=ENV.get('KEYCLOAK_PUBLIC_URL','http://localhost:8080').rstrip('/')
NETWORK=PUBLIC.startswith('https://')
A=PUBLIC+'/a/' if NETWORK else 'http://localhost:5173/'
B=PUBLIC+'/b/' if NETWORK else 'http://localhost:5174/'
API=PUBLIC if NETWORK else 'http://localhost:3001'
report={'startedAt':datetime.now(timezone(timedelta(hours=7))).isoformat(),'checks':[],'screenshots':[],'errors':[]}
stage='startup'


def check(name,actual,expected=True):
    report['checks'].append({'name':name,'actual':actual,'expected':expected,'passed':actual==expected})
    print(('PASS ' if actual==expected else 'FAIL ')+name,flush=True)
    if actual!=expected:raise AssertionError(name)


def shot(page,name):
    page.screenshot(path=str(OUT/name),full_page=True)
    report['screenshots'].append(name)


def watch(page):
    saved={}
    def captured(req):
        if req.url==API+'/api/profile':
            value=req.header_value('authorization')
            if value:saved['authorization']=value
    page.on('request',captured)
    page.on('pageerror',lambda e:report['errors'].append(re.sub(r'eyJ[\w-]+\.[\w-]+\.[\w-]+','[redacted]',str(e))[:300]))
    return saved


def login(browser,username,url=A,mobile=False):
    context=browser.new_context(ignore_https_errors=NETWORK,viewport={'width':390 if mobile else 1440,'height':844 if mobile else 1050},locale='vi-VN',accept_downloads=True)
    page=context.new_page();page.set_default_timeout(25000);saved=watch(page)
    page.goto(url);expect(page.locator('#username')).to_be_visible()
    page.locator('#username').fill(username);page.locator('#password').fill(ENV['TEST_'+username.upper()+'_PASSWORD']);page.locator('#kc-login').click()
    expect(page.locator('.shell')).to_be_visible();expect(page.locator('.loading-line')).to_have_count(0)
    return context,page,saved


def api(context,saved,path,method='GET',body=None):
    response=context.request.fetch(API+path,method=method,headers={'Authorization':saved['authorization']},data=body)
    return response.status,response.json()


def nav(page,name):
    if page.viewport_size['width']<=800:page.get_by_role('button',name='Mở menu',exact=True).click()
    page.get_by_role('navigation').get_by_role('button',name=name,exact=True).click()
    expect(page.locator('.loading-line')).to_have_count(0)
    expect(page.locator('.ops-explorer[aria-busy="true"]')).to_have_count(0)


def main():
    global stage
    admin=None;admin_saved=None;admin_ctx=None;target=None;changed=False
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-proxy-server'])
        try:
            if NETWORK:
                stage='launcher'
                ctx=browser.new_context(ignore_https_errors=True,viewport={'width':1440,'height':1100})
                page=ctx.new_page();watch(page);page.goto(PUBLIC)
                expect(page.get_by_role('heading',level=1)).to_contain_text('Công việc kết nối.')
                check('Launcher shows six working feature links',page.locator('.function-card').count(),6)
                page.get_by_label('Tìm chức năng',exact=True).fill('tai khoan')
                check('Launcher Vietnamese search',page.locator('.function-card:visible').count(),1)
                page.get_by_label('Tìm chức năng',exact=True).fill('')
                page.get_by_role('button',name='Công việc cá nhân',exact=True).click()
                check('Launcher category filter',page.locator('.function-card:visible').count(),2)
                page.get_by_role('button',name='Tất cả chức năng',exact=True).click();shot(page,'01-launcher-desktop.png')
                page.set_viewport_size({'width':390,'height':844});shot(page,'02-launcher-mobile.png')
                check('Launcher mobile width',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                ctx.close()
            stage='admin workspace'
            admin_ctx,admin,admin_saved=login(browser,'admin01')
            expect(admin.locator('h1')).to_have_text('Không gian quản trị')
            check('Dedicated admin overview',admin.get_by_role('heading',name='Đơn cần duyệt',exact=True).is_visible())
            shot(admin,'03-admin-workspace.png')
            nav(admin,'Tất cả chức năng');expect(admin.locator('h1')).to_have_text('Chọn chức năng')
            check('Workspace function cards',admin.locator('.ui-feature').count()>=6)
            shot(admin,'04-workspace-functions.png')
            admin.keyboard.press('Control+k');expect(admin.get_by_role('dialog')).to_be_visible()
            admin.get_by_label('Tìm chức năng trong hệ thống',exact=True).fill('tai khoan')
            admin.get_by_role('dialog').get_by_role('button',name=re.compile('Tài khoản & truy cập')).click()
            expect(admin.get_by_role('table',name='Tài khoản nhân viên')).to_be_visible()
            check('Command search navigates without accents','/users' in admin.url)
            admin.reload();expect(admin.get_by_role('table',name='Tài khoản nhân viên')).to_be_visible();expect(admin.locator('.loading-line')).to_have_count(0)
            check('Workspace deep link survives reload',admin.locator('h1').inner_text(),'Tài khoản & truy cập')
            admin.get_by_label('Tìm tài khoản',exact=True).fill('ngoc linh')
            expect(admin.locator('tbody tr')).to_have_count(1)
            check('Account search without accents',admin.locator('tbody').inner_text().find('employee02')>=0)
            admin.get_by_label('Tìm tài khoản',exact=True).fill('')
            _,all_accounts=api(admin_ctx,admin_saved,'/api/admin/users')
            manager_count=sum(u['role']=='manager' for u in all_accounts['users'])
            admin.get_by_label('Lọc vai trò',exact=True).select_option('manager');expect(admin.locator('tbody tr')).to_have_count(min(10,manager_count))
            check('Role filter matches staff',all('Quản lý' in t for t in admin.locator('tbody tr').all_inner_texts()))
            admin.get_by_label('Lọc vai trò',exact=True).select_option('all')
            with admin.expect_download() as info:admin.get_by_role('button',name='Xuất CSV',exact=True).click()
            download=info.value;download.save_as(str(OUT/'tai-khoan.csv'))
            csv=(OUT/'tai-khoan.csv').read_text(encoding='utf-8-sig')
            check('CSV exports account fields',all(x in csv for x in ['employee02','Họ tên','Trạng thái']))
            check('CSV excludes tokens and credentials','Bearer ' not in csv and 'SECRET' not in csv)
            admin.get_by_label('Tìm tài khoản',exact=True).fill('khong-co-nguoi-nay')
            check('Useful empty state',admin.get_by_role('heading',name='Không tìm thấy tài khoản').is_visible())
            admin.get_by_label('Tìm tài khoản',exact=True).fill('')
            shot(admin,'05-workspace-accounts.png')
            nav(admin,'Chấm công');expect(admin.locator('.punch-button')).to_be_visible()
            check('Admin retains personal attendance',admin.locator('h1').inner_text(),'Chấm công')
            stage='security workspace'
            security=admin_ctx.new_page();security.set_default_timeout(25000);ss=watch(security)
            security.goto(B+'#/accounts');expect(security.get_by_role('table',name='Tài khoản nhân viên')).to_be_visible();expect(security.locator('.loading-line')).to_have_count(0)
            check('Security SSO and direct function link',security.locator('#password').count(),0)
            check('Security deep link after SSO',security.locator('h1').inner_text(),'Tài khoản & truy cập')
            nav(security,'Tổng quan');shot(security,'06-security-overview.png')
            nav(security,'Nhật ký truy cập');table=security.get_by_role('table',name='Nhật ký truy cập')
            expect(table.locator('tbody tr')).to_have_count(10)
            security.get_by_role('button',name='Trang sau',exact=True).click()
            expect(security.locator('.ops-explorer')).to_have_attribute('aria-busy','false')
            check('Audit pagination advances',security.locator('.ui-pagination').inner_text().find('11–20')>=0)
            security.get_by_label('Kết quả truy cập',exact=True).select_option('DENY')
            expect(security.locator('.ops-explorer')).to_have_attribute('aria-busy','false')
            check('Audit filter respects results',all('Từ chối' in t for t in table.locator('tbody tr').all_inner_texts()))
            security.get_by_label('Kết quả truy cập',exact=True).select_option('')
            security.get_by_label('Tìm nhật ký',exact=True).fill('/api/profile')
            expect(security.locator('.ops-explorer')).to_have_attribute('aria-busy','false')
            check('Audit search filters paths',all('/api/profile' in t for t in table.locator('tbody tr').all_inner_texts()))
            with security.expect_download() as info:security.get_by_role('button',name='Xuất CSV',exact=True).click()
            info.value.save_as(str(OUT/'nhat-ky.csv'))
            check('Audit CSV downloads filtered rows','/api/profile' in (OUT/'nhat-ky.csv').read_text(encoding='utf-8-sig'))
            security.get_by_label('Tìm nhật ký',exact=True).fill('');shot(security,'07-audit-filters.png')
            nav(security,'Tất cả chức năng');shot(security,'08-security-functions.png')
            security.locator('.shell-header').get_by_role('button',name='Chọn ứng dụng',exact=True).click();expect(security.get_by_role('dialog')).to_be_visible()
            check('Application chooser has both applications',security.get_by_role('dialog').get_by_role('link').count(),2)
            shot(security,'09-app-switcher.png');security.keyboard.press('Escape');expect(security.get_by_role('dialog')).to_have_count(0)
            check('Escape closes chooser and restores focus',security.evaluate('document.activeElement.getAttribute("aria-label")'),'Chọn ứng dụng')
            for width in [768,390,320]:
                security.set_viewport_size({'width':width,'height':900});nav(security,'Cảnh báo')
                check('Security mobile layout '+str(width),security.evaluate('document.documentElement.scrollWidth<=innerWidth'))
                if width==390:shot(security,'10-security-mobile.png')
                security.get_by_role('button',name='Mở menu',exact=True).click();expect(security.get_by_role('dialog')).to_be_visible()
                if width==390:shot(security,'11-mobile-navigation.png')
                security.keyboard.press('Escape')
            security.set_viewport_size({'width':1440,'height':1050})

            stage='employee request workflow'
            employee_ctx,employee,es=login(browser,'employee02')
            check('Employee has no admin navigation',employee.get_by_role('navigation').get_by_role('button',name='Tài khoản & truy cập',exact=True).count(),0)
            shot(employee,'12-employee-overview.png')
            nav(employee,'Đơn điều chỉnh')
            _,existing=api(employee_ctx,es,'/api/corrections')
            today=datetime.now(timezone(timedelta(hours=7))).date()
            reusable=next((r for r in existing['requests'] if r['status']=='pending' and r['reason'].startswith('Kiểm thử nâng cấp giao diện ')),None)
            candidate=reusable['day'] if reusable else next((today-timedelta(days=n)).isoformat() for n in range(2,20) if not any(r['day']==(today-timedelta(days=n)).isoformat() for r in existing['requests']))
            marker=reusable['reason'] if reusable else 'Kiểm thử nâng cấp giao diện '+datetime.now().strftime('%H%M%S')
            employee.get_by_role('button',name='Tạo đơn điều chỉnh',exact=True).click()
            employee.get_by_label('Ngày cần điều chỉnh',exact=True).fill(candidate)
            employee.get_by_label('Giờ vào',exact=True).fill('17:00');employee.get_by_label('Giờ ra',exact=True).fill('08:00')
            employee.get_by_label('Lý do điều chỉnh',exact=True).fill(marker)
            check('Invalid time disables submission',employee.get_by_role('button',name='Gửi đề nghị',exact=True).is_disabled())
            employee.get_by_label('Giờ vào',exact=True).fill('08:00');employee.get_by_label('Giờ ra',exact=True).fill('17:00')
            if reusable:employee.keyboard.press('Escape')
            else:employee.get_by_role('button',name='Gửi đề nghị',exact=True).click()
            expect(employee.get_by_role('dialog')).to_have_count(0)
            expect(employee.locator('.request-item').filter(has_text=marker)).to_be_visible()
            check('Employee correction persists in API and UI',employee.locator('.request-item').filter(has_text=marker).count(),1)
            nav(admin,'Quản lý nhóm');request=admin.locator('.request-item').filter(has_text=marker);expect(request).to_be_visible()
            request.get_by_role('button',name='Duyệt đơn',exact=True).click();admin.get_by_label('Ghi chú duyệt đơn',exact=True).fill('Đã đối chiếu yêu cầu kiểm thử giao diện.')
            admin.get_by_role('button',name='Duyệt & cập nhật',exact=True).click();expect(admin.get_by_role('dialog')).to_have_count(0)
            _,fresh=api(employee_ctx,es,'/api/corrections')
            check('Approval persists through API',next(r['status'] for r in fresh['requests'] if r['reason']==marker),'approved')
            employee.get_by_role('button',name='Làm mới dữ liệu',exact=True).click();expect(employee.locator('.loading-line')).to_have_count(0)
            employee.get_by_label('Lọc đơn điều chỉnh',exact=True).select_option('approved');employee.get_by_label('Tìm đơn điều chỉnh',exact=True).fill(marker)
            check('Request filters show approved request',employee.locator('.request-item').count(),1)
            shot(employee,'13-approved-request.png')
            employee.set_viewport_size({'width':390,'height':844});nav(employee,'Chấm công')
            check('Workspace mobile layout',employee.evaluate('document.documentElement.scrollWidth<=innerWidth'));shot(employee,'14-workspace-mobile.png')

            stage='alert investigation workflow'
            check('Unauthorized request produces a real security event',api(employee_ctx,es,'/api/attendance?userId=ui-demo-other')[0],403)
            security.get_by_role('button',name='Làm mới dữ liệu',exact=True).click();expect(security.locator('.loading-line')).to_have_count(0)
            nav(security,'Cảnh báo');security.get_by_label('Tìm cảnh báo',exact=True).fill('employee02')
            alert_row=security.locator('tbody tr').filter(has_text='Truy cập dữ liệu người khác').first
            alert_row.get_by_role('button',name='Điều tra',exact=True).click()
            security.get_by_label('Kết luận điều tra',exact=True).select_option('resolved')
            investigation='Kiểm thử giao diện: đã đối chiếu sự kiện mô phỏng truy cập khác người dùng.'
            security.get_by_label('Ghi chú điều tra',exact=True).fill(investigation)
            security.get_by_role('button',name='Lưu kết luận',exact=True).click();expect(security.get_by_role('dialog')).to_have_count(0)
            _,snapshot=api(admin_ctx,ss,'/api/security')
            check('Investigation note and status persist',any(a['username']=='employee02' and a['note']==investigation and a['status']=='resolved' for a in snapshot['alerts']))
            shot(security,'18-investigation-saved.png')

            stage='access management workflow'
            nav(security,'Tài khoản');security.get_by_label('Tìm tài khoản',exact=True).fill('employee02')
            _,account_data=api(admin_ctx,ss,'/api/admin/users');target=next(u for u in account_data['users'] if u['username']=='employee02')
            check('Demo account initially enabled',target['disabled'],False)
            account_row=security.get_by_role('row').filter(has=security.get_by_text('employee02',exact=True))
            account_row.get_by_role('button',name='Quản lý truy cập',exact=True).click()
            security.get_by_role('dialog').get_by_text('Khóa tài khoản',exact=True).click()
            confirm=security.get_by_role('button',name='Khóa tài khoản & lưu',exact=True)
            check('Account action needs a reason',confirm.is_disabled())
            security.get_by_label('Lý do thực hiện',exact=True).fill('Kiểm thử giao diện: khóa tài khoản demo rồi hoàn nguyên.')
            shot(security,'15-account-action-dialog.png')
            # Simulate one failed save to verify form recovery, then retry the real API.
            pattern='**/api/admin/users/*/actions'
            security.route(pattern,lambda route:route.fulfill(status=503,content_type='application/json',body=json.dumps({'message':'Lỗi mô phỏng để kiểm tra thao tác thử lại.'})))
            confirm.click();expect(security.get_by_role('dialog').get_by_role('alert')).to_be_visible()
            check('Failed save keeps entered reason',security.get_by_label('Lý do thực hiện',exact=True).input_value().startswith('Kiểm thử giao diện'))
            security.unroute(pattern);changed=True;confirm.click();expect(security.get_by_role('dialog')).to_have_count(0)
            check('Disable action reaches real API',api(employee_ctx,es,'/api/profile')[0],403)
            account_row.get_by_role('button',name='Quản lý truy cập',exact=True).click();expect(security.get_by_role('radio',name=re.compile('Mở tài khoản'))).to_be_checked()
            security.get_by_label('Lý do thực hiện',exact=True).fill('Hoàn nguyên tài khoản demo sau kiểm thử nâng cấp giao diện.')
            security.get_by_role('button',name='Mở tài khoản & lưu',exact=True).click();expect(security.get_by_role('dialog')).to_have_count(0);changed=False
            _,account_data=api(admin_ctx,ss,'/api/admin/users');check('Demo account restored',next(u for u in account_data['users'] if u['id']==target['id'])['disabled'],False)
            nav(security,'Lịch sử xử lý');security.get_by_label('Trạng thái đối chiếu',exact=True).select_option('synced');expect(security.get_by_role('table',name='Đối chiếu tài khoản')).to_be_visible();shot(security,'16-action-history.png')
            check('Action history shows successful sync','Đã đồng bộ' in security.locator('tbody').inner_text())

            stage='auditor and browser quality'
            auditor_ctx,auditor,_=login(browser,'auditor01',B)
            check('Auditor has no account navigation',auditor.get_by_role('navigation').get_by_role('button',name='Tài khoản',exact=True).count(),0)
            nav(auditor,'Cảnh báo');auditor.get_by_role('button',name='Xem chi tiết',exact=True).first.click()
            expect(auditor.get_by_role('dialog')).to_be_visible()
            check('Auditor cannot save an investigation',auditor.get_by_role('button',name='Lưu kết luận',exact=True).count(),0)
            shot(auditor,'17-auditor-readonly.png');auditor.keyboard.press('Escape')
            check('No browser JavaScript errors',report['errors'],[])
            report['success']=True
        finally:
            if changed and target and admin_ctx and admin_saved:
                try:
                    status,_=api(admin_ctx,ss,'/api/admin/users/'+target['id']+'/actions','POST',{'action':'enable','note':'Hoàn nguyên trạng thái tài khoản sau kiểm thử giao diện.'})
                    report['cleanupRestoredAccount']=status==200
                except Exception:report['cleanupRestoredAccount']=False
            if sys.exc_info()[0]:
                for name in ['admin','security','employee','auditor']:
                    page=locals().get(name)
                    if page and not page.is_closed():
                        try:page.screenshot(path=str(OUT/('failure-'+name+'.png')),full_page=True)
                        except Exception:pass
            browser.close()


if __name__=='__main__':
    try:main()
    except Exception as error:
        report['success']=False;report['errorType']=type(error).__name__;report['stage']=stage
        print('Stopped at '+stage+': '+type(error).__name__,flush=True)
    finally:
        report['finishedAt']=datetime.now(timezone(timedelta(hours=7))).isoformat()
        (OUT/'results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    sys.exit(0 if report.get('success') else 1)
