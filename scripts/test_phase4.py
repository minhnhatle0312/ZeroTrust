"""Only synthetic SQLite, a verified disposable PG fixture, offline tests and fixture builds."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from prepare_phase4_fixture import inspect_fixture
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / '.runtime/phase4-tests'
NODE = shutil.which('node') or 'node'
PRELOAD = str(ROOT / 'tests/isolated-node.cjs')


def postgres_fixture():
    config = json.loads((BASE / 'postgres-fixture.json').read_text(encoding='utf-8'))
    return inspect_fixture(config)


def main():
    mode = sys.argv[1:]
    if mode not in [[], ['--backend-only'], ['--postgres-only']]:
        raise SystemExit('Allowed: --backend-only / --postgres-only')
    BASE.mkdir(parents=True, exist_ok=True)
    if BASE.is_symlink() or getattr(BASE, 'is_junction', lambda:False)() or not BASE.resolve().is_relative_to(ROOT):
        raise RuntimeError('Test output must remain in workspace')
    temporary = tempfile.mkdtemp(prefix='run-', dir=BASE)
    environment = {k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
    environment.update(TEMP=temporary,TMP=temporary,TMPDIR=temporary,IAM_TEST_ROOT=temporary,PYTHONDONTWRITEBYTECODE='1',PYTHONUTF8='1',
        IAM_INVENTORY_PHASE='3',IAM_BROWSER_PHASE='4',PYTHONPATH=str(BASE/'python-libs'),GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL=os.devnull,GIT_TERMINAL_PROMPT='0')
    suites=[]
    if mode != ['--postgres-only']:
        suites.append(('backend','backend',[NODE,'--require',PRELOAD,'--test','--test-reporter=tap','audit.test.js','security.test.js','sso.test.js','operations.test.js','week5-10.test.js','phase2.test.js','incidents.test.js']))
    if mode != ['--backend-only']:
        pg=postgres_fixture();environment['IAM_PHASE4_PG_PORT']=str(pg['port'])
        suites.append(('postgres-incidents','.',[sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_incidents.py']))
    if not mode:
        from test_phase3 import SUITES
        suites.extend(SUITES[1:])
        suites.append(('fixture-safety','.',[sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_phase4_safety.py']))
    results=[]
    for name,cwd,command in suites:
        result=subprocess.run(command,cwd=ROOT/cwd,env=environment,capture_output=True,text=True,encoding='utf-8',timeout=240)
        (BASE/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
        results.append({'suite':name,'exitCode':result.returncode})
        print(name+': '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
    if not mode:
        (BASE/'empty-env').mkdir(exist_ok=True)
        for app in ['web-a','web-b']:
            command=[NODE,str(ROOT/app/'node_modules/vite/bin/vite.js'),'build','--config',str(ROOT/'tests/phase4.vite.mjs')]
            result=subprocess.run(command,cwd=ROOT/app,env={**environment,'IAM_BUILD_APP':app},capture_output=True,text=True,encoding='utf-8',timeout=180)
            (BASE/(app+'-build.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
            results.append({'suite':app+'-build','exitCode':result.returncode})
            print(app+'-build: '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
        if not any(row['exitCode'] for row in results):
            for name in ['auth-browser','workspace-browser']:
                result=subprocess.run([NODE,'--require',PRELOAD,str(ROOT/'tests'/(name+'.cjs'))],cwd=ROOT,env=environment,capture_output=True,text=True,encoding='utf-8',timeout=240)
                (BASE/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
                results.append({'suite':name,'exitCode':result.returncode})
                print(name+': '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
    (BASE/('summary.json' if not mode else mode[0][2:]+'.json')).write_text(json.dumps({'isolated':True,'liveServices':False,'suites':results},indent=2)+'\n',encoding='utf-8')
    return int(any(row['exitCode'] for row in results))


if __name__=='__main__':
    raise SystemExit(main())
