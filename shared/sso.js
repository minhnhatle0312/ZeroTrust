import {renewAccessToken,publishSession,terminalCodes} from './session.mjs';
export const appUrl=()=>new URL(import.meta.env.BASE_URL,window.location.origin).href;

// Access tokens stay in keycloak-js memory. Never copy tokens between applications.
export function monitorSession({keycloak,apiUrl,onEnded,canCheck=()=>true,interval=15000}) {
  let stopped=false,inflight=false;
  async function check() {
    if(stopped || inflight || !canCheck() || document.visibilityState==='hidden') return;
    inflight=true;
    try {
      await renewAccessToken(keycloak,30);
      const response=await fetch(apiUrl+'/api/profile',{headers:{Authorization:'Bearer '+keycloak.token},cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(response.status===401 || response.status===403) {
        const body=await response.json();
        if(terminalCodes.has(body.code)||response.status===401||response.status===403) {
          stopped=true;keycloak.clearToken();publishSession({state:response.status===401||terminalCodes.has(body.code)?'ended':'denied',code:body.code});onEnded?.('Phiên đăng nhập cần được xác nhận lại.');
        }
      } else if(response.ok)publishSession({state:'available'});
      else publishSession({state:'unavailable',code:'BACKEND_UNAVAILABLE'});
    } catch {
      if(!keycloak.authenticated && !stopped) {stopped=true;keycloak.clearToken();publishSession({state:'ended',code:'INVALID_TOKEN'});onEnded?.('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');}
      else if(!stopped)publishSession({state:'unavailable',code:'IDENTITY_UNAVAILABLE'});
    } finally {inflight=false;}
  }
  const timer=setInterval(check,interval);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',check);
  return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
}
