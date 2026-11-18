"""Create missing local configuration without changing existing secrets."""
import secrets
from common import ROOT, read_env

def main(root=ROOT):
    target = root / '.env'
    values = read_env(target) if target.exists() else {}
    defaults = {'POSTGRES_DB':'keycloak','POSTGRES_USER':'keycloak','KEYCLOAK_ADMIN':'admin',
                'KEYCLOAK_PUBLIC_URL':'http://localhost:8080'}
    keys = ('POSTGRES_PASSWORD','KEYCLOAK_ADMIN_PASSWORD','TEST_ADMIN01_PASSWORD',
            'TEST_MANAGER01_PASSWORD','TEST_EMPLOYEE01_PASSWORD','TEST_AUDITOR01_PASSWORD',
            'TEST_EMPLOYEE02_PASSWORD','TEST_MANAGER02_PASSWORD')
    for key in keys:
        if key not in values:
            defaults[key] = secrets.token_hex(24) + 'Aa1!'
    missing = {key:value for key,value in defaults.items() if key not in values}
    if missing:
        with target.open('a', encoding='utf-8') as out:
            out.write('\n'+'\n'.join(f'{k}={v}' for k,v in missing.items())+'\n')
    for relative, example in [('backend/.env','backend/.env.example'),('web-a/.env.local','web-a/.env.example'),
                              ('web-b/.env.local','web-b/.env.example')]:
        path = root / relative
        if not path.exists():
            path.write_text((root/example).read_text(encoding='utf-8'),encoding='utf-8')
    empty = [k for k in set(defaults)|set(keys) if not read_env(target).get(k)]
    if empty:
        raise SystemExit('Fill empty values in .env: '+', '.join(sorted(empty)))
    print('Local .env files ready; existing values preserved. Passwords are not printed.')


if __name__ == '__main__':
    main()
