import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApi} from '../shared/api.mjs';

test('GET renews once across same-second revocation boundary',async()=>{
  const original=globalThis.fetch;let requests=0;const refresh=[];
  globalThis.fetch=async()=>new Response(JSON.stringify(++requests===1?{code:'SESSION_REVOKED',message:'revoked'}:{name:'demo'}),{status:requests===1?401:200});
  try{const api=createApi({token:'not-a-real-token',async updateToken(n){refresh.push(n);}},{retryDelay:0});assert.equal((await api('/api/profile')).name,'demo');assert.equal(requests,2);assert.ok(refresh.includes(-1));}finally{globalThis.fetch=original;}
});
test('Mutations are never automatically resubmitted',async()=>{
  const original=globalThis.fetch;let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({code:'SESSION_REVOKED',message:'revoked'}),{status:401});};
  try{const api=createApi({token:'fake',async updateToken(){}},{retryDelay:0});await assert.rejects(api('/api/corrections','POST',{}),e=>e.code==='SESSION_REVOKED');assert.equal(requests,1);}finally{globalThis.fetch=original;}
});
test('Failed token renewal exposes a recoverable login error',async()=>{
  const api=createApi({async updateToken(){throw Error('raw internal detail');}});await assert.rejects(api('/api/profile'),e=>e.code==='INVALID_TOKEN'&&!e.message.includes('raw internal'));
});
test('Service error preserves code and correlation ID for recovery',async()=>{
  const original=globalThis.fetch;globalThis.fetch=async()=>new Response(JSON.stringify({code:'IDENTITY_UNAVAILABLE',message:'Try later',requestId:'example-id'}),{status:503});
  try{const api=createApi({token:'fake',async updateToken(){}});await assert.rejects(api('/api/security'),e=>e.status===503&&e.requestId==='example-id'&&e.message==='Try later');}finally{globalThis.fetch=original;}
});
