"""Create/stop only a named synthetic PostgreSQL tmpfs fixture; never use compose or volumes."""
import json
from pathlib import Path
import re
import subprocess
import sys
import time
import uuid

BASE=Path(__file__).resolve().parents[1]/'.runtime/phase4-tests'


def inspect_fixture(config):
    if not re.fullmatch(r'zerotrust-phase4-(?:test|[a-f0-9]{12})',config['name']) or not re.fullmatch(r'[a-f0-9]{64}',config['id']) or config.get('synthetic') is not True:
        raise RuntimeError('Not a synthetic phase-4 fixture')
    result=subprocess.run(['docker','inspect',config['name'],'--format','{{.Id}}|{{json .Config.Labels}}|{{json .Mounts}}|{{json .NetworkSettings.Ports}}'],capture_output=True,text=True,timeout=15)
    if result.returncode:raise RuntimeError('Fixture container not found')
    identity,labels,mounts,ports=result.stdout.strip().split('|')
    bindings=json.loads(ports).get('5432/tcp') or []
    if identity!=config['id'] or json.loads(labels).get('zerotrust.test')!='phase4' or len(json.loads(mounts))!=1 or json.loads(mounts)[0]['Type']!='tmpfs' or json.loads(mounts)[0]['Destination']!='/var/lib/postgresql/data' or bindings!=[{'HostIp':'127.0.0.1','HostPort':str(config['port'])}]:
        raise RuntimeError('Fixture identity, tmpfs or loopback binding mismatch')
    if config['host']!='127.0.0.1' or config['database']!='phase4_fixture' or config['user']!='phase4_fixture':
        raise RuntimeError('Fixture connection mismatch')
    return config


def main():
    if sys.argv[1:] not in [['--create'],['--stop']]:raise SystemExit('Use --create or --stop; synthetic fixtures only')
    BASE.mkdir(parents=True,exist_ok=True)
    if BASE.is_symlink() or getattr(BASE,'is_junction',lambda:False)():raise RuntimeError('Output cannot be a link')
    output=BASE/'postgres-fixture.json'
    if output.is_symlink():raise RuntimeError('Fixture metadata cannot be a link')
    if sys.argv[1:] == ['--stop']:
        config=inspect_fixture(json.loads(output.read_text(encoding='utf-8')))
        result=subprocess.run(['docker','stop',config['id']],capture_output=True,text=True,timeout=30)
        if result.returncode:raise RuntimeError('Could not stop synthetic fixture')
        print('Stopped only the verified synthetic tmpfs fixture. No volumes removed.')
        return
    if output.exists():
        # Keep prior metadata as evidence; never overwrite its container or database.
        (BASE/('postgres-fixture-previous-'+uuid.uuid4().hex+'.json')).write_bytes(output.read_bytes())
    name='zerotrust-phase4-'+uuid.uuid4().hex[:12]
    args=['docker','run','--detach','--pull=never','--name',name,'--publish','127.0.0.1::5432','--mount','type=tmpfs,destination=/var/lib/postgresql/data,tmpfs-size=268435456',
          '--env','POSTGRES_HOST_AUTH_METHOD=trust','--env','POSTGRES_DB=phase4_fixture','--env','POSTGRES_USER=phase4_fixture','--label','zerotrust.test=phase4','postgres:17']
    result=subprocess.run(args,capture_output=True,text=True,timeout=45)
    if result.returncode:raise RuntimeError('Cannot create synthetic fixture; no fallback to existing containers')
    identity=result.stdout.strip()
    port=subprocess.run(['docker','inspect',name,'--format','{{json .NetworkSettings.Ports}}'],capture_output=True,text=True,timeout=15)
    bindings=json.loads(port.stdout)['5432/tcp']
    config=dict(id=identity,name=name,host='127.0.0.1',port=int(bindings[0]['HostPort']),database='phase4_fixture',user='phase4_fixture',synthetic=True)
    inspect_fixture(config)
    output.write_text(json.dumps(config,indent=2)+'\n',encoding='utf-8')
    for _ in range(30):
        ready=subprocess.run(['docker','exec',identity,'pg_isready','-h','127.0.0.1','-U','phase4_fixture','-d','phase4_fixture'],capture_output=True,text=True,timeout=3)
        if ready.returncode==0:break
        time.sleep(.5)
    else:raise RuntimeError('Synthetic PostgreSQL did not become ready; no fallback')
    print('Created a new synthetic PostgreSQL tmpfs fixture; loopback-only. No lab volumes mounted.')


if __name__=='__main__':main()
