"""Allowlisted phase-2 tests/builds; never run a live account/data test."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRELOAD = str(ROOT / 'tests/isolated-node.cjs')
NODE = shutil.which('node') or 'node'
SUITES = [
    ('backend', 'backend', [NODE,'--require',PRELOAD,'--test','--test-reporter=tap',
        'audit.test.js','security.test.js','sso.test.js','operations.test.js','week5-10.test.js','phase2.test.js']),
    ('frontend-auth', '.', [NODE,'--require',PRELOAD,'--test','--test-reporter=tap',
        'tests/frontend.test.mjs','tests/api-client.test.mjs','tests/auth-controller.test.mjs','tests/session-monitor.test.mjs']),
    ('python-offline', '.', [sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_detection.py']),
    ('packaging', '.', [sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_packaging.py']),
    ('oidc-review', '.', [sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_oidc_review.py']),
    ('isolation-guards', '.', [NODE,'--require',PRELOAD,'--test','--test-reporter=tap','tests/isolation.test.cjs']),
    ('inventory-check', '.', [NODE,str(ROOT/'scripts/inventory_ui.cjs'),'--check']),
    ('inventory-coverage', '.', [NODE,'--require',PRELOAD,'--test','--test-reporter=tap','tests/inventory.test.cjs']),
]


def main():
    base = ROOT / '.runtime/phase2-tests'
    base.mkdir(parents=True,exist_ok=True)
    if not base.resolve().is_relative_to(ROOT) or base.is_symlink() or getattr(base,'is_junction',lambda:False)():
        raise RuntimeError('Test output must remain inside workspace')
    (base/'empty-env').mkdir(exist_ok=True)
    environment = {k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
    results=[]
    # Retain phase-1 outputs. Only synthetic per-run files are cleaned up here.
    with tempfile.TemporaryDirectory(prefix='run-',dir=base) as temporary:
        environment.update(TEMP=temporary,TMP=temporary,TMPDIR=temporary,IAM_TEST_ROOT=temporary,
            PYTHONDONTWRITEBYTECODE='1',PYTHONUTF8='1',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL=os.devnull,GIT_TERMINAL_PROMPT='0')
        for name,cwd,command in SUITES:
            result=subprocess.run(command,cwd=ROOT/cwd,env=environment,capture_output=True,text=True,encoding='utf-8',timeout=180)
            (base/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
            results.append({'suite':name,'exitCode':result.returncode})
            print(name+': '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
        for app in ['web-a','web-b']:
            result=subprocess.run([NODE,str(ROOT/app/'node_modules/vite/bin/vite.js'),'build','--config',str(ROOT/'tests/phase2.vite.mjs')],
                cwd=ROOT/app,env={**environment,'IAM_BUILD_APP':app},capture_output=True,text=True,encoding='utf-8',timeout=180)
            (base/(app+'-build.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
            results.append({'suite':app+'-build','exitCode':result.returncode})
            print(app+'-build: '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
    (base/'summary.json').write_text(json.dumps({'isolated':True,'liveKeycloakTests':False,'suites':results},indent=2)+'\n',encoding='utf-8')
    return int(any(row['exitCode'] for row in results))


if __name__=='__main__':
    raise SystemExit(main())
