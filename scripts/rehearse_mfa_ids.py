"""Explicit rehearsal on new copies under .runtime/mfa-rehearsals only.

The operating database is opened read-only. No real Keycloak calls or mutations.
Captured, previously verified identities are mocked for the copy experiments.
"""
import argparse
import copy
import json
import os
import sqlite3
import subprocess
import sys
import uuid
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch

import reconcile_mfa_ids as m
r=m.core
REHEARSALS=r.ROOT/'.runtime/mfa-rehearsals'


class CapturedApi:
    def __init__(self, approved, seed):
        self.users_by_name={v['username']:{'id':v['id'],'username':v['username'],'role':v['role'],'enabled':True} for v in seed}
        for name,v in approved['remoteGuards'].items():
            self.users_by_name[name]={**v,'attributes':{'nhip.mfa.required':['true']}}
    def users(self,name):return [copy.deepcopy(self.users_by_name[name])]
    def roles(self,user_id):return [{'name':v['role']} for v in self.users_by_name.values() if v['id']==user_id]
    def exists(self,user_id):return any(v['id']==user_id for v in self.users_by_name.values())


def fixture_guard(folder):
    folder=folder.resolve()
    r.require(folder.is_relative_to(REHEARSALS.resolve()),'Rehearsal path outside isolated root.')
    r.require((folder/'attendance.sqlite').is_file() and (folder/'staff.json').is_file(),'Copy files missing.')


def child_crash(folder, when):
    fixture_guard(folder)
    approved=json.loads((folder/'copy-plan.json').read_bytes())
    db,seed=folder/'attendance.sqlite',folder/'staff.json'
    r.require(approved['databasePath']==str(db.resolve()) and approved['seedPath']==str(seed.resolve()),'Child cannot target operating paths.')
    api=CapturedApi(approved,json.loads(seed.read_bytes()));calls=[]
    def guard():
        fixture_guard(folder);calls.append(1)
        if when=='before' and len(calls)==3:os._exit(86)
    unlink=Path.unlink
    def interrupted(path,*args,**kwargs):
        if path==m.marker_path(seed) and when=='after':os._exit(87)
        return unlink(path,*args,**kwargs)
    with patch.object(Path,'unlink',interrupted):m.apply(db,seed,api,approved,folder/'backups',guard)
    raise RuntimeError('Expected synthetic crash did not occur')


def run(plan_path):
    approved_raw=plan_path.read_bytes();approved=json.loads(approved_raw)
    r.require(approved.get('kind')==m.KIND and len(approved['mapping'])==2,'Reviewed two-account dry-run required.')
    db,seed=Path(approved['databasePath']).resolve(),Path(approved['seedPath']).resolve()
    env=r.read_env(r.ROOT/'backend/.env')
    r.require(db==(r.ROOT/'backend'/env.get('ATTENDANCE_DB','data/attendance.sqlite')).resolve() and
              seed==(r.ROOT/'backend'/env.get('STAFF_FILE','data/staff.json')).resolve(),'Source must be configured data; opened read-only.')
    r.require(not m.marker_path(seed).exists(),'Operating recovery marker exists; stop rehearsal.')
    root=REHEARSALS/(datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'-'+uuid.uuid4().hex[:8])
    root.mkdir(parents=True,exist_ok=False)
    report={'startedAt':datetime.now(timezone.utc).isoformat(),'mode':'COPIES_ONLY_WITH_CAPTURED_MOCK_IAM','status':'BLOCKED',
            'sourcePlan':str(plan_path.resolve()),'sourcePlanHash':r.digest(approved_raw),'cases':[]}
    with closing(r.connect(db)) as c:
        r.integrity(c);original=r.snapshot(c)
    raw_seed=seed.read_bytes();index_hash=r.digest((r.ROOT/'.git/index').read_bytes())
    r.require(r.state_hash(original)==approved['databaseHash'] and r.digest(raw_seed)==approved['seedHash'],'Live data differs from reviewed plan.')
    # This is an isolated rehearsal snapshot, not a live migration backup.
    pristine=root/'snapshot'
    m.verified_backup(db,raw_seed,approved,pristine)
    api=CapturedApi(approved,json.loads(raw_seed))
    env_test={k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
    def make_case(name):
        folder=root/name;folder.mkdir();copy_db=folder/'attendance.sqlite';copy_seed=folder/'staff.json'
        with closing(r.connect(pristine/'attendance.sqlite')) as src,closing(sqlite3.connect(copy_db)) as dest:src.backup(dest)
        with copy_seed.open('xb') as f:f.write(raw_seed)
        fixture_guard(folder)
        with closing(r.connect(copy_db)) as c:cp,state,_=m.plan(c,copy_seed,api)
        r.require({k:v for k,v in cp.items() if k not in {'databasePath','seedPath'}}==
                  {k:v for k,v in approved.items() if k not in {'databasePath','seedPath'}},'Copy plan differs beyond isolated paths.')
        r.write_json(folder/'copy-plan.json',cp)
        r.write_json(folder/'remote-identities.json',api.users_by_name)
        return folder,copy_db,copy_seed,cp,state
    def state_of(path):
        with closing(r.connect(path)) as c:r.integrity(c);return r.snapshot(c)
    def bootstrap(folder,expect_mismatch=False):
        args=['node','--require',str(r.ROOT/'tests/isolated-node.cjs'),str(r.ROOT/'tests/mfa-bootstrap-copy.cjs')]
        if expect_mismatch:args.append('--expect-mismatch')
        p=subprocess.run(args,cwd=r.ROOT,env={**env_test,'IAM_TEST_ROOT':str(folder),'TEMP':str(folder),'TMP':str(folder)},capture_output=True,text=True,encoding='utf-8',timeout=30)
        r.require(p.returncode==0,'Copy bootstrap test failed; output omitted.')
        return json.loads(p.stdout)
    try:
        folder,cdb,cseed,cp,before=make_case('success')
        before_boot=bootstrap(folder,True)
        backup=m.apply(cdb,cseed,api,cp,folder/'backups',lambda:fixture_guard(folder))
        after=state_of(cdb);m.verify_delta(before,after,cp['mapping'],backup.name)
        r.verify_backup_manifest(backup,cp)
        with closing(r.connect(cdb)) as c:r.require(m.plan(c,cseed,api)[0]['mapping']==[],'Copy still has pending ID changes.')
        r.require(cseed.read_bytes()==raw_seed,'Copy seed changed.')
        after_boot=bootstrap(folder)
        report['cases'].append({'name':'success','status':'PASS','staffUpdates':2,'ledgerInserts':2,'auditRowsPreserved':sum(v['rows'] for v in cp['preservedAudit'].values()),'bootstrapBefore':before_boot,'bootstrapAfter':after_boot,'backup':str(backup)})
        for name in ('manifest_failure','backup_corruption','verification_failure','stale_plan'):
            folder,cdb,cseed,cp,before=make_case(name)
            if name=='stale_plan':
                with closing(sqlite3.connect(cdb)) as c:c.execute('UPDATE attendance SET late_minutes=late_minutes+1');c.commit()
                before=state_of(cdb)
            write=r.write_backup_manifest
            def corrupt(backup,value):
                write(backup,value);(backup/'staff.json').write_bytes(b'synthetic corruption on copy')
            if name=='manifest_failure':context=patch.object(r,'write_backup_manifest',side_effect=OSError('synthetic failure'))
            elif name=='backup_corruption':context=patch.object(r,'write_backup_manifest',corrupt)
            elif name=='verification_failure':context=patch.object(m,'verify_delta',side_effect=r.Stop('synthetic failure'))
            else:context=patch.object(m,'REASON',m.REASON)
            rejected=False
            with context:
                try:m.apply(cdb,cseed,api,cp,folder/'backups',lambda:fixture_guard(folder))
                except (r.Stop,OSError):rejected=True
            r.require(rejected and r.state_hash(state_of(cdb))==r.state_hash(before) and cseed.read_bytes()==raw_seed,'Failure did not preserve copy state.')
            report['cases'].append({'name':name,'status':'PASS','copyUnchanged':True})
        for name,when in (('process_crash_before_commit','before'),('process_crash_after_commit','after'),('refuse_recovery_after_external_write','after')):
            folder,cdb,cseed,cp,before=make_case(name)
            p=subprocess.run([sys.executable,'-B',str(Path(__file__).resolve()),'--crash-copy',str(folder),'--when',when],cwd=r.ROOT,env=env_test,capture_output=True,text=True,timeout=30)
            r.require(p.returncode==(86 if when=='before' else 87),'Synthetic crash worker failed unexpectedly.')
            if name=='refuse_recovery_after_external_write':
                with closing(sqlite3.connect(cdb)) as c:c.execute('UPDATE attendance SET late_minutes=late_minutes+1');c.commit()
                changed_hash=r.state_hash(state_of(cdb));rejected=False
                try:m.recover(cdb,cseed,lambda:fixture_guard(folder))
                except r.Stop:rejected=True
                r.require(rejected and m.marker_path(cseed).exists() and r.state_hash(state_of(cdb))==changed_hash,'Unsafe recovery was not refused.')
                outcome='REFUSED_WITHOUT_WRITES'
            else:
                outcome=m.recover(cdb,cseed,lambda:fixture_guard(folder))
                r.require(outcome==('NOT_COMMITTED' if when=='before' else 'COMMITTED'),'Unexpected recovery outcome.')
                after=state_of(cdb)
                if when=='before':r.require(r.state_hash(after)==r.state_hash(before),'Precommit crash changed copy data.')
                else:
                    batch=next(v['batch_id'] for v in after['tables'][r.LEDGER] if v['username']=='mfa-employee')
                    m.verify_delta(before,after,cp['mapping'],batch)
                r.require(not m.marker_path(cseed).exists(),'Verified copy recovery marker remains.')
            r.require(cseed.read_bytes()==raw_seed,'Recovery rewrote copy seed.')
            report['cases'].append({'name':name,'status':'PASS','recoveryOutcome':outcome})
        report['status']='PASS'
    except Exception as error:
        report.update(status='BLOCKED',errorType=type(error).__name__)
    finally:
        with closing(r.connect(db)) as c:source_unchanged=r.state_hash(r.snapshot(c))==r.state_hash(original)
        report['preservation']={'operatingDatabaseUnchanged':source_unchanged,'operatingSeedUnchanged':seed.read_bytes()==raw_seed,
                                'reviewedPlanUnchanged':plan_path.read_bytes()==approved_raw,'gitIndexUnchanged':r.digest((r.ROOT/'.git/index').read_bytes())==index_hash}
        if not all(report['preservation'].values()):report['status']='BLOCKED'
        report['completedAt']=datetime.now(timezone.utc).isoformat()
        r.write_json(root/'rehearsal-report.json',report)
    print('Rehearsal: '+report['status'])
    print('Report: '+str(root/'rehearsal-report.json'))
    print('Cases: '+str(len(report['cases']))+'; all operating data opened read-only.')
    return 0 if report['status']=='PASS' else 1


if __name__=='__main__':
    parser=argparse.ArgumentParser(description=__doc__)
    group=parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--plan',type=Path)
    group.add_argument('--crash-copy',type=Path,help=argparse.SUPPRESS)
    parser.add_argument('--when',choices=('before','after'),help=argparse.SUPPRESS)
    args=parser.parse_args()
    try:
        if args.crash_copy:child_crash(args.crash_copy.resolve(),args.when)
        else:raise SystemExit(run(args.plan.resolve()))
    except (r.RepairError,OSError,ValueError,sqlite3.Error,KeyError,TypeError) as error:
        print('STOP: '+type(error).__name__+'; sensitive details omitted.',file=sys.stderr)
        raise SystemExit(1)
