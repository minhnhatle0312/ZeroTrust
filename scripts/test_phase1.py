"""Run only allowlisted isolated tests; no live API, setup, build or database restore."""
import json
import os
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SUITES = (
    ('backend', 'backend', ['node', '--require', str(ROOT / 'tests/isolated-node.cjs'), '--test',
                          '--test-reporter=tap', 'audit.test.js', 'security.test.js', 'sso.test.js',
                          'operations.test.js', 'week5-10.test.js']),
    ('frontend-utilities', '.', ['node', '--require', str(ROOT / 'tests/isolated-node.cjs'), '--test',
                                '--test-reporter=tap', 'tests/frontend.test.mjs', 'tests/api-client.test.mjs']),
    ('python-offline', '.', [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests',
                            '-p', 'test_detection.py']),
    ('packaging', '.', [sys.executable, '-B', '-m', 'unittest', 'discover', '-s', 'tests',
                       '-p', 'test_packaging.py']),
    ('isolation-guards', '.', ['node', '--require', str(ROOT / 'tests/isolated-node.cjs'), '--test',
                               '--test-reporter=tap', 'tests/isolation.test.cjs']),
    ('inventory-check', '.', ['node', str(ROOT / 'scripts/inventory_ui.cjs'), '--check']),
    ('inventory-coverage', '.', ['node', '--require', str(ROOT / 'tests/isolated-node.cjs'), '--test',
                                 '--test-reporter=tap', 'tests/inventory.test.cjs']),
)


def main():
    base = ROOT / '.runtime/phase1-tests'
    base.mkdir(parents=True, exist_ok=True)
    if base.is_symlink() or getattr(base, 'is_junction', lambda: False)() or not base.resolve().is_relative_to(ROOT):
        raise RuntimeError('Test output must stay inside this workspace')
    # Do not propagate credentials, NODE_OPTIONS, PYTHONPATH, Git hooks/config
    # overrides or any application environment into child test processes.
    keep = {'PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'SYSTEMDRIVE'}
    environment = {k: v for k, v in os.environ.items() if k.upper() in keep}
    results = []
    with tempfile.TemporaryDirectory(prefix='run-', dir=base) as temporary:
        workspace = Path(temporary).resolve()
        environment.update(TEMP=str(workspace), TMP=str(workspace), TMPDIR=str(workspace),
                           IAM_TEST_ROOT=str(workspace), PYTHONDONTWRITEBYTECODE='1',
                           PYTHONUTF8='1', GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
                           GIT_TERMINAL_PROMPT='0')
        for name, cwd, original in SUITES:
            command = original.copy()
            if command[0] == 'node':
                command[0] = shutil.which('node') or 'node'
            completed = subprocess.run(command, cwd=ROOT / cwd, env=environment,
                                       capture_output=True, text=True, encoding='utf-8', timeout=180)
            # These suites contain synthetic fixtures only. No live suite is
            # included in this allowlist, so output cannot contain lab credentials.
            (base / (name + '.log')).write_text(completed.stdout + completed.stderr, encoding='utf-8')
            results.append({'suite': name, 'exitCode': completed.returncode})
            print(name + ': ' + ('PASS' if completed.returncode == 0 else 'FAIL'), flush=True)
    (base / 'summary.json').write_text(json.dumps({'isolated': True, 'suites': results}, indent=2), encoding='utf-8')
    return int(any(item['exitCode'] for item in results))


if __name__ == '__main__':
    raise SystemExit(main())
