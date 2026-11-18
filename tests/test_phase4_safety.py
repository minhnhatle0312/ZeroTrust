"""Refuse database fixtures which could point at a live container or persistent volume."""
import copy
import json
from pathlib import Path
import sys
from types import SimpleNamespace
import unittest
from unittest.mock import patch

sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from prepare_phase4_fixture import inspect_fixture


class FixtureBoundary(unittest.TestCase):
    def setUp(self):
        self.config=dict(id='a'*64,name='zerotrust-phase4-test',host='127.0.0.1',port=55001,database='phase4_fixture',user='phase4_fixture',synthetic=True)
        self.mounts=[dict(Type='tmpfs',Destination='/var/lib/postgresql/data')]
        self.ports={'5432/tcp':[dict(HostIp='127.0.0.1',HostPort='55001')]}

    def reply(self,config=None,mounts=None,ports=None,labels=None):
        return SimpleNamespace(returncode=0,stdout='|'.join([(config or self.config)['id'],json.dumps(labels or {'zerotrust.test':'phase4'}),json.dumps(mounts or self.mounts),json.dumps(ports or self.ports)]))

    def test_exact_synthetic_tmpfs_identity_is_accepted(self):
        with patch('prepare_phase4_fixture.subprocess.run',return_value=self.reply()) as run:
            self.assertEqual(inspect_fixture(self.config),self.config)
            self.assertEqual(run.call_args.args[0][:2],['docker','inspect'])

    def test_persistent_volume_or_bind_mount_is_refused(self):
        for kind in ['volume','bind']:
            with patch('prepare_phase4_fixture.subprocess.run',return_value=self.reply(mounts=[dict(Type=kind,Destination='/var/lib/postgresql/data')])):
                with self.assertRaises(RuntimeError):inspect_fixture(self.config)

    def test_network_binding_cannot_point_outside_loopback(self):
        with patch('prepare_phase4_fixture.subprocess.run',return_value=self.reply(ports={'5432/tcp':[dict(HostIp='0.0.0.0',HostPort='55001')]})):
            with self.assertRaises(RuntimeError):inspect_fixture(self.config)

    def test_container_id_label_and_database_must_match(self):
        for change in [{'id':'b'*64},{'database':'production'},{'host':'192.0.2.1'}]:
            candidate={**self.config,**change}
            with patch('prepare_phase4_fixture.subprocess.run',return_value=self.reply()):
                with self.assertRaises(RuntimeError):inspect_fixture(candidate)
        with patch('prepare_phase4_fixture.subprocess.run',return_value=self.reply(labels={'zerotrust.test':'lab'})):
            with self.assertRaises(RuntimeError):inspect_fixture(self.config)

    def test_unmarked_or_other_container_name_never_calls_docker(self):
        for change in [{'synthetic':False},{'name':'lab-postgres'}]:
            with patch('prepare_phase4_fixture.subprocess.run') as run:
                with self.assertRaises(RuntimeError):inspect_fixture({**self.config,**change})
                run.assert_not_called()


if __name__=='__main__':unittest.main()
