"""Real PostgreSQL tests, only against the runner-verified tmpfs fixture. No lab fallback."""
import concurrent.futures
import hashlib
import http.client
import importlib
import json
import os
from pathlib import Path
import re
import sys
import threading
import unittest
import uuid
from datetime import datetime, timedelta, timezone
from http.server import ThreadingHTTPServer
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'audit'))
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
import service
import incidents
from detection import classify, extract

NOTE = 'Đối chiếu bằng chứng trong PostgreSQL thử nghiệm.'
SCHEMA = (ROOT / 'audit/schema.sql').read_text(encoding='utf-8')


class PostgresIncidents(unittest.TestCase):
    def setUp(self):
        if not os.environ.get('IAM_TEST_ROOT') or not os.environ.get('IAM_PHASE4_PG_PORT'):
            raise RuntimeError('Use scripts/test_phase4.py; real databases are forbidden')
        config = json.loads((ROOT / ('.runtime/phase6-tests/postgres-fixture.json' if os.environ.get('IAM_BROWSER_PHASE')=='6' else '.runtime/phase5b-tests/postgres-fixture.json' if os.environ.get('IAM_BROWSER_PHASE')=='5b' else '.runtime/phase4-tests/postgres-fixture.json')).read_text(encoding='utf-8'))
        self.port = int(os.environ['IAM_PHASE4_PG_PORT'])
        if self.port != config['port'] or config['host'] != '127.0.0.1' or config['database'] != 'phase4_fixture':
            raise RuntimeError('Fixture mismatch')
        self.schema = 'phase4_' + uuid.uuid4().hex
        with self.connection(bootstrap=True) as db:
            db.execute('CREATE SCHEMA ' + self.schema)
        with self.connection() as db:
            db.execute(SCHEMA)
        self.original_connect = service.connect
        service.connect = self.connection
        self.addCleanup(setattr, service, 'connect', self.original_connect)
        self.event_id = 'fixture:event:1'
        self.call('POST', '/ingest', body={'events': [self.event(self.event_id)]})
        self.key = hashlib.sha256(('INSUFFICIENT_ROLE:' + self.event_id).encode()).hexdigest()

    def connection(self, bootstrap=False):
        if not re.fullmatch('phase4_[a-f0-9]{32}', self.schema):
            raise RuntimeError('Invalid synthetic schema')
        return psycopg.connect(host='127.0.0.1', port=self.port, dbname='phase4_fixture', user='phase4_fixture', sslmode='disable', gssencmode='disable', passfile=os.devnull, connect_timeout=3,
                               row_factory=dict_row, options='-c statement_timeout=10000 -c lock_timeout=3000 -c search_path=' + ('public' if bootstrap else self.schema))

    def event(self, key, **change):
        row = dict(event_id=key, timestamp='2026-11-09T01:00:00Z', source='web-a', user_id='employee-fixture', username='fixture',
                   client_id='employee-portal', action='INSUFFICIENT_ROLE', resource='/api/admin', decision='DENY', http_status=403,
                   ip_address='192.0.2.8', request_id='request-' + key, details={'role': 'employee', 'method': 'GET'})
        row.update(change)
        return row

    def call(self, method, route, query=None, body=None):
        return service.dispatch(method, route, query or {}, body or {})

    def update(self, **change):
        body = dict(state='reviewing', note=NOTE, version=1, actor='admin-fixture', requestId='request-fixture')
        body.update(change)
        return self.call('POST', '/incidents/' + self.key, body=body)

    def read(self, **query):
        return self.call('GET', '/incidents/' + self.key, query=query)

    def follow_up(self, key='fixture:follow', **change):
        row = self.event(key, timestamp='2026-11-09T02:00:00Z', action='AUTHORIZED', decision='ALLOW', http_status=200)
        row.update(change)
        self.call('POST', '/ingest', body={'events': [row]})
        return 'audit:' + key

    def verification(self, ref, **change):
        result = dict(result='passed', method=NOTE, expectedDecision='ALLOW', evidenceRefs=[ref])
        result.update(change)
        return result

    def test_source_detail_has_no_invented_cause_or_execution(self):
        d = self.read()['detail']
        self.assertEqual(d['evidence']['items'][0]['ref'], 'audit:' + self.event_id)
        self.assertIsNone(d['assessment']); self.assertIsNone(d['verification'])
        self.assertFalse(d['resolution']['verified']); self.assertEqual(d['actions'], [])
        self.assertFalse(d['recommendations']['generated'][0]['executed'])
        self.assertEqual(d['subject']['userId'], 'employee-fixture')
        self.assertTrue(any(item['kind'] == 'detection' for item in d['timeline']['items']))

    def test_nonexistent_and_malformed_incident(self):
        for route in ['/incidents/' + 'b' * 64, '/incidents/../events', '/incidents/not-an-id']:
            with self.assertRaises(LookupError):
                self.call('GET', route)

    def test_filters_and_pagination(self):
        for query, total in [({'state':'all','severity':'high','source':'web-a','detector':'audit'}, 1),
                             ({'source':'keycloak'}, 0), ({'detector':'detection'}, 0),
                             ({'timeField':'occurred','from':'2026-11-09T00:00:00Z','to':'2026-11-09T01:30:00Z'},1),
                             ({'timeField':'occurred','from':'2026-11-10T00:00:00Z'},0)]:
            self.assertEqual(self.call('GET','/incidents',query)['total'],total)
        for query in [{'state':'bad'},{'severity':'bad'},{'source':'bad'},{'detector':'bad'},{'timeField':'bad'},{'limit':'0'},{'offset':'-1'},{'from':'2026-11-10T00:00:00Z','to':'2026-11-09T00:00:00Z'}]:
            with self.assertRaises(ValueError): self.call('GET','/incidents',query)

    def test_review_records_assessment_proposal_history_and_audit(self):
        ref='audit:'+self.event_id
        self.update(assessment=dict(text=NOTE,confidence='supported',evidenceRefs=[ref]),recommendation=dict(text=NOTE,evidenceRefs=[ref]))
        d=self.read()['detail']
        self.assertEqual(d['assessment']['kind'],'analyst_assessment')
        self.assertFalse(d['recommendations']['recorded'][0]['executed'])
        self.assertEqual(d['history']['items'][0]['actor'],'admin-fixture')
        self.assertEqual(d['history']['items'][0]['request_id'],'request-fixture')
        with self.connection() as db:
            self.assertEqual(db.execute("SELECT count(*) AS n FROM audit_operations WHERE action='INCIDENT_REVIEW'").fetchone()['n'],1)

    def test_missing_or_wrong_version_actor_forgery_and_secret_like_notes(self):
        for change in [{'version':True},{'version':0},{'version':'1'},{'requestId':None},{'forged':True},{'note':'Bearer '+uuid.uuid4().hex}]:
            with self.assertRaises(ValueError): self.update(**change)
        with self.assertRaises(FileExistsError): self.update(version=2)
        self.assertEqual(self.read()['incident']['version'],1)

    def test_cross_identity_evidence_and_missing_event_are_refused(self):
        ref=self.follow_up(user_id='other-fixture')
        for value in [ref,'audit:missing']:
            with self.assertRaises(LookupError): self.update(assessment=dict(text=NOTE,confidence='confirmed',evidenceRefs=[value]))

    def test_unverified_resolution_and_false_positive_refused(self):
        for state in ['resolved','false_positive']:
            with self.assertRaises(ValueError): self.update(state=state)
        self.assertEqual(self.read()['incident']['state'],'open')

    def test_actual_follow_up_supports_explicit_analyst_verification(self):
        ref=self.follow_up(source='api',client_id=None)
        self.update(state='resolved',verification=self.verification(ref))
        d=self.read()['detail']
        self.assertTrue(d['resolution']['verified'])
        self.assertEqual(d['verification']['kind'],'analyst_verification')
        self.assertTrue(any(item['ref']==ref and item['relation']=='investigation' for item in d['evidence']['items']))
        self.assertEqual(self.call('GET','/incidents',{'state':'all','source':'api'})['total'],0)

    def test_wrong_decision_old_or_failed_test_never_closes_incident(self):
        wrong=self.follow_up(decision='DENY',http_status=403)
        for v in [self.verification('audit:'+self.event_id),self.verification(wrong),self.verification(wrong,result='failed')]:
            with self.assertRaises(ValueError):self.update(state='resolved',verification=v)

    def test_false_positive_requires_evidence_supported_assessment(self):
        self.update(state='false_positive',assessment=dict(text=NOTE,confidence='refuted',evidenceRefs=['audit:'+self.event_id]))
        self.assertEqual(self.read()['incident']['state'],'false_positive')
        self.assertFalse(self.read()['detail']['resolution']['verified'])

    def test_actual_execution_event_is_distinct_from_proposal(self):
        ref=self.follow_up('fixture:action',action='REMEDIATION_SYNCED',timestamp='2026-11-09T01:30:00Z')
        test=self.follow_up()
        self.update(state='resolved',actionRefs=[ref],verification=self.verification(test))
        d=self.read()['detail']
        self.assertEqual(d['actions'][0]['kind'],'recorded_execution_event')
        self.assertEqual(d['actions'][0]['targetVerification'],'not_recorded')
        self.assertTrue(d['resolution']['verified'])

    def test_partial_execution_does_not_count_as_remediated(self):
        ref=self.follow_up('fixture:partial',action='REMEDIATION_PARTIAL',timestamp='2026-11-09T01:30:00Z')
        follow=self.follow_up()
        with self.assertRaises(ValueError):self.update(state='resolved',actionRefs=[ref],verification=self.verification(follow))

    def test_admin_execution_target_must_match_incident_subject(self):
        ref=self.follow_up('fixture:admin-action',user_id='admin-fixture',action='REMEDIATION_SYNCED',timestamp='2026-11-09T01:30:00Z',details={'target_user_id':'employee-fixture'})
        self.update(actionRefs=[ref])
        self.assertEqual(self.read()['detail']['actions'][0]['targetVerification'],'recorded')
        verification=self.follow_up('fixture:after-admin-action')
        self.update(version=2,state='resolved',verification=self.verification(verification))
        self.assertTrue(self.read()['detail']['resolution']['verified'])
        wrong=self.follow_up('fixture:wrong-target',user_id='admin-fixture',action='REMEDIATION_SYNCED',details={'target_user_id':'another-fixture'})
        with self.assertRaises(LookupError):self.update(version=3,actionRefs=[wrong])
        wrong_actor_match=self.follow_up('fixture:actor-match-wrong-target',action='REMEDIATION_SYNCED',details={'target_user_id':'another-fixture'})
        with self.assertRaises(LookupError):self.update(version=3,actionRefs=[wrong_actor_match])

    def test_execution_or_investigation_log_is_not_an_independent_test(self):
        for action in ['REMEDIATION_SYNCED','ALERT_REVIEW','INCIDENT_REVIEW']:
            ref=self.follow_up('fixture:non-test:'+action,action=action)
            with self.assertRaises(ValueError):self.update(state='resolved',verification=self.verification(ref))

    def test_future_test_evidence_cannot_verify_remediation(self):
        ref=self.follow_up('fixture:future',timestamp='2100-01-01T00:00:00Z')
        with self.assertRaises(ValueError):self.update(state='resolved',verification=self.verification(ref))

    def test_concurrent_updates_preserve_one_version_and_history(self):
        def update(n):
            try:self.update(note=NOTE+str(n));return 'committed'
            except FileExistsError:return 'conflict'
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
            results=list(pool.map(update,[1,2]))
        self.assertCountEqual(results,['committed','conflict'])
        self.assertEqual(self.read()['incident']['version'],2)
        self.assertEqual(len(self.read()['history']),1)

    def test_new_source_event_reopens_closed_bucket_and_invalidates_old_version(self):
        key=self.key
        ref=self.follow_up()
        self.update(state='resolved',verification=self.verification(ref))
        self.follow_up('fixture:new-trigger',timestamp='2026-11-09T03:00:00Z')
        with self.connection() as db:incidents.record_detection(db,'fixture:new-trigger','INSUFFICIENT_ROLE','high','Additional actual event',key=key)
        self.assertEqual(self.read()['incident']['state'],'reviewing')
        self.assertFalse(self.read()['detail']['resolution']['verified'])
        with self.assertRaises(FileExistsError):self.update(version=2)

    def test_replay_does_not_duplicate_evidence_or_change_version(self):
        self.call('POST','/ingest',body={'events':[self.event(self.event_id)]})
        with self.connection() as db:incidents.record_detection(db,self.event_id,'INSUFFICIENT_ROLE','high','Replay')
        self.assertEqual(self.read()['incident']['version'],1)
        self.assertEqual(len(self.read()['detail']['evidence']['items']),1)

    def test_threshold_incident_links_all_five_counted_events(self):
        batch=[self.event('login-'+str(i),source='keycloak',action='LOGIN_ERROR',resource=None,client_id='employee-portal',timestamp='2026-11-09T04:00:0'+str(i)+'Z') for i in range(5)]
        self.call('POST','/ingest',body={'events':batch})
        rows=self.call('GET','/incidents',{'state':'all'})['rows']
        row=next(r for r in rows if r['rule']=='LOGIN_FAILURE_BURST')
        d=self.call('GET','/incidents/'+row['id'])['detail']
        self.assertEqual(len(d['evidence']['items']),5)
        self.assertIsNone(d['assessment'])

    def test_python_detection_retains_actual_rules_and_features(self):
        key='fixture:detection'
        self.call('POST','/ingest',body={'events':[self.event(key)]})
        with self.connection() as db:
            event=db.execute('SELECT * FROM audit_events WHERE event_id=%s',(key,)).fetchone()
            config=db.execute('SELECT * FROM detection_config WHERE id=1').fetchone()
            result=classify(event,extract(db,event),config)
            db.execute('INSERT INTO detection_runs(id,actor,config) VALUES(%s,%s,%s)',('run-fixture','fixture',Jsonb(config)))
            db.execute('INSERT INTO detection_results(event_id,run_id,prediction,rules,features,latency_ms,version) VALUES(%s,%s,%s,%s,%s,0,1)',(key,'run-fixture',result['prediction'],Jsonb(result['rules']),Jsonb(result['features'])))
            incident_id=incidents.record_detection(db,key,'PYTHON_BASELINE','medium',', '.join(result['rules']))
        d=self.call('GET','/incidents/'+incident_id)['detail']
        self.assertEqual(d['detector'],'detection');self.assertIn('EMPLOYEE_ADMIN_ACCESS',d['detection']['rules'])
        self.assertEqual(d['recommendations']['generated'][0]['rule'],result['rules'][0])

    def test_missing_detection_result_does_not_guess_rules_from_summary(self):
        with self.connection() as db:key=incidents.record_detection(db,self.event_id,'PYTHON_BASELINE','medium','NEW_IP_REVIEW')
        d=self.call('GET','/incidents/'+key)['detail']
        self.assertIsNone(d['detection']);self.assertEqual(d['recommendations']['generated'],[])

    def test_missing_source_keeps_incident_but_reports_unavailable_proof(self):
        with self.connection() as db:db.execute('DELETE FROM audit_events WHERE event_id=%s',(self.event_id,))
        d=self.read()['detail'];self.assertIsNone(d['occurredAt']);self.assertIsNone(d['subject']['userId'])
        self.assertEqual(d['evidence']['missing'],['audit:'+self.event_id]);self.assertFalse(d['resolution']['verified'])

    def test_history_cursor_does_not_lose_older_reviews(self):
        for version in range(1,4):self.update(version=version,note=NOTE+str(version))
        first=self.read(historyLimit='2')['detail']['history']
        self.assertFalse(first['complete'])
        second=self.read(historyLimit='2',historyBefore=str(first['nextCursor']))['detail']['history']
        self.assertTrue(second['complete']);self.assertEqual(len(first['items'])+len(second['items']),3)
        self.assertEqual(len({h['id'] for h in first['items']+second['items']}),3)

    def test_write_failure_rolls_back_state_history_and_operation(self):
        with self.connection() as db:
            db.execute("CREATE FUNCTION synthetic_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Synthetic history failure'; END $$")
            db.execute('CREATE TRIGGER fail_fixture BEFORE INSERT ON incident_history FOR EACH ROW EXECUTE FUNCTION synthetic_failure()')
        with self.assertRaises(psycopg.Error):self.update()
        self.assertEqual(self.read()['incident']['version'],1)
        with self.connection() as db:self.assertEqual(db.execute('SELECT count(*) AS n FROM audit_operations').fetchone()['n'],0)

    def test_legacy_migration_replay_preserves_existing_rows(self):
        legacy_schema='phase4_'+uuid.uuid4().hex
        with self.connection(bootstrap=True) as db:db.execute('CREATE SCHEMA '+legacy_schema)
        previous=self.schema;self.schema=legacy_schema
        try:
            with self.connection() as db:
                db.execute(SCHEMA.split('-- Phase 4:')[0])
                db.execute('INSERT INTO audit_incidents(id,rule,severity,summary,state) VALUES(%s,%s,%s,%s,%s)',('legacy','LEGACY','medium','Existing summary','resolved'))
                db.execute('INSERT INTO incident_history(incident_id,actor,state,note) VALUES(%s,%s,%s,%s)',('legacy','legacy-actor','resolved',NOTE))
                before=db.execute('SELECT * FROM audit_incidents WHERE id=%s',('legacy',)).fetchone()
            with self.connection() as db:db.execute(SCHEMA);db.execute(SCHEMA)
            with self.connection() as db:
                after=db.execute('SELECT * FROM audit_incidents WHERE id=%s',('legacy',)).fetchone()
                self.assertTrue(all(after[k]==v for k,v in before.items()))
                history=db.execute('SELECT * FROM incident_history').fetchone();self.assertIsNone(history['version']);self.assertIsNone(history['request_id'])
                self.assertEqual(db.execute('SELECT count(*) AS n FROM incident_migrations').fetchone()['n'],1)
                self.assertFalse(incidents.detail(db,after)['resolution']['verified'])
        finally:self.schema=previous

    def test_failed_migration_is_transactional(self):
        with self.assertRaises(psycopg.Error):
            with self.connection() as db:
                db.execute('CREATE TABLE synthetic_migration(id INTEGER)')
                db.execute('ALTER TABLE synthetic_migration ADD COLUMN added TEXT')
                db.execute('SELECT nonexistent_synthetic_function()')
        with self.connection() as db:self.assertIsNone(db.execute("SELECT to_regclass('synthetic_migration') AS name").fetchone()['name'])

    def test_retention_dry_run_preserves_all_open_incident_evidence(self):
        old='2000-01-01T00:00:00Z'
        self.call('POST','/ingest',body={'events':[self.event('old-evidence',timestamp=old)]})
        with self.connection() as db:db.execute('UPDATE audit_settings SET retention_days=1 WHERE id=1')
        r=self.call('POST','/retention',body={'apply':False})
        self.assertFalse(r['applied']);self.assertEqual(r['count'],0)

    def test_http_errors_are_sanitized_and_do_not_return_success(self):
        token=uuid.uuid4().hex+uuid.uuid4().hex
        with patch.object(service,'TOKEN',token):
            server=ThreadingHTTPServer(('127.0.0.1',0),service.Handler)
            thread=threading.Thread(target=server.serve_forever,daemon=True);thread.start()
            try:
                def request(route,auth=True):
                    conn=http.client.HTTPConnection('127.0.0.1',server.server_port,timeout=5)
                    conn.request('GET',route,headers={'Authorization':'Bearer '+token} if auth else {})
                    response=conn.getresponse();body=json.loads(response.read());status=response.status;conn.close();return status,body
                self.assertEqual(request('/incidents',False)[0],401)
                self.assertEqual(request('/incidents/'+'b'*64)[0],404)
                self.assertEqual(request('/incidents?severity=invalid')[0],400)
                with patch.object(service,'connect',side_effect=psycopg.OperationalError('Synthetic database unavailable')):
                    status,body=request('/incidents');self.assertEqual(status,503);self.assertNotIn('Synthetic',body['message']);self.assertNotIn(token,json.dumps(body))
            finally:server.shutdown();server.server_close();thread.join()


if __name__=='__main__':
    unittest.main()
