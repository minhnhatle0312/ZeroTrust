// Read-only presentation of the Phase 4 contract. Never infer facts from context.
export const CENTRAL='/api/security/central';
export const states={open:'Mới ghi nhận',reviewing:'Đang điều tra',resolved:'Đã xử lý (trạng thái)',false_positive:'Cảnh báo nhầm (trạng thái)'};
export const severities={low:'Thấp',medium:'Trung bình',high:'Cao',critical:'Nghiêm trọng'};
export const confidence={hypothesis:'Giả thuyết · chưa xác minh',supported:'Nhận định có bằng chứng',confirmed:'Kết luận do người điều tra xác nhận',refuted:'Nhận định đã bác bỏ'};
export const stamp=value=>value&&Number.isFinite(Date.parse(value))?new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'medium',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value)):'Chưa ghi nhận';
export function incidentPath(origin,id){return origin==='sqlite'?'/api/security/alerts/'+encodeURIComponent(id):CENTRAL+'/incidents/'+encodeURIComponent(id);}
export function incidentRoute(origin,id){return 'incident/'+origin+'/'+encodeURIComponent(id);}
export function readRoute(route){
  const match=/^incident\/(sqlite|audit)\/([^/]+)$/.exec(route);
  try{if(match){const id=decodeURIComponent(match[2]);if((match[1]==='audit'?/^[a-f0-9]{64}$/:/^[A-Za-z0-9-]{1,150}$/).test(id))return {origin:match[1],id};}}catch{}
  return null;
}
const returnKey='nhip-security-incident-route';
// Navigation only: persist validated resource IDs, never OAuth callback fragments.
export function rememberIncidentRoute(hash,storage){
  try{if(readRoute(String(hash).replace(/^#\/?/,'')))storage?.setItem(returnKey,hash);
    else if(!/[?&#](?:code|state|access_token|id_token)=/.test(hash||''))storage?.removeItem(returnKey);}catch{}
}
export function takeIncidentRoute(storage){
  try{const hash=storage?.getItem(returnKey);storage?.removeItem(returnKey);const route=String(hash||'').replace(/^#\/?/,'');return readRoute(route)?route:null;}catch{return null;}
}
export function listPath(origin,filter,page=1,size=10){
  const p=new URLSearchParams({limit:String(size)});
  if(origin==='sqlite'){p.set('page',String(page));if(filter.state)p.set('status',filter.state);if(filter.q?.trim())p.set('q',filter.q.trim());}
  else{p.set('offset',String((page-1)*size));p.set('state',filter.state||'all');if(filter.detector)p.set('detector',filter.detector);}
  for(const key of ['severity','source','timeField'])if(filter[key])p.set(key,filter[key]);
  for(const key of ['from','to'])if(filter[key])p.set(key,origin==='sqlite'?filter[key]:new Date(filter[key]+(key==='from'?'T00:00:00+07:00':'T23:59:59.999+07:00')).toISOString());
  return (origin==='sqlite'?'/api/security/alert-list':CENTRAL+'/incidents')+'?'+p;
}
export function timelineItems(detail,history=detail.history?.items||[]){
  const seen=new Set(),items=[...(detail.timeline?.items||[]),...history.map(h=>({kind:'investigation',time:h.time,version:h.version,actor:h.actor,state:h.state,note:h.note,historyId:h.id}))];
  return items.filter(e=>{const k=[e.kind,e.ref||'',e.version??'',e.actor||'',e.time,e.note||''].join('|');if(seen.has(k))return false;seen.add(k);return true;}).sort((a,b)=>(Date.parse(a.time)||0)-(Date.parse(b.time)||0));
}
export function errorText(error){return error?.status===403?'Bạn không đủ quyền xem dữ liệu này.':error?.status===404?'Không tìm thấy sự cố hoặc bằng chứng.':error?.status===401?'Phiên đăng nhập đã hết hạn. Hãy xác thực lại.':error?.message||'Chưa kết nối được dịch vụ. Vui lòng thử lại.';}
export function evidenceFor(detail,ref){return detail.evidence?.items?.find(e=>e.ref===ref)||null;}
// Lookup only explicit anchor event_id returned by the server. No hashes or IP guesses.
export async function findEventIncidents(api,eventId){
  const matches=[];let offset=0;
  for(let i=0;i<10;i++){
    const result=await api(CENTRAL+'/incidents?'+new URLSearchParams({state:'all',limit:'200',offset:String(offset)}));
    matches.push(...(result.rows||[]).filter(r=>r.event_id===eventId));offset+=(result.rows||[]).length;
    if(offset>=result.total)return {matches,complete:true};
    if(!result.rows?.length)return {matches,complete:false};
  }
  return {matches,complete:false};
}
