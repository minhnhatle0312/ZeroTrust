import {test} from 'node:test';
import assert from 'node:assert/strict';
import {buildInvestigation,draftFor,refList} from '../web-b/src/incident-editor.mjs';
const detail={version:4,state:'reviewing',evidence:{complete:true,missing:[],items:[{ref:'events:1',relation:'direct'}]}};
const draft=()=>({...draftFor(detail),note:'Synthetic investigation note.',text:'Synthetic evidence-based assessment.',method:'Compare an independent recorded access probe.'});
test('assessment sends only API fields, version and exact evidence; Backend owns actor/time',()=>{
  const d={...draft(),confidence:'confirmed',selected:['events:1']};
  assert.deepEqual(buildInvestigation('sqlite',detail,'assessment',d),{version:4,note:d.note,assessment:{text:d.text,confidence:'confirmed',evidenceRefs:['events:1']}});
  assert.throws(()=>buildInvestigation('sqlite',detail,'assessment',{...d,selected:[]}),/bằng chứng/);
  assert.ok(buildInvestigation('sqlite',detail,'assessment',{...d,selected:[],confidence:'hypothesis'}).assessment);
});
test('recommendations append proposals rather than execution claims or edits',()=>{
  const body=buildInvestigation('audit',detail,'recommendation',{...draft(),extra:'audit:event-1'});
  assert.deepEqual(Object.keys(body).sort(),['note','recommendation','version']);assert.equal(body.recommendation.executed,undefined);
  assert.throws(()=>buildInvestigation('audit',detail,'recommendation',draft()),/bằng chứng/);
});
test('action records are source references, never invented result/time fields',()=>{
  assert.deepEqual(buildInvestigation('sqlite',detail,'actions',{...draft(),actions:'action:existing\naction:existing'}).actionRefs,['action:existing']);
  assert.deepEqual(buildInvestigation('audit',detail,'actions',{...draft(),actions:'audit:execution:1'}).actionRefs,['audit:execution:1']);
  assert.throws(()=>buildInvestigation('sqlite',detail,'actions',{...draft(),actions:'audit:wrong-store'}),/hành động/);
});
test('verification remains separate from closure unless explicitly requested',()=>{
  const d={...draft(),selected:['events:2'],result:'passed'};
  assert.equal(buildInvestigation('sqlite',detail,'verification',d).status,undefined);
  assert.equal(buildInvestigation('sqlite',detail,'verification',{...d,close:true}).status,'resolved');
  assert.equal(buildInvestigation('audit',detail,'verification',{...d,selected:['audit:probe'],close:true}).state,'resolved');
  for(const result of ['failed','inconclusive'])assert.throws(()=>buildInvestigation('sqlite',detail,'verification',{...d,result,close:true}),/kết quả đạt/);
});
test('closure blocks missing original evidence and unverified status changes',()=>{
  assert.throws(()=>buildInvestigation('sqlite',detail,'state',{...draft(),state:'resolved'}),/kiểm chứng/);
  for(const evidence of [{complete:false,missing:[],items:detail.evidence.items},{complete:true,missing:['events:1'],items:[]},{complete:true,missing:[],items:[{relation:'investigation'}]}])assert.throws(()=>buildInvestigation('sqlite',{...detail,evidence},'verification',{...draft(),selected:['events:2'],result:'passed',close:true}),/bằng chứng nguồn/);
});
test('only supported states are sent; unrelated writes do not silently change state',()=>{
  for(const state of ['open','reviewing','resolved','false_positive'])assert.equal(buildInvestigation('audit',{...detail,verification:{result:'passed'}},'state',{...draft(),state}).state,state);
  for(const state of ['processing','awaiting_verification','closed'])assert.throws(()=>buildInvestigation('sqlite',detail,'state',{...draft(),state}),/không được API hỗ trợ/);
  assert.equal(buildInvestigation('sqlite',detail,'assessment',draft()).status,undefined);
});
test('text, references, credential patterns and UTF8 request limits are validated',()=>{
  assert.deepEqual(refList(' events:1 \n events:1\n\nevents:2'),['events:1','events:2']);
  for(const note of ['', 'short', 'x'.repeat(501),'password=synthetic'])assert.throws(()=>buildInvestigation('sqlite',detail,'assessment',{...draft(),note}),/Ghi chú/);
  assert.throws(()=>buildInvestigation('sqlite',detail,'assessment',{...draft(),extra:'audit:wrong'}),/đúng kho/);
  assert.throws(()=>buildInvestigation('sqlite',detail,'assessment',{...draft(),selected:Array.from({length:101},(_,i)=>'events:'+i)}),/100/);
  assert.throws(()=>buildInvestigation('audit',detail,'assessment',{...draft(),selected:Array.from({length:100},(_,i)=>'audit:'+i+'x'.repeat(230))}),/giới hạn yêu cầu/);
  assert.throws(()=>buildInvestigation('sqlite',{...detail,version:null},'assessment',draft()),/phiên bản/);
});
