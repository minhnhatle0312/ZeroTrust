"""UI/API regression with synthetic loopback fixtures only; no lab configuration."""
import json
import os
import subprocess
import sys
import tempfile
from test_phase3 import ROOT, NODE, PRELOAD, SUITES


def main():
    if sys.argv[1:] not in [[], ['--browser-only'], ['--build-only'], ['--incident-browser-only'], ['--postgres-only']]:
        raise SystemExit('Allowed: --browser-only / --build-only / --incident-browser-only / --postgres-only')
    base = ROOT / '.runtime/phase6-tests'
    base.mkdir(parents=True, exist_ok=True)
    if base.is_symlink() or getattr(base, 'is_junction', lambda: False)() or not base.resolve().is_relative_to(ROOT):
        raise RuntimeError('Output must remain within workspace')
    (base/'empty-env').mkdir(exist_ok=True)
    temporary = tempfile.mkdtemp(prefix='run-', dir=base)
    environment = {k:v for k,v in os.environ.items() if k.upper() in {'PATH','SYSTEMROOT','WINDIR','COMSPEC','PATHEXT','SYSTEMDRIVE'}}
    environment.update(TEMP=temporary,TMP=temporary,TMPDIR=temporary,IAM_TEST_ROOT=temporary,
        IAM_INVENTORY_PHASE='5b',IAM_BROWSER_PHASE='6',PYTHONDONTWRITEBYTECODE='1',PYTHONUTF8='1',GIT_CONFIG_NOSYSTEM='1',GIT_CONFIG_GLOBAL=os.devnull,GIT_TERMINAL_PROMPT='0')
    suites=[]
    if sys.argv[1:]==['--postgres-only']:
        from prepare_phase4_fixture import inspect_fixture
        pg=inspect_fixture(json.loads((base/'postgres-fixture.json').read_text(encoding='utf-8')))
        environment.update(IAM_PHASE4_PG_PORT=str(pg['port']),PYTHONPATH=str(ROOT/'.runtime/phase4-tests/python-libs'))
        suites.append(('postgres-incidents','.',[sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_incidents.py']))
    if not sys.argv[1:]:
        for name,cwd,command in SUITES:
            command=list(command)
            if name=='backend': command.extend(['incidents.test.js','retention.test.js'])
            if name=='frontend-auth': command.extend(['tests/security-view.test.mjs','tests/incident-editor.test.mjs'])
            if name=='inventory-check': command=[v.replace('--phase3','--phase5b') for v in command]
            suites.append((name,cwd,command))
    if not sys.argv[1:]:
        suites.append(('fixture-safety','.',[sys.executable,'-B','-m','unittest','discover','-s','tests','-p','test_phase4_safety.py']))
    if sys.argv[1:] not in [['--browser-only'], ['--incident-browser-only'], ['--postgres-only']]:
        for app in ['web-a','web-b']:
            suites.append((app+'-build',app,[NODE,str(ROOT/app/'node_modules/vite/bin/vite.js'),'build','--config',str(ROOT/'tests/phase6.vite.mjs')]))
    results=[]
    def run(name,cwd,command):
        env={**environment,**({'IAM_BUILD_APP':cwd} if name.endswith('-build') else {})}
        result=subprocess.run(command,cwd=ROOT/cwd,env=env,capture_output=True,text=True,encoding='utf-8',timeout=300)
        (base/(name+'.log')).write_text(result.stdout+result.stderr,encoding='utf-8')
        results.append({'suite':name,'exitCode':result.returncode})
        print(name+': '+('PASS' if result.returncode==0 else 'FAIL'),flush=True)
    for args in suites: run(*args)
    if not any(r['exitCode'] for r in results) and sys.argv[1:] not in [['--build-only'], ['--postgres-only']]:
        for name in (['incident-browser'] if sys.argv[1:]==['--incident-browser-only'] else ['auth-browser','workspace-browser','security-browser','incident-browser']):
            run(name,'.',[NODE,'--require',PRELOAD,str(ROOT/'tests'/(name+'.cjs'))])
    suffix='summary' if not sys.argv[1:] else sys.argv[1][2:]
    (base/(suffix+'.json')).write_text(json.dumps({'isolated':True,'liveServices':False,'suites':results},indent=2)+'\n',encoding='utf-8')
    return int(any(r['exitCode'] for r in results))


if __name__=='__main__':
    raise SystemExit(main())
