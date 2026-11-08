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
  async function call(p, method='GET', body, timeout=8000) {
    const r = await fetch(`${url.origin}/admin/realms/${encodeURIComponent(realm)}${p}`, { method, headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(timeout) });
    if (!r.ok) { if(r.status === 401) cached=null; const e=new Error(`Keycloak operation failed (${r.status})`);e.status=r.status;throw e; }
    if(r.status===204)return null;
    if(r.status===201)return {id:r.headers.get('location')?.split('/').pop()};
    return r.json();
  }
  return {
    async joinUser({requestId,username,name,email,role,password}) {
      const profile=await call('/users/profile'),events=await call('/events/config');
      const attribute=profile.attributes?.find(a=>a.name==='nhip.join.request');
      if(!attribute||attribute.permissions?.edit?.length!==1||attribute.permissions.edit[0]!=='admin'||events.adminEventsDetailsEnabled)throw Error('Apply the week-7 protected metadata and audit policy before Join');
      const matches=await call('/users?exact=true&username='+encodeURIComponent(username));
      let user=matches[0];
      if(user&&(user.federationLink||user.attributes?.['nhip.join.request']?.[0]!==requestId))throw Error('Join username belongs to an unrelated identity');
      if(!user){
        if(typeof password!=='string'||password.length<12)throw Error('A temporary password is required for the first Join attempt');
        const created=await call('/users','POST',{username,...names(name),email,enabled:false,
          attributes:{'nhip.join.request':[requestId],'nhip.mfa.required':['true']},
          requiredActions:['UPDATE_PASSWORD','CONFIGURE_TOTP'],credentials:[{type:'password',value:password,temporary:true}]});
        if(!created.id)throw Error('Join response has no subject');
        user={id:created.id};
      }
      // Creation stays disabled until the durable workflow has a matching app profile.
      await this.updateUser(user.id,{name,email,role});
      await this.remediate(user.id,'require-mfa');
      return {id:user.id};
    },
    async userByUsername(username) {
      const users=await call('/users?exact=true&username='+encodeURIComponent(username));
      if(users.length!==1)throw Error('Expected exactly one matching identity');
      return {id:users[0].id,providerId:users[0].federationLink || null};
    },
    async requireDirectoryEnrollment(id){
      const p='/users/'+encodeURIComponent(id),user=await call(p);
      if(!user.federationLink)throw Error('Expected an LDAP identity');
      await call(p,'PUT',{...user,requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
    },
    async directoryProvider(id) {
      const component=await call('/components/'+encodeURIComponent(id));
      if(component.providerId!=='ldap')throw Error('Configured component is not LDAP');
      // Never return the component's bindCredential or arbitrary config to HTTP clients.
      const pick=key=>component.config?.[key]?.[0] || '';
      return {id:component.id,name:component.name,enabled:pick('enabled')==='true',editMode:pick('editMode'),
        usersDn:pick('usersDn'),connectionUrl:pick('connectionUrl'),cachePolicy:pick('cachePolicy'),
        lastSync:pick('lastSync') || null};
    },
    async syncDirectory(id,mode='full') {
      const action=mode==='changed'?'triggerChangedUsersSync':'triggerFullSync';
      return call('/user-storage/'+encodeURIComponent(id)+'/sync?action='+action,'POST',undefined,60000);
    },
    async directoryUsers(providerId) {
      const users=[];
      for(let first=0;first<10000;first+=100) {
        const page=await call('/users?first='+first+'&max=100&briefRepresentation=false');
        users.push(...page.filter(u=>u.federationLink===providerId).map(u=>({id:u.id})));
        if(page.length<100)return {users,complete:true};
      }
      return {users,complete:false};
    },
    async directoryUser(id,paths=[]) {
      const p='/users/'+encodeURIComponent(id),user=await call(p);
      const [memberships,direct]=await Promise.all([call(p+'/groups?max=100&briefRepresentation=false'),call(p+'/role-mappings/realm')]);
      if(memberships.length>=100)throw Error('Directory membership scan is incomplete');
      const groups=[];
      for(const group of memberships.filter(g=>paths.includes(g.path))) {
        const roles=await call('/groups/'+encodeURIComponent(group.id)+'/role-mappings/realm/composite');
        groups.push({path:group.path,roles:roles.map(r=>r.name)});
      }
      const attr=name=>user.attributes?.[name]?.[0] || '';
      return {id:user.id,username:user.username,name:[user.lastName,user.firstName].filter(Boolean).join(' '),email:user.email || '',
        providerId:user.federationLink || null,enabled:user.enabled===true,team:attr('nhip.directory.team'),
        sourceStatus:attr('nhip.directory.status'),mfaRequired:attr('nhip.mfa.required')==='true',groups,
        directRoles:direct.map(r=>r.name).filter(r=>['admin','manager','employee','auditor'].includes(r))};
    },
    async createUser({username,name,email,role,password}) {
      const created=await call('/users','POST',{username,...names(name),email,enabled:true,attributes:{'nhip.mfa.required':['true']},requiredActions:['UPDATE_PASSWORD','CONFIGURE_TOTP'],credentials:[{type:'password',value:password,temporary:true}]});
      if(!created.id)throw new Error('Keycloak did not return user ID');
      try{const mapping=await call('/roles/'+encodeURIComponent(role));await call('/users/'+encodeURIComponent(created.id)+'/role-mappings/realm','POST',[mapping]);}
      catch(e){await call('/users/'+encodeURIComponent(created.id),'PUT',{enabled:false}).catch(()=>{});throw e;}
      return created;
    },
    async updateUser(id,{name,role,email}) {
      const p='/users/'+encodeURIComponent(id);
      const user=await call(p);
      if(user.federationLink)throw Error('Directory-managed identity is read-only');
      const assigned=await call(p+'/role-mappings/realm');
      const mapping=await call('/roles/'+encodeURIComponent(role));
      const removed=assigned.filter(r=>['employee','manager','auditor'].includes(r.name)&&r.name!==role);
      if(removed.length)await call(p+'/role-mappings/realm','DELETE',removed);
      if(!assigned.some(r=>r.name===role))await call(p+'/role-mappings/realm','POST',[mapping]);
      await call(p,'PUT',{...user,...names(name),...(email?{email}:{})});
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
      const [user,mappings,security]=await Promise.all([call(p),call(p+'/role-mappings/realm/composite'),this.userSecurity(id)]);
      let inherited=[];
      if(user.federationLink){const directory=await this.directoryUser(id,require('../directory/directory-config.json').mappings.map(m=>m.keycloakPath));inherited=directory.groups.flatMap(g=>g.roles);}
      return {id:user.id,username:user.username,name:[user.lastName,user.firstName].filter(Boolean).join(' '),email:user.email || '',enabled:user.enabled===true,
        roles:[...new Set([...mappings.map(r=>r.name),...inherited])].filter(r=>['employee','manager','auditor','admin'].includes(r)),identitySource:user.federationLink?'ldap':'local',security};
    },
    async recoverMfa(id) {
      const p='/users/'+encodeURIComponent(id),user=await call(p);
      // Require setup before removing the old factors; do not open a password-only interval.
      await call(p,'PUT',{...user,...(!user.federationLink?{attributes:{...user.attributes,'nhip.mfa.required':['true']}}:{}),requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
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
    async resetPassword(id,password) {const p='/users/'+encodeURIComponent(id);if((await call(p)).federationLink)throw Error('LDAP password must be changed at the directory');await call(p+'/reset-password','PUT',{type:'password',value:password,temporary:true});await call(p+'/logout','POST');},
    async sessionActive(id,sid) { return (await call(`/users/${encodeURIComponent(id)}/sessions`)).some(s=>s.id===sid); },
    async remediate(id, action) {
      const p = `/users/${encodeURIComponent(id)}`;
      if(action === 'revoke') return call(p+'/logout','POST');
      const user = await call(p);
      if(['disable','enable'].includes(action)) await call(p,'PUT',{...user,enabled:action === 'enable'});
      else if(action === 'require-mfa') await call(p,'PUT',{...user,attributes:{...user.attributes,'nhip.mfa.required':['true']},requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
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
    async adminEvents({max=200,first=0,dateFrom,dateTo,direction='asc'}={}) {
      const query=new URLSearchParams({max:String(max),first:String(first),direction});
      if(dateFrom!==undefined)query.set('dateFrom',String(dateFrom));
      if(dateTo!==undefined)query.set('dateTo',String(dateTo));
      return (await call('/admin-events?'+query)).map(e=>({id:e.id,time:e.time,operationType:e.operationType,resourceType:e.resourceType,resourcePath:e.resourcePath,error:e.error,userId:e.authDetails?.userId,clientId:e.authDetails?.clientId,ipAddress:e.authDetails?.ipAddress}));
    },
    async events({max=30,first=0,dateFrom,dateTo,direction='desc'}={}) {
      const query=new URLSearchParams({max:String(max),first:String(first),direction});
      if(dateFrom!==undefined)query.set('dateFrom',String(dateFrom));
      if(dateTo!==undefined)query.set('dateTo',String(dateTo));
      return (await call('/events?'+query)).map(e=>({id:e.id,time:e.time,type:e.type,clientId:e.clientId,userId:e.userId,error:e.error,ipAddress:e.ipAddress,username:e.details?.username,sessionId:e.sessionId}));
    },
  };
}
module.exports = { keycloakAdmin };
