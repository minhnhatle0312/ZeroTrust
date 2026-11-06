"""End-to-end operations against the real Keycloak lab. Only new labeled demo accounts are changed."""
import json
import secrets
import sys
import time
from datetime import datetime,timedelta,timezone
from pathlib import Path
import frontend_ui as ui

from playwright.sync_api import sync_playwright,expect
OUT=ui.ROOT/'evidence/api-upgrade'
OUT.mkdir(parents=True,exist_ok=True)
ui.OUT=OUT
ui.report={'startedAt':datetime.now(timezone(timedelta(hours=7))).isoformat(),'checks':[],'screenshots':[],'errors':[]}
check,shot,nav,api,watch=ui.check,ui.shot,ui.nav,ui.api,ui.watch
stage='start'

def main():
    global stage
    account=None;admin_ctx=None;saved=None
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',headless=True,args=['--no-proxy-server'])
        try:
            stage='admin and API readiness'
            admin_ctx,admin,saved=ui.login(browser,'admin01',ui.B)
            # Stabilize the test while explicitly testing automatic refresh later.
            admin.get_by_role('checkbox',name='Tự cập nhật 20 giây').uncheck()
            check('New summary API available',api(admin_ctx,saved,'/api/security/summary')[0],200)
            nav(admin,'Tài khoản')
            username='uiops-'+datetime.now().strftime('%m%d%H%M%S')
            temporary='DemoTemp'+secrets.token_hex(8)+'9!'
            permanent='DemoNew'+secrets.token_hex(8)+'9!'
            admin.get_by_role('button',name='Thêm nhân viên',exact=True).click()
            admin.get_by_label('Tên đăng nhập mới',exact=True).fill(username)
            admin.get_by_label('Email nhân viên',exact=True).fill(username+'@example.test')
            admin.get_by_label('Họ và tên',exact=True).fill('Nhân viên kiểm thử API')
            admin.get_by_label('Nhóm nhân viên',exact=True).fill('Kiểm thử chức năng')
            admin.get_by_label('Mật khẩu tạm thời',exact=True).fill(temporary)
            admin.get_by_role('button',name='Tạo nhân viên',exact=True).click()
            expect(admin.get_by_role('dialog')).to_have_count(0)
            _,result=api(admin_ctx,saved,'/api/admin/users');account=next(u for u in result['users'] if u['username']==username)
            check('Create employee synchronizes Keycloak and app',account['role'],'employee')
            admin.get_by_label('Tìm tài khoản',exact=True).fill(username)
            expect(admin.locator('tbody tr')).to_have_count(1)
            shot(admin,'01-created-employee.png')
            stage='edit profile and password'
            admin.get_by_role('button',name='Hồ sơ & phiên',exact=True).click()
            admin.get_by_label('Họ và tên',exact=True).fill('Nhân viên API đã cập nhật')
            admin.get_by_label('Nhóm nhân viên',exact=True).fill('Kiểm thử nhóm mới')
            admin.get_by_label('Vai trò mới',exact=True).select_option('manager')
            admin.get_by_label('Lý do cập nhật',exact=True).fill('Kiểm thử chuyển nhóm và vai trò trên giao diện.')
            shot(admin,'02-edit-role-team.png')
            admin.get_by_role('button',name='Lưu hồ sơ',exact=True).click();expect(admin.get_by_role('dialog')).to_have_count(0)
            _,result=api(admin_ctx,saved,'/api/admin/users/'+account['id'])
            check('Profile and group changes persist',result['user']['team'],'Kiểm thử nhóm mới')
            check('Role change persists',result['user']['role'],'manager')
            admin.get_by_role('button',name='Hồ sơ & phiên',exact=True).click()
            admin.get_by_role('button',name='Đặt lại mật khẩu',exact=True).click()
            admin.get_by_label('Mật khẩu tạm thời',exact=True).fill(temporary)
            admin.get_by_label('Lý do cập nhật',exact=True).fill('Kiểm thử cấp mật khẩu tạm thời trước đăng nhập.')
            admin.get_by_role('button',name='Lưu mật khẩu tạm thời',exact=True).click();expect(admin.get_by_role('dialog')).to_have_count(0)
            check('Password reset logged without revealing password',temporary not in json.dumps(api(admin_ctx,saved,'/api/security')[1]))
            stage='new account authentication'
            user_ctx=browser.new_context(ignore_https_errors=ui.NETWORK,viewport={'width':1440,'height':1050},locale='vi-VN')
            user=user_ctx.new_page();user.set_default_timeout(25000);us=watch(user)
            user.goto(ui.A);user.locator('#username').fill(username);user.locator('#password').fill(temporary);user.locator('#kc-login').click()
            expect(user.locator('#password-new')).to_be_visible()
            check('Temporary password requires change',user.locator('#password-new').is_visible())
            user.locator('#password-new').fill(permanent);user.locator('#password-confirm').fill(permanent)
            user.locator('input[type=submit],button[type=submit]').first.click()
            expect(user.locator('.shell')).to_be_visible();expect(user.locator('.loading-line')).to_have_count(0)
            check('New role permits manager navigation',user.get_by_role('navigation').get_by_role('button',name='Quản lý nhóm',exact=True).is_visible())
            nav(user,'Hồ sơ & phiên của tôi');expect(user.get_by_role('table',name='Phiên đăng nhập')).to_be_visible()
            check('Personal session shows current session','Phiên hiện tại' in user.locator('.ops-sessions').inner_text())
            shot(user,'03-personal-sessions.png')
            stage='correction cancellation and notifications'
            nav(user,'Đơn điều chỉnh');user.get_by_role('button',name='Tạo đơn điều chỉnh',exact=True).click()
            yesterday=(datetime.now(timezone(timedelta(hours=7))).date()-timedelta(days=1)).isoformat()
            user.get_by_label('Ngày cần điều chỉnh',exact=True).fill(yesterday)
            user.get_by_label('Lý do điều chỉnh',exact=True).fill('Kiểm thử rút đơn và thông báo quản trị.')
            user.get_by_role('button',name='Gửi đề nghị',exact=True).click();expect(user.get_by_role('dialog')).to_have_count(0)
            user.get_by_role('button',name='Rút đơn',exact=True).click();user.get_by_role('button',name='Xác nhận rút đơn',exact=True).click();expect(user.get_by_role('dialog')).to_have_count(0)
            check('Withdrawn correction displayed','Đã rút đơn' in user.locator('.request-item').inner_text())
            _,notifications=api(admin_ctx,saved,'/api/notifications')
            check('Admin receives new correction notification',any(username not in n['body'] and 'Nhân viên API đã cập nhật' in n['body'] for n in notifications['items']))
            admin.get_by_role('button',name='Thông báo',exact=True).click();expect(admin.get_by_role('dialog')).to_be_visible()
            check('Notification list displays real data',admin.locator('.ops-notifications>button').count()>0)
            shot(admin,'04-notification-center.png')
            admin.get_by_role('button',name='Đánh dấu tất cả đã đọc',exact=True).click()
            expect(admin.get_by_role('dialog')).to_contain_text('0 thông báo chưa đọc')
            check('Read state persists',api(admin_ctx,saved,'/api/notifications')[1]['unread'],0)
            admin.keyboard.press('Escape')
            stage='identity events and generated alerts'
            bad_ctx=browser.new_context(ignore_https_errors=ui.NETWORK)
            bad=bad_ctx.new_page();bad.goto(ui.A);bad.locator('#username').fill(username);bad.locator('#password').fill('InvalidDemoPasswordOnce9!');bad.locator('#kc-login').click()
            expect(bad.get_by_text('Invalid username or password.',exact=True)).to_be_visible()
            nav(admin,'Đăng nhập & xác thực');admin.get_by_role('button',name='Đồng bộ Keycloak',exact=True).click()
            expect(admin.get_by_role('button',name='Đồng bộ Keycloak',exact=True)).to_be_enabled()
            _,result=api(admin_ctx,saved,'/api/security/login-events?q='+username)
            check('Failed login imported from actual Keycloak',any(e['type']=='LOGIN_ERROR' for e in result['items']))
            _,context=api(admin_ctx,saved,'/api/security/alert-list?q='+username)
            check('Failed login generates visible alert',any('Keycloak' in a['kind'] for a in context['items']))
            admin.get_by_label('Tìm đăng nhập',exact=True).fill(username)
            expect(admin.locator('.ops-explorer')).to_have_attribute('aria-busy','false')
            expect(admin.get_by_role('table',name='Sự kiện đăng nhập')).to_contain_text('LOGIN_ERROR')
            shot(admin,'05-keycloak-login-events.png')
            nav(admin,'Cảnh báo');admin.get_by_label('Tìm cảnh báo',exact=True).fill(username)
            expect(admin.get_by_role('table',name='Cảnh báo truy cập')).to_contain_text('Keycloak')
            admin.get_by_role('button',name='Điều tra',exact=True).first.click()
            admin.get_by_text('Hoạt động liên quan đến tài khoản',exact=True).click()
            expect(admin.locator('.ops-alert-context')).to_contain_text('LOGIN_ERROR')
            check('Alert context includes related authentication','LOGIN_ERROR' in admin.locator('.ops-alert-context').inner_text())
            shot(admin,'06-alert-context.png');admin.keyboard.press('Escape')
            stage='full audit explorer'
            nav(admin,'Nhật ký truy cập');expect(admin.get_by_role('table',name='Nhật ký truy cập')).to_be_visible()
            admin.get_by_label('Tìm nhật ký',exact=True).fill(username)
            admin.get_by_label('Tìm nhật ký',exact=True).fill('')
            admin.get_by_label('Từ ngày',exact=True).fill('2020-01-01')
            expect(admin.locator('.ops-loading')).to_have_count(0)
            _,result=api(admin_ctx,saved,'/api/security/events?from=2020-01-01')
            check('Server-side audit searches beyond 100 records',result['total']>100)
            admin.get_by_role('button',name='Thời điểm',exact=True).click()
            expect(admin.locator('.ops-explorer')).to_have_attribute('aria-busy','false')
            check('Audit sorting is performed on server',admin.locator('th[aria-sort=ascending]').count(),1)
            admin.get_by_role('button',name='Chi tiết',exact=True).first.click();expect(admin.get_by_role('dialog')).to_have_count(1)
            check('Event detail exposes correlation ID','Mã đối chiếu' in admin.get_by_role('dialog').inner_text())
            shot(admin,'07-event-detail.png');admin.keyboard.press('Escape')
            with admin.expect_download() as info:admin.get_by_role('button',name='Xuất CSV',exact=True).click()
            info.value.save_as(str(OUT/'audit-filtered.csv'))
            check('Remote filtered export downloaded',(OUT/'audit-filtered.csv').stat().st_size>100)
            admin.set_viewport_size({'width':390,'height':844})
            check('New explorer fits mobile page',admin.evaluate('document.documentElement.scrollWidth<=innerWidth'));shot(admin,'08-log-mobile.png')
            admin.set_viewport_size({'width':1440,'height':1050})
            stage='revoke chosen session'
            nav(admin,'Tài khoản');admin.get_by_label('Tìm tài khoản',exact=True).fill(username)
            admin.get_by_role('button',name='Hồ sơ & phiên',exact=True).click();admin.get_by_role('button',name='Phiên đăng nhập',exact=True).click()
            expect(admin.get_by_role('table',name='Phiên đăng nhập')).to_be_visible()
            admin.get_by_role('button',name='Kết thúc phiên',exact=True).first.click()
            admin.get_by_label('Lý do kết thúc phiên',exact=True).fill('Kiểm thử kết thúc đúng phiên đăng nhập demo.')
            admin.get_by_role('button',name='Xác nhận kết thúc',exact=True).click()
            expect(admin.get_by_role('table',name='Phiên đăng nhập')).to_have_count(0)
            for _ in range(8):
                status,_=api(user_ctx,us,'/api/profile')
                if status==401:break
                time.sleep(1)
            check('Terminated session token rejected by API',status,401)
            admin.keyboard.press('Escape')
            nav(admin,'Tổng quan');admin.get_by_role('checkbox',name='Tự cập nhật 20 giây').check()
            check('Automatic refresh can be enabled',admin.get_by_role('checkbox',name='Tự cập nhật 20 giây').is_checked())
            check('No browser JavaScript errors',ui.report['errors'],[])
            ui.report['success']=True
        finally:
            if account and admin_ctx and saved:
                try:
                    status,_=api(admin_ctx,saved,'/api/admin/users/'+account['id']+'/actions','POST',{'action':'disable','note':'Kết thúc kiểm thử: khóa tài khoản demo mới tạo, giữ lịch sử đối chiếu.'})
                    ui.report['demoAccountDisabled']=status==200
                except Exception:ui.report['demoAccountDisabled']=False
            if sys.exc_info()[0]:
                for name in ['admin','user','bad']:
                    page=locals().get(name)
                    if page and not page.is_closed():
                        try:page.screenshot(path=str(OUT/('failure-'+name+'.png')),full_page=True)
                        except Exception:pass
            browser.close()

if __name__=='__main__':
    try:main()
    except Exception as e:
        ui.report['success']=False;ui.report['stage']=stage;ui.report['errorType']=type(e).__name__
        print('Stopped at '+stage+': '+type(e).__name__,flush=True)
    finally:
        ui.report['finishedAt']=datetime.now(timezone(timedelta(hours=7))).isoformat()
        (OUT/'browser-results.json').write_text(json.dumps(ui.report,ensure_ascii=False,indent=2),encoding='utf-8')
    sys.exit(0 if ui.report.get('success') else 1)
