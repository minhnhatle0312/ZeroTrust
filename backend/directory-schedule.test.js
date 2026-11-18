const {test}=require('node:test');
const assert=require('node:assert/strict');
const {directoryScheduleEnabled,startDirectorySchedule}=require('./directory-schedule');

test('periodic sync stays enabled by default; explicit false is the only disable value',()=>{
  assert.equal(directoryScheduleEnabled(undefined),true);
  assert.equal(directoryScheduleEnabled('true'),true);
  assert.equal(directoryScheduleEnabled('false'),false);
  for(const value of ['', '0', 'False', 'TRUE', 'false ', null])assert.throws(()=>directoryScheduleEnabled(value),/must be true or false/);
});
test('disabled runtime creates no timer and makes no calls to the directory',()=>{
  const directory=new Proxy({}, {get(){throw Error('Directory must not be touched');}});
  assert.equal(startDirectorySchedule(directory,{enabled:false,intervalSeconds:300,schedule(){throw Error('Timer must not be created');}}),null);
});
test('enabled runtime queues only configured providers on each scheduled tick',()=>{
  let tick,unrefs=0,queued=0;
  const directory={configured:true,queue(){queued++;}};
  const handle={unref(){unrefs++;}};
  assert.equal(startDirectorySchedule(directory,{enabled:true,intervalSeconds:300,schedule(fn,delay){assert.equal(delay,300000);tick=fn;return handle;}}),handle);
  assert.equal(unrefs,1);assert.equal(queued,0);
  tick();assert.equal(queued,1);
  directory.configured=false;tick();assert.equal(queued,1);
  directory.configured=true;directory.queue=()=>{throw Error('existing job');};assert.doesNotThrow(tick);
});
