"""Exercise separate clients, SSO, single logout, RBAC and HTTPS on the real lab."""
import base64
import json
import os
import ssl
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path[:0]=[str(ROOT/'.tools'),str(ROOT/'scripts')]
from common import read_env
from playwright.sync_api import sync_playwright,expect

OUT=Path(os.getenv('TEST_EVIDENCE_DIR',str(ROOT/'evidence/week3')))
OUT.mkdir(parents=True,exist_ok=True)
ENV=read_env()
PUBLIC=ENV.get('KEYCLOAK_PUBLIC_URL','http://localhost:8080').rstrip('/')
NETWORK=PUBLIC.startswith('https://')
A=PUBLIC+'/a/' if NETWORK else 'http://localhost:5173/'
B=PUBLIC+'/b/' if NETWORK else 'http://localhost:5174/'
API=PUBLIC if NETWORK else 'http://localhost:3001'
report={'startedAt':datetime.now(timezone(timedelta(hours=7))).isoformat(),'mode':'HTTPS LAN/VPN' if NETWORK else 'localhost','publicUrl':PUBLIC,'checks':[],'screenshots':[]}


def check(name,actual,expected=True):
    report['checks'].append({'name':name,'actual':actual,'expected':expected,'passed':actual==expected})
    print(('PASS ' if actual==expected else 'FAIL ')+name,flush=True)
    if actual!=expected:raise AssertionError(name)


def shot(page,name):
    page.screenshot(path=str(OUT/name),full_page=True)
    report['screenshots'].append(name)


def watch(page):
    saved={}
    def request(req):
        if req.url==API+'/api/profile':
            value=req.header_value('authorization')
            if value:saved['authorization']=value
    page.on('request',request)
    return saved


def claims(saved):
    part=saved['authorization'].split('.')[1]
    return json.loads(base64.urlsafe_b64decode(part+'='*(-len(part)%4)))


def login(page,url,username):
    page.goto(url)
    expect(page.locator('#username')).to_be_visible()
    page.locator('#username').fill(username)
    page.locator('#password').fill(ENV['TEST_'+username.upper()+'_PASSWORD'])
    page.locator('#kc-login').click()


def req(context,saved,path,**options):
    return context.request.get(API+path,headers={'Authorization':saved['authorization']},**options)


def main():
    if NETWORK:
        tls=ssl.create_default_context(cafile=str(ROOT/'network/.local/ca.crt'))
        opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=tls))
        with opener.open(PUBLIC+'/health',timeout=10) as r:
            check('HTTPS certificate chain and IP SAN validated',r.status,200)
    with sync_playwright() as p:
        browser=p.chromium.launch(channel=os.getenv('TEST_BROWSER_CHANNEL','chrome'),headless=True,args=['--no-proxy-server'])
        try:
            # Test automation accepts this lab certificate; the chain is independently verified above.
            ctx=browser.new_context(ignore_https_errors=NETWORK,viewport={'width':1440,'height':1050},locale='vi-VN')
            a=ctx.new_page();a.set_default_timeout(30000);sa=watch(a)
            login(a,A,'admin01');expect(a.locator('h1')).to_have_text('Không gian quản trị');expect(a.locator('.loading-line')).to_have_count(0)
            check('Web A signed in',req(ctx,sa,'/api/profile').status,200)
            shot(a,'01-web-a-admin.png')
            b=ctx.new_page();b.set_default_timeout(30000);sb=watch(b)
            b.goto(B);expect(b.locator('h1')).to_have_text('Trung tâm an ninh');expect(b.locator('.loading-line')).to_have_count(0)
            check('A to B SSO without entering password',b.locator('#password').count(),0)
            ca,cb=claims(sa),claims(sb)
            response=req(ctx,sb,'/api/security')
            check('Web B security API',response.status,200)
            check('Separate OIDC clients',[ca['azp'],cb['azp']],['employee-portal','security-dashboard'])
            check('Same Keycloak browser session',ca['sid']==cb['sid'])
            check('Web B own audience','security-api' in (cb['aud'] if isinstance(cb['aud'],list) else [cb['aud']]))
            check('Web B token cannot read attendance',req(ctx,sb,'/api/attendance').status,403)
            shot(b,'02-web-b-admin.png')
            b.get_by_role('navigation').get_by_role('button',name='Cảnh báo',exact=True).click();shot(b,'03-web-b-alerts.png')
            b.get_by_role('navigation').get_by_role('button',name='Nhật ký truy cập',exact=True).click();shot(b,'04-web-b-audit.png')
            b.get_by_role('navigation').get_by_role('button',name='Tài khoản',exact=True).click()
            check('Admin accounts rendered',b.locator('tbody tr').count()>=6)
            shot(b,'05-web-b-accounts.png')
            report['stage']='B logout redirects to login'
            b.locator('.logout-button').click();expect(b.locator('#username')).to_be_visible()
            report['stage']='Web A observes B logout'
            a.bring_to_front();expect(a.locator('#username')).to_be_visible(timeout=30000)
            shot(a,'06-logout-b-ends-a.png')
            check('B logout detected by Web A',a.locator('#username').is_visible())
            check('Old A token rejected after B logout',req(ctx,sa,'/api/profile').status,401)
            check('Old B token rejected after B logout',req(ctx,sb,'/api/profile').status,401)
            ctx.close()

            ctx=browser.new_context(ignore_https_errors=NETWORK,viewport={'width':1440,'height':1050},locale='vi-VN')
            b=ctx.new_page();b.set_default_timeout(30000);sb=watch(b)
            login(b,B,'auditor01');expect(b.locator('h1')).to_have_text('Trung tâm an ninh');expect(b.locator('.loading-line')).to_have_count(0)
            check('Auditor reads Web B',req(ctx,sb,'/api/security').status,200)
            check('Auditor denied account API',req(ctx,sb,'/api/admin/users').status,403)
            check('Auditor has no account navigation',b.get_by_role('navigation').get_by_role('button',name='Tài khoản',exact=True).count(),0)
            shot(b,'07-web-b-auditor.png')
            b.set_viewport_size({'width':390,'height':844});shot(b,'08-web-b-mobile.png')
            check('Mobile has no horizontal page overflow',b.evaluate('document.documentElement.scrollWidth<=window.innerWidth'))
            b.set_viewport_size({'width':1440,'height':1050})
            a=ctx.new_page();a.set_default_timeout(30000);sa=watch(a)
            a.goto(A);expect(a.locator('h1')).to_contain_text('Xin chào');expect(a.locator('.loading-line')).to_have_count(0)
            check('B to A SSO without password',a.locator('#password').count(),0)
            a.locator('.logout-button').click();expect(a.locator('#username')).to_be_visible()
            b.bring_to_front();expect(b.locator('#username')).to_be_visible(timeout=30000)
            shot(b,'09-logout-a-ends-b.png')
            check('A logout detected by Web B',req(ctx,sb,'/api/profile').status,401)
            ctx.close()

            for username in ['employee01','manager01']:
                ctx=browser.new_context(ignore_https_errors=NETWORK,viewport={'width':1440,'height':1050},locale='vi-VN')
                a=ctx.new_page();a.set_default_timeout(30000);sa=watch(a)
                login(a,A,username);expect(a.locator('h1')).to_contain_text('Xin chào');expect(a.locator('.loading-line')).to_have_count(0)
                # Capture B's access token on its code exchange solely in memory, so UI hiding cannot substitute for API authorization.
                b=ctx.new_page();b.set_default_timeout(30000);token={}
                def exchanged(response):
                    if '/protocol/openid-connect/token' in response.url and response.request.method=='POST' and response.status==200:
                        value=response.json().get('access_token')
                        if value:token['authorization']='Bearer '+value
                b.on('response',exchanged)
                b.goto(B);expect(b.locator('h1')).to_have_text('Bạn chưa có quyền truy cập')
                check(username+' denied by Web B UI',b.locator('h1').inner_text(),'Bạn chưa có quyền truy cập')
                check(username+' denied by Web B API',req(ctx,token,'/api/security').status,403)
                check(username+' may still use Web A',req(ctx,sa,'/api/profile').status,200)
                shot(b,'10-'+username+'-denied.png')
                ctx.close()
            ctx=browser.new_context(ignore_https_errors=NETWORK)
            page=ctx.new_page();page.goto(B);expect(page.locator('#username')).to_be_visible()
            check('Separate browser/device must authenticate independently',page.locator('#username').is_visible())
            if NETWORK:
                for path in ['/network/.local/server.key','/.env','/admin/','/a/%2e%2e/%2e%2e/.env']:
                    check('Private path blocked '+path,ctx.request.get(PUBLIC+path).status in [403,404])
            ctx.close()
        finally:
            if sys.exc_info()[0]:
                for name in ['a','b']:
                    page=locals().get(name)
                    if page and not page.is_closed():
                        try:
                            report['failure-'+name]=page.evaluate('({path:location.pathname,headings:[...document.querySelectorAll("h1")].map(x=>x.textContent),visibility:document.visibilityState})')
                            page.screenshot(path=str(OUT/('failure-'+name+'.png')),full_page=True)
                        except Exception:pass
            browser.close()
    report.pop('stage',None)
    report['success']=True


if __name__=='__main__':
    try:main()
    except Exception as error:
        report['success']=False;report['errorType']=type(error).__name__
        print('Stopped:',type(error).__name__,flush=True)
    finally:
        report['finishedAt']=datetime.now(timezone(timedelta(hours=7))).isoformat()
        (OUT/'browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2),encoding='utf-8')
    sys.exit(0 if report.get('success') else 1)
