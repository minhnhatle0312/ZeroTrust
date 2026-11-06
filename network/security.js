const HOP_HEADERS=new Set(['connection','keep-alive','proxy-authenticate','proxy-authorization','proxy-connection','te','trailer','transfer-encoding','upgrade']);

function secureHeaders(res) {
  res.setHeader('X-Content-Type-Options','nosniff');
  res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Strict-Transport-Security','max-age=86400');
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
}

function proxyHeaders(req,canonical) {
  const blocked=new Set(HOP_HEADERS);
  for(const name of String(req.headers.connection || '').split(','))blocked.add(name.trim().toLowerCase());
  const headers={};
  for(const [key,value] of Object.entries(req.headers)) {
    if(blocked.has(key)||key==='forwarded'||key==='x-real-ip'||key.startsWith('x-forwarded-'))continue;
    headers[key]=value;
  }
  headers.host=canonical.host;
  headers['x-forwarded-host']=canonical.host;
  headers['x-forwarded-proto']='https';
  headers['x-forwarded-port']=canonical.port || '443';
  headers['x-forwarded-for']=req.socket.remoteAddress;
  return headers;
}

function requestPath(raw) {
  if(typeof raw!=='string'||!raw.startsWith('/')||raw.startsWith('//'))return null;
  let pathname=raw.split('?')[0];
  try{
    for(let i=0;i<3;i++) {
      if(/[\\\x00-\x1f\x7f]/.test(pathname)||pathname.split('/').some(p=>p==='.'||p==='..'))return null;
      const decoded=decodeURIComponent(pathname);
      if(decoded===pathname)return pathname;
      pathname=decoded;
    }
  }catch{return null;}
  return null;
}
module.exports={secureHeaders,proxyHeaders,requestPath,HOP_HEADERS};
