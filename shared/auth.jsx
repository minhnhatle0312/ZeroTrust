import React,{useEffect,useLayoutEffect,useRef,useState} from 'react';
import {createAuthController,identityProbe,rememberSection,takeSection} from './auth-controller.mjs';
import {createApi} from './api.mjs';
import {monitorSession} from './sso.js';
import './auth.css';

const TEXT={
  welcome:['Sẵn sàng cho một nhịp mới.','Đăng nhập để mở không gian làm việc của bạn.'],
  checking:['Đang kiểm tra phiên','Đang kết nối dịch vụ xác thực và kiểm tra quyền truy cập.'],
  authenticating:['Đang đến Keycloak','Bạn sẽ nhập mật khẩu và mã OTP trên trang xác thực của tổ chức.'],
  'signing-out':['Đang đăng xuất','Đang yêu cầu Keycloak kết thúc phiên đăng nhập chung.'],
  expired:['Phiên đăng nhập đã kết thúc','Đăng nhập lại để tiếp tục công việc.'],
  unavailable:['Kết nối đang gián đoạn','Chưa xác nhận được dịch vụ. Hãy kiểm tra mạng rồi thử lại.'],
  denied:['Bạn chưa có quyền truy cập','Tài khoản hiện chưa được phép mở không gian này.'],
  required:['Cần hoàn tất xác thực','Tiếp tục tại Keycloak để hoàn thành các bước bắt buộc.'],
  error:['Chưa thể hiển thị ứng dụng','Hãy tải lại trang để tiếp tục.'],
};

export function AuthScreen({app='A',state,onLogin,onRetry,onLogout,onReload,otherUrl}) {
  const security=app==='B',busy=['checking','authenticating','signing-out'].includes(state.status);
  const [title,description]=TEXT[state.status]||TEXT.unavailable;
  return <main className={'auth-layout '+(security?'auth-security':'auth-workspace')}>
    <section className="auth-story" aria-label={'Nhịp '+(security?'Security':'Workspace')}>
      <a className="auth-brand" href={new URL(import.meta.env.BASE_URL,window.location.origin).pathname}><span aria-hidden="true">n</span><strong>nhịp<small>{security?'SECURITY':'WORKSPACE'}</small></strong></a>
      <div className="auth-story-copy"><p className="auth-kicker">{security?'QUAN SÁT · XÁC MINH · BẢO VỆ':'KHÔNG GIAN LÀM VIỆC CỦA BẠN'}</p>
        <h1>{security?<>Hiểu từng tín hiệu.<br/>Bảo vệ mỗi kết nối.</>:<>Một nhịp làm việc.<br/>Kết nối mọi ngày.</>}</h1>
        <p>{security?'Theo dõi sự kiện, đối chiếu truy cập và điều tra cảnh báo trong một không gian an ninh.':'Chấm công, theo dõi đề nghị và quản lý công việc trong một không gian rõ ràng, liền mạch.'}</p>
        <div className="auth-illustration" aria-hidden="true"><div className="auth-orbit"/><div className="auth-orbit second"/><div className="auth-emblem">{security?'◇':'✳'}</div><span className="auth-art-note">{security?'Mỗi truy cập đều được xác minh':'Công việc rõ ràng. Kết nối an tâm.'}</span></div>
      </div><p className="auth-story-footer">Nhịp · Kết nối công việc, bảo vệ danh tính.</p>
    </section>
    <section className="auth-entry"><div className="auth-entry-card">
      <p className="auth-kicker">{security?'NHỊP SECURITY':'NHỊP WORKSPACE'}</p>
      <div className={'auth-state-icon '+(busy?'is-busy':'')} aria-hidden="true">{busy?'◌':state.status==='welcome'?'↗':state.status==='denied'?'!':state.status==='expired'?'◷':'◇'}</div>
      <div role={['denied','unavailable','error'].includes(state.status)?'alert':'status'} aria-live="polite"><h2>{title}</h2><p className="auth-description">{state.message||description}</p></div>
      <div className="auth-entry-actions" aria-busy={busy}>
        {['welcome','expired','required'].includes(state.status)&&<button className="auth-primary" onClick={onLogin}>{state.status==='welcome'?'Đăng nhập qua Keycloak':state.status==='required'?'Tiếp tục xác thực':'Đăng nhập lại'}<span aria-hidden="true">↗</span></button>}
        {busy&&<p className="auth-progress"><span/>Vui lòng chờ trong giây lát…</p>}
        {state.status==='unavailable'&&<button className="auth-primary" onClick={onRetry}>Kiểm tra kết nối lại<span aria-hidden="true">↻</span></button>}
        {state.status==='denied'&&<button className="auth-primary" onClick={onLogout}>Đăng xuất để đổi tài khoản</button>}
        {['unavailable','error'].includes(state.status)&&<button className="auth-secondary" onClick={onReload}>Tải lại trang</button>}
        {!busy&&otherUrl&&<a className="auth-other-app" href={otherUrl}>{security?'Về Nhịp Workspace':'Mở Nhịp Security'}<span aria-hidden="true">→</span></a>}
      </div>
      <div className="auth-trust-note"><span aria-hidden="true">◇</span><div><strong>Đăng nhập tập trung, truy cập theo quyền</strong><p>Mật khẩu và OTP được nhập tại Keycloak. Quyền truy cập được máy chủ xác nhận trước khi mở ứng dụng.</p></div></div>
      {security&&<p className="auth-role-note">Không gian dành cho quản trị viên và kiểm toán viên được cấp quyền.</p>}
    </div><footer className="auth-entry-footer">Cần hỗ trợ tài khoản? Liên hệ quản trị viên của bạn.</footer></section>
  </main>;
}

class AuthBoundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  // Do not log render exceptions: third-party errors may carry URL/credential data.
  render(){return this.state.failed?<AuthScreen app={this.props.app} state={{status:'error'}} onReload={()=>window.location.reload()} otherUrl={this.props.otherUrl}/>:this.props.children;}
}

export function AuthGate({keycloak,identityConfig,app,apiUrl,otherUrl,children}) {
  const [state,setState]=useState({status:'checking',authorized:false,message:''}),controller=useRef(null);
  const pausedDialogs=useRef([]);
  useLayoutEffect(()=>{
    if(state.authorized&&state.status!=='ready'){
      const opened=[...document.querySelectorAll('.auth-protected dialog[open]')];
      for(const dialog of opened)dialog.close();
      pausedDialogs.current.push(...opened);
    }else if(state.status==='ready'){
      for(const dialog of pausedDialogs.current)if(dialog.isConnected&&!dialog.open)dialog.showModal();
      pausedDialogs.current=[];
    }else if(!state.authorized)pausedDialogs.current=[];
  },[state.status,state.authorized]);
  useEffect(()=>{
    const sectionKey='nhip-return-section-'+app;
    // Access to storage may be disabled by browser privacy settings.
    let storage;try{storage=window.sessionStorage;}catch{}
    rememberSection(storage,sectionKey,window.location.hash);
    const api=createApi(keycloak,{baseUrl:apiUrl});
    let checkIdentity;try{checkIdentity=identityProbe({...identityConfig,origin:window.location.origin});}
    catch{checkIdentity=async()=>{throw Error('Invalid identity configuration');};}
    const auth=createAuthController({keycloak,app,probe:()=>api('/api/profile'),checkIdentity,
      redirectUri:new URL(import.meta.env.BASE_URL,window.location.origin).href,
      notify:next=>{if(next.status==='ready'){const section=takeSection(storage,sectionKey);if(section)window.history.replaceState(null,'',new URL(import.meta.env.BASE_URL,window.location.origin).pathname+section);}setState(next);},reload:()=>window.location.reload()});
    controller.current=auth;
    const receive=e=>auth.session(e.detail);
    window.addEventListener('iam:session',receive);
    const offline=()=>auth.session({state:'unavailable'});
    window.addEventListener('offline',offline);
    auth.start();
    const stop=monitorSession({keycloak,apiUrl,onEnded:()=>{},canCheck:()=>auth.state.authorized});
    return()=>{stop();auth.dispose();window.removeEventListener('iam:session',receive);window.removeEventListener('offline',offline);};
  },[]);
  return <>{state.status!=='ready'&&<AuthScreen app={app} state={state} otherUrl={otherUrl}
    onLogin={()=>controller.current.login()} onRetry={()=>controller.current.retry()}
    onLogout={()=>controller.current.logout()} onReload={()=>window.location.reload()}/>}
    {state.authorized&&<div className="auth-protected" hidden={state.status!=='ready'} inert={state.status!=='ready'?true:undefined}><AuthBoundary app={app} otherUrl={otherUrl}>{React.cloneElement(children,{onSignOut:()=>controller.current.logout()})}</AuthBoundary></div>}</>;
}
