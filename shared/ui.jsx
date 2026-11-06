import React,{useEffect,useId,useRef,useState} from 'react';
import Icon from '../web-a/src/icons.jsx';
import {matches,downloadCsv,roleLabels} from './data.mjs';
import './ui.css';

export function useSection(initial='overview'){
  const read=()=>window.location.hash.replace(/^#\/?/,'') || initial;
  const [section,setSection]=useState(read);
  useEffect(()=>{const change=()=>setSection(read());window.addEventListener('hashchange',change);return()=>window.removeEventListener('hashchange',change);},[]);
  function navigate(id){if(read()===id)setSection(id);else window.location.hash='/'+id;}
  return [section,navigate];
}
export function Dialog({title,description,children,onClose,busy=false,wide=false}){
  const ref=useRef(),id=useId();
  useEffect(()=>{const previous=document.activeElement;ref.current.showModal();return()=>{previous?.isConnected&&previous.focus();};},[]);
  return <dialog ref={ref} className={'ui-dialog'+(wide?' wide':'')} aria-labelledby={id} onCancel={e=>{e.preventDefault();if(!busy)onClose();}} onClick={e=>{if(e.target===ref.current&&!busy){const r=ref.current.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)onClose();}}}>
    <div className="ui-dialog-header"><div><h2 id={id}>{title}</h2>{description&&<p>{description}</p>}</div><button type="button" className="ui-icon-button" aria-label="Đóng" onClick={onClose} disabled={busy}><Icon name="close"/></button></div>{children}
  </dialog>;
}
export function Badge({children,tone=''}){return <span className={'ui-badge '+tone}>{children}</span>;}
export function Empty({title='Không có kết quả phù hợp',children,onReset}){
  return <div className="ui-empty"><span><Icon name="search" size={25}/></span><h3>{title}</h3><p>{children || 'Thử từ khóa khác hoặc điều chỉnh bộ lọc để xem dữ liệu.'}</p>{onReset&&<button className="ui-button secondary" onClick={onReset}>Xóa bộ lọc</button>}</div>;
}
export function Search({value,onChange,label='Tìm kiếm',placeholder='Tìm tên, tài khoản hoặc nội dung…'}){
  return <label className="ui-search"><Icon name="search" size={18}/><input type="search" aria-label={label} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)}/>{value&&<button type="button" aria-label="Xóa tìm kiếm" onClick={()=>onChange('')}><Icon name="close" size={15}/></button>}</label>;
}
export function ExportButton({filename='du-lieu.csv',columns,rows}){return <button className="ui-button secondary" disabled={!rows.length} onClick={()=>downloadCsv(filename,columns,rows)}><Icon name="download" size={17}/>Xuất CSV</button>;}
export function DataTable({rows,columns,empty='Chưa có dữ liệu',name='Danh sách',initialSize=10}){
  const [page,setPage]=useState(1),[size,setSize]=useState(initialSize),[sort,setSort]=useState(null);
  useEffect(()=>setPage(1),[rows.length,size]);
  let sorted=rows;
  if(sort){const column=columns.find(c=>c.key===sort.key);sorted=[...rows].sort((a,b)=>{const x=column.sortValue?column.sortValue(a):a[sort.key],y=column.sortValue?column.sortValue(b):b[sort.key];return(typeof x==='number'&&typeof y==='number'?x-y:String(x ?? '').localeCompare(String(y ?? ''),'vi',{numeric:true}))*(sort.desc?-1:1);});}
  const count=Math.max(1,Math.ceil(sorted.length/size)),current=Math.min(page,count),visible=sorted.slice((current-1)*size,current*size);
  return <>{!rows.length?<Empty title={empty}/>:<><div className="ui-table-scroll"><table className="ui-table" aria-label={name}><thead><tr>{columns.map(c=><th key={c.key} scope="col" aria-sort={sort?.key===c.key?(sort.desc?'descending':'ascending'):undefined}>{c.sortable?<button onClick={()=>{setSort({key:c.key,desc:sort?.key===c.key?!sort.desc:false});setPage(1);}}>{c.label}<span aria-hidden="true">{sort?.key===c.key?(sort.desc?'↓':'↑'):'↕'}</span></button>:c.label}</th>)}</tr></thead><tbody>{visible.map((row,i)=><tr key={row.id || i}>{columns.map(c=><td key={c.key}>{c.render?c.render(row):row[c.key]}</td>)}</tr>)}</tbody></table></div><div className="ui-pagination"><span>{(current-1)*size+1}–{Math.min(current*size,rows.length)} trong {rows.length} kết quả</span><div><label>Số dòng <select aria-label="Số dòng mỗi trang" value={size} onChange={e=>setSize(Number(e.target.value))}>{[10,20,50].map(n=><option key={n}>{n}</option>)}</select></label><button className="ui-icon-button" aria-label="Trang trước" disabled={current===1} onClick={()=>setPage(current-1)}><span aria-hidden="true">‹</span></button><strong>{current} / {count}</strong><button className="ui-icon-button" aria-label="Trang sau" disabled={current===count} onClick={()=>setPage(current+1)}><span aria-hidden="true">›</span></button></div></div></>}</>;
}
export function StatCard({label,value,detail,icon='grid',tone='mint',onClick}){
  const content=<><span className={'ui-stat-icon '+tone}><Icon name={icon} size={21}/></span><span className="ui-stat-text"><span>{label}</span><strong>{value ?? '—'}</strong>{detail&&<small>{detail}</small>}</span>{onClick&&<Icon name="arrow" size={17}/> }</>;
  return onClick?<button className="ui-stat" onClick={onClick}>{content}</button>:<article className="ui-stat">{content}</article>;
}
export function FeatureGrid({items,onNavigate}){
  return <div className="ui-feature-grid">{items.map(item=>{const content=<><span className={'ui-feature-icon '+(item.tone || 'mint')}><Icon name={item.icon || 'grid'} size={23}/></span><div><strong>{item.label}</strong><p>{item.description}</p></div><Icon name="arrow" size={18}/></>;return item.href?<a className="ui-feature" key={item.id} href={item.href}>{content}</a>:<button className="ui-feature" key={item.id} onClick={()=>onNavigate(item.id)}>{content}</button>;})}</div>;
}
export function Frame({app='Workspace',profile,items,section,onNavigate,applications,onRefresh,onLogout,loading,notifications,children}){
  const [dialog,setDialog]=useState(null),[search,setSearch]=useState('');
  const [session,setSession]=useState(null);
  useEffect(()=>{const receive=e=>setSession(e.detail);window.addEventListener('iam:session',receive);return()=>window.removeEventListener('iam:session',receive);},[]);
  useEffect(()=>{const listener=e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();if(document.querySelector('dialog[open]'))return;setSearch('');setDialog('search');}};window.addEventListener('keydown',listener);return()=>window.removeEventListener('keydown',listener);},[]);
  function navigate(id){onNavigate(id);setDialog(null);}
  const navigation=<nav aria-label={app==='Security'?'Điều hướng bảo mật':'Điều hướng'}>{items.map((item,i)=><React.Fragment key={item.id}>{item.group&&items[i-1]?.group!==item.group&&<p className="shell-nav-label">{item.group}</p>}<button className={section===item.id?'active':''} aria-label={item.label} aria-current={section===item.id?'page':undefined} onClick={()=>navigate(item.id)}><Icon name={item.icon || 'grid'} size={20}/><span>{item.label}</span>{item.count>0&&<b>{item.count}</b>}</button></React.Fragment>)}</nav>;
  const brand=<a className="shell-brand" href="#/overview" aria-label={'Nhịp '+app}><span><Icon name={app==='Security'?'shield':'clock'} size={25}/></span><strong>nhịp<small>{app}</small></strong><i/></a>;
  return <div className={'shell app-'+app.toLowerCase()}>
    <a className="skip-link" href="#main-content" onClick={e=>{e.preventDefault();document.getElementById('main-content')?.focus();}}>Đến nội dung chính</a>
    <aside className="shell-sidebar">{brand}<button className="shell-workspace" onClick={()=>setDialog('apps')} aria-label="Chuyển ứng dụng"><span className="shell-workspace-icon"><Icon name="grid" size={18}/></span><span><strong>{app==='Security'?'Quản trị & bảo mật':'Không gian làm việc'}</strong><small>Chuyển ứng dụng</small></span><span aria-hidden="true">⌄</span></button>{navigation}<div className="shell-sidebar-bottom"><div className="shell-protected"><Icon name="shield" size={17}/><span>Danh tính đã được xác thực</span></div><div className="shell-person"><span className="shell-avatar">{(profile?.name || 'N').slice(0,1)}</span><span><strong>{profile?.name || 'Đang kết nối…'}</strong><small>{roleLabels[profile?.role] || 'Xác thực tài khoản'}</small></span></div></div></aside>
    <div className="shell-body"><header className="shell-header"><button className="ui-icon-button shell-mobile-toggle" aria-label="Mở menu" onClick={()=>setDialog('navigation')}><Icon name="menu"/></button><div className="shell-breadcrumb"><span>{app==='Security'?'Nhịp Security':'Nhịp Workspace'}</span><span>/</span><strong>{items.find(x=>x.id===section)?.label || 'Tổng quan'}</strong></div><button className="shell-global-search" onClick={()=>{setSearch('');setDialog('search');}} aria-label="Tìm chức năng"><Icon name="search" size={17}/><span>Tìm chức năng…</span><kbd>Ctrl K</kbd></button><div className="shell-header-actions">{notifications}<button className="ui-icon-button" aria-label="Chọn ứng dụng" onClick={()=>setDialog('apps')}><Icon name="grid"/></button><button className="ui-icon-button" aria-label="Làm mới dữ liệu" disabled={loading} onClick={onRefresh}><Icon name="refresh"/></button><span className="shell-header-divider"/><button className="logout-button" aria-label="Đăng xuất" onClick={onLogout}><Icon name="logout" size={18}/><span>Đăng xuất</span></button><span className="shell-avatar small" title={profile?.name}>{(profile?.name || 'N').slice(0,1)}</span></div></header>
      {loading&&<div className="shell-progress loading-line" role="status" aria-label="Đang tải dữ liệu"/>}
      <main className="shell-content" id="main-content" tabIndex={-1}>{session?.state==='ended'?<section className="ui-empty" role="alert"><span><Icon name="key" size={28}/></span><h1>Phiên đăng nhập cần được xác nhận lại</h1><p>{session.message}</p>{session.requestId&&<small>Mã đối chiếu: {session.requestId}</small>}<button className="ui-button" onClick={onLogout}>Đăng nhập lại</button></section>:children}<footer className="shell-footer"><span><i/>Nhịp · Kết nối công việc, bảo vệ danh tính.</span><span>{app==='Security'?'TRUNG TÂM QUẢN TRỊ':'KHÔNG GIAN LÀM VIỆC'}</span></footer></main>
    </div>
    {dialog==='navigation'&&<Dialog title="Điều hướng" onClose={()=>setDialog(null)}><div className="shell-mobile-nav">{navigation}</div><button className="ui-button secondary" onClick={()=>setDialog('apps')}><Icon name="grid" size={18}/>Chọn ứng dụng</button></Dialog>}
    {dialog==='apps'&&<Dialog title="Chọn không gian của bạn" description="Chuyển ứng dụng bằng phiên đăng nhập hiện tại." wide onClose={()=>setDialog(null)}><div className="ui-app-grid">{applications.map(a=><a className={'ui-app-card '+(a.active?'selected':'')} href={a.href} key={a.label}><span className={'ui-feature-icon '+(a.tone || 'mint')}><Icon name={a.icon} size={25}/></span><Badge tone={a.active?'green':''}>{a.active?'Đang sử dụng':a.badge}</Badge><h3>{a.label}</h3><p>{a.description}</p><strong>Mở không gian <Icon name="arrow" size={18}/></strong></a>)}</div></Dialog>}
    {dialog==='search'&&<Dialog title="Bạn muốn làm gì?" description="Tìm nhanh chức năng theo quyền của bạn." onClose={()=>setDialog(null)}><Search label="Tìm chức năng trong hệ thống" value={search} onChange={setSearch} placeholder="Ví dụ: tài khoản, chấm công, cảnh báo…"/><div className="ui-command-list">{items.filter(i=>matches(search,i.label,i.description)).map(i=><button key={i.id} onClick={()=>navigate(i.id)}><Icon name={i.icon || 'grid'}/><span><strong>{i.label}</strong><small>{i.description || i.group}</small></span><Icon name="arrow" size={17}/></button>)}{!items.some(i=>matches(search,i.label,i.description))&&<Empty/>}</div></Dialog>}
  </div>;
}
