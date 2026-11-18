// Display validation only. The API remains authoritative for time, ownership and permissions.
export const workspaceTimezone = 'Asia/Ho_Chi_Minh';
export const localDay = value => new Date(new Date(value).getTime()+7*3600000).toISOString().slice(0,10);
export const displayDay = value => new Date(value+'T00:00:00+07:00').toLocaleDateString('vi-VN',{timeZone:workspaceTimezone});
export const displayTime = value => value ? new Date(value).toLocaleTimeString('vi-VN',{timeZone:workspaceTimezone,hour:'2-digit',minute:'2-digit'}) : '—';
export const completedHours = row => row.check_out ? Math.max(0,(new Date(row.check_out)-new Date(row.check_in))/3600000) : 0;

export function correctionProblem(form,now=new Date()) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(form.day)||!Number.isFinite(Date.parse(form.day))||new Date(form.day).toISOString().slice(0,10)!==form.day)
    return 'Chọn ngày điều chỉnh hợp lệ.';
  if(form.day>localDay(now)||form.day<localDay(new Date(now.getTime()-31*86400000)))return 'Chỉ gửi đơn cho 31 ngày gần nhất, không chọn ngày tương lai.';
  if(![form.checkIn,form.checkOut].every(v=>/^([01]\d|2[0-3]):[0-5]\d$/.test(v))||form.checkOut<=form.checkIn)return 'Giờ ra phải sau giờ vào trong cùng ngày.';
  if(new Date(form.day+'T'+form.checkOut+':00+07:00')>now)return 'Giờ đề nghị không được ở tương lai.';
  if(form.reason.trim().length<10||form.reason.length>500)return 'Lý do cần từ 10 đến 500 ký tự, không chỉ có khoảng trắng.';
  return '';
}
