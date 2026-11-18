import {test} from 'node:test';
import assert from 'node:assert/strict';
import {listPath,readRoute,incidentRoute,incidentPath,stamp,timelineItems,errorText,findEventIncidents,evidenceFor,rememberIncidentRoute,takeIncidentRoute} from '../web-b/src/security-data.mjs';
test('return navigation stores only validated incident routes and consumes them once',()=>{
  const entries=new Map(),storage={setItem:(k,v)=>entries.set(k,v),getItem:k=>entries.get(k),removeItem:k=>entries.delete(k)};
  rememberIncidentRoute('#/incident/sqlite/fixture-id',storage);assert.equal(takeIncidentRoute(storage),'incident/sqlite/fixture-id');assert.equal(takeIncidentRoute(storage),null);
  rememberIncidentRoute('#/incident/sqlite/fixture-id',storage);rememberIncidentRoute('#state=synthetic-state&code=synthetic-code',storage);assert.equal(takeIncidentRoute(storage),'incident/sqlite/fixture-id');
  rememberIncidentRoute('#access_token=synthetic',storage);assert.equal(entries.size,0);
  rememberIncidentRoute('#/incident/sqlite/fixture-id',storage);rememberIncidentRoute('#/alerts',storage);assert.equal(takeIncidentRoute(storage),null);
  rememberIncidentRoute('#/incident/sqlite/fixture-id?code=invalid',storage);assert.equal(entries.size,0);
  assert.equal(takeIncidentRoute({getItem(){throw Error('blocked');}}),null);
});
test('incident routes reject invalid IDs and encode exact references',()=>{
  for(const origin of ['sqlite','audit']){const id=origin==='sqlite'?'fixture-id':'a'.repeat(64);assert.deepEqual(readRoute(incidentRoute(origin,id)),{origin,id});assert.ok(incidentPath(origin,id).endsWith(id));}
  for(const s of ['incident/sqlite/a%2Fb','incident/audit/not-a-digest','incident/sqlite/%','incident/other/a','incident/sqlite/../x'])assert.equal(readRoute(s),null);
});
test('local and central pagination/filter contracts stay distinct',()=>{
  const f={state:'reviewing',q:'fixture',severity:'high',source:'api',from:'2026-10-01',to:'2026-10-02',timeField:'occurred',detector:'detection'};
  const local=new URL('http://fixture.test'+listPath('sqlite',f,3,20)),pg=new URL('http://fixture.test'+listPath('audit',f,3,20));
  assert.equal(local.searchParams.get('page'),'3');assert.equal(local.searchParams.get('status'),'reviewing');assert.equal(local.searchParams.get('from'),'2026-10-01');assert.equal(local.searchParams.get('detector'),null);
  assert.equal(pg.searchParams.get('offset'),'40');assert.equal(pg.searchParams.get('state'),'reviewing');assert.equal(pg.searchParams.get('q'),null);assert.equal(pg.searchParams.get('from'),'2026-09-30T17:00:00.000Z');assert.equal(pg.searchParams.get('to'),'2026-10-02T16:59:59.999Z');
  assert.equal(new URL('http://fixture.test'+listPath('audit',{},1,10)).searchParams.get('state'),'all');
});
test('missing timestamps and error states are explicit',()=>{
  assert.equal(stamp(null),'Chưa ghi nhận');assert.equal(stamp('bad'),'Chưa ghi nhận');assert.match(stamp('2026-10-01T01:00:00Z'),/08:00:00/);
  assert.match(errorText({status:403}),/quyền/);assert.match(errorText({status:404}),/Không tìm thấy/);assert.match(errorText({status:401}),/hết hạn/);
});
test('timeline appends history without duplicating the initial page or inventing times',()=>{
  const first={kind:'investigation',version:2,actor:'fixture',state:'reviewing',time:'2026-10-02T00:00:00Z',note:'Recorded'};
  const d={timeline:{items:[first,{kind:'source_event',ref:'events:1',time:'2026-10-01T00:00:00Z'}]}};
  const rows=timelineItems(d,[{...first,id:'a'},{id:'old',version:1,actor:'old',time:'2026-09-30T00:00:00Z'}]);assert.equal(rows.length,3);assert.equal(rows[0].version,1);
});
test('evidence references use exact returned links, never IP or username matching',()=>{
  const d={evidence:{items:[{ref:'audit:event-a',ip:'127.0.0.1'}]}};
  assert.equal(evidenceFor(d,'audit:event-a').ref,'audit:event-a');assert.equal(evidenceFor(d,'audit:event-b'),null);
});
test('event lookup reads all states and paginates exact anchor matches',async()=>{
  let calls=0;const r=await findEventIncidents(async path=>{const p=new URL('http://fixture.test'+path).searchParams;assert.equal(p.get('state'),'all');calls++;return calls===1?{rows:[{id:'wrong',event_id:'other'}],total:2}:{rows:[{id:'right',event_id:'needle'}],total:2};},'needle');assert.equal(calls,2);assert.deepEqual(r,{matches:[{id:'right',event_id:'needle'}],complete:true});
});
test('event lookup discloses bounded or truncated searches and propagates errors',async()=>{
  let calls=0;const r=await findEventIncidents(async()=>{calls++;return {rows:Array.from({length:200},()=>({event_id:'other'})),total:3000};},'needle');assert.equal(calls,10);assert.equal(r.complete,false);
  assert.equal((await findEventIncidents(async()=>({rows:[],total:1}),'needle')).complete,false);
  await assert.rejects(findEventIncidents(async()=>{throw Error('unavailable');},'needle'),/unavailable/);
});
