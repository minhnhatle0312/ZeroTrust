"""Declare the admin-only Join correlation attribute after a private backup; never runs tests."""
from common import ROOT,admin_token,read_env,request
from backup_week5 import create_backup
from backup_week6 import create_directory_backup


def configure():
    env=read_env(ROOT/'backend/.env')
    folder,_=create_directory_backup() if env.get('DIRECTORY_COMPONENT_ID') else create_backup()
    token=admin_token();base='/admin/realms/company-iam';path=base+'/users/profile';profile=request(path,token=token)
    flow=next((f for f in request(base+'/authentication/flows',token=token) if f['alias']=='nhip-week5-browser'),None)
    clients=request(base+'/clients',token=token)
    for name in ['employee-portal','security-dashboard']:
        client=next((c for c in clients if c['clientId']==name),None)
        if not flow or not client or client.get('authenticationFlowBindingOverrides',{}).get('browser')!=flow['id']:raise RuntimeError('Apply the week-5 MFA client flow before week 7. User profile was not changed.')
    flag=next((a for a in profile.get('attributes',[]) if a['name']=='nhip.mfa.required'),None)
    if not flag or flag.get('permissions',{}).get('edit')!=['admin']:raise RuntimeError('The MFA flag must be admin-managed before week 7.')
    events=request(base+'/events/config',token=token)
    if events.get('adminEventsDetailsEnabled'):request(base+'/events/config','PUT',{**events,'adminEventsDetailsEnabled':False},token)
    attributes=[a for a in profile.get('attributes',[]) if a['name']!='nhip.join.request']
    attributes.append({'name':'nhip.join.request','displayName':'Join workflow reference','multivalued':False,'permissions':{'view':['admin'],'edit':['admin']}})
    request(path,'PUT',{**profile,'attributes':attributes},token)
    print('Declared admin-only Join correlation metadata. Private backup:',folder.relative_to(ROOT))
    print('No user, password, role, flow, source, synchronization or tests were changed by this script.')


if __name__=='__main__':configure()
