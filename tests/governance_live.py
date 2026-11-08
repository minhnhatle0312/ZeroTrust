"""Real local Join -> MFA -> grant -> Change -> Leave with retained audit evidence."""
import json
import secrets
import time
import sys
from unittest.mock import patch
import release_live as lab
from playwright.sync_api import sync_playwright


def main():
    source='ldap' if '--ldap' in sys.argv else 'local'
    with sync_playwright() as p:
        browser=p.chromium.launch(channel='chrome',args=['--no-proxy-server'])
        ctx,page,admin=lab.login(browser,'admin01',lab.ENV['TEST_ADMIN01_PASSWORD'])
        prefix='/api/security/governance/workflows'
        def flow(body,password=None):
            status,data=lab.api(ctx,admin,prefix,'POST',{**body,'note':'Release QA lifecycle scenario verification'})
            lab.check(body['kind']+' workflow created',status,201)
            w=data['workflow'];path=prefix+'/'+w['id']
            status,data=lab.api(ctx,admin,path+'/decision','POST',{'decision':'approve','version':w['version'],'note':'Release QA approved isolated demo identity'})
            lab.check(body['kind']+' approved',status,200)
            payload={'version':data['workflow']['version'],'note':'Release QA execute and verify remote state'}
            if password and source=='local':payload['password']=password
            status,_=lab.api(ctx,admin,path+'/execute','POST',payload)
            lab.check(body['kind']+' queued',status,202)
            for _ in range(20):
                time.sleep(1)
                _,data=lab.api(ctx,admin,path)
                if data['workflow']['state']!='running':break
            if source=='ldap' and data['workflow']['step']=='source_wait':
                import process_governance
                with patch.object(sys,'argv',['process_governance.py',w['id']]), patch.object(process_governance.getpass,'getpass',return_value=password):
                    process_governance.main()
                _,data=lab.api(ctx,admin,path)
                status,_=lab.api(ctx,admin,path+'/execute','POST',{'version':data['workflow']['version'],'note':'Release QA reconcile completed LDAP source receipt'})
                lab.check(body['kind']+' LDAP reconcile queued',status,202)
                for _ in range(20):
                    time.sleep(1)
                    _,data=lab.api(ctx,admin,path)
                    if data['workflow']['state']!='running':break
            (lab.OUT/(source+'-'+body['kind']+'-workflow.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
            lab.check(body['kind']+' confirmed',data['workflow']['state'],'synced')
            return data['user']
        username=('ldap-' if source=='ldap' else '')+'qa-jcl-'+str(int(time.time()))
        password=secrets.token_hex(18)+'Aa1!';new_password=secrets.token_hex(18)+'Aa2!'
        user=flow({'kind':'join','source':source,'username':username,'name':'Release QA Employee','email':username+'@example.test','team':'Release QA','role':'employee'},password)
        c,a,token=lab.login(browser,username,password,'a',new_password=new_password if source=='local' else None)
        if source=='ldap':new_password=password
        lab.check('Join account can use API after MFA',lab.api(c,token,'/api/profile')[0],200)
        status,data=lab.api(c,token,'/api/me/access/requests','POST',{'resource':'team-report','days':1,'note':'Release QA request temporary report access'})
        lab.check('Access request created',status,201)
        (lab.OUT/'grant-request.json').write_text(json.dumps(data,ensure_ascii=False,indent=2),encoding='utf-8')
        lab.check('Unapproved resource denied',lab.api(c,token,'/api/access/resources/team-report')[0],403)
        status,_=lab.api(ctx,admin,'/api/governance/requests/'+data['id']+'/decision','POST',{'decision':'approve','note':'Release QA approve temporary scoped report'})
        lab.check('Grant approved by administrator',status,200)
        lab.check('Approved resource accessible',lab.api(c,token,'/api/access/resources/team-report')[0],200)
        user=flow({'kind':'change','targetId':user['id'],'name':user['name'],'email':user['email'],'team':'Release QA Moved','role':'manager'})
        lab.check('Change rejects old session',lab.api(c,token,'/api/profile')[0] in [401,403])
        c.close()
        c,a,token=lab.login(browser,username,new_password,'a')
        status,profile=lab.api(c,token,'/api/profile')
        lab.check('Changed account signs in',status,200)
        lab.check('Change revokes previous grant',lab.api(c,token,'/api/access/resources/team-report')[0],403)
        user=flow({'kind':'leave','targetId':user['id']})
        lab.check('Leave rejects existing token',lab.api(c,token,'/api/profile')[0] in [401,403])
        lab.check('Leave locally disabled',user['disabled'],True)
        lab.check('Leave state retained',user['governanceState'],'left')
        browser.close()


if __name__=='__main__':
    try:main()
    finally:(lab.OUT/('governance-ldap-results.json' if '--ldap' in sys.argv else 'governance-results.json')).write_text(json.dumps({'checks':lab.checks},ensure_ascii=False,indent=2),encoding='utf-8')
