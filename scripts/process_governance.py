"""Apply one approved LDAP lifecycle intent at its source, then keep the app hold for reconciliation.

Never invoked by the web server. This operator tool needs the local private LDAP
credential. Password enrollment for Join is interactive and is never journaled.
"""
import argparse
import base64
from datetime import datetime,timezone
import getpass
import json
from pathlib import Path
import re
import sqlite3
from types import SimpleNamespace
from uuid import uuid4
from common import ROOT,read_env
from directory_user import command,members,maintain
from prepare_week6 import ldif_value,ssha


def timestamp():return datetime.now(timezone.utc).isoformat().replace('+00:00','Z')


def attribute(output,name):
    values=[]
    for line in (output or '').splitlines():
        if line.startswith(name+':: '):values.append(base64.b64decode(line[len(name)+3:]).decode('utf-8'))
        elif line.startswith(name+': '):values.append(line[len(name)+2:])
    return values


def join(workflow,config,password):
    desired=json.loads(workflow['desired_json']);username=workflow['username']
    dn='uid='+username+','+config['usersDn'];marker='nhip-governance:'+workflow['id']
    found=command('ldapsearch','-LLL','-o','ldif-wrap=no','-b',dn,'-s','base','(objectClass=inetOrgPerson)','description',allow_missing=True)
    if found is not None and marker not in attribute(found,'description'):raise RuntimeError('The LDAP username belongs to another source operation. Nothing was overwritten.')
    if found is None:
        words=desired['name'].split()
        pairs=[('dn',dn),('objectClass','inetOrgPerson'),('uid',username),('cn',desired['name']),('sn',' '.join(words[:-1])),('givenName',words[-1]),('mail',desired['email']),('ou',desired['team']),('employeeType','disabled'),('businessCategory','true'),('description',marker),('userPassword',ssha(password))]
        command('ldapadd',ldif='\n'.join(ldif_value(k,v) for k,v in pairs)+'\n')
    # First remove any prior memberships; add the approved default group last.
    for mapping in sorted(config['mappings'],key=lambda m:m['role']=='employee'):
        group_dn='cn='+mapping['ldapGroup']+','+config['groupsDn']
        values=[v for v in members(group_dn) if v.lower() not in [dn.lower(),config['bindDn'].lower()]]
        if mapping['role']=='employee':values.append(dn)
        values=values or [config['bindDn']]
        change=[ldif_value('dn',group_dn),'changetype: modify','replace: member']+[ldif_value('member',v) for v in values]
        command('ldapmodify',ldif='\n'.join(change)+'\n')
    # READ_ONLY Keycloak cannot rotate an LDAP password. The recipient chooses
    # their final password here, replacing the disabled bootstrap before activation.
    change=[ldif_value('dn',dn),'changetype: modify','replace: userPassword',ldif_value('userPassword',ssha(password)),'-',
            'replace: employeeType','employeeType: active','-','replace: businessCategory','businessCategory: true']
    command('ldapmodify',ldif='\n'.join(change)+'\n')


def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('workflow_id');parser.add_argument('--resume',action='store_true',help='Only after inspecting/stopping the prior failed source writer.');args=parser.parse_args()
    env=read_env(ROOT/'backend/.env');database=Path(env.get('ATTENDANCE_DB','data/attendance.sqlite'))
    if not database.is_absolute():database=ROOT/'backend'/database
    if not database.exists():raise RuntimeError('Start the updated backend schema before using this operator tool.')
    with sqlite3.connect(database) as db:
        db.row_factory=sqlite3.Row;row=db.execute('SELECT * FROM lifecycle_workflows WHERE id=?',(args.workflow_id,)).fetchone()
        if not row:raise RuntimeError('Unknown workflow.')
        workflow=dict(row)
    if workflow['source']!='ldap' or workflow['approval']!='approved' or workflow['state']=='synced' or not workflow['attempts']:raise RuntimeError('Execute an approved LDAP workflow from Web B first. No source changes were made.')
    if workflow['source_done']:raise RuntimeError('Source receipt is already recorded. Reconcile from Web B; do not replay this source change.')
    if not re.fullmatch(r'ldap-[a-zA-Z0-9._-]{1,45}',workflow['username']):raise RuntimeError('Not a managed LDAP username.')
    if workflow['state']=='running' and not (args.resume and workflow['step']=='source_write'):raise RuntimeError('A backend/source operation is running. Inspect/stop the previous writer before a deliberate --resume.')
    with sqlite3.connect(database) as db:
        failed_source=db.execute("SELECT id FROM lifecycle_history WHERE workflow_id=? AND event='SOURCE_PARTIAL' LIMIT 1",(args.workflow_id,)).fetchone()
    if failed_source and not args.resume:raise RuntimeError('A prior source write failed. Inspect/stop the previous writer and use --resume for the complete intended change.')
    config=json.loads((ROOT/'directory/directory-config.json').read_text(encoding='utf-8'));desired=json.loads(workflow['desired_json'])
    password=None
    if workflow['kind']=='join':
        print('The recipient must choose their LDAP password privately. It will not be printed or saved in the workflow.')
        password=getpass.getpass('New LDAP password: ');confirmation=getpass.getpass('Confirm LDAP password: ')
        if password!=confirmation or not 12<=len(password)<=128 or not re.search('[a-z]',password) or not re.search('[A-Z]',password) or not re.search('[0-9]',password):raise RuntimeError('Passwords must match, be 12-128 characters and include upper/lowercase letters and a digit.')
        confirmation=None
    with sqlite3.connect(database) as db:
        db.execute('BEGIN IMMEDIATE')
        current=db.execute('SELECT version,state,source_done FROM lifecycle_workflows WHERE id=?',(args.workflow_id,)).fetchone()
        if current[0]!=workflow['version'] or current[2]:raise RuntimeError('Workflow changed; reload it before writing the source.')
        if db.execute("SELECT id FROM lifecycle_workflows WHERE id<>? AND state='running' AND step='source_write'",(args.workflow_id,)).fetchone():raise RuntimeError('Another source writer is active. Serialize LDAP lifecycle writes.')
        if db.execute("SELECT user_id FROM directory_maintenance WHERE state='writing' AND user_id<>?",(workflow['target_id'] or '',)).fetchone():raise RuntimeError('Another LDAP maintenance writer is active.')
        db.execute("UPDATE lifecycle_workflows SET state='running',step='source_write',version=version+1,updated_at=? WHERE id=?",(timestamp(),args.workflow_id))
        db.execute('INSERT INTO lifecycle_history(id,workflow_id,event,note,time) VALUES(?,?,?,?,?)',(str(uuid4()),args.workflow_id,'SOURCE_WRITE_STARTED','Operator started the approved source intent.',timestamp()))
    try:
        if workflow['kind']=='join':join(workflow,config,password)
        else:
            mapping=next((m for m in config['mappings'] if m['role']==desired.get('role')),None)
            if workflow['kind']=='change' and not mapping:raise RuntimeError('No approved LDAP group mapping exists.')
            maintain(SimpleNamespace(username=workflow['username'],team=desired.get('team'),group=mapping['ldapGroup'] if mapping else None,
                disable=workflow['kind']=='leave',enable=False,note=workflow['note'][:300],resume=args.resume,workflow_id=workflow['id']))
        with sqlite3.connect(database) as db:
            receipt=str(uuid4());time=timestamp()
            db.execute("UPDATE lifecycle_workflows SET source_done=1,source_receipt=?,state='partial',step='reconcile',message=?,version=version+1,updated_at=? WHERE id=?",(receipt,'Source writes completed; application access remains held until Web B reconciliation.',time,args.workflow_id))
            db.execute('INSERT INTO lifecycle_history(id,workflow_id,event,note,time) VALUES(?,?,?,?,?)',(str(uuid4()),args.workflow_id,'SOURCE_WRITTEN','LDAP operation completed. This receipt is not an acceptance test.',time))
            db.execute('INSERT INTO events(request_id,time,username,method,path,status,decision,reason,target) VALUES(?,?,?,?,?,?,?,?,?)',(receipt,time,'governance-cli','PATCH','/governance/source',202,'ALLOW','LIFECYCLE_SOURCE_WRITTEN',args.workflow_id))
        print('Source receipt recorded. Open Web B, inspect the workflow and execute reconciliation. The application hold remains.')
    except Exception:
        with sqlite3.connect(database) as db:
            db.execute("UPDATE lifecycle_workflows SET state='partial',step='source_wait',message=?,version=version+1,updated_at=? WHERE id=?",('Source write was not confirmed. Inspect the LDAP entries and any maintenance hold before --resume.',timestamp(),args.workflow_id))
            db.execute('INSERT INTO lifecycle_history(id,workflow_id,event,note,time) VALUES(?,?,?,?,?)',(str(uuid4()),args.workflow_id,'SOURCE_PARTIAL','Source write was not confirmed; all application holds remain.',timestamp()))
        raise RuntimeError('LDAP source operation was not confirmed. No raw response or credentials are printed; inspect the held workflow.') from None
    finally:password=None


if __name__=='__main__':main()
