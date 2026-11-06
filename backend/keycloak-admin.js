function keycloakAdmin({ issuer, clientId, clientSecret }) {
  function names(name){const words=name.trim().split(/\s+/);return {firstName:words.at(-1),lastName:words.slice(0,-1).join(' ')};}
  const url = new URL(issuer), realm = url.pathname.split('/').pop();
  let cached,authenticating;
  async function token() {
    if (!clientSecret) throw new Error('Missing Keycloak service credential');
    if (cached && cached.until > Date.now()) return cached.token;
    if(!authenticating)authenticating=(async()=>{
      const r = await fetch(`${issuer}/protocol/openid-connect/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}), signal:AbortSignal.timeout(8000) });
      if (!r.ok) throw new Error('Keycloak service authentication failed');
      const b = await r.json(); cached = { token:b.access_token, until:Date.now()+Math.max(0,b.expires_in-20)*1000 }; return cached.token;
    })().finally(()=>{authenticating=null;});
    return authenticating;
  }
  async function call(p, method='GET', body) {
    const r = await fetch(`${url.origin}/admin/realms/${encodeURIComponent(realm)}${p}`, { method, headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(8000) });
    if (!r.ok) { if(r.status === 401) cached=null; const e=new Error(`Keycloak operation failed (${r.status})`);e.status=r.status;throw e; }
    if(r.status===204)return null;
    if(r.status===201)return {id:r.headers.get('location')?.split('/').pop()};
    return r.json();
  }
  return {
    async createUser({username,name,email,role,password}) {
      const created=await call('/users','POST',{username,...names(name),email,enabled:true,requiredActions:['UPDATE_PASSWORD'],credentials:[{type:'password',value:password,temporary:true}]});
      if(!created.id)throw new Error('Keycloak did not return user ID');
      try{const mapping=await call('/roles/'+encodeURIComponent(role));await call('/users/'+encodeURIComponent(created.id)+'/role-mappings/realm','POST',[mapping]);}
      catch(e){await call('/users/'+encodeURIComponent(created.id),'PUT',{enabled:false}).catch(()=>{});throw e;}
      return created;
    },
    async updateUser(id,{name,role,email}) {
      const p='/users/'+encodeURIComponent(id);
      const assigned=await call(p+'/role-mappings/realm');
      const mapping=await call('/roles/'+encodeURIComponent(role));
      const removed=assigned.filter(r=>['employee','manager','auditor'].includes(r.name)&&r.name!==role);
      if(removed.length)await call(p+'/role-mappings/realm','DELETE',removed);
      if(!assigned.some(r=>r.name===role))await call(p+'/role-mappings/realm','POST',[mapping]);
      await call(p,'PUT',{...names(name),...(email?{email}:{})});
      await call(p+'/logout','POST');
    },
    async userSecurity(id) {
      const p='/users/'+encodeURIComponent(id);
      const [user,credentials]=await Promise.all([call(p),call(p+'/credentials')]);
      const otp=credentials.filter(c=>c.type==='otp');
      const required=user.attributes?.['nhip.mfa.required']?.includes('true') || false;
      return {enabled:user.enabled===true,required,configured:otp.length>0,
        requiredActions:(user.requiredActions || []).map(String),
        state:user.requiredActions?.includes('CONFIGURE_TOTP')?(otp.length?'reconfigure':'pending'):otp.length?'enabled':required?'pending':'not_enabled',
        configuredAt:otp.length?Math.max(...otp.map(c=>Number(c.createdDate)||0)) || null:null,
        observedAt:new Date().toISOString(),credentialCount:otp.length};
    },
    async inspectUser(id) {
      const p='/users/'+encodeURIComponent(id);
      const [user,mappings,security]=await Promise.all([call(p),call(p+'/role-mappings/realm'),this.userSecurity(id)]);
      return {id:user.id,username:user.username,name:[user.lastName,user.firstName].filter(Boolean).join(' '),email:user.email || '',enabled:user.enabled===true,
        roles:mappings.map(r=>r.name).filter(r=>['employee','manager','auditor','admin'].includes(r)),security};
    },
    async recoverMfa(id) {
      const p='/users/'+encodeURIComponent(id),user=await call(p);
      // Require setup before removing the old factors; do not open a password-only interval.
      await call(p,'PUT',{attributes:{...user.attributes,'nhip.mfa.required':['true']},requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
      await call(p+'/logout','POST');
      const credentials=await call(p+'/credentials');
      for(const credential of credentials.filter(c=>c.type==='otp'))await call(p+'/credentials/'+encodeURIComponent(credential.id),'DELETE');
    },
    async sessions(id) {return (await call('/users/'+encodeURIComponent(id)+'/sessions')).map(s=>({id:s.id,ipAddress:s.ipAddress,start:s.start,lastAccess:s.lastAccess,clients:Object.values(s.clients || {}),device:s.rememberMe?'Phiên ghi nhớ':'Trình duyệt (Keycloak không cung cấp tên thiết bị)'}));},
    async endSession(id,sid) {
      const sessions=await call('/users/'+encodeURIComponent(id)+'/sessions');
      if(!sessions.some(s=>s.id===sid))throw new Error('Session not owned by target');
      return call('/sessions/'+encodeURIComponent(sid),'DELETE');
    },
    async resetPassword(id,password) {await call('/users/'+encodeURIComponent(id)+'/reset-password','PUT',{type:'password',value:password,temporary:true});await call('/users/'+encodeURIComponent(id)+'/logout','POST');},
    async sessionActive(id,sid) { return (await call(`/users/${encodeURIComponent(id)}/sessions`)).some(s=>s.id===sid); },
    async remediate(id, action) {
      const p = `/users/${encodeURIComponent(id)}`;
      if(action === 'revoke') return call(p+'/logout','POST');
      const user = await call(p);
      if(['disable','enable'].includes(action)) await call(p,'PUT',{enabled:action === 'enable'});
      else if(action === 'require-mfa') await call(p,'PUT',{attributes:{...user.attributes,'nhip.mfa.required':['true']},requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
      else throw new Error('Unsupported action');
      if(action !== 'enable') await call(p+'/logout','POST');
    },
    async ready() {await token();const r=await fetch(issuer+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(4000)});if(!r.ok)throw Error('Identity unavailable');return true;},
    async activeSessionCount() {
      const ids=new Set();let complete=true;
      for(const clientId of ['employee-portal','security-dashboard']) {
        const clients=await call('/clients?clientId='+encodeURIComponent(clientId));
        if(!clients.length){complete=false;continue;}
        let drained=false;
        for(let first=0;first<10000;first+=200){const page=await call('/clients/'+encodeURIComponent(clients[0].id)+'/user-sessions?first='+first+'&max=200');for(const s of page)ids.add(s.id);if(page.length<200){drained=true;break;}}
        if(!drained)complete=false;
      }
      return {count:ids.size,complete,observedAt:new Date().toISOString()};
    },
    async policy() { const c = await call(''); return {bruteForceProtected:c.bruteForceProtected,accessTokenLifespan:c.accessTokenLifespan,eventsEnabled:c.eventsEnabled,eventsExpiration:c.eventsExpiration,passwordPolicy:c.passwordPolicy,registrationAllowed:c.registrationAllowed,sslRequired:c.sslRequired,otpPolicy:{type:c.otpPolicyType,algorithm:c.otpPolicyAlgorithm,digits:c.otpPolicyDigits,period:c.otpPolicyPeriod,lookAheadWindow:c.otpPolicyLookAheadWindow,reusable:c.otpPolicyCodeReusable},revokeRefreshToken:c.revokeRefreshToken,refreshTokenMaxReuse:c.refreshTokenMaxReuse,ssoSessionIdleTimeout:c.ssoSessionIdleTimeout,ssoSessionMaxLifespan:c.ssoSessionMaxLifespan}; },
    async events({max=30,first=0,dateFrom,dateTo,direction='desc'}={}) {
      const query=new URLSearchParams({max:String(max),first:String(first),direction});
      if(dateFrom!==undefined)query.set('dateFrom',String(dateFrom));
      if(dateTo!==undefined)query.set('dateTo',String(dateTo));
      return (await call('/events?'+query)).map(e=>({id:e.id,time:e.time,type:e.type,clientId:e.clientId,userId:e.userId,error:e.error,ipAddress:e.ipAddress,username:e.details?.username}));
    },
  };
}
module.exports = { keycloakAdmin };
