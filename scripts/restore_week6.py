"""Roll back managed federation configuration; keep LDAP data/history and quarantine affected app accounts."""
import argparse
import hashlib
import json
import sqlite3
from datetime import datetime,timezone
from pathlib import Path
from common import ROOT,admin_token,read_env,request
from configure_network import write_env


def restore(folder):
    folder=Path(folder).resolve()
    try:folder.relative_to((ROOT/'backups').resolve())
    except ValueError:raise RuntimeError('Choose the private backup directory inside this project.')
    manifest=json.loads((folder/'manifest.json').read_text(encoding='utf-8'))
    if not manifest.get('complete') or manifest.get('scope')!='week6-directory':raise RuntimeError('This is not a complete directory configuration backup.')
    for name,digest in manifest['files'].items():
        file=(folder/name).resolve()
        try:file.relative_to(folder)
        except ValueError:raise RuntimeError('Invalid backup manifest path.')
        if not file.is_file() or hashlib.sha256(file.read_bytes()).hexdigest()!=digest:raise RuntimeError('Backup integrity mismatch; configuration was not restored.')
    saved=json.loads((folder/'week6-directory-config.json').read_text(encoding='utf-8'))
    env=read_env(ROOT/'backend/.env');provider_id=env.get('DIRECTORY_COMPONENT_ID')
    if not provider_id:raise RuntimeError('No managed directory provider is configured in backend/.env.')
    token=admin_token();base='/admin/realms/company-iam'
    def api(path,method='GET',data=None):return request(base+path,method,data,token)
    current=api('/components/'+provider_id)
    if current.get('name')!='nhip-openldap' or current.get('providerId')!='ldap':raise RuntimeError('The configured component is not the managed week-6 provider.')
    previous=next((c for c in saved['components'] if c['id']==provider_id),None)
    database=Path(env.get('ATTENDANCE_DB','data/attendance.sqlite'))
    if not database.is_absolute():database=ROOT/'backend'/database
    if not database.exists():raise RuntimeError('Application database is missing; restore it deliberately before altering federation.')
    stamp=int(datetime.now(timezone.utc).timestamp())
    with sqlite3.connect(database) as db:
        db.execute('BEGIN IMMEDIATE')
        db.execute("UPDATE staff SET disabled=1,revoked_before=MAX(revoked_before,?),directory_status='maintenance' WHERE identity_source='ldap' AND directory_provider_id=?",(stamp,provider_id))
    # Disable first; rollback must never reopen imported accounts behind the app.
    api('/components/'+provider_id,'PUT',{**current,'config':{**current.get('config',{}),'enabled':['false']}})
    if previous:
        children=api('/components?parent='+provider_id)
        old_ids={c['id'] for c in saved['components'] if c.get('parentId')==provider_id}
        managed={'nhip-'+k for k in ['username','email','firstName','lastName','nhip.directory.team','nhip.directory.status','nhip.mfa.required']}|{'nhip-directory-groups'}
        unknown=[c for c in children if c['id'] not in old_ids and c['name'] not in managed]
        if unknown:raise RuntimeError('New unrelated mappers were found. Provider remains disabled; reconcile manually.')
        for child in children:
            if child['id'] not in old_ids:api('/components/'+child['id'],'DELETE')
        for child in saved['components']:
            if child.get('parentId')==provider_id:api('/components/'+child['id'],'PUT',child)
        api('/components/'+provider_id,'PUT',previous)
    # Keep namespace/data instead of deleting imported users or their references.
    saved_env=read_env(folder/'files/backend/.env') if (folder/'files/backend/.env').exists() else {}
    write_env(ROOT/'backend/.env',{'DIRECTORY_COMPONENT_ID':saved_env.get('DIRECTORY_COMPONENT_ID',''),'DIRECTORY_SYNC_INTERVAL_SECONDS':saved_env.get('DIRECTORY_SYNC_INTERVAL_SECONDS','300')})
    print('Managed federation configuration rolled back. LDAP/application users remain quarantined for explicit review.')
    print('LDAP contents, group namespace, MFA credentials, audit/attendance history and application schema were not rolled back.')
    print('Restart the appropriate earlier runner. Use the directory.ldif backup only for a deliberate LDAP data restore into a new volume.')


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('backup')
    restore(parser.parse_args().backup)
