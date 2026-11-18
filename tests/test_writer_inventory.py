"""Isolated inventory checks: no real CIM, Docker, IAM or business database."""
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import unittest
from unittest.mock import patch, MagicMock

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('writer_inventory', ROOT/'scripts/inspect_sqlite_writers.py')
inventory = importlib.util.module_from_spec(spec)
spec.loader.exec_module(inventory)


class InventoryTests(unittest.TestCase):
    def test_failed_powershell_never_reports_stderr(self):
        with patch.object(inventory.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'synthetic-secret')) as run:
            result = inventory.powershell_inventory([123])
        self.assertEqual(result['status'], 'UNAVAILABLE')
        self.assertNotIn('synthetic-secret', json.dumps(result))
        command = run.call_args.args[0]
        self.assertNotIn('-ExecutionPolicy', command)
        self.assertNotIn('RunAs', command)

    def test_mounts_only_projection(self):
        outputs = [subprocess.CompletedProcess([], 0, 'aabb1234\n', ''), subprocess.CompletedProcess([], 0, json.dumps([
            {'Type':'bind','Source':'D:/ZeroTrust','Destination':'/app','RW':True,'Extra':'synthetic-secret'}]), '')]
        with patch.object(inventory.subprocess, 'run', side_effect=outputs) as run:
            result = inventory.docker_mounts()
        self.assertEqual(result['items'][0]['mounts'][0]['source'], 'D:/ZeroTrust')
        self.assertNotIn('synthetic-secret', json.dumps(result))
        self.assertEqual(run.call_args.args[0], ['docker','inspect','--format','{{json .Mounts}}','aabb1234'])

    def test_docker_permission_failure_is_not_empty_success(self):
        with patch.object(inventory.subprocess, 'run', return_value=subprocess.CompletedProcess([], 1, '', 'synthetic-secret')):
            result = inventory.docker_mounts()
        self.assertEqual(result['status'], 'UNAVAILABLE')
        self.assertNotIn('synthetic-secret', json.dumps(result))

    def collected(self, windows=None, error=None, env=None):
        windows = windows or {k:{'status':'OK','items':[]} for k in ('processes','services','tasks')}
        sock = MagicMock()
        sock.__enter__.return_value.connect_ex.return_value = 10061
        with patch.object(inventory, 'read_paths', return_value=(Path('fixture.sqlite'),Path('fixture.json'))), \
             patch.object(inventory, 'file_users', return_value={'status':'OK','processes':[]}), \
             patch.object(inventory, 'powershell_inventory', return_value=windows, side_effect=error), \
             patch.object(inventory, 'docker_mounts', return_value={'status':'OK','items':[]}), \
             patch.object(inventory.socket, 'socket', return_value=sock), patch.dict(os.environ, env or {}, clear=True):
            return inventory.collect()

    def test_success_still_requires_human_review(self):
        report = self.collected()
        self.assertTrue(report['queryComplete'])
        self.assertEqual(report['status'], 'REVIEW_REQUIRED')
        self.assertFalse(report['processesStopped'])

    def test_task_failure_blocks(self):
        report = self.collected(windows={k:{'status':'UNAVAILABLE' if k=='tasks' else 'OK'} for k in ('processes','services','tasks')})
        self.assertFalse(report['queryComplete'])
        self.assertEqual(report['status'], 'BLOCKED_INVENTORY')

    def test_exception_does_not_leak_sensitive_message(self):
        report = self.collected(error=RuntimeError('synthetic-secret'))
        self.assertEqual(report['status'], 'BLOCKED_INVENTORY')
        self.assertNotIn('synthetic-secret', json.dumps(report))

    def test_environment_override_requires_review_without_value(self):
        report = self.collected(env={'ATTENDANCE_DB':'synthetic-secret'})
        self.assertEqual(report['status'], 'BLOCKED_INVENTORY')
        self.assertEqual(report['environmentOverridesPresent'], ['ATTENDANCE_DB'])
        self.assertNotIn('synthetic-secret', json.dumps(report))

    @unittest.skipUnless(os.name=='nt', 'Windows PowerShell fixture')
    def test_powershell_fixture_sanitizes_and_recognizes_current_codex(self):
        # Functions shadow system cmdlets: this does not query real processes/tasks.
        fixtures = r'''
function Get-CimInstance($ClassName) {
  if($ClassName -eq 'Win32_Process') {
    [pscustomobject]@{ProcessId=999001;ParentProcessId=999000;Name='node.exe';ExecutablePath='D:\node\node.exe';CommandLine='"D:\node\node.exe" "D:\tools\@openai\codex\bin\codex.js" --token synthetic-secret'}
    [pscustomobject]@{ProcessId=999002;ParentProcessId=999000;Name='node.exe';CommandLine='node --require hidden.js server.js --password synthetic-secret'}
    [pscustomobject]@{ProcessId=999003;ParentProcessId=999000;Name='python.exe';CommandLine='python D:\ZeroTrust\scripts\process_governance.py --token synthetic-secret'}
  } else {
    [pscustomobject]@{Name='fixture';State='Running';StartMode='Auto';ProcessId=999003;PathName='python D:\ZeroTrust\worker.py --token synthetic-secret'}
  }
}
function Get-ScheduledTask {
  [pscustomobject]@{TaskName='fixture';TaskPath='\';State='Ready';Settings=[pscustomobject]@{Enabled=$true};Actions=@([pscustomobject]@{Execute='python.exe';WorkingDirectory='D:\ZeroTrust';Arguments='D:\ZeroTrust\worker.py --password synthetic-secret'})}
}
'''
        with patch.object(inventory, 'PS_INVENTORY', fixtures+inventory.PS_INVENTORY):
            report = inventory.powershell_inventory([])
        self.assertEqual(report['tasks']['status'], 'OK')
        self.assertEqual(report['services']['status'], 'OK')
        procs = {p['pid']:p for p in report['processes']['items']}
        self.assertTrue(procs[999001]['codexEntrypoint'])
        self.assertFalse(procs[999002]['codexEntrypoint'])
        self.assertIsNone(procs[999002]['entrypoint'])
        self.assertTrue(procs[999003]['workerHint'])
        self.assertTrue(report['tasks']['items'][0]['enabled'])
        self.assertNotIn('synthetic-secret', json.dumps(report))
        self.assertNotIn('--password', json.dumps(report))


if __name__=='__main__':
    unittest.main()
