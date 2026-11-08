"""Start the explicitly configured week-6 source; no automatic setup or tests."""
import argparse
import shutil
import subprocess
import sys
import time
import urllib.request
from common import ROOT,read_env


def main(require_directory=True,require_audit=False):
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('--network',action='store_true');args=parser.parse_args()
    env=read_env();backend=read_env(ROOT/'backend/.env')
    if require_audit and (not backend.get('AUDIT_SERVICE_URL') or not backend.get('AUDIT_SERVICE_TOKEN')):raise RuntimeError('Prepare audit credentials explicitly with prepare_week8.py before using the release runner.')
    if require_directory and not backend.get('DIRECTORY_COMPONENT_ID'):raise RuntimeError('Prepare/apply week 6 explicitly before using this runner. It never modifies federation silently.')
    if args.network!=env.get('KEYCLOAK_PUBLIC_URL','http://localhost:8080').startswith('https://'):raise RuntimeError('Match --network to the current configure_network.py mode.')
    node=shutil.which('node')
    if not node:raise RuntimeError('Node.js is required.')
    for app in ['backend','web-a','web-b']:
        if not (ROOT/app/'node_modules').exists():raise RuntimeError('Install dependencies in '+app+' before starting.')
    compose=['docker','compose','--env-file','.env']
    if backend.get('AUDIT_SERVICE_URL'):
        if not (ROOT/'audit/.local/compose.env').exists():raise RuntimeError('Missing private audit Compose configuration.')
        compose+=['--env-file','audit/.local/compose.env']
    compose+=['-f','docker-compose.yml']
    if backend.get('DIRECTORY_COMPONENT_ID'):compose+=['-f','directory/compose.week6.yml']
    if backend.get('AUDIT_SERVICE_URL'):compose+=['-f','audit/compose.week8.yml']
    subprocess.run(compose+['up','-d'],cwd=ROOT,check=True)
    http=urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(90):
        try:
            with http.open('http://127.0.0.1:8080/realms/company-iam/.well-known/openid-configuration',timeout=2):break
        except Exception:time.sleep(1)
    else:raise RuntimeError('Keycloak has not started. Check Docker logs; federation was not changed by this runner.')
    if args.network:
        for app,base in [('web-a','/a/'),('web-b','/b/')]:subprocess.run([node,'node_modules/vite/bin/vite.js','build','--base='+base],cwd=ROOT/app,check=True)
    children=[]
    try:
        children.append(subprocess.Popen([node,'server.js'],cwd=ROOT/'backend'))
        if args.network:children.append(subprocess.Popen([node,'network/gateway.js'],cwd=ROOT))
        else:
            for app,port in [('web-a','5173'),('web-b','5174')]:children.append(subprocess.Popen([node,'node_modules/vite/bin/vite.js','--host','127.0.0.1','--port',port,'--strictPort'],cwd=ROOT/app))
        public=env.get('KEYCLOAK_PUBLIC_URL')
        print('Applications started. Any configured directory follows its backend sync schedule; no immediate sync, MFA setup or tests were requested by this runner.',flush=True)
        print('Web B:',public+'/b/#/directory' if args.network else 'http://localhost:5174/#/directory',flush=True)
        while all(p.poll() is None for p in children):time.sleep(1)
        raise RuntimeError('A project process stopped; inspect its output before starting another instance.')
    except KeyboardInterrupt:print('Stopping project application processes.')
    finally:
        for p in reversed(children):
            if p.poll() is None:
                p.terminate()
                try:p.wait(timeout=5)
                except subprocess.TimeoutExpired:p.kill()


if __name__=='__main__':main()
