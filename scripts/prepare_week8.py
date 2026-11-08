"""Prepare private audit credentials only. Does not start services or run tests."""
import secrets
from common import ROOT, read_env


def main():
    folder = ROOT / 'audit/.local'
    folder.mkdir(parents=True, exist_ok=True)
    target = folder / 'compose.env'
    if target.exists():
        config = read_env(target)
        if not config.get('AUDIT_SERVICE_TOKEN') or not config.get('AUDIT_DB_PASSWORD'):
            raise RuntimeError('Existing audit configuration is incomplete; preserve and repair it manually.')
    else:
        config = {'AUDIT_DB_PASSWORD': secrets.token_hex(32), 'AUDIT_SERVICE_TOKEN': secrets.token_hex(32)}
        with target.open('x', encoding='utf-8') as stream:
            stream.write(''.join(k + '=' + v + '\n' for k, v in config.items()))
    backend = ROOT / 'backend/.env'
    original = backend.read_text(encoding='utf-8-sig')
    current = read_env(backend)
    if current.get('AUDIT_SERVICE_TOKEN') and current['AUDIT_SERVICE_TOKEN'] != config['AUDIT_SERVICE_TOKEN']:
        raise RuntimeError('Backend token differs; reconcile credentials manually. No rotation was applied.')
    backup = folder / 'backend-before-week8.env'
    if not backup.exists():
        with backup.open('x', encoding='utf-8') as stream:
            stream.write(original)
    replacements = {'AUDIT_SERVICE_URL': 'http://127.0.0.1:8090', 'AUDIT_SERVICE_TOKEN': config['AUDIT_SERVICE_TOKEN']}
    lines = [line for line in original.splitlines() if line.partition('=')[0].strip() not in replacements]
    backend.write_text('\n'.join(lines) + '\n' + ''.join(k + '=' + v + '\n' for k, v in replacements.items()), encoding='utf-8')
    print('Prepared ignored audit configuration. No services started; no tests run.')


if __name__ == '__main__':
    main()
