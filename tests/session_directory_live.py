"""Live LDAP outage containment and refresh-token rotation, with guaranteed service restart."""
import json
import subprocess
import time
import release_live as lab
from playwright.sync_api import sync_playwright


def main():
    password=json.loads((lab.ROOT/'directory/.local/credentials.json').read_text())['users']['ldap-employee01']
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',args=['--no-proxy-server'])
        tokens=[]
        def capture(response):
            if response.url==lab.PUBLIC+'/realms/company-iam/protocol/openid-connect/token' and response.status==200:
                tokens.append(response.json())
        browser.on('context',lambda ctx:ctx.on('response',capture))
        ctx,page,saved=lab.login(browser,'ldap-employee01',password,'a',True)
        lab.check('Live LDAP API before outage',lab.api(ctx,saved,'/api/profile')[0],200)
        try:
            subprocess.run(['docker','stop','iam-zerotrust-ldap-1'],check=True,capture_output=True)
            time.sleep(6)
            status,_=lab.api(ctx,saved,'/api/profile')
            lab.check('LDAP outage fails closed',status in [401,403,503])
        finally:
            subprocess.run(['docker','start','iam-zerotrust-ldap-1'],check=True,capture_output=True)
        time.sleep(7)
        # The browser may end its session while identity verification is unavailable.
        # Recovery must allow a fresh authenticated session, not resurrect a revoked one.
        ctx.close()
        ctx,page,saved=lab.login(browser,'ldap-employee01',password,'a')
        lab.check('LDAP login recovers after source restart',lab.api(ctx,saved,'/api/profile')[0],200)
        lab.check('Captured token exchange in memory',bool(tokens))
        original=tokens[-1]['refresh_token']
        endpoint=lab.PUBLIC+'/realms/company-iam/protocol/openid-connect/token'
        first=ctx.request.post(endpoint,form={'grant_type':'refresh_token','client_id':'employee-portal','refresh_token':original})
        lab.check('Refresh succeeds',first.status,200)
        replacement=first.json()['refresh_token']
        lab.check('Refresh rotates token',replacement!=original)
        repeated=ctx.request.post(endpoint,form={'grant_type':'refresh_token','client_id':'employee-portal','refresh_token':original})
        lab.check('Old refresh token rejected',repeated.status,400)
        lab.check('Malformed access token rejected',lab.api(ctx,{'authorization':'Bearer not-a-jwt'},'/api/profile')[0],401)
        ctx.close();browser.close()


if __name__=='__main__':
    try:main()
    finally:(lab.OUT/'session-directory-results.json').write_text(json.dumps({'checks':lab.checks},ensure_ascii=False,indent=2),encoding='utf-8')
