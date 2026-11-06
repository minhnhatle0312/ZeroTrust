"""Run Keycloak, API and both applications locally or through the HTTPS LAN gateway."""
import argparse
import json
import shutil
import subprocess
import sys
import time
import urllib.request
from pathlib import Path
from common import ROOT, read_env


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--network', action='store_true')
    args = parser.parse_args()
    public = read_env().get('KEYCLOAK_PUBLIC_URL', 'http://localhost:8080')
    if args.network != public.startswith('https://'):
        raise SystemExit('Run configure_network.py --host SERVER_IP (network) or --local first; modes must match.')
    node = shutil.which('node')
    if not node:
        raise SystemExit('Node.js 22.19+ is required.')
    for app in ['backend', 'web-a', 'web-b']:
        if not (ROOT / app / 'node_modules').exists():
            raise SystemExit('Install dependencies first: cd ' + app + '; npm.cmd ci')
    subprocess.run(['docker', 'compose', 'up', '-d'], cwd=ROOT, check=True)
    http = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    for _ in range(120):
        try:
            with http.open('http://127.0.0.1:8080/realms/master/.well-known/openid-configuration', timeout=2):
                break
        except Exception:
            time.sleep(1)
    else:
        raise SystemExit('Keycloak did not become ready. Check docker compose logs keycloak.')
    subprocess.run([sys.executable, 'scripts/setup_week3.py'], cwd=ROOT, check=True)
    if args.network:
        for app, base in [('web-a', '/a/'), ('web-b', '/b/')]:
            subprocess.run([node, 'node_modules/vite/bin/vite.js', 'build', '--base=' + base], cwd=ROOT / app, check=True)
    children = []
    try:
        children.append(subprocess.Popen([node, 'server.js'], cwd=ROOT / 'backend'))
        if args.network:
            children.append(subprocess.Popen([node, 'network/gateway.js'], cwd=ROOT))
            print('Web A:', public + '/a/', '\nWeb B:', public + '/b/', flush=True)
        else:
            for app, port in [('web-a', '5173'), ('web-b', '5174')]:
                children.append(subprocess.Popen([node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', port, '--strictPort'], cwd=ROOT / app))
            print('Web A: http://localhost:5173\nWeb B: http://localhost:5174', flush=True)
        print('Keep this terminal running. Press Ctrl+C to stop the application services.', flush=True)
        while all(p.poll() is None for p in children):
            time.sleep(1)
        raise SystemExit('An application stopped. Check the messages above; another process may already use the port.')
    except KeyboardInterrupt:
        print('Stopping application services.')
    finally:
        for child in reversed(children):
            if child.poll() is None:
                child.terminate()
                try:
                    child.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    child.kill()


if __name__ == '__main__':
    main()
