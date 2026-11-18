"""Read-only environment checks. Output contains allowlisted metadata, never credentials."""
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import urllib.request
from urllib.parse import urlsplit

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/'.runtime/phase6-tests'


def command(args):
    try:
        p=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=20)
        return p.returncode,p.stdout,p.stderr
    except Exception:
        return -1,'',''


def safe_url(value):
    try:
        p=urlsplit(value)
        if p.scheme not in {'http','https'} or not p.hostname or p.username or p.password or p.query or p.fragment:
            return None
        return value.rstrip('/')
    except ValueError:
        return None


def env_file(path):
    result={}
    if path.is_file():
        for line in path.read_text(encoding='utf-8-sig').splitlines():
            if '=' in line and not line.lstrip().startswith('#'):
                k,v=line.split('=',1);result[k.strip()]=v.strip().strip('"').strip("'")
    return result


def main():
    BASE.mkdir(parents=True,exist_ok=True)
    if BASE.is_symlink() or getattr(BASE,'is_junction',lambda:False)() or not BASE.resolve().is_relative_to(ROOT):
        raise RuntimeError('Unsafe output path')
    result={'readOnly':True,'labMutations':False,'docker':{},'compose':{},'environment':{},'ports':{},'publicHttp':{}}
    for label,args in [('client',['docker','--version']),('compose',['docker','compose','version','--short']),('engine',['docker','info','--format','{{.ServerVersion}}'])]:
        code,out,err=command(args)
        result['docker'][label]={'available':code==0,'version':out.strip()[:80] if code==0 else None,'reason':None if code==0 else 'ENGINE_PIPE_MISSING' if 'cannot find the file specified' in err.lower() else 'COMMAND_UNAVAILABLE'}
    code,out,_=command(['docker','compose','config','--format','json'])
    if code==0:
        config=json.loads(out)
        result['compose']={'valid':True,'services':{name:{'image':s.get('image'),'profiles':s.get('profiles',[]),'ports':[{k:p.get(k) for k in ['host_ip','published','target','protocol']} for p in s.get('ports',[])],'dependsOn':sorted(s.get('depends_on',{}))} for name,s in config.get('services',{}).items()}}
        ports={int(p['published']) for s in config.get('services',{}).values() for p in s.get('ports',[]) if str(p.get('published','')).isdigit()}
    else:
        result['compose']={'valid':False,'reason':'CONFIG_COMMAND_FAILED_DETAILS_SUPPRESSED'};ports=set()
    urls={}
    for file,keys in [('backend/.env',['KEYCLOAK_ISSUER','KEYCLOAK_INTERNAL_ISSUER','FRONTEND_ORIGIN','SECURITY_FRONTEND_ORIGIN','AUDIT_SERVICE_URL']),('web-a/.env',['VITE_KEYCLOAK_URL','VITE_API_URL','VITE_SECURITY_URL']),('web-b/.env',['VITE_KEYCLOAK_URL','VITE_API_URL','VITE_PORTAL_URL'])]:
        source=ROOT/file
        sources=[source]+([source.with_name('.env.local')] if file.startswith('web-') else [])
        values={}
        for candidate in sources:values.update(env_file(candidate))
        selected={k:safe_url(values.get(k,'')) for k in keys}
        result['environment'][file]={'present':any(p.is_file() for p in sources),'sourceFiles':[p.relative_to(ROOT).as_posix() for p in sources if p.is_file()],'publicEndpoints':selected,'secretValuesReadIntoReport':False}
        urls.update({file+':'+k:v for k,v in selected.items() if v})
        for value in selected.values():
            if value:
                p=urlsplit(value)
                if p.hostname in {'localhost','127.0.0.1','::1'}:ports.add(p.port or (443 if p.scheme=='https' else 80))
    network=ROOT/'network/.local/config.json'
    active_public=safe_url(env_file(ROOT/'.env').get('KEYCLOAK_PUBLIC_URL',''))
    result['environment']['activePublicUrl']=active_public
    public=None
    if network.is_file():
        public=safe_url(json.loads(network.read_text(encoding='utf-8-sig')).get('publicUrl',''))
    result['environment']['network']={'present':network.is_file(),'publicUrl':public,'caPresent':(ROOT/'network/.local/ca.crt').is_file()}
    backend=env_file(ROOT/'backend/.env')
    compose=['docker','compose','--env-file','.env']
    if backend.get('AUDIT_SERVICE_URL') and (ROOT/'audit/.local/compose.env').is_file():compose+=['--env-file','audit/.local/compose.env']
    compose+=['-f','docker-compose.yml']
    if backend.get('DIRECTORY_COMPONENT_ID'):compose+=['-f','directory/compose.week6.yml']
    if backend.get('AUDIT_SERVICE_URL'):compose+=['-f','audit/compose.week8.yml']
    code,out,_=command(compose+['config','--format','json'])
    result['compose']['configuredFullStack']={'valid':code==0,'services':sorted(json.loads(out).get('services',{})) if code==0 else [],'valuesSuppressed':True}
    ports.update([3001,5173,5174,8080,8443,5432,5433])
    for port in sorted(ports):
        try:
            with socket.create_connection(('127.0.0.1',port),timeout=.4):listening=True
        except OSError:listening=False
        result['ports'][str(port)]={'host':'127.0.0.1','tcpListening':listening,'serviceIdentityVerified':False}
    candidates={'backend-health':'http://127.0.0.1:3001/health','web-a':'http://127.0.0.1:5173/','web-b':'http://127.0.0.1:5174/','keycloak-local-discovery':'http://127.0.0.1:8080/realms/company-iam/.well-known/openid-configuration'}
    if public:
        candidates.update({'gateway-health':public+'/health','gateway-ready':public+'/ready','gateway-discovery':public+'/realms/company-iam/.well-known/openid-configuration'})
    ca=ROOT/'network/.local/ca.crt'
    try:context=ssl.create_default_context(cafile=str(ca) if ca.is_file() else None)
    except Exception:context=ssl.create_default_context()
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self,*_args,**_kwargs):return None
    opener=urllib.request.build_opener(urllib.request.ProxyHandler({}),urllib.request.HTTPSHandler(context=context),NoRedirect())
    for label,url in candidates.items():
        try:
            with opener.open(urllib.request.Request(url,headers={'Accept':'application/json,text/html'}),timeout=3) as response:
                item={'reachable':True,'httpStatus':response.status,'tlsVerified':url.startswith('https:'),'authenticated':False}
                if 'discovery' in label:
                    from review_oidc import review_discovery
                    body=json.loads(response.read(262144));expected=url.rsplit('/.well-known',1)[0]
                    item['discoveryChecks']=review_discovery(body,expected)
                result['publicHttp'][label]=item
        except Exception as e:
            result['publicHttp'][label]={'reachable':False,'failureType':type(e).__name__,'authenticated':False}
    if result['docker']['engine']['available']:
        code,out,_=command(['docker','ps','--format','{{.Names}}|{{.Status}}|{{.Ports}}'])
        result['docker']['runningContainers']=[{'name':s.split('|')[0],'status':s.split('|')[1],'ports':s.split('|')[2]} for s in out.splitlines() if s.count('|')==2] if code==0 else []
    (BASE/'environment.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(result,ensure_ascii=True,indent=2))


if __name__=='__main__':main()
