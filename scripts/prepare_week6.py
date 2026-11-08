"""Prepare private OpenLDAP bootstrap files. Does not start Docker, configure Keycloak or run tests."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import secrets
import shutil
import subprocess
from common import ROOT

CONFIG=ROOT/'directory/directory-config.json'
PRIVATE=ROOT/'directory/.local'


def private_write(path,content,public=False):
    path.write_text(content,encoding='utf-8',newline='\n')
    os.chmod(path,0o644 if public else 0o600)


def ssha(password):
    salt=secrets.token_bytes(16)
    return '{SSHA}'+base64.b64encode(hashlib.sha1(password.encode()+salt).digest()+salt).decode()


def ldif_value(name,value):
    raw=str(value).encode('utf-8')
    if not raw or raw[:1] in [b' ',b':',b'<'] or raw[-1:]==b' ' or any(n<32 or n>126 for n in raw):
        return name+':: '+base64.b64encode(raw).decode()
    return name+': '+raw.decode('ascii')


def prepare():
    config=json.loads(CONFIG.read_text(encoding='utf-8'))
    PRIVATE.mkdir(parents=True,exist_ok=True,mode=0o700)
    path=PRIVATE/'credentials.json'
    if path.exists():
        credentials=json.loads(path.read_text(encoding='utf-8'))
    else:
        credentials={'admin':secrets.token_urlsafe(36),'reader':secrets.token_urlsafe(36),'users':{}}
    for user in config['users']:
        credentials['users'].setdefault(user['username'],secrets.token_urlsafe(24)+'Aa1!')
    private_write(path,json.dumps(credentials,ensure_ascii=False,indent=2)+'\n')
    private_write(PRIVATE/'admin-password.txt',credentials['admin'])

    openssl=shutil.which('openssl') or next((str(p) for p in [Path('C:/Program Files/Git/usr/bin/openssl.exe')] if p.exists()),None)
    if not openssl:raise RuntimeError('OpenSSL is required to prepare LDAPS certificates.')
    def run(*args):
        r=subprocess.run([openssl,*args],cwd=PRIVATE,capture_output=True)
        if r.returncode:raise RuntimeError('OpenSSL could not prepare LDAPS certificates. No service was started.')
    if not (PRIVATE/'ca.crt').exists():
        if (PRIVATE/'ca.key').exists():raise RuntimeError('Incomplete CA files; restore the existing CA certificate before continuing.')
        run('req','-x509','-newkey','rsa:3072','-sha256','-nodes','-days','365','-keyout','ca.key','-out','ca.crt','-subj','/CN=Nhip Directory Lab CA','-addext','basicConstraints=critical,CA:TRUE,pathlen:0','-addext','keyUsage=critical,keyCertSign,cRLSign')
    if not (PRIVATE/'server.crt').exists():
        private_write(PRIVATE/'server.ext','subjectAltName=DNS:ldap,DNS:localhost,IP:127.0.0.1\nbasicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\n')
        run('req','-new','-newkey','rsa:2048','-nodes','-keyout','server.key','-out','server.csr','-subj','/CN=ldap')
        run('x509','-req','-in','server.csr','-CA','ca.crt','-CAkey','ca.key','-CAcreateserial','-out','server.crt','-days','90','-sha256','-extfile','server.ext')
    for name in ['ca.key','server.key']:os.chmod(PRIVATE/name,0o600)
    for name in ['ca.crt','server.crt']:os.chmod(PRIVATE/name,0o644)
    template=(ROOT/'directory/slapd.conf.template').read_text(encoding='utf-8')
    private_write(PRIVATE/'slapd.conf',template.replace('@ADMIN_HASH@',ssha(credentials['admin'])))

    entries=[]
    def add(*pairs):entries.append('\n'.join(ldif_value(k,v) for k,v in pairs))
    base=config['baseDn']
    add(('dn',base),('objectClass','top'),('objectClass','dcObject'),('objectClass','organization'),('dc','company'),('o','Nhip IAM Lab'))
    for ou in ['people','groups','services']:
        add(('dn','ou='+ou+','+base),('objectClass','organizationalUnit'),('ou',ou))
    add(('dn',config['bindDn']),('objectClass','organizationalRole'),('objectClass','simpleSecurityObject'),('cn','keycloak-reader'),('description','Read-only Keycloak service bind'),('userPassword',ssha(credentials['reader'])))
    for user in config['users']:
        add(('dn','uid='+user['username']+','+config['usersDn']),('objectClass','inetOrgPerson'),('uid',user['username']),('cn',user['sn']+' '+user['givenName']),('sn',user['sn']),('givenName',user['givenName']),('mail',user['username']+'@example.test'),('ou',user['team']),('employeeType','active'),('businessCategory','true'),('userPassword',ssha(credentials['users'][user['username']])))
    for mapping in config['mappings']:
        members=[('member','uid='+u['username']+','+config['usersDn']) for u in config['users'] if u['group']==mapping['ldapGroup']]
        add(('dn','cn='+mapping['ldapGroup']+','+config['groupsDn']),('objectClass','groupOfNames'),('cn',mapping['ldapGroup']),*(members or [('member',config['bindDn'])]))
    private_write(PRIVATE/'bootstrap.ldif','\n\n'.join(entries)+'\n')
    print('Private LDAPS/bootstrap files ready in directory/.local. Existing credentials preserved.')
    print('No containers, authentication flow, federation or tests were started.')


if __name__=='__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    prepare()
