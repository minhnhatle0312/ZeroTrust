import {test} from 'node:test';
import assert from 'node:assert/strict';
import {matches,csvText} from '../shared/data.mjs';

test('Vietnamese search accepts accents, case and unaccented d',()=>{
  assert.equal(matches('dieu chinh','ĐƠN ĐIỀU CHỈNH'),true);
  assert.equal(matches(' ngoc linh ','Ngọc Linh','Vận hành'),true);
  assert.equal(matches('Quan tri','Quản trị viên'),true);
  assert.equal(matches('employee02','employee01'),false);
});
test('CSV keeps commas, quotes and multiline text inside quoted cells',()=>{
  const csv=csvText([{key:'name',label:'Họ tên'},{key:'note',label:'Ghi chú'}],[{name:'Nhật, Minh',note:'Dòng "một"\nDòng hai'}]);
  assert.ok(csv.startsWith('\ufeff'));
  assert.ok(csv.includes('"Nhật, Minh","Dòng ""một""\nDòng hai"'));
});
test('CSV neutralizes spreadsheet formula payloads including leading controls',()=>{
  const csv=csvText([{key:'text',label:'Nội dung'}],['=HYPERLINK("https://example.invalid")','+1+2','@SUM(A1:A2)',' -5+6','\t=1+1'].map(text=>({text})));
  for(const line of csv.split('\r\n').slice(1))assert.ok(line.startsWith('"\''));
});
test('CSV column mapping exports only declared public fields',()=>{
  const csv=csvText([{label:'Tài khoản',key:'username'},{label:'Trạng thái',value:u=>u.disabled?'Khóa':'Mở'}],[{username:'demo',disabled:false,secret:'DO_NOT_EXPORT'}]);
  assert.ok(csv.includes('"demo","Mở"'));
  assert.equal(csv.includes('DO_NOT_EXPORT'),false);
});
