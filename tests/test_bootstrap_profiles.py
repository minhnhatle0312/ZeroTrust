import contextlib
import importlib
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import unittest
import uuid
from unittest.mock import patch
from urllib.parse import urlsplit, parse_qs

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import bootstrap_profiles as b
import init_env
import setup_keycloak
import setup_week2
import setup_week3


class FakeProvisioning:
    """No sockets; IDs are allocated by the fake IdP, never by seed generation."""
    def __init__(self):
        self.realm=False;self.users={};self.roles={};self.assigned={};self.calls=[]
        self.clients={'realm-management':{'id':'management','clientId':'realm-management'}}
        self.mappers={}

    def __call__(self,path,method='GET',data=None):
        self.calls.append((method,path))
        if path=='/admin/realms':
            if method=='POST':self.realm=True;return None
            return [{'realm':'company-iam'}] if self.realm else []
        p=urlsplit(path);route=p.path.removeprefix('/admin/realms/company-iam');q=parse_qs(p.query)
        if not route and method=='PUT':return None
        if route=='/roles':
            if method=='POST':self.roles[data['name']]={'id':uuid.uuid4().hex,**data};return None
            return list(self.roles.values())
        if route=='/clients':
            if method=='POST':self.clients[data['clientId']]={**data,'id':uuid.uuid4().hex};return None
            return [self.clients[q['clientId'][0]]] if q['clientId'][0] in self.clients else []
        if route.startswith('/clients/'):
            parts=route.split('/');cid=parts[2]
            if len(parts)==3 and method=='PUT':self.clients[data['clientId']]=data;return None
            if parts[-1]=='service-account-user':return {'id':'service'}
            if parts[-1]=='client-secret':return {'value':'synthetic-service-only'}
            if '/roles/' in route:return {'id':parts[-1],'name':parts[-1]}
            if '/protocol-mappers/models' in route:
                if method=='GET':return self.mappers.get(cid,[])
                if method=='POST':self.mappers.setdefault(cid,[]).append({**data,'id':uuid.uuid4().hex})
                return None
        if route=='/users':
            if method=='POST':
                clean={k:v for k,v in data.items() if k!='credentials'}
                self.users[data['username']]={**clean,'id':uuid.uuid4().hex};return None
            return [self.users[q['username'][0]]] if q['username'][0] in self.users else []
        if '/role-mappings/' in route:
            uid=route.split('/')[2]
            if method=='POST':self.assigned.setdefault(uid,[]).extend(data);return None
            return self.assigned.get(uid,[])
        if route=='/events/config':return {} if method=='GET' else None
        raise AssertionError('Unexpected fixture endpoint')


class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'.runtime/bootstrap-tests'/uuid.uuid4().hex
        self.root.mkdir(parents=True)
        for folder in ('backend','web-a','web-b','keycloak'):(self.root/folder).mkdir()
        for app in ('backend','web-a','web-b'):
            (self.root/app/'.env.example').write_bytes((ROOT/app/'.env.example').read_bytes())
        (self.root/'keycloak/lab-config.json').write_bytes((ROOT/'keycloak/lab-config.json').read_bytes())
        self.config=json.loads((self.root/'keycloak/lab-config.json').read_bytes())
        self.fake=FakeProvisioning()
        # Any accidental real transport is a test failure, including token acquisition.
        self.network=patch('urllib.request.OpenerDirector.open',side_effect=AssertionError('Live HTTP forbidden'))
        self.network.start();self.addCleanup(self.network.stop)
        with contextlib.redirect_stdout(io.StringIO()):init_env.main(self.root)

    def setup_demo(self):
        with contextlib.ExitStack() as stack:
            for module in (setup_keycloak,setup_week2):
                stack.enter_context(patch.object(module,'ROOT',self.root))
                stack.enter_context(patch.object(module,'require_uninitialized',lambda:b.require_uninitialized(self.root)))
                stack.enter_context(patch.object(module,'session',lambda:self.fake))
            stack.enter_context(patch.object(setup_keycloak,'read_env',lambda:b.read_env(self.root/'.env')))
            stack.enter_context(patch.object(setup_keycloak,'precheck',lambda api,c:b.precheck(api,c,self.root)))
            stack.enter_context(patch.object(setup_week2,'publish_profiles',lambda api,c:b.publish_profiles(api,c,self.root)))
            stack.enter_context(contextlib.redirect_stdout(io.StringIO()))
            setup_week2.main()

    def seed(self):return self.root/'backend/data/staff.json'

    def test_fresh_setup_exports_actual_ids_and_repeat_preserves_seed_bytes(self):
        self.setup_demo();raw=self.seed().read_bytes();profiles=json.loads(raw)
        self.assertEqual(len(profiles),6)
        self.assertEqual({u['username']:u['id'] for u in profiles},{name:u['id'] for name,u in self.fake.users.items()})
        self.assertFalse((self.root/'backend/data/attendance.sqlite').exists())
        self.setup_demo();self.assertEqual(self.seed().read_bytes(),raw)

    def test_existing_database_blocks_before_any_keycloak_or_env_write(self):
        (self.root/'backend/data').mkdir();(self.root/'backend/data/attendance.sqlite').write_bytes(b'synthetic-existing')
        before=(self.root/'backend/.env').read_bytes()
        with self.assertRaisesRegex(RuntimeError,'Existing SQLite'):self.setup_demo()
        self.assertEqual(self.fake.calls,[]);self.assertEqual((self.root/'backend/.env').read_bytes(),before)

    def test_stale_seed_preserved_and_no_remote_writes(self):
        self.setup_demo();old=self.seed().read_bytes();old_id=self.fake.users['employee01']['id'];new_id=uuid.uuid4().hex
        self.fake.users['employee01']['id']=new_id;self.fake.assigned[new_id]=self.fake.assigned[old_id];self.fake.calls=[]
        with self.assertRaisesRegex(RuntimeError,'differs'):self.setup_demo()
        self.assertEqual(self.seed().read_bytes(),old);self.assertTrue(all(m=='GET' for m,p in self.fake.calls))

    def test_no_partial_seed_on_last_account_failure(self):
        self.setup_demo();self.seed().unlink();del self.fake.users[self.config['users'][-1]['username']]
        with self.assertRaises(RuntimeError):b.publish_profiles(self.fake,self.config,self.root)
        self.assertFalse(self.seed().exists())

    def test_federated_preexisting_user_blocks_before_remote_writes(self):
        self.fake.realm=True;self.fake.users['admin01']={'id':'ldap','username':'admin01','enabled':True,'federationLink':'ldap'}
        with self.assertRaisesRegex(RuntimeError,'Federated'):self.setup_demo()
        self.assertTrue(all(m=='GET' for m,p in self.fake.calls));self.assertFalse(self.seed().exists())

    def test_role_conflict_blocks_before_remote_writes(self):
        self.fake.realm=True;self.fake.users['employee01']={'id':'e','username':'employee01','enabled':True};self.fake.assigned['e']=[{'name':'admin'}]
        with self.assertRaisesRegex(RuntimeError,'role'):self.setup_demo()
        self.assertTrue(all(m=='GET' for m,p in self.fake.calls))

    def test_seed_duplicate_id_rejected(self):
        self.setup_demo();self.fake.users['employee02']['id']=self.fake.users['employee01']['id'];self.seed().unlink()
        with self.assertRaisesRegex(RuntimeError,'Duplicate'):b.publish_profiles(self.fake,self.config,self.root)
        self.assertFalse(self.seed().exists())

    def test_publish_never_clobbers_competing_seed(self):
        self.setup_demo();self.seed().unlink();link=os.link
        def compete(source,target):
            Path(target).write_text('competing-file');return link(source,target)
        with patch.object(b.os,'link',compete):
            with self.assertRaises(FileExistsError):b.publish_profiles(self.fake,self.config,self.root)
        self.assertEqual(self.seed().read_text(),'competing-file')

    def test_pending_reconciliation_and_wal_block_provisioning(self):
        self.seed().parent.mkdir(parents=True,exist_ok=True)
        for name in ('staff.json.reconcile-pending.json','attendance.sqlite-wal'):
            file=self.seed().with_name(name);file.write_text('{}')
            with self.assertRaises(RuntimeError):b.require_uninitialized(self.root)
            file.unlink()

    def test_environment_initialization_is_repeatable_and_covers_both_webs(self):
        files=[self.root/p for p in ('.env','backend/.env','web-a/.env.local','web-b/.env.local')]
        before=[f.read_bytes() for f in files]
        with contextlib.redirect_stdout(io.StringIO()):init_env.main(self.root)
        self.assertEqual(before,[f.read_bytes() for f in files]);self.assertEqual(b.read_env(self.root/'.env')['KEYCLOAK_PUBLIC_URL'],'http://localhost:8080')

    def test_importing_setup_has_no_configuration_or_network_side_effect(self):
        with patch.object(init_env,'main',side_effect=AssertionError('Import wrote config')),patch('pathlib.Path.write_text',side_effect=AssertionError('Import wrote file')),patch('pathlib.Path.open',side_effect=AssertionError('Import opened data')):
            importlib.reload(init_env);importlib.reload(setup_keycloak);importlib.reload(setup_week2);importlib.reload(setup_week3)

    def test_startup_runner_never_calls_setup(self):
        import ast
        tree=ast.parse((ROOT/'scripts/run_week3.py').read_text(encoding='utf-8'))
        strings=[n.value for n in ast.walk(tree) if isinstance(n,ast.Constant) and isinstance(n.value,str)]
        self.assertFalse(any('scripts/setup_' in s for s in strings));self.assertIn('--check-bootstrap',strings)

    def test_generated_seed_through_backend_and_six_signed_logins(self):
        self.setup_demo()
        env={k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
        env.update(IAM_TEST_ROOT=str(self.root),IAM_BOOTSTRAP_SEED=str(self.seed()),TEMP=str(self.root),TMP=str(self.root))
        result=subprocess.run(['node','--require',str(ROOT/'tests/isolated-node.cjs'),'--test','--test-isolation=none','--test-reporter=tap',str(ROOT/'backend/bootstrap.test.js')],cwd=ROOT,env=env,capture_output=True,text=True,encoding='utf-8',timeout=90)
        (self.root/'backend-bootstrap.log').write_text(result.stdout+result.stderr,encoding='utf-8')
        self.assertEqual(result.returncode,0,result.stdout+result.stderr)


if __name__=='__main__':unittest.main()
