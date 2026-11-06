import {createApi} from '../../shared/api.mjs';
import React,{useEffect,useRef,useState} from 'react';
import keycloak from './keycloak.js';
import Icon from '../../web-a/src/icons.jsx';
import {appUrl} from '../../shared/sso.js';
import {Frame,useSection,Badge,FeatureGrid,StatCard,Empty} from '../../shared/ui.jsx';
import {AccountsPanel,AlertsPanel,EventsPanel,ActionsPanel,IdentityCard,AccountDialog,AlertDialog} from '../../shared/admin.jsx';
import {NotificationBell,RemoteExplorer,SecurityInsights,EmployeeDialog,PersonalProfile} from '../../shared/operations.jsx';
import {dateTime,statusLabels} from '../../shared/data.mjs';
import {SecurityAnalytics,AccessMatrix,ReconciliationPanel} from '../../shared/week5.jsx';

const API=import.meta.env.VITE_API_URL || 'http://localhost:3001';
const PORTAL=import.meta.env.VITE_PORTAL_URL || 'http://localhost:5173/';
const api=createApi(keycloak,{baseUrl:API});

export default function App({onDenied}){
  const [section,navigate]=useSection(),[profile,setProfile]=useState(null),[data,setData]=useState({alerts:[],events:[],actions:[],openCount:0}),[users,setUsers]=useState([]),[identity,setIdentity]=useState(null);
  const [loading,setLoading]=useState(true),[error,setError]=useState(''),[toast,setToast]=useState(null),[modal,setModal]=useState(null),[updated,setUpdated]=useState(null),[autoRefresh,setAutoRefresh]=useState(true),[authEnded,setAuthEnded]=useState(false);
  const sequence=useRef(0),isAdmin=profile?.role==='admin';
  async function load(quiet=false){
    const seq=++sequence.current;if(!quiet)setLoading(true);setError('');
    try{
      const me=await api('/api/profile');if(seq!==sequence.current)return;setProfile(me);
      const [security,connection,accounts]=await Promise.all([api('/api/security'),api('/api/security/keycloak').catch(()=>({connected:false})),me.role==='admin'?api('/api/admin/users'):Promise.resolve({users:[]})]);
      if(seq===sequence.current){setData(security);setIdentity(connection);setUsers(accounts.users);setUpdated(new Date());}
    }catch(e){if(seq===sequence.current){if(e.status===403&&e.code==='DASHBOARD_ACCESS_DENIED')onDenied(e.message);else {setError(e.message);if(['SESSION_REVOKED','INVALID_TOKEN','SSO_SESSION_ENDED','ACCOUNT_DISABLED'].includes(e.code))setAuthEnded(true);}}}
    finally{if(seq===sequence.current)setLoading(false);}
  }
  useEffect(()=>{load();return()=>{sequence.current++;};},[]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(null),8000);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{if(!autoRefresh)return;const timer=setInterval(()=>{if(document.visibilityState==='visible'&&!document.querySelector('dialog[open]'))load(true);},20000);return()=>clearInterval(timer);},[autoRefresh]);
  const items=[
    {id:'overview',label:'Tổng quan',icon:'grid',group:'Không gian quản trị',description:'Công việc ưu tiên và tình trạng hệ thống'},
    {id:'functions',label:'Tất cả chức năng',icon:'search',group:'Không gian quản trị',description:'Tìm nhanh công cụ bạn cần'},
    {id:'alerts',label:'Cảnh báo',icon:'alert',count:data.openCount,group:'Giám sát & xử lý',description:'Xem, điều tra và ghi kết luận cảnh báo',tone:'amber'},
    {id:'events',label:'Nhật ký truy cập',icon:'file',group:'Giám sát & xử lý',description:'Tra cứu, lọc và xuất nhật ký truy cập',tone:'blue'},
    ...(isAdmin?[{id:'accounts',label:'Tài khoản',icon:'users',group:'Giám sát & xử lý',description:'Tìm nhân viên và quản lý quyền truy cập',tone:'purple'}]:[]),
    {id:'logins',label:'Đăng nhập & xác thực',icon:'key',group:'Giám sát & xử lý',description:'Xem sự kiện đăng nhập, IP và nguyên nhân thất bại',tone:'blue'},
    {id:'matrix',label:'Ma trận quyền',icon:'shield',group:'Giám sát & xử lý',description:'Đối chiếu User, Role, tài nguyên và phạm vi dữ liệu',tone:'blue'},
    {id:'actions',label:'Lịch sử xử lý',icon:'refresh',group:'Giám sát & xử lý',description:'Theo dõi các thao tác và kết quả đồng bộ',tone:'mint'},
    {id:'profile',label:'Hồ sơ & phiên của tôi',icon:'clock',group:'Tài khoản cá nhân',description:'Xem hồ sơ và kết thúc từng phiên đăng nhập'},
  ];
  useEffect(()=>{if(profile&&!items.some(i=>i.id===section))navigate('overview');},[section,profile?.role]);
  const applications=[{label:'Nhịp Workspace',description:'Chấm công, bảng công và quản lý nhóm.',href:PORTAL,icon:'clock',badge:'Công việc hằng ngày',tone:'mint'},{label:'Nhịp Security',description:'Cảnh báo, nhật ký và quản trị truy cập.',href:appUrl(),icon:'shield',active:true,tone:'blue'}];
  function manage(user,action){setModal({type:'account',user,action});}
  async function saved(result){setModal(null);setToast({text:result.message || 'Đã lưu kết quả điều tra.',partial:result.status==='PARTIAL'});await load();}
  const pending=data.actions.filter(a=>a.state==='partial').length;
  function openNotification(section){if(['team','requests'].includes(section)){window.location.href=PORTAL+'#/'+section;return;}navigate(section==='alerts'?'alerts':section==='profile'?'profile':'overview');}
  const titles={logins:'Đăng nhập & xác thực',profile:'Hồ sơ & phiên của tôi',overview:'Trung tâm an ninh',functions:'Chọn chức năng',alerts:'Điều tra cảnh báo',events:'Nhật ký truy cập',accounts:'Tài khoản & truy cập',actions:'Lịch sử xử lý'};
  const subtitles={logins:'Đối chiếu đăng nhập thành công, thất bại, ứng dụng và địa chỉ IP từ Keycloak.',profile:'Kiểm tra danh tính, phát hiện và kết thúc phiên không còn sử dụng.',overview:'Nắm rõ điều cần làm và xử lý từng việc với đầy đủ ngữ cảnh.',functions:'Các công cụ quản trị và giám sát, sắp xếp theo công việc của bạn.',alerts:'Ưu tiên cảnh báo cần điều tra, ghi nhận kết luận và theo dõi xử lý.',events:'Tìm đúng hoạt động, đối chiếu kết quả và xuất dữ liệu cần thiết.',accounts:'Chọn nhân viên và quản lý quyền truy cập trong một luồng rõ ràng.',actions:'Xem thao tác đã thực hiện và tiếp tục các bước chưa đồng bộ.'};
  if(!updated)return <Frame app="Security" profile={profile} items={items} section={section} onNavigate={navigate} applications={applications} onRefresh={()=>load()} loading={loading} notifications={profile&&<NotificationBell api={api} onOpen={openNotification}/>} onLogout={()=>keycloak.logout({redirectUri:appUrl()})}><div className="ui-empty"><span><Icon name={error?'alert':'refresh'} size={28}/></span><h1>{error?'Chưa tải được trung tâm an ninh':'Đang tải trung tâm an ninh…'}</h1><p>{error || 'Đang xác nhận tài khoản và tải dữ liệu giám sát.'}</p>{error&&<button className="ui-button" onClick={()=>authEnded?keycloak.login():load()}>{authEnded?'Đăng nhập lại':'Thử lại'}</button>}</div></Frame>;
  return <Frame app="Security" profile={profile} items={items} section={section} onNavigate={navigate} applications={applications} onRefresh={()=>load()} loading={loading} notifications={profile&&<NotificationBell api={api} onOpen={openNotification}/>} onLogout={()=>keycloak.logout({redirectUri:appUrl()})}>
    {error&&<div className="ui-notice error" role="alert"><Icon name="alert" size={19}/><span>{error}</span><button onClick={()=>authEnded?keycloak.login():load()}>{authEnded?'Đăng nhập lại':'Thử lại'}</button></div>}
    {toast&&<div className={'ui-notice '+(toast.partial?'warning':'')} role="status"><Icon name={toast.partial?'alert':'check'} size={19}/><span>{toast.text}</span><button aria-label="Đóng thông báo" onClick={()=>setToast(null)}>Đóng</button></div>}
    <div className="ui-page-heading"><div><p className="ui-eyebrow">NHỊP SECURITY · {isAdmin?'KHÔNG GIAN QUẢN TRỊ':'KHÔNG GIAN KIỂM TOÁN'}</p><h1>{section==='matrix'?'Ma trận quyền truy cập':titles[section] || titles.overview}</h1><p>{section==='matrix'?'Đối chiếu tài khoản, vai trò và điều kiện truy cập tài nguyên.':subtitles[section]}</p></div><div className="ops-live-status"><label><input type="checkbox" checked={autoRefresh} onChange={e=>setAutoRefresh(e.target.checked)}/> Tự cập nhật 20 giây</label><div className="security-updated"><Icon name="refresh" size={15}/><span>Cập nhật gần nhất<strong>{updated?dateTime(updated):'Đang kết nối…'}</strong></span></div></div></div>
    {section==='overview'&&<>
      <section className="security-welcome"><div><Badge tone="green"><i className="status-dot"/>Danh tính đã xác thực</Badge><h2>{isAdmin?'Mọi việc cần làm.\nTrong một không gian.':'Quan sát rõ ràng.\nKiểm toán có căn cứ.'}</h2><p>{isAdmin?'Ưu tiên cảnh báo, kiểm tra tài khoản và theo dõi từng thao tác xử lý.':'Đối chiếu cảnh báo, truy vết hoạt động và theo dõi kết quả điều tra.'}</p><button className="ui-button" onClick={()=>navigate('alerts')}>Xem cảnh báo cần xử lý<Icon name="arrow" size={17}/></button></div><div className="security-welcome-art" aria-hidden="true"><div className="security-orbit"/><div className="security-orbit second"/><span><Icon name="shield" size={64}/></span><i className="security-art-tag"><Icon name="check" size={14}/>Truy cập được kiểm soát</i></div></section>
      <div className="ui-stats"><StatCard value={data.openCount} label="Cảnh báo đang mở" detail="Cần xem xét và điều tra" icon="alert" tone="amber" onClick={()=>navigate('alerts')}/><StatCard value={data.events.filter(e=>e.decision==='DENY').length} label="Yêu cầu bị từ chối" detail="Trong các sự kiện đã tải" icon="shield" tone="rose" onClick={()=>navigate('events')}/><StatCard value={isAdmin?users.length:data.events.length} label={isAdmin?'Tài khoản nhân viên':'Sự kiện gần đây'} detail={isAdmin?'Trong phạm vi quản trị':'Có thể tra cứu và đối chiếu'} icon={isAdmin?'users':'file'} tone="blue" onClick={()=>navigate(isAdmin?'accounts':'events')}/><StatCard value={pending} label="Chưa đồng bộ" detail="Thao tác cần kiểm tra lại" icon="refresh" tone="purple" onClick={()=>navigate('actions')}/></div>
      <div className="ui-section-title"><div><h2>Truy cập nhanh</h2><p>Đi thẳng đến công việc bạn cần xử lý.</p></div><button className="ui-link-button" onClick={()=>navigate('functions')}>Tất cả chức năng<Icon name="arrow" size={16}/></button></div><FeatureGrid items={items.filter(i=>['alerts','accounts','events'].includes(i.id))} onNavigate={navigate}/>
      <div className="security-overview-grid"><section className="ui-panel"><div className="ui-panel-heading"><div><h2>Cảnh báo gần đây</h2><p>Thông tin mới nhất để bắt đầu điều tra.</p></div><button className="ui-link-button" onClick={()=>navigate('alerts')}>Xem tất cả<Icon name="arrow" size={15}/></button></div>{data.alerts.length?<div className="security-alert-list">{data.alerts.slice(0,4).map(a=><button key={a.id} onClick={()=>setModal({type:'alert',alert:a})}><span className={'admin-alert-icon '+a.severity}><Icon name="alert" size={19}/></span><span><strong>{a.kind}</strong><small>{a.username} · {dateTime(a.updated_at)}</small></span><Badge tone={['resolved','false_positive'].includes(a.status)?'green':'amber'}>{statusLabels[a.status]}</Badge><Icon name="arrow" size={15}/></button>)}</div>:<Empty title="Chưa có cảnh báo"/>}</section><IdentityCard identity={identity}/></div>
    </>}
    {section==='functions'&&<><div className="security-function-note"><Icon name="shield" size={19}/><span>{isAdmin?'Bạn có quyền quản trị và xử lý trong phạm vi được cấp.':'Bạn có quyền xem và đối chiếu; cập nhật do quản trị viên thực hiện.'}</span></div><FeatureGrid items={items.filter(i=>!['overview','functions'].includes(i.id))} onNavigate={navigate}/><div className="ui-section-title"><h2>Không gian công việc</h2></div><FeatureGrid items={[{id:'portal',label:'Nhịp Workspace',description:'Quay lại chấm công và công việc cá nhân.',icon:'clock',href:PORTAL}]} onNavigate={navigate}/></>}
    {section==='overview'&&<><SecurityAnalytics api={api} revision={updated?.getTime()}/><SecurityInsights api={api} canManage={isAdmin} revision={updated?.getTime()} onChanged={()=>load()}/></>}
    {section==='matrix'&&<AccessMatrix api={api}/>}
    {section==='profile'&&<PersonalProfile api={api} profile={profile} onCurrentEnded={()=>keycloak.login()} onEnroll={()=>keycloak.login({action:'CONFIGURE_TOTP',redirectUri:appUrl()})}/>}
    {section==='logins'&&<><SecurityInsights api={api} canManage={isAdmin} revision={updated?.getTime()} onChanged={()=>load()}/><RemoteExplorer api={api} kind="logins" revision={updated?.getTime()}/></>}
    {section==='alerts'&&<RemoteExplorer api={api} kind="alerts" onInspect={alert=>setModal({type:'alert',alert})} canManage={isAdmin} revision={updated?.getTime()}/>}
    {section==='events'&&<RemoteExplorer api={api} kind="events" revision={updated?.getTime()}/>}
    {section==='accounts'&&isAdmin&&<><div className="security-account-summary"><Badge tone="green">{users.filter(u=>!u.disabled).length} đang hoạt động</Badge><Badge tone="rose">{users.filter(u=>u.disabled).length} đang khóa</Badge><span>Tài khoản quản trị được quản lý riêng tại Keycloak.</span></div><AccountsPanel users={users} onManage={manage} onDetails={user=>setModal({type:'employee',user})} onCreate={()=>setModal({type:'employee'})}/></>}
    {section==='actions'&&<ReconciliationPanel api={api} canManage={isAdmin} revision={updated?.getTime()} onChanged={()=>load()}/>}
    {modal?.type==='employee'&&<EmployeeDialog key={modal.user?.id || 'new'} user={modal.user} api={api} onClose={()=>setModal(null)} onSaved={saved} onReauth={()=>keycloak.login({prompt:'login',maxAge:0,redirectUri:appUrl()})}/>}
    {modal?.type==='account'&&<AccountDialog key={modal.user.id} user={modal.user} initialAction={modal.action} api={api} onClose={()=>setModal(null)} onSaved={saved}/>}
    {modal?.type==='alert'&&<AlertDialog key={modal.alert.id} alert={modal.alert} canManage={isAdmin} api={api} onClose={()=>setModal(null)} onSaved={saved} users={users} onManageUser={manage}/>}
  </Frame>;
}
