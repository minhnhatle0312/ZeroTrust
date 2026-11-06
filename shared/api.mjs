import {renewAccessToken,publishSession,terminalCodes} from './session.mjs';

export function createApi(keycloak,{baseUrl='',retryDelay=1100}={}) {
  let renewing=null,terminal=null;
  async function renew(){
    if(!renewing)renewing=new Promise(resolve=>setTimeout(resolve,retryDelay)).then(()=>renewAccessToken(keycloak,-1)).finally(()=>{renewing=null;});
    return renewing;
  }
  return async function api(path,method='GET',body,retried=false){
    if(terminal)throw terminal;
    try{await renewAccessToken(keycloak,30);}catch{
      const e=new Error(keycloak.authenticated!==true?'Phiên đăng nhập đã kết thúc. Hãy đăng nhập lại.':'Chưa làm mới được phiên. Kiểm tra kết nối dịch vụ xác thực rồi thử lại.');
      e.code=keycloak.authenticated!==true?'INVALID_TOKEN':'IDENTITY_UNAVAILABLE';e.status=e.httpStatus=keycloak.authenticated!==true?401:503;
      if(terminalCodes.has(e.code)){terminal=e;publishSession({state:'ended',code:e.code,message:e.message});}
      throw e;
    }
    let response;
    try{response=await fetch(baseUrl+path,{method,headers:{Authorization:'Bearer '+keycloak.token,...(body!==undefined?{'Content-Type':'application/json'}:{})},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});}
    catch{throw new Error('Chưa kết nối được máy chủ. Kiểm tra mạng rồi thử lại.');}
    let data;try{data=await response.json();}catch{throw new Error('Máy chủ chưa trả dữ liệu hợp lệ. Vui lòng thử lại.');}
    // Token timestamps use whole seconds. A new login in the second of a
    // password/role change can hit the local revocation boundary. Renew reads
    // once after that boundary; mutations always require an explicit retry.
    if(response.status===401&&data.code==='SESSION_REVOKED'&&method==='GET'&&!retried){
      try{await renew();}catch{const e=new Error('Phiên đã kết thúc. Hãy đăng nhập lại để tiếp tục.');e.code='INVALID_TOKEN';e.status=e.httpStatus=401;terminal=e;publishSession({state:'ended',code:e.code,message:e.message});throw e;}
      return api(path,method,body,true);
    }
    if(!response.ok){
      const e=new Error(data.message || 'Không thể tải dữ liệu.');e.code=data.code;e.status=e.httpStatus=response.status;e.requestId=data.requestId;e.retryAfter=response.headers?.get?.('Retry-After') || null;
      if(terminalCodes.has(e.code)){terminal=e;publishSession({state:'ended',code:e.code,message:e.message,requestId:e.requestId});}
      throw e;
    }
    return data;
  };
}
