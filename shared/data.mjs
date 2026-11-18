export const normalizeText=value=>String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').replace(/Đ/g,'D').toLowerCase().trim();
export const matches=(query,...values)=>normalizeText(values.join(' ')).includes(normalizeText(query));

export function csvText(columns,rows){
  const cell=value=>{
    let text=String(value ?? '');
    if(/^[\s\u0000-\u001f]*[=+@-]/.test(text))text="'"+text;
    return '"'+text.replace(/"/g,'""')+'"';
  };
  return '\ufeff'+[columns.map(c=>cell(c.label)).join(','),...rows.map(row=>columns.map(c=>cell(c.value?c.value(row):row[c.key])).join(','))].join('\r\n');
}
export function downloadCsv(filename,columns,rows){
  const url=URL.createObjectURL(new Blob([csvText(columns,rows)],{type:'text/csv;charset=utf-8;'}));
  const link=document.createElement('a');link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
export const roleLabels={employee:'Nhân viên',manager:'Quản lý',admin:'Quản trị viên',auditor:'Kiểm toán viên'};
export const statusLabels={cancelled:'Đã rút đơn',pending:'Chờ duyệt',approved:'Đã duyệt',rejected:'Từ chối',open:'Mới phát hiện',reviewing:'Đang điều tra',resolved:'Đã xử lý',false_positive:'Đã xác minh hợp lệ',synced:'Đã đồng bộ',partial:'Chưa đồng bộ'};
export const dateTime=value=>value?new Date(value).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}):'—';
