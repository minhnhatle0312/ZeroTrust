import {test} from 'node:test';
import assert from 'node:assert/strict';
import {correctionProblem,localDay,completedHours} from '../web-a/src/workspace.mjs';
const now=new Date('2026-11-09T05:00:00Z'),valid={day:'2026-11-08',checkIn:'08:00',checkOut:'17:00',reason:'Quên thao tác khi bắt đầu ca.'};
test('Correction accepts valid past shift and exact 31-day boundary',()=>{
  assert.equal(correctionProblem(valid,now),'');
  assert.equal(correctionProblem({...valid,day:'2026-10-09'},now),'');
});
test('Correction rejects impossible dates, missing dates, old and future days',()=>{
  for(const day of ['','2026-02-30','2026-10-08','2026-11-10','2026-13-01'])assert.ok(correctionProblem({...valid,day},now));
});
test('Correction rejects reversed, equal and malformed times',()=>{
  for(const checkOut of ['08:00','07:00','24:00','17:60',''])assert.ok(correctionProblem({...valid,checkOut},now));
});
test('Correction distinguishes future time today from a completed shift',()=>{
  assert.ok(correctionProblem({...valid,day:'2026-11-09'},now));
  assert.equal(correctionProblem({...valid,day:'2026-11-09',checkOut:'11:00'},now),'');
});
test('Correction trims reason and enforces limits',()=>{
  for(const reason of ['          ',' ngắn ', 'x'.repeat(501)])assert.ok(correctionProblem({...valid,reason},now));
  assert.equal(correctionProblem({...valid,reason:'x'.repeat(500)},now),'');
});
test('Vietnam local day handles UTC midnight boundary',()=>{
  assert.equal(localDay(new Date('2026-11-08T17:00:00Z')),'2026-11-09');
  assert.equal(localDay(new Date('2026-11-08T16:59:59Z')),'2026-11-08');
});
test('Duration excludes open shifts and never reports negative hours',()=>{
  assert.equal(completedHours({check_in:'2026-11-09T01:00:00Z'}),0);
  assert.equal(completedHours({check_in:'2026-11-09T01:00:00Z',check_out:'2026-11-09T10:00:00Z'}),9);
  assert.equal(completedHours({check_in:'2026-11-09T10:00:00Z',check_out:'2026-11-09T01:00:00Z'}),0);
});
