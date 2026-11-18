"""Snapshot LDAP data/config plus the existing Keycloak/SQLite backup; no tests."""
import hashlib
import json
import os
import shutil
import subprocess
from common import ROOT,admin_token,request
from backup_week5 import create_backup


def create_directory_backup():
    folder,_=create_backup()
    token=admin_token();base='/admin/realms/company-iam'
    components=request(base+'/components',token=token)
    groups=request(base+'/groups?briefRepresentation=false&max=1000',token=token)
    managed=[]
    root=next((g for g in groups if g.get('path')=='/directory'),None)
    if root:
        managed=[root]+request(base+'/groups/'+root['id']+'/children?max=100',token=token)
    snapshot={'components':components,'userProfile':request(base+'/users/profile',token=token),
              'groupRoles':{g['id']:request(base+'/groups/'+g['id']+'/role-mappings/realm',token=token) for g in managed}}
    (folder/'week6-directory-config.json').write_text(json.dumps(snapshot,ensure_ascii=False,indent=2),encoding='utf-8')
    private=ROOT/'directory/.local'
    if not private.exists():raise RuntimeError('Prepare directory/.local before taking the directory snapshot.')
    shutil.copytree(private,folder/'directory-private')
    command=['docker','compose','-f','docker-compose.yml','-f','directory/compose.week6.yml','exec','-T','ldap',
             'slapcat','-f','/run/nhip-ldap/slapd.conf']
    with (folder/'directory.ldif').open('wb') as output:
        result=subprocess.run(command,cwd=ROOT,stdout=output,stderr=subprocess.PIPE)
    if result.returncode:raise RuntimeError('LDAP backup failed. No federation configuration was changed. The incomplete snapshot must not be used for restore.')
    manifest_path=folder/'manifest.json'
    manifest=json.loads(manifest_path.read_text(encoding='utf-8'))
    manifest['scope']='week6-directory'
    manifest['files']={str(p.relative_to(folder)):hashlib.sha256(p.read_bytes()).hexdigest() for p in folder.rglob('*') if p.is_file() and p.name!='manifest.json'}
    manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2),encoding='utf-8')
    for p in folder.rglob('*'):
        if p.is_file():os.chmod(p,0o600)
    return folder,snapshot


if __name__=='__main__':
    folder,_=create_directory_backup()
    print('Directory/Keycloak/SQLite backup:',folder.relative_to(ROOT))
    print('Snapshots are separate; stop application/directory writes for a coordinated recovery point.')
