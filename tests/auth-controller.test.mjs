import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAuthController,authFailure,INIT_OPTIONS,identityProbe,rememberSection,takeSection} from '../shared/auth-controller.mjs';

function fixture({authenticated=false,role='admin',app='A',probe,init,timeout=50}={}) {
  const calls=[],states=[];
  const keycloak={authenticated,async init(options){calls.push(['init',options]);return init?init():authenticated;},
    async login(options){calls.push(['login',options]);},async logout(options){calls.push(['logout',options]);}};
  const controller=createAuthController({keycloak,app,probe:probe||(async()=>({role})),
    redirectUri:'https://app.example.test/a/',notify:s=>states.push(s),reload:()=>calls.push(['reload']),timeout});
  return {controller,keycloak,calls,states};
}
test('unauthenticated visitor sees start page and is not granted application access',async()=>{
  const f=fixture();await f.controller.start();assert.equal(f.controller.state.status,'welcome');assert.equal(f.controller.state.authorized,false);
});
test('both applications use standard code flow with S256 and non-interactive SSO check',()=>{
  assert.deepEqual(INIT_OPTIONS,{onLoad:'check-sso',flow:'standard',pkceMethod:'S256',checkLoginIframe:false,enableLogging:false});
});
test('existing SSO requires backend profile confirmation before ready',async()=>{
  let finish;const f=fixture({authenticated:true,probe:()=>new Promise(resolve=>{finish=resolve;})});
  const started=f.controller.start();await new Promise(r=>setTimeout(r,0));
  assert.equal(f.controller.state.authorized,false);finish({role:'employee'});await started;
  assert.equal(f.controller.state.status,'ready');
});
test('Web B rejects employee and manager despite an authenticated IdP session',async()=>{
  for(const role of ['employee','manager']){const f=fixture({app:'B',authenticated:true,role});await f.controller.start();assert.equal(f.controller.state.status,'denied');assert.equal(f.controller.state.authorized,false);}
});
test('Web B admits admin and auditor only after backend confirmation',async()=>{
  for(const role of ['admin','auditor']){const f=fixture({app:'B',authenticated:true,role});await f.controller.start();assert.equal(f.controller.state.status,'ready');}
});
test('backend outage never authorizes initial entry',async()=>{
  const f=fixture({authenticated:true,probe:async()=>{throw {status:503};}});await f.controller.start();assert.equal(f.controller.state.status,'unavailable');assert.equal(f.controller.state.authorized,false);
});
test('Keycloak initialization timeout is bounded, redacted and requires fresh page instance',async()=>{
  const f=fixture({init:()=>new Promise(()=>{}),timeout:5});await f.controller.start();assert.equal(f.controller.state.status,'unavailable');await f.controller.retry();assert.equal(f.calls.at(-1)[0],'reload');
});
test('Keycloak initialization failure does not expose underlying detail',async()=>{
  const f=fixture({init:()=>{throw Error('internal fixture detail');}});await f.controller.start();assert.ok(!JSON.stringify(f.states).includes('internal fixture detail'));
});
test('concurrent start calls initialize the adapter once',async()=>{
  const f=fixture();await Promise.all([f.controller.start(),f.controller.start()]);assert.equal(f.calls.filter(c=>c[0]==='init').length,1);
});
test('login explicitly delegates to Keycloak and never grants access on callback promise alone',async()=>{
  const f=fixture();await f.controller.start();await f.controller.login();assert.equal(f.calls.at(-1)[0],'login');assert.equal(f.controller.state.status,'authenticating');assert.equal(f.controller.state.authorized,false);
});
test('login transport failure becomes recoverable unavailable state',async()=>{
  const f=fixture();await f.controller.start();f.keycloak.login=async()=>{throw Error('detail');};await f.controller.login();assert.equal(f.controller.state.status,'unavailable');
});
test('MFA or required actions are handled at Keycloak, never accepted locally',async()=>{
  for(const code of ['MFA_SETUP_REQUIRED','REQUIRED_ACTION_PENDING']){const f=fixture({authenticated:true,probe:async()=>{throw {code,status:403};}});await f.controller.start();assert.equal(f.controller.state.status,'required');assert.equal(f.controller.state.authorized,false);}
});
test('expired, revoked and ended sessions close application access',async()=>{
  for(const code of ['INVALID_TOKEN','SESSION_REVOKED','SSO_SESSION_ENDED']){const f=fixture({authenticated:true});await f.controller.start();f.controller.session({state:'ended',code});assert.equal(f.controller.state.status,'expired');assert.equal(f.controller.state.authorized,false);}
});
test('disabled account remains a denied state even when event terminates the session',()=>{
  assert.equal(authFailure({code:'ACCOUNT_DISABLED',status:401}).status,'denied');
});
test('lost connectivity hides UI without discarding mounted application state',async()=>{
  const f=fixture({authenticated:true});await f.controller.start();f.controller.session({state:'unavailable'});assert.equal(f.controller.state.status,'unavailable');assert.equal(f.controller.state.authorized,true);f.controller.session({state:'available'});assert.equal(f.controller.state.status,'ready');
});
test('an available event cannot revive a revoked session',async()=>{
  const f=fixture({authenticated:true});await f.controller.start();f.controller.session({state:'ended',code:'SESSION_REVOKED'});f.controller.session({state:'available'});assert.equal(f.controller.state.authorized,false);assert.equal(f.controller.state.status,'expired');
});
test('logout uses the canonical app return URI and blocks product immediately',async()=>{
  const f=fixture({authenticated:true});await f.controller.start();await f.controller.logout();assert.equal(f.calls.at(-1)[0],'logout');assert.equal(f.calls.at(-1)[1].redirectUri,'https://app.example.test/a/');assert.equal(f.controller.state.authorized,false);
});
test('failed logout retry retries logout rather than re-admitting old SSO session',async()=>{
  const f=fixture({authenticated:true});await f.controller.start();let attempts=0;f.keycloak.logout=async()=>{attempts++;throw Error('detail');};await f.controller.logout();await f.controller.retry();assert.equal(attempts,2);assert.equal(f.controller.state.authorized,false);
});
test('late profile response cannot override a terminal session event',async()=>{
  let finish;const f=fixture({authenticated:true,probe:()=>new Promise(r=>{finish=r;})});const job=f.controller.start();await new Promise(r=>setTimeout(r,0));f.controller.session({state:'ended',code:'SESSION_REVOKED'});finish({role:'admin'});await job;assert.equal(f.controller.state.authorized,false);
});
test('dispose prevents late authentication response updates',async()=>{
  let finish;const f=fixture({init:()=>new Promise(r=>{finish=r;})});const job=f.controller.start();await new Promise(r=>setTimeout(r,0));f.controller.dispose();const count=f.states.length;finish(true);await job;assert.equal(f.states.length,count);
});
test('only route sections, never OAuth fragments, are remembered for deep links',()=>{
  const values=new Map();const store={setItem:(k,v)=>values.set(k,v),getItem:k=>values.get(k),removeItem:k=>values.delete(k)};
  rememberSection(store,'A','#/accounts');assert.equal(takeSection(store,'A'),'#/accounts');assert.equal(values.size,0);
  for(const input of ['#code=fixture&state=fixture','#/accounts?code=fixture','https://example.invalid/']){rememberSection(store,'A',input);assert.equal(values.size,0);}
});
function metadata(){const root='https://issuer.example.test/realms/company-iam';return {issuer:root,response_types_supported:['code'],code_challenge_methods_supported:['S256'],id_token_signing_alg_values_supported:['RS256'],authorization_endpoint:root+'/auth',token_endpoint:root+'/token',jwks_uri:root+'/certs',end_session_endpoint:root+'/logout'};}
test('identity discovery validates expected issuer and standard flow metadata without bearer credentials',async()=>{
  let options;const probe=identityProbe({url:'https://issuer.example.test',realm:'company-iam',origin:'https://app.example.test',
    fetcher:async(_url,input)=>{options=input;return new Response(JSON.stringify(metadata()));}});
  await probe();assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);
});
test('identity discovery rejects issuer mismatch, missing S256 and off-origin token endpoint',async()=>{
  for(const update of [{issuer:'https://rogue.example.test'},{code_challenge_methods_supported:['plain']},{token_endpoint:'https://rogue.example.test/token'}]){
    const probe=identityProbe({url:'https://issuer.example.test',realm:'company-iam',origin:'https://app.example.test',fetcher:async()=>new Response(JSON.stringify({...metadata(),...update}))});
    await assert.rejects(probe);
  }
});
test('identity discovery rejects credential URLs and HTTP LAN before network access',()=>{
  for(const url of ['http://192.0.2.10','https://user:fixture@example.test','https://issuer.example.test?private=fixture'])assert.throws(()=>identityProbe({url,realm:'company-iam',origin:'https://app.example.test'}));
});
test('unavailable identity discovery prevents redirect/init instead of landing on a browser error page',async()=>{
  let initialized=false;const auth=createAuthController({keycloak:{async init(){initialized=true;}},probe:async()=>({role:'admin'}),checkIdentity:async()=>{throw Error('synthetic outage');}});
  await auth.start();assert.equal(initialized,false);assert.equal(auth.state.status,'unavailable');assert.equal(auth.state.authorized,false);
});
