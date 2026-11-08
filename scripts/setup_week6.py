"""Configure the explicit READ_ONLY OpenLDAP provider. No tests or user synchronization are run."""
import argparse
import json
import os
from urllib.parse import quote
from common import ROOT,admin_token,request
from backup_week6 import create_directory_backup
from configure_network import write_env

PROVIDER='nhip-openldap'
ATTRS={'nhip.directory.team':'ou','nhip.directory.status':'employeeType','nhip.mfa.required':'businessCategory'}


def configure():
    config=json.loads((ROOT/'directory/directory-config.json').read_text(encoding='utf-8'))
    credentials_path=ROOT/'directory/.local/credentials.json'
    if not credentials_path.exists():raise RuntimeError('Run scripts/prepare_week6.py and start the week-6 Compose overlay first.')
    credentials=json.loads(credentials_path.read_text(encoding='utf-8'))
    token=admin_token();base='/admin/realms/company-iam'
    def api(path,method='GET',body=None):return request(base+path,method,body,token)
    # Take the existing backup before changing the realm, including provider secrets.
    backup,snapshot=create_directory_backup()
    components=api('/components')
    clients=api('/clients')
    mfa_flow=next((f for f in api('/authentication/flows') if f['alias']=='nhip-week5-browser'),None)
    for name in ['employee-portal','security-dashboard']:
        client=next((c for c in clients if c['clientId']==name),None)
        if not client or not mfa_flow or client.get('authenticationFlowBindingOverrides',{}).get('browser')!=mfa_flow['id']:
            raise RuntimeError('Apply the week-5 MFA browser flow first; LDAP demos require OTP. No directory provider was changed.')
    events=api('/events/config')
    if events.get('adminEventsDetailsEnabled'):
        api('/events/config','PUT',{**events,'adminEventsDetailsEnabled':False})
    profile=api('/users/profile')
    attributes=[a for a in profile.get('attributes',[]) if a['name'] not in ATTRS]
    for name in ATTRS:
        previous=next((a for a in profile.get('attributes',[]) if a['name']==name),{})
        attributes.append({**previous,'name':name,'displayName':name,'permissions':{'view':['admin'],'edit':['admin']},'multivalued':False})
    api('/users/profile','PUT',{**profile,'attributes':attributes})
    realm=api('')
    desired={'name':PROVIDER,'providerId':'ldap','providerType':'org.keycloak.storage.UserStorageProvider','parentId':realm['id'],
        'config':{k:[v] for k,v in {'enabled':'false','priority':'10','editMode':'READ_ONLY','importEnabled':'true','syncRegistrations':'false',
          'vendor':'other','usernameLDAPAttribute':'uid','rdnLDAPAttribute':'uid','uuidLDAPAttribute':'entryUUID','userObjectClasses':'inetOrgPerson',
          'connectionUrl':'ldaps://ldap:636','usersDn':config['usersDn'],'authType':'simple','bindDn':config['bindDn'],
          'bindCredential':credentials['reader'],'searchScope':'1','useTruststoreSpi':'always','connectionPooling':'false','pagination':'true',
          'connectionTimeout':'5000','readTimeout':'5000','cachePolicy':'NO_CACHE','fullSyncPeriod':'-1','changedSyncPeriod':'-1',
          'batchSizeForSync':'100','removeInvalidUsersEnabled':'false','customUserSearchFilter':'(uid=ldap-*)'}.items()}}
    matching=[c for c in components if c.get('name')==PROVIDER and c['providerId']=='ldap']
    if len(matching)>1:raise RuntimeError('More than one managed provider exists; resolve the configuration before continuing.')
    if matching:api('/components/'+matching[0]['id'],'PUT',{**matching[0],**desired})
    else:api('/components','POST',desired)
    provider=next(c for c in api('/components') if c.get('name')==PROVIDER and c['providerId']=='ldap')
    provider_id=provider['id']

    def mapper(name,provider_kind,values):
        existing=api('/components?parent='+quote(provider_id)+'&type='+quote('org.keycloak.storage.ldap.mappers.LDAPStorageMapper'))
        candidates=[c for c in existing if c.get('name')==name or (provider_kind=='user-attribute-ldap-mapper' and c['providerId']==provider_kind and c.get('config',{}).get('user.model.attribute')==[values['user.model.attribute']])]
        if len(candidates)>1:raise RuntimeError('Duplicate LDAP attribute mappers; review the saved configuration before continuing.')
        current=candidates[0] if candidates else None
        body={'name':name,'providerId':provider_kind,'providerType':'org.keycloak.storage.ldap.mappers.LDAPStorageMapper','parentId':provider_id,'config':{k:[v] for k,v in values.items()}}
        api('/components/'+current['id'] if current else '/components','PUT' if current else 'POST',{**(current or {}),**body})

    for user_attr,ldap_attr in {'username':'uid','email':'mail','firstName':'givenName','lastName':'sn',**ATTRS}.items():
        mapper('nhip-'+user_attr,'user-attribute-ldap-mapper',{'user.model.attribute':user_attr,'ldap.attribute':ldap_attr,'read.only':'true','always.read.value.from.ldap':'true','is.mandatory.in.ldap':'true'})
    # Isolated group subtree; never reuse or drop the application's existing groups.
    groups=api('/groups?search=directory&exact=true&briefRepresentation=false')
    root=next((g for g in groups if g['path']==config['groupRoot']),None)
    if not root:
        api('/groups','POST',{'name':'directory'})
        root=next(g for g in api('/groups?search=directory&exact=true') if g['path']==config['groupRoot'])
    if any(r['name'] in ['admin','employee','manager','auditor'] for r in api('/groups/'+root['id']+'/role-mappings/realm/composite')):
        raise RuntimeError('The directory parent group must not carry business roles.')
    for mapping in config['mappings']:
        children=api('/groups/'+root['id']+'/children?max=100')
        group=next((g for g in children if g['name']==mapping['ldapGroup']),None)
        if not group:
            api('/groups/'+root['id']+'/children','POST',{'name':mapping['ldapGroup']})
            group=next(g for g in api('/groups/'+root['id']+'/children?max=100') if g['name']==mapping['ldapGroup'])
        role=api('/roles/'+mapping['role'])
        assigned=api('/groups/'+group['id']+'/role-mappings/realm')
        if any(r['name']=='admin' for r in assigned):raise RuntimeError('Managed LDAP group must not carry admin role. Review the snapshot.')
        obsolete=[r for r in assigned if r['name'] in ['employee','manager','auditor'] and r['name']!=mapping['role']]
        if obsolete:api('/groups/'+group['id']+'/role-mappings/realm','DELETE',obsolete)
        api('/groups/'+group['id']+'/role-mappings/realm','POST',[role])
    mapper('nhip-directory-groups','group-ldap-mapper',{'groups.dn':config['groupsDn'],'groups.path':config['groupRoot'],'group.name.ldap.attribute':'cn',
        'group.object.classes':'groupOfNames','membership.ldap.attribute':'member','membership.attribute.type':'DN','membership.user.ldap.attribute':'uid',
        'mode':'READ_ONLY','preserve.group.inheritance':'false','ignore.missing.groups':'false','drop.non.existing.groups.during.sync':'false',
        'user.roles.retrieve.strategy':'LOAD_GROUPS_BY_MEMBER_ATTRIBUTE'})
    # Keep federation disabled until every required attribute/group mapper exists.
    final=api('/components/'+provider_id)
    api('/components/'+provider_id,'PUT',{**final,'config':{**final['config'],'enabled':['true']}})
    write_env(ROOT/'backend/.env',{'DIRECTORY_COMPONENT_ID':provider_id,'DIRECTORY_SYNC_INTERVAL_SECONDS':'300'})
    state=ROOT/'directory/.local/provider.json'
    state.write_text(json.dumps({'id':provider_id,'name':PROVIDER,'backup':str(backup.relative_to(ROOT))},indent=2)+'\n',encoding='utf-8')
    os.chmod(state,0o600)
    print('READ_ONLY federation and group mapping prepared. Backup:',backup.relative_to(ROOT))
    print('Restart the backend to load DIRECTORY_COMPONENT_ID. Use Web B Directory to request the first full sync.')
    print('No connection test, synchronization, login, OTP enrollment or test suite was run by this script.')


if __name__=='__main__':
    argparse.ArgumentParser(description=__doc__).parse_args()
    configure()
