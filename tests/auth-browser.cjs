// Actual built apps + actual keycloak-js, with a synthetic OIDC/API server only.
// This is NOT a live Keycloak/MFA test. Never print request URLs, bodies or tokens.
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const crypto=require('node:crypto');
const {chromium}=require('../.tools/playwright/driver/package');
const ROOT=path.resolve(__dirname,'..'),OUT=path.join(ROOT,process.env.IAM_BROWSER_PHASE==='6'?'.runtime/phase6-tests':process.env.IAM_BROWSER_PHASE==='5b'?'.runtime/phase5b-tests':process.env.IAM_BROWSER_PHASE==='5a'?'.runtime/phase5a-tests':process.env.IAM_BROWSER_PHASE==='4'?'.runtime/phase4-tests':process.env.IAM_BROWSER_PHASE==='3'?'.runtime/phase3-tests':'.runtime/phase2-tests');
const results=[],observations=[],requestCounts={},codes=new Map(),access=new Map(),refresh=new Map();
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
      if(mode.backendDown){json(res,503,{code:'UPSTREAM_UNAVAILABLE'});return;}
      const user=access.get(String(req.headers.authorization||'').replace(/^Bearer /,''));
      if(!user){json(res,401,{code:'INVALID_TOKEN'});return;}
      const route=pathname.slice('/fixture-api'.length);
      if(route==='/api/profile'){
        if(mode.profileCode){json(res,mode.profileCode==='SSO_SESSION_ENDED'?401:403,{code:mode.profileCode});return;}
        json(res,200,{id:'synthetic-'+user.role,username:'synthetic-'+user.role,name:'Fixture User',role:user.role,roles:[user.role],team:'Fixture',identitySource:'local',governanceState:'active'});return;
      }
      if(req.method!=='GET'){json(res,405,{code:'FIXTURE_READ_ONLY'});return;}
      const payloads={
        '/api/attendance':{records:[],today:null,week:[]},'/api/corrections':{requests:[]},
        '/api/team':{members:[],records:[],requests:[]},'/api/admin/users':{users:[]},
        '/api/security':{alerts:[],events:[],actions:[],openCount:0},'/api/security/keycloak':{connected:true,policy:{},events:[]},
        '/api/notifications':{items:[],unread:0},'/api/security/summary':{requests:0,denied:0,openAlerts:0,staff:1,disabled:0,series:[],collector:{}},
        '/api/security/analytics':{requests:0,denied:0,login:{success:0,failure:0},users:{total:1,disabled:0,mfaRequired:0},sessions:{count:1,available:true},series:[],distribution:[],collector:{}},
        '/api/me/workspace':{records:[],requests:[],kpi:{days:0,lateDays:0,lateMinutes:0,hours:0,pending:0,approved:0}},
        '/api/security/actions':{items:[],total:0,page:1,pages:0},
      };
      json(res,200,payloads[route]||{items:[],total:0,page:1,pages:0});return;
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
function check(name,value){results.push({name,passed:!!value});console.log((value?'PASS ':'FAIL ')+name);if(!value)throw Error('Check failed');}
async function wait(page,status){await page.locator('.auth-entry h2').filter({hasText:status}).waitFor({timeout:25000});}
async function main(){
  fs.mkdirSync(OUT,{recursive:true});server.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));base='http://127.0.0.1:'+server.address().port;
  const executable=process.env.IAM_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe';
  const browser=await chromium.launch({executablePath:executable,headless:true,args:['--disable-background-networking','--disable-sync','--no-first-run']});
  let externalRequests=0,jsErrors=0;
  async function context(){
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},locale:'vi-VN'});
    await ctx.route('**/*',route=>{if(new URL(route.request().url()).origin===base)route.continue();else{externalRequests++;route.abort();}});
    ctx.on('page',page=>page.on('pageerror',()=>jsErrors++));return ctx;
  }
  try{
    let ctx=await context(),page=await ctx.newPage();
    await page.goto(base+'/a/');await wait(page,'Sẵn sàng');check('Web A shows unauthenticated start',await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).isVisible());
    check('No password or OTP input in Web A start page',await page.locator('input').count()===0);
    await page.screenshot({path:path.join(OUT,'auth-a-desktop.png')});
    for(const width of [320,390,768]){await page.setViewportSize({width,height:900});check('Web A responsive '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
    await page.screenshot({path:path.join(OUT,'auth-a-mobile.png')});
    await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await page.locator('.shell').waitFor();check('Web A actual adapter completes synthetic code/PKCE callback',true);
    await page.goto(base+'/b/');await page.locator('.app-security').waitFor();check('Synthetic SSO Web A to Web B',true);
    await page.goto(base+'/a/');await page.locator('.app-workspace').waitFor();check('Synthetic SSO Web B to Web A',true);
    await page.goto(base+'/a/#/users');await page.getByRole('button',{name:'Thêm nhân viên'}).click();await page.getByLabel('Họ và tên',{exact:true}).fill('Synthetic UI fixture');
    mode.backendDown=true;await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await wait(page,'Kết nối');
    check('Active backend outage hides product',!(await page.locator('.shell').isVisible()));check('Open dialog does not block connectivity screen',await page.getByRole('button',{name:'Kiểm tra kết nối lại'}).isVisible());
    mode.backendDown=false;await page.getByRole('button',{name:'Kiểm tra kết nối lại'}).click();await page.locator('dialog[open]').waitFor();
    check('Connectivity retry preserves unsaved form',await page.getByLabel('Họ và tên',{exact:true}).inputValue()==='Synthetic UI fixture');await page.getByRole('button',{name:'Hủy',exact:true}).click();
    await page.getByRole('button',{name:'Đăng xuất',exact:true}).click();await wait(page,'Sẵn sàng');check('Synthetic logout returns to unauthenticated page',true);await ctx.close();

    mode={role:'employee',backendDown:false,idpDown:false,profileCode:null,refreshFailure:false};ctx=await context();page=await ctx.newPage();await page.goto(base+'/b/');await wait(page,'Sẵn sàng');
    await page.screenshot({path:path.join(OUT,'auth-b-desktop.png')});await page.setViewportSize({width:390,height:844});check('Web B responsive mobile',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(OUT,'auth-b-mobile.png')});
    await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await wait(page,'Bạn chưa có quyền');check('Web B employee denied before mounting application',await page.locator('.shell').count()===0);await ctx.close();

    for(const code of ['MFA_SETUP_REQUIRED','ACCOUNT_DISABLED','SSO_SESSION_ENDED']){
      mode={role:'admin',profileCode:code};ctx=await context();page=await ctx.newPage();await page.goto(base+'/a/');await wait(page,'Sẵn sàng');await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();
      await wait(page,code==='MFA_SETUP_REQUIRED'?'Cần hoàn tất':code==='ACCOUNT_DISABLED'?'Bạn chưa có quyền':'Phiên đăng nhập đã kết thúc');check('Synthetic profile rejection '+code,await page.locator('.shell').count()===0);await ctx.close();
    }
    mode={role:'admin',idpDown:true};ctx=await context();page=await ctx.newPage();await page.goto(base+'/a/');await wait(page,'Kết nối');check('IdP discovery failure does not admit application',await page.locator('.shell').count()===0);await ctx.close();
    mode={role:'admin',backendDown:true};ctx=await context();page=await ctx.newPage();await page.goto(base+'/a/');await wait(page,'Sẵn sàng');await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await wait(page,'Kết nối');check('Initial backend outage does not admit application',await page.locator('.shell').count()===0);await ctx.close();
    mode={role:'admin'};ctx=await context();page=await ctx.newPage();await page.goto(base+'/a/');await wait(page,'Sẵn sàng');await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await page.locator('.shell').waitFor();
    await page.clock.install();mode.refreshFailure=true;await page.clock.setSystemTime(new Date(Date.now()+360000));await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await wait(page,'Phiên đăng nhập đã kết thúc');check('Actual adapter refresh rejection closes protected application in fixture',await page.locator('.shell').count()===0);await ctx.close();
    mode={role:'admin'};ctx=await context();page=await ctx.newPage();await page.goto(base+'/a/');await wait(page,'Sẵn sàng');await page.getByRole('button',{name:'Đăng nhập qua Keycloak'}).click();await page.locator('.shell').waitFor();
    mode.profileCode='SSO_SESSION_ENDED';await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await wait(page,'Phiên đăng nhập đã kết thúc');check('Active revoked session removes protected application',await page.locator('.shell').count()===0);await ctx.close();
    check('Every synthetic authorization uses code, S256 and nonce',observations.filter(o=>'codeFlow'in o).every(o=>o.codeFlow&&o.s256&&o.noncePresent));
    check('Synthetic token endpoint validated PKCE verifiers',observations.filter(o=>o.verifierMatches).length>=5);
    check('Browser has no application JavaScript errors',jsErrors===0);check('Browser sent no requests to real services',externalRequests===0);
  }catch(error){
    const screens=[];
    for(const context of browser.contexts())for(const current of context.pages()){
      screens.push({pathname:new URL(current.url()).pathname,
        heading:await current.locator('.auth-entry h2').textContent({timeout:500}).catch(()=>null)});
    }
    fs.writeFileSync(path.join(OUT,'browser-diagnostic.json'),JSON.stringify({screens,requestCounts,protocolChecks:observations},null,2));
    throw error;
  }finally{await browser.close();await new Promise(r=>server.close(r));}
}
main().then(()=>{
  fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify({kind:'synthetic-oidc-actual-adapter',liveKeycloak:false,checks:results},null,2));
  console.log('Synthetic auth browser: '+results.length+' checks PASS; live Keycloak/MFA not tested.');
}).catch(async error=>{
  fs.writeFileSync(path.join(OUT,'browser-results.json'),JSON.stringify({kind:'synthetic-oidc-actual-adapter',liveKeycloak:false,checks:results,failureType:error.name,failureLocations:(error.stack||'').match(/auth-browser\.cjs:\d+:\d+/g)||[]},null,2));
  console.error('Synthetic auth browser failed; '+results.length+' checks recorded. No URL/body/token logged.');
  server.close();process.exitCode=1;
});
