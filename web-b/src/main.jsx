import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.jsx';
import keycloak from './keycloak.js';
import {monitorSession,appUrl} from '../../shared/sso.js';
import './style.css';

const root=createRoot(document.getElementById('root'));
const portal=import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173';
function status(title,message,denied=false) {
  root.render(<main className="auth-page"><section className="auth-card"><div className="brand-mark">N</div><p className="eyebrow">NHỊP SECURITY</p><h1>{title}</h1><p>{message}</p><div className="auth-links"><a className="button" href={portal}>Về Web A</a><button className="button secondary" onClick={()=>denied?keycloak.logout({redirectUri:appUrl()}):keycloak.login({redirectUri:appUrl()})}>{denied?'Đăng xuất':'Đăng nhập lại'}</button></div></section></main>);
}
class Boundary extends React.Component {
  state={failed:false};
  static getDerivedStateFromError(){return {failed:true};}
  render(){return this.state.failed?<main className="auth-page"><section className="auth-card"><h1>Không thể hiển thị trang</h1><p>Vui lòng tải lại ứng dụng.</p><button className="button" onClick={()=>window.location.reload()}>Tải lại</button></section></main>:this.props.children;}
}
async function start(){
  status('Đang xác thực','Đang kết nối phiên đăng nhập Keycloak…');
  try {
    await keycloak.init({onLoad:'login-required',pkceMethod:'S256',checkLoginIframe:false});
    if(!['admin','auditor'].some(r=>keycloak.hasRealmRole(r))){status('Bạn chưa có quyền truy cập','Trung tâm an ninh dành cho quản trị viên và kiểm toán viên. Bạn vẫn có thể sử dụng Web A.',true);return;}
    root.render(<Boundary><App onDenied={message=>status('Bạn chưa có quyền truy cập',message,true)}/></Boundary>);
    monitorSession({keycloak,apiUrl:import.meta.env.VITE_API_URL || 'http://localhost:3001',onEnded:message=>status('Phiên đăng nhập đã kết thúc',message)});
  } catch {status('Chưa kết nối được Keycloak','Kiểm tra dịch vụ xác thực, kết nối mạng và địa chỉ ứng dụng rồi đăng nhập lại.');}
}
start();
