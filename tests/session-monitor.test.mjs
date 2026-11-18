import {test} from 'node:test';
import assert from 'node:assert/strict';
import {monitorSession} from '../shared/sso.js';

async function scenario({status=200,body={role:'admin'},failure=false,authenticated=true,canCheck=true}={}) {
  const old={window:globalThis.window,document:globalThis.document,fetch:globalThis.fetch};
  const events=[],listeners={};let calls=0,cleared=0;
  globalThis.window={addEventListener:(key,fn)=>listeners[key]=fn,removeEventListener:()=>{},dispatchEvent:e=>events.push(e.detail)};
  globalThis.document={visibilityState:'visible',addEventListener:()=>{},removeEventListener:()=>{}};
  globalThis.fetch=async()=>{calls++;if(failure)throw Error('fixture-only');return new Response(JSON.stringify(body),{status});};
  const keycloak={authenticated,token:'synthetic-test-value',async updateToken(){},clearToken(){cleared++;}};
  const stop=monitorSession({keycloak,apiUrl:'http://127.0.0.1:1',canCheck:()=>canCheck,interval:60000});
  try{await listeners.focus();return {events,calls,cleared};}
  finally{stop();Object.assign(globalThis,old);}
}
test('session monitor distinguishes backend outage from expired session',async()=>{
  const r=await scenario({status:503});assert.equal(r.events.at(-1).state,'unavailable');assert.equal(r.cleared,0);
});
test('session monitor reports network failure while IdP session remains valid',async()=>{
  const r=await scenario({failure:true});assert.equal(r.events.at(-1).state,'unavailable');assert.equal(r.cleared,0);
});
test('session monitor confirms availability only after a successful protected read',async()=>{
  assert.equal((await scenario()).events.at(-1).state,'available');
});
test('session monitor clears revoked session',async()=>{
  const r=await scenario({status:401,body:{code:'SSO_SESSION_ENDED'}});assert.equal(r.events.at(-1).state,'ended');assert.equal(r.cleared,1);
});
test('session monitor reports stale role denial from profile endpoint',async()=>{
  const r=await scenario({status:403,body:{code:'INSUFFICIENT_ROLE'}});assert.equal(r.events.at(-1).state,'denied');assert.equal(r.cleared,1);
});
test('session monitor never probes before admission',async()=>{
  assert.equal((await scenario({canCheck:false})).calls,0);
});
