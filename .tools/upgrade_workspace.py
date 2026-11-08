from pathlib import Path

p=Path('web-a/src/App.jsx')
s=p.read_text(encoding='utf-8')
s=s.replace("import Icon from './icons';", """import Icon from './icons';
import AdminHome from './AdminHome';
import {Frame,useSection,FeatureGrid,Dialog,DataTable,Search,ExportButton} from '../../shared/ui.jsx';
import {AccountsPanel,AlertsPanel,EventsPanel,ActionsPanel,IdentityCard,AccountDialog,AlertDialog} from '../../shared/admin.jsx';
import {matches} from '../../shared/data.mjs';""")
start=s.index('function Modal(')
end=s.index('\nexport default function App()',start)
s=s[:start]+'''function Modal({title,children,onClose,busy=false}) { return <Dialog title={title} onClose={onClose} busy={busy}>{children}</Dialog>; }
function AttendanceTable({rows,team=false}) {
  const [query,setQuery]=useState('');
  const filtered=rows.filter(r=>matches(query,r.name,r.team,r.day,r.late_minutes?'Đi muộn':'Đúng giờ'));
  const columns=[...(team?[{key:'name',label:'Nhân viên',sortable:true,render:r=><><strong>{r.name}</strong><small>{r.team}</small></>}]:[]),{key:'day',label:'Ngày',sortable:true,render:r=>date(r.day+'T00:00:00+07:00')},{key:'check_in',label:'Giờ vào',sortable:true,render:r=>time(r.check_in)},{key:'check_out',label:'Giờ ra',sortable:true,render:r=>time(r.check_out)},{key:'duration',label:'Thời lượng',sortValue:hours,sortable:true,render:r=>r.check_out?hours(r).toFixed(1)+' giờ':'Đang ghi nhận'},{key:'late_minutes',label:'Trạng thái',sortable:true,render:r=><Badge tone={r.late_minutes?'amber':'green'}>{r.late_minutes?'Muộn '+r.late_minutes+' phút':'Đúng giờ'}</Badge>}];
  const csv=[...(team?[{key:'name',label:'Nhân viên'},{key:'team',label:'Nhóm'}]:[]),{key:'day',label:'Ngày'},{key:'check_in',label:'Giờ vào',value:r=>time(r.check_in)},{key:'check_out',label:'Giờ ra',value:r=>time(r.check_out)},{key:'duration',label:'Số giờ',value:r=>r.check_out?hours(r).toFixed(1):''},{key:'late_minutes',label:'Phút đi muộn'}];
  return <div className="workspace-attendance-table"><div className="ui-toolbar"><Search value={query} onChange={setQuery} label={team?'Tìm bảng công nhân viên':'Tìm bảng công'} placeholder={team?'Tìm nhân viên, nhóm hoặc ngày…':'Tìm ngày hoặc trạng thái…'}/><div className="ui-export"><ExportButton filename="bang-cong.csv" columns={csv} rows={filtered}/></div></div><DataTable rows={filtered} columns={columns} name={team?'Bảng công nhân viên':'Bảng công cá nhân'} empty="Chưa có bản ghi phù hợp"/></div>;
}
''' +s[end:]
s=s.replace("const [tab,setTab]=useState('overview'),", "const [tab,setTab]=useSection(),")
s=s.replace("const sequence=useRef(0);", """const sequence=useRef(0);
  const [requestQuery,setRequestQuery]=useState(''),[requestState,setRequestState]=useState('all'),[toastWarning,setToastWarning]=useState(false);""")
s=s.replace("function failure(e){setError(e.message);if(['SESSION_REVOKED','INVALID_TOKEN','ACCOUNT_DISABLED']", "function failure(e){setError(e.message);if(['SESSION_REVOKED','INVALID_TOKEN','ACCOUNT_DISABLED','SSO_SESSION_ENDED']")
s=s.replace("const seq=++sequence.current;setLoading(true);", "const seq=++sequence.current;setLoading(true);setError('');")
s=s.replace("if(tab==='team'&&['manager','admin'].includes(me.role))", "if((tab==='team'||(tab==='overview'&&me.role==='admin'))&&['manager','admin'].includes(me.role))")
s=s.replace("if(tab==='security'&&['admin','auditor'].includes(me.role))", "if((tab==='security'||(tab==='overview'&&me.role==='admin'))&&['admin','auditor'].includes(me.role))")
s=s.replace("if(tab==='users'&&me.role==='admin')", "if(['users','security','overview'].includes(tab)&&me.role==='admin')")
s=s.replace("setToast(r.message || 'Đã cập nhật.');", "setToast(r.message || 'Đã cập nhật.');setToastWarning(r.status==='PARTIAL');")
s=s.replace("const nav=(key)=>{setTab(key);setError('');setQuery('');};", """const nav=(key)=>{setTab(key);setError('');setQuery('');};
  const descriptions={overview:'Tổng hợp công việc và các mục cần xử lý',functions:'Tìm công cụ phù hợp với công việc của bạn',attendance:'Lọc, xem và xuất bảng công cá nhân',requests:'Gửi đề nghị và theo dõi kết quả điều chỉnh',team:'Xem nhóm, duyệt đơn và xuất bảng công',security:'Điều tra cảnh báo và đối chiếu nhật ký',users:'Tìm nhân viên và quản lý quyền truy cập'};
  const menu=[tabs[0],['functions','search','Tất cả chức năng'],...tabs.slice(1)].map(([id,icon,label])=>({id,icon,label,description:descriptions[id],group:['overview','functions'].includes(id)?'Không gian làm việc':['attendance','requests'].includes(id)?'Công việc cá nhân':'Quản lý & điều hành',count:id==='requests'?pending:0}));
  useEffect(()=>{if(profile&&!menu.some(item=>item.id===tab))nav('overview');},[tab,profile?.role]);
  const apps=[{label:'Nhịp Workspace',description:'Chấm công, bảng công và quản lý nhóm.',href:APP_URL,icon:'clock',active:true,tone:'mint'},...(canSecurity?[{label:'Nhịp Security',description:'Cảnh báo, nhật ký và quản trị truy cập.',href:SECURITY_URL,icon:'shield',badge:'Admin / Kiểm toán',tone:'blue'}]:[])];
  async function managementSaved(result){setModal(null);setToast(result.message || 'Đã lưu kết quả điều tra.');setToastWarning(result.status==='PARTIAL');await load();}
  const filteredRequests=requests.filter(r=>(requestState==='all'||r.status===requestState)&&matches(requestQuery,r.day,r.reason,r.review_note));""")
start=s.index('  return <div className="app-shell">')
end=s.index('    <div className="page-wrap">',start)
s=s[:start]+'''  return <Frame app="Workspace" profile={profile} items={menu} section={tab} onNavigate={nav} applications={apps} onRefresh={load} loading={loading} onLogout={()=>keycloak.logout({redirectUri:APP_URL})}>
''' +s[end:]
s=s.replace('<div className="notice success" role="status">','<div className={"notice "+(toastWarning?"warning":"success")} role="status">')
s=s.replace("<h1>{tab==='overview'?`Xin chào, ${display}.`:tabs.find(t=>t[0]===tab)?.[2]}</h1>","<h1>{tab==='overview'?(isAdmin?'Không gian quản trị':`Xin chào, ${display}.`):tab==='functions'?'Chọn chức năng':tabs.find(t=>t[0]===tab)?.[2]}</h1>")
s=s.replace("overview:'Sẵn sàng cho một ngày làm việc thật hiệu quả?',", "overview:isAdmin?'Sắp xếp công việc, theo dõi đội ngũ và xử lý từng việc rõ ràng.':'Sẵn sàng cho một ngày làm việc thật hiệu quả?',functions:'Các chức năng được sắp xếp theo quyền và công việc của bạn.',")
s=s.replace("{tab==='overview'&&<>", """{tab==='overview'&&isAdmin&&<AdminHome profile={profile} users={users} team={team} security={security} identity={kc} onNavigate={nav} onReview={request=>open({type:'review',request,decision:'approved'})} securityUrl={SECURITY_URL}/>}
      {tab==='functions'&&<><FeatureGrid items={menu.filter(i=>!['overview','functions'].includes(i.id))} onNavigate={nav}/>{canSecurity&&<><div className="ui-section-title"><h2>Không gian quản trị chuyên biệt</h2></div><FeatureGrid items={[{id:'security-app',label:'Nhịp Security',description:'Chuyển sang công cụ giám sát và quản trị chuyên biệt.',icon:'shield',href:SECURITY_URL,tone:'blue'}]} onNavigate={nav}/></>}</>}
      {tab==='overview'&&!isAdmin&&<>""")
s=s.replace('<Badge tone="amber">{pending} đang chờ</Badge></div>{!requests.length?', '<Badge tone="amber">{pending} đang chờ</Badge></div><div className="workspace-request-filters"><Search value={requestQuery} onChange={setRequestQuery} label="Tìm đơn điều chỉnh" placeholder="Tìm ngày, lý do hoặc phản hồi…"/><select aria-label="Lọc đơn điều chỉnh" value={requestState} onChange={e=>setRequestState(e.target.value)}><option value="all">Tất cả trạng thái</option><option value="pending">Chờ duyệt</option><option value="approved">Đã duyệt</option><option value="rejected">Từ chối</option></select></div>{!filteredRequests.length?')
s=s.replace('requests.map(r=><article className="request-item"','filteredRequests.map(r=><article className="request-item"')
start=s.index("      {tab==='security'&&<>")
end=s.index('      <footer className="footer">',start)
s=s[:start]+'''      {tab==='security'&&<div className="workspace-security"><div className="workspace-security-intro"><Icon name="shield" size={24}/><div><strong>Kiểm tra hoạt động và xử lý có căn cứ.</strong><p>Tra cứu cảnh báo, đối chiếu truy cập và theo dõi kết quả xử lý.</p></div><a className="ui-button secondary small" href={SECURITY_URL}>Mở Security<Icon name="arrow" size={16}/></a></div><AlertsPanel alerts={security.alerts} canManage={isAdmin} onInspect={alert=>setModal({type:'alert',alert})}/><EventsPanel events={security.events}/><ActionsPanel actions={security.actions} users={users} canManage={isAdmin} onRetry={(user,action)=>setModal({type:'user',user,action})}/><IdentityCard identity={kc}/></div>}
      {tab==='users'&&isAdmin&&<AccountsPanel users={users} onManage={user=>setModal({type:'user',user})}/>}
''' +s[end:]
start=s.index('      <footer className="footer">')
end=s.index('</footer>',start)+len('</footer>')
s=s[:start]+s[end:]
s=s.replace('    </div></main>','    </div>')
start=s.index('    {modal&&<Modal')
end=s.rindex('  </div>;')
s=s[:start]+'''    {modal&&['request','review'].includes(modal.type)&&<Modal title={modal.type==='request'?'Tạo đơn điều chỉnh':modal.decision==='approved'?'Duyệt đơn điều chỉnh':'Từ chối đơn'} busy={busy} onClose={()=>!busy&&setModal(null)}><form onSubmit={e=>{e.preventDefault();if(modal.type==='request')perform('/api/corrections','POST',{...form,reason:form.reason.trim()});else perform('/api/corrections/'+modal.request.id,'PATCH',{decision:modal.decision,note:note.trim()});}}>
      {modal.type==='request'?<><p className="form-intro">Quản lý sẽ xem xét đề nghị trước khi bảng công được cập nhật.</p><label>Ngày cần điều chỉnh<input type="date" required value={form.day} min={day(new Date(clock.getTime()-31*86400000))} max={day(clock)} onChange={e=>setForm({...form,day:e.target.value})} disabled={busy}/></label><div className="form-grid"><label>Giờ vào<input type="time" required value={form.checkIn} onChange={e=>setForm({...form,checkIn:e.target.value})} disabled={busy}/></label><label>Giờ ra<input type="time" required value={form.checkOut} onChange={e=>setForm({...form,checkOut:e.target.value})} disabled={busy}/></label></div>{form.checkOut<=form.checkIn&&<p className="form-error">Giờ ra phải sau giờ vào trong cùng ngày.</p>}<label>Lý do điều chỉnh<textarea required minLength={10} maxLength={500} value={form.reason} onChange={e=>setForm({...form,reason:e.target.value})} placeholder="Giải thích lý do cần điều chỉnh, tối thiểu 10 ký tự." disabled={busy}/></label><p className="ui-form-help">Có thể gửi đề nghị cho 31 ngày gần nhất. Thời gian chỉ thay đổi sau khi được duyệt.</p></>:<><div className="workspace-review-summary"><strong>{modal.request.name}</strong><span>{modal.request.team}</span><p>{date(modal.request.day+'T00:00:00+07:00')} · {time(modal.request.check_in)} — {time(modal.request.check_out)}</p><p>{modal.request.reason}</p></div><label>Ghi chú duyệt đơn<textarea aria-label="Ghi chú duyệt đơn" required minLength={5} maxLength={300} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ghi rõ căn cứ phê duyệt hoặc từ chối…" disabled={busy}/></label></>}
      {error&&<p className="form-error" role="alert">{error}</p>}<div className="ui-dialog-actions"><button type="button" className="ui-button secondary" disabled={busy} onClick={()=>setModal(null)}>Hủy</button><button className="ui-button" disabled={busy||(modal.type==='request'?(form.reason.trim().length<10||form.checkOut<=form.checkIn):note.trim().length<5)}>{busy?'Đang xử lý…':modal.type==='request'?'Gửi đề nghị':modal.decision==='approved'?'Duyệt & cập nhật':'Từ chối đơn'}</button></div></form></Modal>}
    {modal?.type==='user'&&isAdmin&&<AccountDialog key={modal.user.id} user={modal.user} initialAction={modal.action} api={api} onClose={()=>setModal(null)} onSaved={managementSaved}/>}
    {modal?.type==='alert'&&<AlertDialog key={modal.alert.id} alert={modal.alert} canManage={isAdmin} api={api} onClose={()=>setModal(null)} onSaved={managementSaved} users={users} onManageUser={user=>setModal({type:'user',user})}/>}
  </Frame>;
}
'''
p.write_text(s,encoding='utf-8')
print('Workspace interface upgraded.')
