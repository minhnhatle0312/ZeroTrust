"""New release screens, mobile layout and a credential-free demonstration recording."""
import os
import json
import release_live as lab
from playwright.sync_api import sync_playwright, expect

os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(lab.ROOT/'.tools/browsers')


def main():
    errors=[]
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',args=['--no-proxy-server'])
        auth,_,_=lab.login(browser,'admin01',lab.ENV['TEST_ADMIN01_PASSWORD'])
        context=browser.new_context(ignore_https_errors=True,storage_state=auth.storage_state(),
            viewport={'width':1440,'height':1000},record_video_dir=str(lab.OUT/'video'),record_video_size={'width':1440,'height':1000})
        auth.close()
        page=context.new_page();page.set_default_timeout(30000)
        page.on('pageerror',lambda _:errors.append('JavaScript runtime error'))
        for section,title in [('directory','Danh bạ LDAP'),('federation','Đồng bộ thư mục'),('directory-mapping','Ánh xạ nhóm LDAP'),
                              ('governance','Vòng đời danh tính'),('access-approvals','Phê duyệt quyền'),('access-review','Rà soát quyền'),
                              ('grant-matrix','Vai trò & quyền bổ sung'),('central-audit','Audit & Security Monitoring'),('detection','Python Anomaly Detection')]:
            page.goto(lab.PUBLIC+'/b/#/'+section)
            expect(page.locator('h1')).to_contain_text(title)
            page.wait_for_timeout(2000)
            lab.check(section+' renders without API error',page.locator('[role=alert]').count(),0)
            page.screenshot(path=str(lab.OUT/(section+'-desktop.png')),full_page=True)
            page.set_viewport_size({'width':390,'height':844})
            page.wait_for_timeout(200)
            lab.check(section+' mobile no page overflow',page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
            page.screenshot(path=str(lab.OUT/(section+'-mobile.png')),full_page=True)
            page.set_viewport_size({'width':1440,'height':1000})
        page.get_by_role('button',name='Đánh giá & chỉ số',exact=True).click()
        expect(page.get_by_role('heading',name='Confusion Matrix')).to_be_visible()
        page.screenshot(path=str(lab.OUT/'detection-metrics.png'),full_page=True)
        page.wait_for_timeout(3000)
        lab.check('New screens no JavaScript errors',errors,[])
        video=page.video
        context.close()
        video.save_as(str(lab.OUT/'release-demo.webm'))
        browser.close()


if __name__=='__main__':
    try:main()
    finally:(lab.OUT/'release-ui-results.json').write_text(json.dumps({'checks':lab.checks},ensure_ascii=False,indent=2),encoding='utf-8')
