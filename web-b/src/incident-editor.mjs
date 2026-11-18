// Only Phase 4 investigation mutations. No identity/session/remediation endpoints.
export const modes={assessment:'Nhận định nguyên nhân',recommendation:'Bổ sung đề xuất',actions:'Liên kết hành động đã thực hiện',verification:'Xác minh kết quả',state:'Cập nhật trạng thái'};
export const refList=text=>[...new Set(String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean))];
export function draftFor(detail){return {note:'',text:'',confidence:'hypothesis',selected:[],extra:'',actions:'',result:'inconclusive',method:'',expectedDecision:'DENY',state:detail.state,close:false};}
const sensitive=/(?:Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN [^-]*PRIVATE KEY-----|(?:password|client_secret|refresh_token|access_token|otp_secret)\s*[:=])/i;
function textProblem(value,min,max){return typeof value!=='string'||value.trim().length<min||value.length>max||sensitive.test(value)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(value);}
export function buildInvestigation(origin,detail,mode,draft){
  if(!Number.isSafeInteger(detail.version)||detail.version<1)throw Error('Thiếu phiên bản hồ sơ. Hãy tải lại.');
  if(textProblem(draft.note,10,500))throw Error('Ghi chú cần 10–500 ký tự; không nhập mật khẩu, OTP, token hoặc khóa.');
  if(!Object.hasOwn(modes,mode))throw Error('Loại cập nhật không hợp lệ.');
  const evidenceRefs=[...new Set([...draft.selected,...refList(draft.extra)])];
  const pattern=origin==='sqlite'?/^(events|identity_events):[^\s]{1,240}$/:/^audit:[^\s]{1,240}$/;
  if(evidenceRefs.length>100||evidenceRefs.some(r=>!pattern.test(r)))throw Error('Tối đa 100 tham chiếu bằng chứng đúng kho, mỗi dòng một mã.');
  const body={version:detail.version,note:draft.note.trim()};
  if(mode==='assessment'){
    if(textProblem(draft.text,10,1000)||!['hypothesis','supported','confirmed','refuted'].includes(draft.confidence))throw Error('Nhận định cần 10–1000 ký tự và mức xác minh hợp lệ.');
    if(draft.confidence!=='hypothesis'&&!evidenceRefs.length)throw Error('Nhận định ngoài mức giả thuyết cần bằng chứng.');
    body.assessment={text:draft.text.trim(),confidence:draft.confidence,evidenceRefs};
  }
  if(mode==='recommendation'){
    if(textProblem(draft.text,10,1000)||!evidenceRefs.length)throw Error('Đề xuất cần 10–1000 ký tự và ít nhất một bằng chứng.');
    body.recommendation={text:draft.text.trim(),evidenceRefs};
  }
  if(mode==='actions'){
    const refs=refList(draft.actions),actionPattern=origin==='sqlite'?/^action:[A-Za-z0-9-]{1,150}$/:/^audit:[^\s]{1,240}$/;
    if(!refs.length||refs.length>100||refs.some(r=>!actionPattern.test(r)))throw Error('Cần 1–100 mã hành động đã tồn tại, đúng kho.');
    body.actionRefs=refs;
  }
  if(mode==='verification'){
    if(textProblem(draft.method,10,1000)||!evidenceRefs.length||!['passed','failed','inconclusive'].includes(draft.result)||!['ALLOW','DENY'].includes(draft.expectedDecision))throw Error('Cần phương pháp 10–1000 ký tự, kết quả, quyết định mong đợi và bằng chứng thực tế.');
    body.verification={method:draft.method.trim(),result:draft.result,expectedDecision:draft.expectedDecision,evidenceRefs};
    if(draft.close&&draft.result!=='passed')throw Error('Chỉ kết quả đạt mới được gửi yêu cầu đóng sự cố.');
  }
  const state=mode==='state'?draft.state:mode==='verification'&&draft.close?'resolved':undefined;
  if(state!==undefined){
    if(!['open','reviewing','resolved','false_positive'].includes(state))throw Error('Trạng thái không được API hỗ trợ.');
    if(state==='resolved'){
      if(!detail.evidence?.complete||detail.evidence?.missing?.length||!detail.evidence?.items?.some(e=>e.relation==='direct'))throw Error('Chưa thể đóng: bằng chứng nguồn thiếu hoặc chưa đầy đủ.');
      if(mode==='state'&&detail.verification?.result!=='passed')throw Error('Chưa thể đóng: cần ghi nhận kiểm chứng đạt với bằng chứng độc lập trước.');
    }
    body[origin==='sqlite'?'status':'state']=state;
  }
  if(new TextEncoder().encode(JSON.stringify(body)).length>16000)throw Error('Nội dung vượt giới hạn yêu cầu. Giảm số tham chiếu hoặc độ dài ghi chú.');
  return body;
}
