"""Controlled synthetic experiment against live PostgreSQL. Not real-world model accuracy."""
import json
import sys
import time
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.request import Request, build_opener, ProxyHandler
from urllib.error import HTTPError
from urllib.parse import quote

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from common import read_env
ENV=read_env(ROOT/'backend/.env')
OUT=ROOT/'evidence/release';OUT.mkdir(parents=True,exist_ok=True)
HTTP=build_opener(ProxyHandler({}));checks=[]


def api(path,body=None,authorized=True):
    headers={'Content-Type':'application/json'}
    if authorized:headers['Authorization']='Bearer '+ENV['AUDIT_SERVICE_TOKEN']
    req=Request(ENV['AUDIT_SERVICE_URL']+path,headers=headers,data=json.dumps(body).encode() if body is not None else None)
    try:r=HTTP.open(req,timeout=30)
    except HTTPError as error:r=error
    with r:return r.status,json.load(r)


def check(name,actual,expected=True):
    checks.append({'name':name,'actual':actual,'expected':expected,'passed':actual==expected})
    print(('PASS ' if actual==expected else 'FAIL ')+name,flush=True)
    assert actual==expected,name


def main():
    check('Private service requires machine credential',api('/events',authorized=False)[0],401)
    check('PostgreSQL ready',api('/health')[1]['connected'])
    run='qa-'+uuid.uuid4().hex[:12]
    base=datetime.now(timezone.utc).replace(hour=3,minute=0,second=0,microsecond=0)-timedelta(days=1)
    rows=[];targets={}
    def add(scenario,index,action='READ',decision='ALLOW',ip='192.0.2.1',stamp=None,resource='/api/profile',role='employee'):
        key=run+'-'+scenario+'-'+str(index)
        rows.append({'event_id':key,'timestamp':(stamp or base+timedelta(seconds=index)).isoformat(),'source':'web-a',
                     'user_id':run+'-'+scenario,'username':run,'client_id':'employee-portal','action':action,'decision':decision,
                     'ip_address':ip,'resource':resource,'http_status':403 if decision=='DENY' else 200,
                     'request_id':run+'-correlation','details':{'role':role,'password':'must-not-be-stored'}})
        return key
    for i in range(20):targets[add('normal'+str(i),0)]=('Normal','normal')
    for i in range(5):key=add('login',i,'LOGIN_ERROR','DENY')
    targets[key]=('Anomaly','LOGIN_FAILURE_BURST')
    for i in range(10):key=add('deny',i,'INSUFFICIENT_ROLE','DENY')
    targets[key]=('Anomaly','CONSECUTIVE_DENY')
    targets[add('admin',0,'INSUFFICIENT_ROLE','DENY',resource='/api/admin')]=('Anomaly','EMPLOYEE_ADMIN_ACCESS')
    targets[add('revoke',0,'SESSION_REVOKED','DENY')]=('Anomaly','REVOKED_TOKEN_REUSE')
    for i in range(5):add('ip',i)
    targets[add('ip',6,ip='198.51.100.7')]=('Anomaly','NEW_IP_REVIEW')
    targets[add('night',0,stamp=base.replace(hour=18))]=('Anomaly','OUTSIDE_BUSINESS_HOURS')
    for i in range(100):key=add('spike',i)
    targets[key]=('Anomaly','REQUEST_SPIKE')
    status,data=api('/ingest',{'events':rows})
    check('Batch ingest committed',status,200);check('All unique events inserted',data['inserted'],len(rows))
    check('Replay deduplicates',api('/ingest',{'events':rows})[1]['inserted'],0)
    check('Reject malformed batch',api('/ingest',{'events':[rows[0],{'event_id':'bad'}]})[0],400)
    _,detail=api('/events/'+quote(rows[0]['event_id']))
    check('Sensitive payload fields discarded','password' not in detail['event']['details'])
    check('Correlation returns related events',len(detail['related']),100)
    check('Correlation truncation disclosed',detail['complete'],False)
    _,page=api('/events?q='+run+'&limit=25')
    check('Pagination total',page['total'],len(rows));check('Pagination first page',len(page['rows']),25)
    # Drain bounded jobs until every fixture has been classified. Production auto-run stays unchanged.
    for _ in range(80):
        _,status=api('/detection/status')
        if not status['pending']:break
        check('Queue detection batch',api('/detection/run',{'actor':'release-qa'})[0],200)
        for _ in range(30):
            time.sleep(1)
            _,status=api('/detection/status')
            if status['runs'][0]['state'] not in ['queued','running']:break
        check('Detection batch succeeds',status['runs'][0]['state'],'completed')
    found={}
    for offset in range(0,100000,25):
        _,result=api('/detection/results?offset='+str(offset))
        for row in result['rows']:
            if row['event_id'] in targets:found[row['event_id']]=row
        if len(found)==len(targets) or offset+25>=result['total']:break
    check('Every scenario has a result',len(found),len(targets))
    dataset=[]
    for key,(truth,scenario) in targets.items():
        row=found[key]
        check(scenario+' prediction',row['prediction'],truth)
        if truth=='Anomaly':check(scenario+' explanation',scenario in row['rules'])
        dataset.append({'event_id':key,'label':truth,'prediction':row['prediction'],'scenario':run+'-'+scenario,
                        'split':'evaluation','review_note':'Controlled synthetic scenario; label defined before inference, not human-reviewed production data.',
                        'latency_ms':row['latency_ms']})
        status,_=api('/detection/labels/'+quote(key),{'actor':'release-qa-synthetic','label':truth,'scenario':run+'-'+scenario,
                     'split':'evaluation','note':dataset[-1]['review_note'],'version':0})
        check('Store controlled scenario label',status,200)
    status,evaluation=api('/detection/evaluate',{'actor':'release-qa-synthetic'})
    check('Persist evaluation snapshot',status,200)
    (OUT/'synthetic-dataset.jsonl').write_text(''.join(json.dumps(r)+'\n' for r in dataset),encoding='utf-8')
    (OUT/'detection-evaluation.json').write_text(json.dumps({'scope':'Controlled synthetic fixtures only; not real-world accuracy','evaluation':evaluation},indent=2),encoding='utf-8')


if __name__=='__main__':
    try:main()
    finally:(OUT/'audit-results.json').write_text(json.dumps({'checks':checks},indent=2),encoding='utf-8')
