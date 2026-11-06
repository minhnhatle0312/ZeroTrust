// HTTPS entry point for the private lab. Only the certificate and built apps are static.
const https=require('node:https');
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {secureHeaders,proxyHeaders,requestPath,HOP_HEADERS}=require('./security');
const root=path.resolve(__dirname,'..');
const configFile=process.env.IAM_GATEWAY_CONFIG || path.join(__dirname,'.local/config.json');
const config=JSON.parse(fs.readFileSync(configFile,'utf8'));
const canonical=new URL(config.publicUrl);
if(canonical.protocol!=='https:'||canonical.pathname!=='/'||canonical.username||canonical.password)throw Error('Gateway requires a canonical HTTPS origin.');
const tlsDirectory=path.resolve(root,config.tlsDirectory || 'network/.local');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.ico':'image/x-icon','.woff2':'font/woff2','.crt':'application/x-x509-ca-cert'};
function reply(res,status,body,type='text/plain; charset=utf-8'){res.writeHead(status,{'Content-Type':type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(body);}
function proxy(req,res,port){
  const headers=proxyHeaders(req,canonical);
  const upstream=http.request({host:'127.0.0.1',port,path:req.url,method:req.method,headers,timeout:15000},incoming=>{
    const safeHeaders={...incoming.headers};for(const name of HOP_HEADERS)delete safeHeaders[name];
    for(const name of String(incoming.headers.connection || '').split(','))delete safeHeaders[name.trim().toLowerCase()];
    res.writeHead(incoming.statusCode,safeHeaders);incoming.pipe(res);
  });
  upstream.on('timeout',()=>upstream.destroy());
  upstream.on('error',()=>{if(!res.headersSent)reply(res,503,'Dịch vụ đang khởi động hoặc tạm thời không sẵn sàng.');else res.destroy();});
  req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
}
function staticApp(req,res,prefix,directory){
  if(!['GET','HEAD'].includes(req.method))return reply(res,405,'Method not allowed');
  let relative;try{relative=decodeURIComponent(new URL(req.url,config.publicUrl).pathname).slice(prefix.length);}catch{return reply(res,400,'Invalid path');}
  const base=path.resolve(root,config.appDirectories?.[directory] || path.join(directory,'dist'));
  let file=path.resolve(base,relative || 'index.html');
  if(!file.startsWith(base+path.sep))return reply(res,403,'Forbidden');
  if(!fs.existsSync(file)){
    if(path.extname(relative))return reply(res,404,'Not found');
    file=path.join(base,'index.html');
  }
  try{
    if(!fs.statSync(file).isFile())return reply(res,404,'Not found');
    if(!fs.realpathSync(file).startsWith(fs.realpathSync(base)+path.sep))return reply(res,403,'Forbidden');
  }catch{return reply(res,503,'Application assets are not ready.');}
  res.writeHead(200,{'Content-Type':types[path.extname(file)] || 'application/octet-stream','Cache-Control':path.basename(file)==='index.html'?'no-store':'public, max-age=3600','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; frame-src 'self'; frame-ancestors 'none'; base-uri 'self'; object-src 'none'"});
  if(req.method==='HEAD')return res.end();const stream=fs.createReadStream(file);stream.on('error',()=>res.destroy());stream.pipe(res);
}
const server=https.createServer({key:fs.readFileSync(path.join(tlsDirectory,'server.key')),cert:fs.readFileSync(path.join(tlsDirectory,'server.crt')),minVersion:'TLSv1.2',maxHeaderSize:16384},(req,res)=>{
  secureHeaders(res);
  if(req.headers.host!==canonical.host)return reply(res,421,'Use the configured LAN/VPN hostname.');
  const pathname=requestPath(req.url);
  if(pathname===null)return reply(res,400,'Invalid path');
  if(pathname.startsWith('/api/') || pathname==='/health' || pathname==='/ready')return proxy(req,res,config.backendPort || 3001);
  if(pathname.startsWith('/realms/'+encodeURIComponent(config.realm || 'company-iam')+'/') || pathname.startsWith('/resources/'))return proxy(req,res,config.keycloakPort || 8080);
  if(pathname==='/a' || pathname==='/b'){res.writeHead(302,{Location:pathname+'/'});return res.end();}
  if(pathname.startsWith('/a/'))return staticApp(req,res,'/a/','web-a');
  if(pathname.startsWith('/b/'))return staticApp(req,res,'/b/','web-b');
  if(pathname==='/certificate.crt')return reply(res,200,fs.readFileSync(path.join(tlsDirectory,'ca.crt')),types['.crt']);
  const publicAssets={'/portal.css':'text/css; charset=utf-8','/portal.js':'text/javascript; charset=utf-8'};
  if(Object.hasOwn(publicAssets,pathname))return reply(res,200,fs.readFileSync(path.join(__dirname,'public',pathname.slice(1))),publicAssets[pathname]);
  if(pathname!=='/')return reply(res,404,'Not found');
  reply(res,200,fs.readFileSync(path.join(__dirname,'public/index.html')),'text/html; charset=utf-8');
});
server.headersTimeout=15000;
server.requestTimeout=30000;
server.keepAliveTimeout=5000;
server.on('error',e=>{console.error('HTTPS gateway failed:',e.code);process.exitCode=1;});
server.listen(config.port,config.host,()=>console.log('Private network entry:',config.publicUrl));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>process.exit(0)));
