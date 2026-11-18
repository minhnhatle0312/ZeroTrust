// Actual built apps + actual keycloak-js, with a synthetic OIDC/API server only.
// This is NOT a live Keycloak/MFA test. Never print request URLs, bodies or tokens.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const ROOT=path.resolve(__dirname,'..','..'),OUT=path.join(ROOT,process.env.IAM_BROWSER_PHASE==='6'?'.runtime/phase6-tests':process.env.IAM_BROWSER_PHASE==='5b'?'.runtime/phase5b-tests':process.env.IAM_BROWSER_PHASE==='5a'?'.runtime/phase5a-tests':process.env.IAM_BROWSER_PHASE==='4'?'.runtime/phase4-tests':'.runtime/phase3-tests');
const observations=[],requestCounts={},codes=new Map(),access=new Map(),refresh=new Map();
let backend,store;const mutations=[];
let base='',mode={role:'admin',backendDown:false,idpDown:false,profileCode:null,refreshFailure:false};
const issuer=()=>base+'/fixture-idp/realms/company-iam';
function json(res,status,body){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(body));}
function token(payload){return [Buffer.from(JSON.stringify({alg:'RS256',typ:'JWT'})).toString('base64url'),Buffer.from(JSON.stringify(payload)).toString('base64url'),'synthetic-fixture-signature'].join('.');}
function issue(client,role,nonce){
  const now=Math.floor(Date.now()/1000),subject='synthetic-'+role,sid='synthetic-session';
  const claims={iss:issuer(),sub:subject,iat:now,exp:now+300,sid,session_state:sid,azp:client,
    aud:client==='employee-portal'?'employee-api':'security-api',preferred_username:subject,realm_access:{roles:[role]}};
  const at=token(claims),rt=token({...claims,typ:'Refresh',jti:crypto.randomUUID(),exp:now+1800});access.set(at,{role,client});refresh.set(rt,{role,client});
  return {access_token:at,refresh_token:rt,id_token:token({...claims,aud:client,nonce}),expires_in:300,refresh_expires_in:1800,token_type:'Bearer',session_state:sid};
}
const server=http.createServer(async(req,res)=>{
  try{
    const url=new URL(req.url,base),pathname=url.pathname;
    if(mode.securityFixture&&pathname.startsWith('/synthetic-audit/')){
      await require(mode.incidentWriteFixture?'./incident-write-data.cjs':'./security-data.cjs').respond(req,res,url,mode,json);return;
    }
    const kind=pathname.endsWith('/auth')?'authorize':pathname.endsWith('/token')?'token':pathname.endsWith('/.well-known/openid-configuration')?'discovery':pathname.endsWith('/api/profile')?'profile':'other';
    requestCounts[kind]=(requestCounts[kind]||0)+1;
    if(pathname.startsWith('/fixture-idp/')){
      if(mode.idpDown){json(res,503,{error:'synthetic_unavailable'});return;}
      if(pathname.endsWith('/.well-known/openid-configuration')){
        json(res,200,{issuer:issuer(),authorization_endpoint:issuer()+'/protocol/openid-connect/auth',
          token_endpoint:issuer()+'/protocol/openid-connect/token',end_session_endpoint:issuer()+'/protocol/openid-connect/logout',
          jwks_uri:issuer()+'/protocol/openid-connect/certs',response_types_supported:['code'],code_challenge_methods_supported:['S256'],
          id_token_signing_alg_values_supported:['RS256']});return;
      }
      if(pathname.endsWith('/auth')){
        const params=url.searchParams,target=new URL(params.get('redirect_uri'));
        if(target.origin!==base){json(res,400,{error:'fixture_redirect_rejected'});return;}
        const session=String(req.headers.cookie||'').match(/fixture_session=(admin|auditor|employee|manager)/)?.[1];
        const reply={state:params.get('state'),iss:issuer()};
        if(params.get('prompt')==='none'&&!session)reply.error='login_required';
        else{
          const code=crypto.randomUUID(),role=session||mode.role;
          codes.set(code,{client:params.get('client_id'),challenge:params.get('code_challenge'),nonce:params.get('nonce'),role});
          observations.push({codeFlow:params.get('response_type')==='code',s256:params.get('code_challenge_method')==='S256',noncePresent:!!params.get('nonce'),silent:params.get('prompt')==='none'});
          reply.code=code;reply.session_state='synthetic-session';
          res.setHeader('Set-Cookie','fixture_session='+role+'; Path=/; HttpOnly; SameSite=Lax');
        }
        target.hash=new URLSearchParams(reply).toString();res.writeHead(302,{Location:target.href});res.end();return;
      }
      if(pathname.endsWith('/token')){
        let raw='';for await(const chunk of req)raw+=chunk;
        const params=new URLSearchParams(raw);
        if(params.get('grant_type')==='refresh_token'){
          const old=params.get('refresh_token'),known=refresh.get(old);refresh.delete(old);
          if(!known||mode.refreshFailure){json(res,400,{error:'invalid_grant'});return;}
          json(res,200,issue(known.client,known.role));return;
        }
        const code=params.get('code'),known=codes.get(code);codes.delete(code);
        const challenge=crypto.createHash('sha256').update(params.get('code_verifier')||'').digest('base64url');
        if(!known||challenge!==known.challenge){json(res,400,{error:'fixture_pkce_rejected'});return;}
        observations.push({verifierMatches:true});json(res,200,issue(known.client,known.role,known.nonce));return;
      }
      if(pathname.endsWith('/logout')){
        const target=new URL(url.searchParams.get('post_logout_redirect_uri'));
        if(target.origin!==base){json(res,400,{error:'fixture_redirect_rejected'});return;}
        res.writeHead(302,{Location:target.href,'Set-Cookie':'fixture_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0'});res.end();return;
      }
      json(res,404,{});return;
    }
    if(pathname.startsWith('/fixture-api/')){
      const route=pathname.slice('/fixture-api'.length);
      if(mode.delay&&route===mode.delayRoute)await new Promise(r=>setTimeout(r,mode.delay));
      if(mode.failOnce&&route===mode.failOnce){mode.failOnce=null;json(res,409,{code:'SYNTHETIC_CONFLICT',message:'Synthetic conflict; retry safely.'});return;}
      if(mode.backendDown){json(res,503,{code:'UPSTREAM_UNAVAILABLE'});return;}
      if(req.method!=='GET')res.once('finish',()=>mutations.push({method:req.method,route,status:res.statusCode}));
      req.url=req.url.slice('/fixture-api'.length);backend(req,res);return;
    }
    const app=pathname.startsWith('/a/')?'web-a':pathname.startsWith('/b/')?'web-b':null;
    if(!app){res.writeHead(404);res.end();return;}
    const directory=path.join(OUT,'build',app),relative=pathname.slice(3)||'index.html';
    const file=path.resolve(directory,relative);
    if(!file.startsWith(directory+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
    const type={'.html':'text/html','.js':'text/javascript','.css':'text/css'}[path.extname(file)]||'application/octet-stream';
    res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-store'});res.end(fs.readFileSync(file));
  }catch{json(res,500,{code:'SYNTHETIC_FIXTURE_ERROR'});}
});

module.exports={mode,mutations,observations,requestCounts,get store(){return store;},get base(){return base;},server,
 async start(){
   server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
   ({store,app:backend}=require('./workspace-backend.cjs').createFixture({base,access,securityFixture:mode.securityFixture}));
   if(mode.securityFixture)require('./security-data.cjs').seed(store);
   if(mode.incidentWriteFixture)require('./incident-write-data.cjs').seed(store);
   return base;
 },async close(){server.closeAllConnections();await new Promise(r=>server.close(r));store?.db.close();}
};
module.exports.testRequest=async(role,route,method='GET',body)=>{
  if(!mode.incidentWriteFixture||!/^\/api\/security\/(?:alerts\/|central\/incidents\/)/.test(route))throw Error('Only isolated incident fixture requests allowed');
  const credential=issue(['employee','manager'].includes(role)?'employee-portal':'security-dashboard',role);
  const result=await fetch(base+'/fixture-api'+route,{method,headers:{Authorization:'Bearer '+credential.access_token,...(body===undefined?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:JSON.stringify(body)});
  return {status:result.status,body:await result.json()};
};
