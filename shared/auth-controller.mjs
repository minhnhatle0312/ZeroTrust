// No credentials or token values enter view state, URLs generated here, or logs.
export const INIT_OPTIONS = Object.freeze({
  onLoad:'check-sso', flow:'standard', pkceMethod:'S256',
  checkLoginIframe:false, enableLogging:false,
});
const expired = new Set(['INVALID_TOKEN','SESSION_REVOKED','SSO_SESSION_ENDED','MISSING_TOKEN']);
const required = new Set(['MFA_SETUP_REQUIRED','REQUIRED_ACTION_PENDING']);
const denied = new Set(['DASHBOARD_ACCESS_DENIED','CLIENT_SCOPE_DENIED','INSUFFICIENT_ROLE','UNREGISTERED',
  'ACCOUNT_DISABLED','DIRECTORY_ACCESS_CHANGED','GOVERNANCE_HOLD']);

export function authFailure(error={}) {
  if (required.has(error.code)) return {status:'required',message:'Hãy hoàn tất bước xác thực bắt buộc tại Keycloak để tiếp tục.'};
  if (denied.has(error.code) || error.status===403) return {status:'denied',message:error.code==='ACCOUNT_DISABLED'
    ? 'Tài khoản đã bị khóa. Hãy liên hệ quản trị viên để được hỗ trợ.'
    : 'Tài khoản hiện chưa được phép truy cập không gian này. Hãy liên hệ quản trị viên nếu cần hỗ trợ.'};
  if (expired.has(error.code) || error.status===401) return {status:'expired',message:'Phiên đăng nhập đã kết thúc. Đăng nhập lại để tiếp tục.'};
  return {status:'unavailable',message:'Chưa xác nhận được kết nối với dịch vụ xác thực hoặc máy chủ. Hãy kiểm tra mạng rồi thử lại.'};
}

export async function withDeadline(task,milliseconds=20000) {
  let timer;
  try {
    return await Promise.race([Promise.resolve().then(task),new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(Object.assign(new Error('Authentication service timeout'),{code:'AUTH_TIMEOUT'})),milliseconds);
    })]);
  } finally {clearTimeout(timer);}
}

export function createAuthController({keycloak,probe,checkIdentity=async()=>{},app='A',redirectUri,notify=()=>{},reload=()=>{},timeout=20000}) {
  let state={status:'checking',authorized:false,message:''},initialized=false,started=false,disposed=false,version=0,logoutPending=false;
  function set(update) {if(!disposed){state={...state,...update};notify(state);}}
  function fail(error) {const failure=authFailure(error);set({...failure,authorized:failure.status==='unavailable'&&state.authorized});}
  async function signOut() {
    if(disposed||['authenticating','signing-out'].includes(state.status))return;
    version++;logoutPending=true;
    set({status:'signing-out',authorized:false,message:''});
    try {await withDeadline(async()=>{await checkIdentity();await keycloak.logout({redirectUri});},timeout);}
    catch {set({status:'unavailable',authorized:false,message:'Chưa xác nhận được đăng xuất tại Keycloak. Phiên SSO có thể vẫn còn; hãy thử lại.'});}
  }
  async function confirm() {
    const current=++version;
    set({status:'checking'});
    try {
      const profile=await withDeadline(probe,timeout);
      if(disposed||current!==version)return;
      if(!profile || !['employee','manager','admin','auditor'].includes(profile.role)) {
        fail({code:'UNREGISTERED'});return;
      }
      if(app==='B'&&!['admin','auditor'].includes(profile.role)){fail({code:'DASHBOARD_ACCESS_DENIED'});return;}
      set({status:'ready',authorized:true,message:''});
    } catch(error) {if(current===version&&!disposed)fail(error);}
  }
  return {
    get state(){return state;},
    async start() {
      if(started||disposed)return;
      started=true;
      const current=++version;
      set({status:'checking'});
      try {
        const authenticated=await withDeadline(async()=>{await checkIdentity();return keycloak.init({...INIT_OPTIONS});},timeout);
        if(disposed||current!==version)return;
        initialized=true;
        if(!authenticated){set({status:'welcome',authorized:false,message:''});return;}
        await confirm();
      } catch(error) {
        if(current!==version||disposed)return;
        // keycloak-js instances cannot be initialized twice after a failed init.
        set({status:error?.error==='access_denied'?'denied':'unavailable',authorized:false,
          message:error?.error==='access_denied'?'Yêu cầu đăng nhập chưa được chấp thuận.':'Chưa kết nối được dịch vụ xác thực. Hãy thử tải lại trang.'});
      }
    },
    async login() {
      if(disposed||['checking','authenticating','signing-out'].includes(state.status))return;
      if(!initialized){reload();return;}
      version++;
      set({status:'authenticating',message:''});
      try {await withDeadline(async()=>{await checkIdentity();await keycloak.login({redirectUri});},timeout);}
      catch {set({status:'unavailable',message:'Chưa chuyển được đến Keycloak. Hãy kiểm tra kết nối rồi thử lại.'});}
    },
    logout:signOut,
    async retry() {
      if(logoutPending){await signOut();return;}
      if(!initialized){reload();return;}
      if(!keycloak.authenticated){set({status:'welcome',authorized:false,message:''});return;}
      await confirm();
    },
    session(detail) {
      if(disposed)return;
      if(detail.state==='ended'||detail.state==='denied') {
        version++;fail({code:detail.code,status:detail.state==='denied'?403:401});
      } else if(detail.state==='unavailable'&&state.authorized) {
        // Preserve mounted application state while the connectivity screen hides it.
        set({status:'unavailable',message:'Kết nối bị gián đoạn. Các thao tác được tạm dừng cho đến khi xác nhận lại phiên.'});
      } else if(detail.state==='available'&&state.authorized&&state.status==='unavailable') {
        set({status:'ready',message:''});
      }
    },
    dispose(){disposed=true;version++;},
  };
}

// Store only a validated section name, never an OAuth callback or any token.
export function rememberSection(storage,key,hash) {
  if(/^#\/[a-z][a-z0-9-]*$/.test(hash||''))try{storage.setItem(key,hash);}catch{}
}
export function takeSection(storage,key) {
  try{const hash=storage.getItem(key);storage.removeItem(key);return /^#\/[a-z][a-z0-9-]*$/.test(hash||'')?hash:'';}catch{return '';}
}

export function identityProbe({url,realm,origin,fetcher=globalThis.fetch,timeout=10000}) {
  const endpoint=new URL(url,origin);
  if(endpoint.username||endpoint.password||endpoint.search||endpoint.hash)throw Error('Invalid identity URL');
  if(endpoint.protocol!=='https:'&&!(endpoint.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(endpoint.hostname)))throw Error('Identity endpoint requires HTTPS or loopback development');
  const expected=endpoint.href.replace(/\/$/,'')+'/realms/'+encodeURIComponent(realm);
  return async()=>{
    const response=await fetcher(expected+'/.well-known/openid-configuration',{
      credentials:'omit',cache:'no-store',redirect:'error',signal:AbortSignal.timeout(timeout),
    });
    if(!response.ok)throw Error('Identity discovery unavailable');
    const data=await response.json();
    if(data.issuer!==expected||!data.response_types_supported?.includes('code')||!data.code_challenge_methods_supported?.includes('S256')
      ||!data.id_token_signing_alg_values_supported?.includes('RS256'))throw Error('Identity metadata does not match expected configuration');
    for(const key of ['authorization_endpoint','token_endpoint','jwks_uri','end_session_endpoint']){
      const value=new URL(data[key]);
      if(value.origin!==endpoint.origin||value.username||value.password)throw Error('Unexpected identity endpoint');
    }
  };
}
