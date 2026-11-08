"""Maintain a managed LDAP demo identity at the source; no tests or app/profile writes back to LDAP."""
import argparse
import base64
import json
import re
import sqlite3
import subprocess
from datetime import datetime,timezone
from pathlib import Path
from uuid import uuid4
from urllib.parse import quote
from common import ROOT,admin_token,read_env,request
from prepare_week6 import ldif_value

COMPOSE=['docker','compose','-f','docker-compose.yml','-f','directory/compose.week6.yml','exec','-T','ldap']


def command(program,*args,ldif=None,allow_missing=False):
    result=subprocess.run(COMPOSE+[program,'-H','ldapi:///','-x','-D','cn=admin,dc=company,dc=local','-y','/bootstrap/admin-password.txt',*args],cwd=ROOT,input=ldif,capture_output=True,text=True,encoding='utf-8')
    if allow_missing and result.returncode==32:return None
    if result.returncode:raise RuntimeError('LDAP maintenance failed; no credentials or raw LDAP error body are printed. Check the directory and synchronize before releasing the hold.')
    return result.stdout


def members(dn):
    result=command('ldapsearch','-LLL','-o','ldif-wrap=no','-b',dn,'-s','base','(objectClass=*)','member')
    values=[]
    for line in result.splitlines():
        if line.startswith('member:: '):values.append(base64.b64decode(line[9:]).decode())
        elif line.startswith('member: '):values.append(line[8:])
    return values


def maintain(args):
    config=json.loads((ROOT/'directory/directory-config.json').read_text(encoding='utf-8'))
    if not re.fullmatch(r'ldap-[a-zA-Z0-9._-]{1,45}',args.username):raise RuntimeError('Only explicitly named ldap-* identities are managed here.')
    if args.team and (not 2<=len(args.team.strip())<=80 or any(c in args.team for c in '\r\n\x00')):raise RuntimeError('Team must be 2–80 characters without control characters.')
    if not any([args.team,args.group,args.disable,args.enable]):raise RuntimeError('Choose --team, --group, --disable or --enable.')
    if not 10<=len(args.note.strip())<=300:raise RuntimeError('Provide a maintenance reason of 10–300 characters.')
    env=read_env(ROOT/'backend/.env');provider=env.get('DIRECTORY_COMPONENT_ID')
    if not provider:raise RuntimeError('Apply the week-6 provider before directory maintenance.')
    token=admin_token();base='/admin/realms/company-iam'
    users=request(base+'/users?exact=true&username='+quote(args.username),token=token)
    existing=next((u for u in users if u.get('federationLink')==provider),None)
    if users and not existing:raise RuntimeError('The username belongs to another identity source. No LDAP changes were made.')
    if not existing:raise RuntimeError('Import and synchronize the managed LDAP user first before maintenance.')
    database=Path(env.get('ATTENDANCE_DB','data/attendance.sqlite'))
    if not database.is_absolute():database=ROOT/'backend'/database
    if not database.exists():raise RuntimeError('Start the week-6 backend once to prepare the application schema before maintenance.')
    stamp=datetime.now(timezone.utc);timestamp=stamp.isoformat().replace('+00:00','Z');identifier=str(uuid4())
    with sqlite3.connect(database) as db:
        db.execute('BEGIN IMMEDIATE')
        row=db.execute('SELECT id,identity_source,governance_state FROM staff WHERE username=?',(args.username,)).fetchone()
        if not row:raise RuntimeError('Complete an application Directory sync before source maintenance.')
        if row[1]!='ldap' or row[0]!=existing['id']:raise RuntimeError('Application/source identity does not match; no LDAP changes were made.')
        workflow_id=getattr(args,'workflow_id',None)
        if db.execute("SELECT id FROM lifecycle_workflows WHERE state='running' AND step='source_write' AND id<>?",(workflow_id or '',)).fetchone():raise RuntimeError('A lifecycle source writer is active; serialize LDAP maintenance.')
        if row[2]!='active':
            workflow=db.execute("SELECT id FROM lifecycle_workflows WHERE id=? AND target_id=? AND source='ldap' AND approval='approved' AND state='running' AND step='source_write'",(workflow_id,row[0])).fetchone() if workflow_id else None
            if not workflow:raise RuntimeError('A lifecycle hold is active. Use scripts/process_governance.py for its approved request instead of changing the source separately.')
        if db.execute("SELECT user_id FROM directory_maintenance WHERE state='writing' AND user_id<>?",(row[0],)).fetchone():raise RuntimeError('Another directory writer is active; serialize group maintenance before continuing.')
        held=db.execute("SELECT state FROM directory_maintenance WHERE user_id=?",(row[0],)).fetchone()
        if held and held[0]=='writing' and not args.resume:raise RuntimeError('A source write is already held. Inspect/stop the earlier operation before using --resume with a complete intended change.')
        db.execute("UPDATE staff SET directory_status='maintenance',revoked_before=MAX(revoked_before,?) WHERE id=?",(int(stamp.timestamp()),row[0]))
        db.execute("INSERT INTO directory_maintenance(user_id,state,note,started_at) VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET state='writing',note=excluded.note,started_at=excluded.started_at,finished_at=NULL",(row[0],'writing',args.note.strip(),timestamp))
        db.execute('INSERT INTO events(request_id,time,username,method,path,status,decision,reason,target,client_id,role) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            (identifier,timestamp,'directory-cli','PATCH','/directory/maintenance',202,'ALLOW','DIRECTORY_MAINTENANCE_REQUESTED',existing['id'] if existing else None,'directory-cli','operator'))
    # A hold precedes writes. If logout or LDAP modification fails, do not undo
    # the hold automatically; an explicit source reconciliation must release it.
    if existing:request(base+'/users/'+existing['id']+'/logout','POST',token=token)
    user_dn='uid='+args.username+','+config['usersDn']
    command('ldapsearch','-LLL','-b',user_dn,'-s','base','(objectClass=inetOrgPerson)','uid')
    lines=[ldif_value('dn',user_dn),'changetype: modify']
    if args.team:lines+=['replace: ou',ldif_value('ou',args.team.strip()),'-']
    if args.disable or args.enable:lines+=['replace: employeeType','employeeType: '+('disabled' if args.disable else 'active'),'-']
    if len(lines)>2:command('ldapmodify',ldif='\n'.join(lines)+'\n')
    if args.group:
        # Remove memberships before adding the target. LDAP modifications are
        # atomic per entry, not across three groups; the application hold is kept.
        for mapping in sorted(config['mappings'],key=lambda m:m['ldapGroup']==args.group):
            dn='cn='+mapping['ldapGroup']+','+config['groupsDn']
            values=[v for v in members(dn) if v.lower()!=user_dn.lower() and v.lower()!=config['bindDn'].lower()]
            if mapping['ldapGroup']==args.group:values.append(user_dn)
            values=values or [config['bindDn']]
            change=[ldif_value('dn',dn),'changetype: modify','replace: member']+[ldif_value('member',v) for v in values]
            command('ldapmodify',ldif='\n'.join(change)+'\n')
    finished=datetime.now(timezone.utc).isoformat().replace('+00:00','Z')
    with sqlite3.connect(database) as db:
        db.execute("UPDATE directory_maintenance SET state='ready',finished_at=? WHERE user_id=?",(finished,existing['id']))
        db.execute('INSERT INTO events(request_id,time,username,method,path,status,decision,reason,target,client_id,role) VALUES(?,?,?,?,?,?,?,?,?,?,?)',
            (identifier,finished,'directory-cli','PATCH','/directory/maintenance',200,'ALLOW','DIRECTORY_SOURCE_CHANGED',existing['id'] if existing else None,'directory-cli','operator'))
    print('LDAP source updated. Run a full sync from Web B Directory before the user signs in again.')
    print('The maintenance hold remains until successful reconciliation. No LDAP/app password was reset.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('username')
    parser.add_argument('--team')
    parser.add_argument('--group',choices=['employees','managers','auditors'])
    status=parser.add_mutually_exclusive_group()
    status.add_argument('--disable',action='store_true');status.add_argument('--enable',action='store_true')
    parser.add_argument('--note',required=True)
    parser.add_argument('--resume',action='store_true',help='Explicitly resume an inspected/stopped failed maintenance operation; never use while the prior writer runs.')
    maintain(parser.parse_args())
