async function createVerifier({issuer, jwks, clients={'employee-portal':'employee-api','security-dashboard':'security-api'}}) {
  const {jwtVerify}=await import('jose');
  return async token=>{
    const {payload}=await jwtVerify(token,jwks,{issuer,audience:Object.values(clients),algorithms:['RS256'],requiredClaims:['sub','iat','exp','azp','sid']});
    const expected=Object.hasOwn(clients,payload.azp)?clients[payload.azp]:undefined;
    const audiences=Array.isArray(payload.aud)?payload.aud:[payload.aud];
    if(!expected || !audiences.includes(expected) || typeof payload.sid!=='string' || !payload.sid) throw new Error('Unexpected token client or audience');
    return payload;
  };
}

function sessionChecker(identity,{ttl=5000,now=Date.now}={}) {
  const cache=new Map();
  return async claims=>{
    const key=JSON.stringify([claims.sub,claims.sid]);
    const existing=cache.get(key);
    if(existing && existing.until>now()) return existing.value;
    if(cache.size>5000) for(const [k,v] of cache) if(v.until<=now()) cache.delete(k);
    const entry={until:now()+ttl,value:null};
    entry.value=Promise.resolve().then(()=>identity.sessionActive(claims.sub,claims.sid));
    cache.set(key,entry);
    try { return await entry.value; } catch(e) { if(cache.get(key)===entry)cache.delete(key);throw e; }
  };
}
// A separate cache is invalidated by account operations. Outages are never
// converted into a cached healthy account state.
function accountChecker(identity,{ttl=5000,now=Date.now}={}) {
  const cache=new Map();
  async function check(id) {
    const old=cache.get(id);
    if(old && old.until>now())return old.value;
    if(cache.size>5000)for(const [key,value] of cache)if(value.until<=now())cache.delete(key);
    const entry={until:now()+ttl,value:Promise.resolve().then(()=>identity.userSecurity(id))};
    cache.set(id,entry);
    try{return await entry.value;}catch(e){if(cache.get(id)===entry)cache.delete(id);throw e;}
  }
  check.invalidate=id=>cache.delete(id);
  return check;
}
module.exports={createVerifier,sessionChecker,accountChecker};
