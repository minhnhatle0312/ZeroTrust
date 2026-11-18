import copy
import json
import os
import sqlite3
import subprocess
import sys
import unittest
import uuid
from contextlib import closing
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import reconcile_mfa_ids as m
r=m.core


class FakeApi:
    def __init__(self):
        self.data={n:{'id':'kc-'+n,'username':n,'enabled':True} for n in r.ACCOUNTS}
        for n in m.TARGETS:
            self.data[n]={'id':'kc-'+n,'username':n,'enabled':True,'attributes':{'nhip.mfa.required':['true']},'totp':False,'requiredActions':['CONFIGURE_TOTP'],'createdTimestamp':123}
        self.extra_role=False
        self.old_exists=False
    def users(self,name):return [copy.deepcopy(self.data[name])]
    def roles(self,user_id):
        role={**r.ACCOUNTS,**m.TARGETS}[user_id.removeprefix('kc-')]
        return [{'name':role}]+([{'name':'admin'}] if self.extra_role and user_id=='kc-mfa-employee' else [])
    def exists(self,user_id):return self.old_exists


class MfaTests(unittest.TestCase):
    def setUp(self):
        self.root=ROOT/'.runtime/mfa-id-tests'/uuid.uuid4().hex
        self.root.mkdir(parents=True)
        self.env={k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
        self.env.update(IAM_TEST_ROOT=str(self.root),TEMP=str(self.root),TMP=str(self.root),PYTHONDONTWRITEBYTECODE='1')
        p=subprocess.run(['node','--require',str(ROOT/'tests/isolated-node.cjs'),str(ROOT/'tests/mfa-staff-id-fixture.cjs')],cwd=ROOT,env=self.env,capture_output=True,text=True,encoding='utf-8',timeout=30)
        self.assertEqual(p.returncode,0,p.stdout+p.stderr)
        self.db=self.root/'attendance.sqlite';self.seed=self.root/'staff.json';self.api=FakeApi()
        with closing(sqlite3.connect(self.db)) as c:
            c.execute(r.LEDGER_SQL)
            for name,role in r.TARGETS.items():c.execute('INSERT INTO '+r.LEDGER+' VALUES(?,?,?,?,?,?,?)',('old-'+name,'kc-'+name,name,role,'2026-11-12','completed-demo','prior synthetic migration'))
            c.commit()
        self.baseline=self.state();self.seed_bytes=self.seed.read_bytes()
    def state(self):
        with closing(r.connect(self.db)) as c:return r.snapshot(c)
    def plan(self):
        with closing(r.connect(self.db)) as c:return m.plan(c,self.seed,self.api)[0]
    def apply(self,approved=None,guard=lambda:None):return m.apply(self.db,self.seed,self.api,approved or self.plan(),self.root/'backups',guard)
    def unchanged(self):
        self.assertEqual(r.state_hash(self.state()),r.state_hash(self.baseline))
        self.assertEqual(self.seed.read_bytes(),self.seed_bytes)
    def sql(self,text,args=()):
        with closing(sqlite3.connect(self.db)) as c:c.execute(text,args);c.commit()

    def test_plan_and_success_preserve_scope_audit_seed_and_prior_ledger(self):
        approved=self.plan()
        self.assertEqual(approved['expectedChanges'],{'staffRows':2,'ledgerInserts':2,'seedWrites':0,'auditWrites':0})
        self.assertEqual(sum(v['rows'] for v in approved['preservedAudit'].values()),20)
        self.assertEqual(len(approved['foreignKeys']),12)
        self.unchanged()
        backup=self.apply(approved)
        after=self.state();m.verify_delta(self.baseline,after,approved['mapping'],backup.name)
        self.assertEqual(len(after['tables'][r.LEDGER]),7)
        self.assertEqual(self.seed.read_bytes(),self.seed_bytes)
        self.assertEqual(r.normalized(after['tables']['audit_outbox']),r.normalized(self.baseline['tables']['audit_outbox']))
        manifest=r.verify_backup_manifest(backup,approved)
        self.assertEqual(set(manifest['files']),set(r.BACKUP_FILES))
        self.assertEqual(self.plan()['mapping'],[])
        self.assertIsNone(self.apply())

    def test_eight_profiles_jwt_and_mfa_enforcement(self):
        command=['node','--require',str(ROOT/'tests/isolated-node.cjs'),'--test','--test-isolation=none',str(ROOT/'tests/mfa-id-backend.cjs')]
        before=subprocess.run(command,cwd=ROOT,env={**self.env,'MFA_BEFORE':'1'},capture_output=True,text=True,encoding='utf-8',timeout=60)
        self.assertEqual(before.returncode,0,before.stdout+before.stderr)
        self.apply()
        after=subprocess.run(command,cwd=ROOT,env=self.env,capture_output=True,text=True,encoding='utf-8',timeout=60)
        self.assertEqual(after.returncode,0,after.stdout+after.stderr)

    def test_demo_mismatch_blocks_without_rerunning_old_migration(self):
        self.api.data['employee01']['id']='replacement-demo'
        with self.assertRaises(Exception):self.plan()
        self.unchanged()

    def test_mfa_flags_and_enrollment_cannot_be_downgraded(self):
        original=copy.deepcopy(self.api.data['mfa-employee'])
        for changes in ({'attributes':{}},{'attributes':{'nhip.mfa.required':['false']}},{'requiredActions':[],'totp':False}):
            with self.subTest(changes=changes):
                self.api.data['mfa-employee']={**original,**changes}
                with self.assertRaises(r.Stop):self.plan()
        self.api.data['mfa-employee']=original
        self.sql("UPDATE staff SET mfa_required=0 WHERE username='mfa-employee'")
        with self.assertRaises(r.Stop):self.plan()

    def test_remote_ldap_service_disabled_and_role_mismatch_block(self):
        original=copy.deepcopy(self.api.data['mfa-employee'])
        for changes in ({'federationLink':'ldap'},{'serviceAccountClientId':'service'},{'enabled':False},{'attributes':{'nhip.mfa.required':['true'],'LDAP_ID':['synthetic']}}):
            with self.subTest(changes=changes):
                self.api.data['mfa-employee']={**original,**changes}
                with self.assertRaises(r.Stop):self.plan()
        self.api.data['mfa-employee']=original;self.api.extra_role=True
        with self.assertRaises(r.Stop):self.plan()
        self.unchanged()

    def test_local_ldap_or_disabled_block(self):
        for col,value in [('identity_source','ldap'),('disabled',1),('governance_state','left')]:
            with self.subTest(column=col):
                self.sql('UPDATE staff SET '+col+'=? WHERE username=?',(value,'mfa-employee'))
                with self.assertRaises(r.Stop):self.plan()
                original=next(v for v in self.baseline['tables']['staff'] if v['username']=='mfa-employee')[col]
                self.sql('UPDATE staff SET '+col+'=? WHERE username=?',(original,'mfa-employee'))
        self.unchanged()

    def test_old_identity_and_duplicate_lookup_block(self):
        self.api.old_exists=True
        with self.assertRaisesRegex(r.Stop,'still exists'):self.plan()
        self.api.old_exists=False;original=self.api.users
        self.api.users=lambda n:original(n)*(2 if n=='mfa-employee' else 1)
        with self.assertRaisesRegex(r.Stop,'unique'):self.plan()
        self.unchanged()

    def test_target_collision(self):
        self.sql("UPDATE staff SET id='kc-mfa-employee' WHERE username='disabled-fixture'")
        with self.assertRaisesRegex(r.Stop,'collision'):self.plan()

    def test_partial_or_conflicting_ledger_blocks(self):
        self.sql("UPDATE staff SET id='kc-mfa-employee' WHERE username='mfa-employee'")
        with self.assertRaisesRegex(r.Stop,'lacks a verified ledger'):self.plan()

    def test_existing_business_reference_requires_separate_review(self):
        self.sql("INSERT INTO attendance(id,user_id,day,check_in,updated_at) VALUES('mfa-att','old-mfa-employee','2026-11-11','2026-11-11','2026-11-11')")
        with self.assertRaisesRegex(r.Stop,'business references'):self.plan()

    def test_unknown_reference_and_trigger_block(self):
        self.sql('CREATE TABLE unknown_ref(value TEXT)')
        self.sql("INSERT INTO unknown_ref VALUES('old-mfa-employee')")
        with self.assertRaisesRegex(r.Stop,'Unclassified'):self.plan()
        self.sql('DROP TABLE unknown_ref')
        self.sql("CREATE TRIGGER staff_change AFTER UPDATE ON staff BEGIN UPDATE audit_outbox SET delivered_at=NULL; END")
        with self.assertRaisesRegex(r.Stop,'Trigger'):self.plan()

    def test_wrong_plan_kind_and_stale_snapshot_block(self):
        approved=self.plan();wrong={**approved,'kind':'demo-migration'}
        with self.assertRaisesRegex(r.Stop,'Not a reviewed'):self.apply(wrong)
        self.sql("UPDATE audit_outbox SET delivered_at='changed' WHERE seq=1")
        baseline=r.state_hash(self.state())
        with self.assertRaisesRegex(r.Stop,'stale'):self.apply(approved)
        self.assertEqual(r.state_hash(self.state()),baseline)

    def test_remote_enrollment_change_makes_plan_stale(self):
        approved=self.plan();self.api.data['mfa-employee'].update(totp=True,requiredActions=[])
        with self.assertRaisesRegex(r.Stop,'stale'):self.apply(approved)
        self.unchanged()

    def test_manifest_failure_happens_before_updates(self):
        trace=[];connect=r.connect
        def traced(path,writable=False):
            c=connect(path,writable)
            if writable:c.set_trace_callback(trace.append)
            return c
        with patch.object(r,'connect',traced),patch.object(r,'write_backup_manifest',side_effect=OSError('synthetic manifest failure')):
            with self.assertRaises(OSError):self.apply()
        self.assertFalse([s for s in trace if s.startswith(('UPDATE','INSERT','CREATE'))])
        self.unchanged()

    def test_backup_corruption_blocks_before_updates(self):
        write=r.write_backup_manifest
        def corrupt(backup,approved):
            write(backup,approved);(backup/'staff.json').write_bytes(b'corrupt synthetic backup')
        with patch.object(r,'write_backup_manifest',corrupt):
            with self.assertRaisesRegex(r.Stop,'manifest file verification'):self.apply()
        self.unchanged()

    def test_guard_failure_and_verification_failure_roll_back(self):
        calls=[]
        def guard():
            calls.append(1)
            if len(calls)==3:raise r.Stop('late guard failure')
        with self.assertRaises(r.Stop):self.apply(guard=guard)
        self.unchanged();self.assertFalse(m.marker_path(self.seed).exists())
        with patch.object(m,'verify_delta',side_effect=r.Stop('synthetic verification failure')):
            with self.assertRaises(r.Stop):self.apply()
        self.unchanged()

    def test_failure_on_second_staff_update_rolls_back_first_and_ledger(self):
        connect=r.connect
        class Proxy:
            def __init__(self,c):self.c=c;self.updates=0
            def __getattr__(self,name):return getattr(self.c,name)
            def execute(self,sql,*args):
                if sql.startswith('UPDATE staff SET id='):
                    self.updates+=1
                    if self.updates==2:raise sqlite3.OperationalError('synthetic second update failure')
                return self.c.execute(sql,*args)
        def injected(path,writable=False):
            c=connect(path,writable)
            return Proxy(c) if writable and Path(path)==self.db else c
        with patch.object(r,'connect',injected):
            with self.assertRaises(sqlite3.OperationalError):self.apply()
        self.unchanged()

    def test_seed_race_is_not_overwritten(self):
        calls=[]
        def guard():
            calls.append(1)
            if len(calls)==3:self.seed.write_bytes(b'external seed edit')
        with self.assertRaisesRegex(r.Stop,'Seed changed'):self.apply(guard=guard)
        self.assertEqual(r.state_hash(self.state()),r.state_hash(self.baseline))
        self.assertEqual(self.seed.read_bytes(),b'external seed edit')
        self.assertTrue(m.marker_path(self.seed).exists())

    def test_partial_marker_write_rolls_back_and_requires_manual_review(self):
        write=r.write_json
        def partial(path,value):
            if path==m.marker_path(self.seed):
                with path.open('xb') as f:f.write(b'{')
                raise OSError('synthetic interrupted marker write')
            return write(path,value)
        with patch.object(r,'write_json',partial):
            with self.assertRaises(OSError):self.apply()
        self.unchanged();self.assertTrue(m.marker_path(self.seed).exists())
        with self.assertRaises(json.JSONDecodeError):m.recover(self.db,self.seed,lambda:None)
        self.unchanged();self.assertTrue(m.marker_path(self.seed).exists())

    def test_interruption_before_commit_recovers_without_db_or_seed_restore(self):
        unlink=Path.unlink;calls=[]
        def fail_marker(path,*args,**kwargs):
            if path==m.marker_path(self.seed):raise OSError('synthetic interruption')
            return unlink(path,*args,**kwargs)
        def guard():
            calls.append(1)
            if len(calls)==3:raise r.Stop('late guard failure')
        with patch.object(Path,'unlink',fail_marker):
            with self.assertRaises(OSError):self.apply(guard=guard)
        self.unchanged()
        self.assertEqual(m.recover(self.db,self.seed,lambda:None),'NOT_COMMITTED')
        self.unchanged();self.assertFalse(m.marker_path(self.seed).exists())

    def interrupted_commit(self):
        unlink=Path.unlink
        def fail_marker(path,*args,**kwargs):
            if path==m.marker_path(self.seed):raise OSError('synthetic interruption after commit')
            return unlink(path,*args,**kwargs)
        with patch.object(Path,'unlink',fail_marker):
            with self.assertRaises(OSError):self.apply()

    def test_interruption_after_commit_is_verified_never_reapplied(self):
        self.interrupted_commit();after=r.state_hash(self.state())
        self.assertEqual(m.recover(self.db,self.seed,lambda:None),'COMMITTED')
        self.assertEqual(r.state_hash(self.state()),after);self.assertEqual(self.seed.read_bytes(),self.seed_bytes)

    def test_recovery_refuses_subsequent_database_edit(self):
        self.interrupted_commit();self.sql("UPDATE attendance SET late_minutes=9")
        after=r.state_hash(self.state())
        with self.assertRaisesRegex(r.Stop,'changed after interruption'):m.recover(self.db,self.seed,lambda:None)
        self.assertEqual(r.state_hash(self.state()),after);self.assertTrue(m.marker_path(self.seed).exists())

    def test_recovery_refuses_corrupt_manifest(self):
        self.interrupted_commit();marker=json.loads(m.marker_path(self.seed).read_bytes())
        (Path(marker['backup'])/'manifest.json').write_bytes(b'{}')
        with self.assertRaisesRegex(r.Stop,'manifest changed'):m.recover(self.db,self.seed,lambda:None)
        self.assertTrue(m.marker_path(self.seed).exists())

    def test_transport_never_writes_keycloak(self):
        api=object.__new__(m.ReadOnlyKeycloak)
        for method in ('POST','PUT','DELETE'):
            with self.assertRaises(r.Stop):api._exchange(r.BASE+'/users/example',method,{})


if __name__=='__main__':unittest.main()
