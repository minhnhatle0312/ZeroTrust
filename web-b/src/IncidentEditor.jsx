import React,{useEffect,useRef,useState} from 'react';
import {Dialog,Badge} from '../../shared/ui.jsx';
import {states,confidence,stamp,incidentPath,errorText} from './security-data.mjs';
import {modes,draftFor,buildInvestigation,refList} from './incident-editor.mjs';

export function IncidentEditor({api,origin,detail,onClose,onSaved}){
  const [mode,setMode]=useState('assessment'),[draft,setDraft]=useState(()=>draftFor(detail)),[snapshot,setSnapshot]=useState(detail);
  const [busy,setBusy]=useState(false),[confirm,setConfirm]=useState(null),[error,setError]=useState(''),[locked,setLocked]=useState(false),[blocked,setBlocked]=useState(false),[message,setMessage]=useState(''),[compare,setCompare]=useState(false);
  const [actions,setActions]=useState(null),[actionPage,setActionPage]=useState(1),[actionBusy,setActionBusy]=useState(false),[actionError,setActionError]=useState('');
  const [reviewed,setReviewed]=useState(false);
  const live=useRef(true),sending=useRef(false),form=useRef(null),errorRef=useRef(null),confirmationRef=useRef(null);
  useEffect(()=>{live.current=true;return()=>{live.current=false;};},[]);
  useEffect(()=>{if(error)errorRef.current?.focus();},[error]);
  useEffect(()=>{if(confirm){confirmationRef.current?.focus();confirmationRef.current?.scrollIntoView({block:'nearest'});}},[confirm]);
  useEffect(()=>{
    const before=e=>{e.preventDefault();e.returnValue='';};
    if(draft.note||draft.text||draft.method||draft.actions||draft.extra||draft.selected.length)window.addEventListener('beforeunload',before);
    return()=>window.removeEventListener('beforeunload',before);
  },[draft]);
  function field(key,value){setDraft(d=>({...d,[key]:value}));setConfirm(null);setError('');setMessage('');}
  function close(){if(busy)return;if(draft.note||draft.text||draft.method||draft.actions||draft.extra||draft.selected.length){if(!window.confirm('Bỏ bản nháp điều tra chưa lưu?'))return;}onClose();}
  async function reload(){
    if(sending.current)return;setBusy(true);setError('');
    try{const data=await api(incidentPath(origin,detail.id)+'?historyLimit=25');if(!live.current)return;if(data.detail?.schemaVersion!==1||data.detail?.id!==detail.id||!Number.isSafeInteger(data.detail?.version))throw Error('Chưa đọc được hồ sơ hợp lệ để đối chiếu.');setSnapshot(data.detail);setLocked(false);setCompare(true);setReviewed(false);setConfirm(null);setMessage('Đã đọc phiên bản mới. Bản nháp được giữ nguyên; đối chiếu thay đổi trước khi gửi lại.');}
    catch(e){if(live.current)setError(errorText(e));}finally{if(live.current)setBusy(false);}
  }
  async function readActions(page=1){
    setActionBusy(true);setActionError('');try{const data=await api('/api/security/actions?'+new URLSearchParams({page:String(page),limit:'50'}));if(live.current){setActions(data);setActionPage(page);}}catch(e){if(live.current)setActionError(errorText(e));}finally{if(live.current)setActionBusy(false);}
  }
  function prepare(e){e.preventDefault();if(busy||locked||blocked||(compare&&!reviewed))return;setError('');try{const body=buildInvestigation(origin,snapshot,mode,draft);setConfirm(body);}catch(e){setError(e.message);}}
  async function submit(){
    if(sending.current||!confirm||locked||blocked||(compare&&!reviewed))return;sending.current=true;setBusy(true);setError('');setMessage('');
    try{
      const response=await api(incidentPath(origin,detail.id),origin==='sqlite'?'PATCH':'POST',confirm);
      if(!live.current)return;
      // Acknowledge only the mutation response. Read-back is separate and never retries a write.
      if(!Number.isSafeInteger(response.version)||response.version<=snapshot.version){setLocked(true);setConfirm(null);setError('Phản hồi cập nhật chưa xác nhận phiên bản. Không gửi lại; đọc hồ sơ và lịch sử để đối chiếu.');return;}
      setConfirm(null);onSaved(response);
    }catch(e){
      if(!live.current)return;setConfirm(null);setError(errorText(e));
      if(e.status===403)setBlocked(true);
      if(e.status===409||!e.status||e.status>=500){setLocked(true);setMessage(e.status===409?'Dữ liệu hoặc điều kiện xử lý đã thay đổi. Tải phiên bản mới, đối chiếu bản nháp và lịch sử trước khi gửi lại.':'Chưa xác định chắc chắn cập nhật đã được ghi hay chưa. Không gửi lại tự động; đọc phiên bản và lịch sử để đối chiếu.');}
    }finally{sending.current=false;if(live.current)setBusy(false);}
  }
  let problem='';try{buildInvestigation(origin,snapshot,mode,draft);}catch(e){problem=e.message;}
  const showEvidence=['assessment','recommendation','verification'].includes(mode);
  return <Dialog title="Cập nhật hồ sơ sự cố" description={snapshot.incidentRef+' · phiên bản '+snapshot.version} onClose={close} busy={busy} wide>
    <div className="incident-editor">
      <p className="ui-notice">Chỉ ghi hồ sơ và liên kết dữ liệu nguồn. Không thực thi khắc phục trên tài khoản, phiên hoặc hệ thống. Không nhập mật khẩu, OTP, token hoặc khóa.</p>
      {error&&<div className="ui-notice error" role="alert" tabIndex={-1} ref={errorRef}>{error}</div>}
      {message&&<p className="ui-notice warning" role="status">{message}</p>}
      {(locked||blocked||compare)&&<section className="incident-conflict"><h3>{blocked?'Backend từ chối quyền ghi':'Cần đối chiếu trước khi cập nhật tiếp'}</h3><p>Bản nháp vẫn được giữ. Phiên bản đang đối chiếu: {snapshot.version}.</p>{locked&&!blocked&&<button className="ui-button secondary" disabled={busy} onClick={reload}>Đọc phiên bản mới, giữ bản nháp</button>}<details><summary>Thông tin hồ sơ đang đối chiếu</summary><p>Trạng thái: {states[snapshot.state]||snapshot.state}. Người xử lý: {snapshot.handler?.name||snapshot.handler?.id||'Chưa ghi nhận'} · {stamp(snapshot.handler?.time)}</p>{(snapshot.history?.items||[]).slice(0,5).map(h=><p key={h.id}>{stamp(h.time)} · {h.actor_name||h.actor} · {h.note}</p>)}<p>Nhận định hiện tại: {snapshot.assessment?.text||'Chưa có'}</p><p>Đề xuất đã ghi: {snapshot.recommendations?.recorded?.length||0}</p></details></section>}
      {compare&&<label className="incident-checkbox"><input type="checkbox" checked={reviewed} onChange={e=>{setReviewed(e.target.checked);setConfirm(null);}} disabled={busy}/> Tôi đã đối chiếu phiên bản mới với bản nháp và lịch sử</label>}
      <form ref={form} onSubmit={prepare}>
        <fieldset disabled={busy||blocked}><legend>Nội dung cập nhật</legend>
          <label>Loại cập nhật<select aria-label="Loại cập nhật" value={mode} onChange={e=>{setMode(e.target.value);setConfirm(null);setError('');}}>{Object.entries(modes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
          <label>Ghi chú thay đổi<textarea aria-label="Ghi chú thay đổi" required minLength={10} maxLength={500} value={draft.note} onChange={e=>field('note',e.target.value)}/></label>
          {['assessment','recommendation'].includes(mode)&&<label>{mode==='assessment'?'Nội dung nhận định':'Nội dung đề xuất'}<textarea aria-label={mode==='assessment'?'Nội dung nhận định':'Nội dung đề xuất'} required minLength={10} maxLength={1000} value={draft.text} onChange={e=>field('text',e.target.value)}/></label>}
          {mode==='assessment'&&<label>Mức xác minh nguyên nhân<select aria-label="Mức xác minh nguyên nhân" value={draft.confidence} onChange={e=>field('confidence',e.target.value)}>{Object.entries(confidence).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>}
          {mode==='recommendation'&&<p className="security-note">API bổ sung đề xuất mới, giữ nguyên đề xuất và lịch sử cũ. Nếu sửa ý kiến trước đó, ghi rõ đề xuất được thay thế trong nội dung; không đánh dấu đã thực hiện.</p>}
          {mode==='actions'&&<><label>Mã hành động đã thực hiện<textarea aria-label="Mã hành động đã thực hiện" value={draft.actions} onChange={e=>field('actions',e.target.value)} placeholder={origin==='sqlite'?'action:<mã đã có>':'audit:<event_id thực thi đã có>'}/></label><p className="security-note">Mỗi dòng một mã. Người thực hiện, thời điểm, kết quả và phản hồi lấy từ bản ghi Backend; không có ô tự khai kết quả thành công. Backend xác minh mã và phạm vi đối tượng khi lưu.</p>
            {origin==='sqlite'&&<><button type="button" className="ui-button secondary" disabled={actionBusy} onClick={()=>readActions(1)}>{actionBusy?'Đang đọc nhật ký…':'Chọn từ nhật ký hành động'}</button>{actionError&&<p role="alert">{actionError}</p>}{actions&&<div className="incident-action-picker"><p>Chỉ hiển thị hành động đúng user ID của sự cố trong trang nguồn {actionPage}; không suy đoán theo tên hoặc IP.</p>{actions.items.filter(a=>snapshot.subject?.userId&&a.target_id===snapshot.subject.userId).map(a=><div key={a.id}><p><strong>{a.action}</strong> · {a.actor} · {stamp(a.time)} · {a.state} / {a.remote_state||'chưa xác nhận'}</p><p>{a.message||'Chưa ghi phản hồi'}</p><button type="button" className="ui-button secondary" onClick={()=>field('actions',[...new Set([...refList(draft.actions),'action:'+a.id])].join('\n'))}>Chọn action:{a.id}</button></div>)}<div className="incident-editor-buttons"><button type="button" className="ui-button secondary" disabled={actionBusy||actionPage<=1} onClick={()=>readActions(actionPage-1)}>Nhật ký trước</button><button type="button" className="ui-button secondary" disabled={actionBusy||actionPage>=actions.pages} onClick={()=>readActions(actionPage+1)}>Nhật ký sau</button></div></div>}</>}
            {origin==='audit'&&<p className="security-note">Dùng mã sự kiện thực thi trong Audit (REMEDIATION/ACCOUNT_CHANGE/SESSION_TERMINATED được API hỗ trợ), không dùng sự kiện đề xuất hoặc gán nhãn. Sau khi liên kết thành công, xem phản hồi nguồn trong phần Kết quả của hồ sơ.</p>}
          </>}
          {mode==='verification'&&<><label>Kết quả kiểm tra<select aria-label="Kết quả kiểm tra" value={draft.result} onChange={e=>field('result',e.target.value)}><option value="inconclusive">Chưa đủ kết luận</option><option value="failed">Không đạt</option><option value="passed">Đạt</option></select></label><label>Phương pháp kiểm tra<textarea aria-label="Phương pháp kiểm tra" required minLength={10} maxLength={1000} value={draft.method} onChange={e=>field('method',e.target.value)}/></label><label>Quyết định mong đợi<select aria-label="Quyết định mong đợi" value={draft.expectedDecision} onChange={e=>field('expectedDecision',e.target.value)}><option value="DENY">DENY — cần bị từ chối</option><option value="ALLOW">ALLOW — cần được cho phép</option></select></label><label className="incident-checkbox"><input type="checkbox" checked={draft.close} onChange={e=>field('close',e.target.checked)}/> Yêu cầu Backend đóng sự cố cùng lần xác minh này</label><p className="security-note">Cần bằng chứng kiểm tra độc lập sau sự kiện và sau hành động liên kết. Nhật ký thực thi không thay thế kết quả kiểm tra.</p></>}
          {mode==='state'&&<><label>Trạng thái mới<select aria-label="Trạng thái mới" value={draft.state} onChange={e=>field('state',e.target.value)}>{Object.entries(states).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label><p className="security-note">API hỗ trợ open, reviewing, resolved, false_positive. Đang xử lý / chờ xác minh tiếp tục được ghi nhận trong reviewing và hồ sơ kiểm chứng; không có trạng thái API riêng. Đóng hoặc xác nhận cảnh báo nhầm vẫn do Backend kiểm tra.</p></>}
          {showEvidence&&<fieldset className="incident-evidence-picker"><legend>Bằng chứng nguồn</legend>{snapshot.evidence?.items?.map(e=><label className="incident-checkbox" key={e.ref}><input type="checkbox" checked={draft.selected.includes(e.ref)} onChange={v=>field('selected',v.target.checked?[...draft.selected,e.ref]:draft.selected.filter(r=>r!==e.ref))}/><span><strong>{e.ref}</strong> · {e.type}<small>{stamp(e.occurredAt)} · {e.decision} · {e.relation==='direct'?'Nguồn phát hiện':'Điều tra bổ sung'}</small></span></label>)}{!snapshot.evidence?.items?.length&&<p>Chưa có bằng chứng liên kết.</p>}<label>Tham chiếu bằng chứng bổ sung<textarea aria-label="Tham chiếu bằng chứng bổ sung" value={draft.extra} onChange={e=>field('extra',e.target.value)} placeholder={origin==='sqlite'?'events:<id> hoặc identity_events:<id>, mỗi dòng một mã':'audit:<event_id>, mỗi dòng một mã'}/></label><p className="security-note">Mã bổ sung chưa được xác nhận chỉ là tham chiếu yêu cầu kiểm tra; Backend kiểm tra sự tồn tại, đúng danh tính và điều kiện thời gian khi lưu. Không tạo sự kiện mới.</p></fieldset>}
        </fieldset>
        {snapshot.verification&&['open','reviewing'].includes(snapshot.state)&&mode!=='verification'&&<p className="ui-notice warning">Theo API, cập nhật khi hồ sơ đang mở/điều tra có thể xóa kết quả kiểm chứng hiện tại khỏi bản hiện hành; lịch sử vẫn giữ. Cần kiểm chứng lại trước khi đóng.</p>}
        {problem&&<p className="security-note" role="status">{problem}</p>}
        <div className="incident-editor-buttons"><button className="ui-button secondary" type="button" onClick={close} disabled={busy}>Hủy cập nhật</button><button className="ui-button" disabled={busy||locked||blocked||(compare&&!reviewed)||!!problem}>Kiểm tra và xác nhận</button></div>
      </form>
      {confirm&&<section ref={confirmationRef} tabIndex={-1} className="incident-confirm" aria-label="Xác nhận cập nhật"><h3>Xác nhận ghi hồ sơ</h3><p>{modes[mode]} · phiên bản {confirm.version}. Người thực hiện và thời điểm do Backend xác định.</p><p>Ghi chú: {confirm.note}</p>{confirm.assessment&&<p>Nhận định: {confirm.assessment.text} · {confidence[confirm.assessment.confidence]}</p>}{confirm.recommendation&&<p>Đề xuất chưa thực hiện: {confirm.recommendation.text}</p>}{confirm.actionRefs&&<p>Liên kết hành động: {confirm.actionRefs.join(', ')}</p>}{confirm.verification&&<p>Kiểm chứng: {confirm.verification.result} · {confirm.verification.expectedDecision} · {confirm.verification.method}</p>}<p>Bằng chứng: {(confirm.assessment?.evidenceRefs||confirm.recommendation?.evidenceRefs||confirm.verification?.evidenceRefs||[]).join(', ')||'Không gửi bằng chứng trong cập nhật này'}</p>{(confirm.status||confirm.state)&&<p>Yêu cầu trạng thái: {states[confirm.status||confirm.state]}. Backend quyết định có đủ điều kiện hay không.</p>}<div className="incident-editor-buttons"><button type="button" className="ui-button secondary" disabled={busy} onClick={()=>setConfirm(null)}>Quay lại chỉnh sửa</button><button type="button" className="ui-button" disabled={busy||locked||blocked} onClick={submit}>{busy?'Đang ghi hồ sơ…':'Xác nhận lưu hồ sơ'}</button></div></section>}
    </div>
  </Dialog>;
}
