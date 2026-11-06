import {renewAccessToken,publishSession,terminalCodes} from './session.mjs';
export const appUrl=()=>new URL(import.meta.env.BASE_URL,window.location.origin).href;

// Access tokens stay in keycloak-js memory. Never copy tokens between applications.
export function monitorSession({keycloak,apiUrl,onEnded,interval=15000}) {
  let stopped=false,inflight=false;
  async function check() {
    if(stopped || inflight || document.visibilityState==='hidden') return;
    inflight=true;
    try {
      await renewAccessToken(keycloak,30);
      const response=await fetch(apiUrl+'/api/profile',{headers:{Authorization:'Bearer '+keycloak.token},cache:'no-store',signal:AbortSignal.timeout(10000)});
      if(response.status===401 || response.status===403) {
        const body=await response.json();
        if(terminalCodes.has(body.code)) {
          stopped=true;keycloak.clearToken();publishSession({state:'ended',code:body.code,message:body.message});onEnded(body.message);
        }
      }
    } catch {
      if(!keycloak.authenticated && !stopped) {stopped=true;keycloak.clearToken();publishSession({state:'ended',code:'INVALID_TOKEN',message:'Phiên đăng nhập đã hết hạn.'});onEnded('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.');}
    } finally {inflight=false;}
  }
  const timer=setInterval(check,interval);
  window.addEventListener('focus',check);
  document.addEventListener('visibilitychange',check);
  return ()=>{stopped=true;clearInterval(timer);window.removeEventListener('focus',check);document.removeEventListener('visibilitychange',check);};
}
