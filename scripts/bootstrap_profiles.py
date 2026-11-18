"""Fresh-machine provisioning guards and verified seed export. No import side effects."""
import json
import os
import uuid
from urllib.parse import quote
from common import ROOT, read_env
from repair_security_dashboard import Api


def paths(root=ROOT):
    if any(k in os.environ for k in ('IAM_BACKEND_ENV', 'ATTENDANCE_DB', 'STAFF_FILE')):
        raise RuntimeError('Provisioning environment overrides are not supported; review deployment paths first.')
    config = root / 'backend/.env'
    env = read_env(config) if config.exists() else {}
    return ((root/'backend'/env.get('ATTENDANCE_DB','data/attendance.sqlite')).resolve(),
            (root/'backend'/env.get('STAFF_FILE','data/staff.json')).resolve())


def require_uninitialized(root=ROOT):
    db, seed = paths(root)
    if not db.is_relative_to(root.resolve()) or not seed.is_relative_to(root.resolve()):
        raise RuntimeError('Provisioning paths must stay in this project.')
    if any(os.path.lexists(str(db)+suffix) for suffix in ('','-wal','-shm','-journal')):
        raise RuntimeError('Existing SQLite detected: setup is only for a new machine before first Backend start. Do not reset; use the reviewed reconciliation workflow.')
    if seed.with_name(seed.name+'.reconcile-pending.json').exists():
        raise RuntimeError('Interrupted reconciliation detected; do not provision.')
    return seed


def session(root=ROOT):
    # Reuses proactive refresh and one GET retry; never replays a failed write.
    return Api(read_env(root/'.env'))._send


def validated_user(user, expected, roles, require_role=True):
    from repair_security_dashboard import identifier
    if user.get('username')!=expected['username'] or user.get('enabled') is not True:
        raise RuntimeError('Unexpected or disabled demo identity; stopped.')
    if user.get('federationLink') or user.get('serviceAccountClientId') or any('ldap' in k.lower() for k in (user.get('attributes') or {})):
        raise RuntimeError('Federated demo username blocked; never automatically match LDAP.')
    application={r['name'] for r in roles} & {'admin','employee','manager','auditor'}
    if application-{expected['role']} or (require_role and application!={expected['role']}):
        raise RuntimeError('Conflicting/missing effective application role; stopped.')
    return identifier(user.get('id'))


def collect_profiles(api, config):
    base='/admin/realms/'+config['realm']
    profiles=[]
    for expected in config['users']:
        users=api(base+'/users?exact=true&username='+quote(expected['username']))
        if len(users)!=1:
            raise RuntimeError('Expected exactly one demo identity; seed not published.')
        roles=api(base+'/users/'+users[0]['id']+'/role-mappings/realm/composite')
        uid=validated_user(users[0],expected,roles)
        profiles.append({**expected,'id':uid})
    if len({p['id'] for p in profiles})!=len(profiles) or len({p['username'] for p in profiles})!=len(profiles):
        raise RuntimeError('Duplicate identity in seed; stopped.')
    return profiles


def check_existing_seed(seed, profiles):
    if not seed.exists():
        return
    try:
        existing=json.loads(seed.read_bytes())
    except (ValueError,OSError):
        raise RuntimeError('Existing seed cannot be verified; preserve it and investigate.') from None
    if existing!=profiles:
        raise RuntimeError('Existing staff.json differs from verified identities. Never overwrite it with a different realm; review reconciliation.')


def precheck(api, config, root=ROOT):
    seed=require_uninitialized(root)
    if seed.exists():
        check_existing_seed(seed,collect_profiles(api,config))
    return seed


def publish_profiles(api, config, root=ROOT):
    seed=require_uninitialized(root)
    profiles=collect_profiles(api,config)
    check_existing_seed(seed,profiles)
    if seed.exists():
        return  # Byte-for-byte preservation on rerun before first Backend start.
    seed.parent.mkdir(parents=True,exist_ok=True)
    temporary=seed.with_name(seed.name+'.'+uuid.uuid4().hex+'.tmp')
    try:
        with temporary.open('x',encoding='utf-8') as out:
            json.dump(profiles,out,ensure_ascii=False,indent=2)
            out.flush();os.fsync(out.fileno())
        require_uninitialized(root)
        # Atomic no-clobber publication on the same filesystem. A competing seed
        # producer makes this fail; it never replaces an existing seed.
        os.link(temporary,seed)
    finally:
        if temporary.exists():temporary.unlink()
