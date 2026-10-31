function keycloakAdmin({ issuer, clientId, clientSecret }) {
  const url = new URL(issuer), realm = url.pathname.split('/').pop();
  let cached;
  async function token() {
    if (!clientSecret) throw new Error('Missing Keycloak service credential');
    if (cached && cached.until > Date.now()) return cached.token;
    const r = await fetch(`${issuer}/protocol/openid-connect/token`, { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:new URLSearchParams({grant_type:'client_credentials',client_id:clientId,client_secret:clientSecret}), signal:AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error('Keycloak service authentication failed');
    const b = await r.json(); cached = { token:b.access_token, until:Date.now()+Math.max(0,b.expires_in-20)*1000 }; return cached.token;
  }
  async function call(p, method='GET', body) {
    const r = await fetch(`${url.origin}/admin/realms/${encodeURIComponent(realm)}${p}`, { method, headers:{Authorization:`Bearer ${await token()}`,'Content-Type':'application/json'}, body:body === undefined ? undefined : JSON.stringify(body), signal:AbortSignal.timeout(8000) });
    if (!r.ok) { if(r.status === 401) cached=null; throw new Error(`Keycloak operation failed (${r.status})`); }
    return r.status === 204 ? null : r.json();
  }
  return {
    async remediate(id, action) {
      const p = `/users/${encodeURIComponent(id)}`;
      if(action === 'revoke') return call(p+'/logout','POST');
      const user = await call(p);
      if(['disable','enable'].includes(action)) await call(p,'PUT',{enabled:action === 'enable'});
      else if(action === 'require-mfa') await call(p,'PUT',{requiredActions:[...new Set([...(user.requiredActions || []),'CONFIGURE_TOTP'])]});
      else throw new Error('Unsupported action');
      if(action !== 'enable') await call(p+'/logout','POST');
    },
    async policy() { const c = await call(''); return {bruteForceProtected:c.bruteForceProtected,accessTokenLifespan:c.accessTokenLifespan,eventsEnabled:c.eventsEnabled,passwordPolicy:c.passwordPolicy,registrationAllowed:c.registrationAllowed,sslRequired:c.sslRequired}; },
    async events() { return (await call('/events?max=30')).map(e=>({time:e.time,type:e.type,clientId:e.clientId,userId:e.userId,error:e.error})); },
  };
}
module.exports = { keycloakAdmin };
