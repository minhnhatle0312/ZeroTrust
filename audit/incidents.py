"""Source-backed incident views and investigation records. No remediation execution."""
import hashlib
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from psycopg.types.json import Jsonb

POLICY = json.loads(Path(__file__).with_name('incident-policy.json').read_text(encoding='utf-8'))
STATES = {'open', 'reviewing', 'resolved', 'false_positive'}
SOURCES = {'web-a', 'web-b', 'api', 'keycloak', 'keycloak-admin'}
EXECUTION_EVENT = re.compile(r'^(?:REMEDIATION_|ACCOUNT_CHANGE_|ALERT_REVIEW$|CENTRAL_INCIDENT_|INCIDENT_REVIEW$|SESSION_TERMINATED$)')
SENSITIVE = re.compile(r'Bearer\s+\S+|eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+|-----BEGIN [^-]*PRIVATE KEY-----|(?:password|client_secret|refresh_token|access_token|otp_secret)\s*[:=]', re.I)


def text(value, minimum=1, maximum=1000):
    if not isinstance(value, str) or not minimum <= len(value.strip()) <= maximum or len(value) > maximum or SENSITIVE.search(value) or any(ord(c) < 32 and c not in '\n\t\r' for c in value):
        raise ValueError('Invalid investigation text; do not include credentials')
    return value.strip()


def fields(value, allowed):
    if not isinstance(value, dict) or set(value) - set(allowed):
        raise ValueError('Unexpected investigation field')


def timestamp(value):
    result = value if isinstance(value, datetime) else datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result.astimezone(timezone.utc)


def event_view(row, relation='direct'):
    return dict(ref='audit:' + row['event_id'], id=row['event_id'], source=row['source'], occurredAt=row['timestamp'],
                userId=row.get('user_id'), username=row.get('username'), ip=row.get('ip_address'), application=row.get('client_id'),
                resource=row.get('resource'), requestId=row.get('request_id'), sessionRef=row.get('session_id'),
                type=row['action'], decision=row['decision'], httpStatus=row.get('http_status'), targetUserId=(row.get('details') or {}).get('target_user_id'), relation=relation)


def record_detection(db, event_id, rule, severity, summary, key=None, evidence_ids=None):
    key = key or hashlib.sha256((rule + ':' + event_id).encode()).hexdigest()
    created = db.execute('INSERT INTO audit_incidents(id,event_id,rule,severity,summary) VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id',
                         (key, event_id, rule, severity, summary)).fetchone()
    # Row lock serializes evidence append with analyst writes. Replay does not change versions.
    row = db.execute('SELECT * FROM audit_incidents WHERE id=%s FOR UPDATE', (key,)).fetchone()
    linked = []
    for ref in dict.fromkeys([event_id] + list(evidence_ids or [])):
        added = db.execute("INSERT INTO incident_evidence(incident_id,event_ref,event_id,relation) VALUES(%s,%s,%s,'direct') ON CONFLICT DO NOTHING RETURNING event_ref", (key, ref, ref)).fetchone()
        if added:
            linked.append('audit:' + ref)
    if not created and linked:
        state = 'reviewing' if row['state'] in {'resolved', 'false_positive'} else row['state']
        changed = db.execute('UPDATE audit_incidents SET state=%s,version=version+1,updated_at=now() WHERE id=%s RETURNING version', (state, key)).fetchone()
        db.execute('INSERT INTO incident_history(incident_id,actor,state,note,version,change) VALUES(%s,%s,%s,%s,%s,%s)',
                   (key, 'system:detector', state, 'New source event linked; previous verification requires review.', changed['version'], Jsonb({'kind': 'source_evidence_added', 'eventRefs': linked, 'previousState': row['state']})))
    return key


def list_incidents(db, q):
    clauses, args = [], []
    state = q.get('state', 'open')
    if state != 'all':
        if state not in STATES:
            raise ValueError('Invalid incident state')
        clauses.append('i.state=%s'); args.append(state)
    if q.get('severity'):
        if q['severity'] not in {'low', 'medium', 'high', 'critical'}:
            raise ValueError('Invalid severity')
        clauses.append('i.severity=%s'); args.append(q['severity'])
    if q.get('source'):
        if q['source'] not in SOURCES:
            raise ValueError('Invalid event source')
        clauses.append("EXISTS(SELECT 1 FROM audit_events ev WHERE ev.source=%s AND (ev.event_id=i.event_id OR EXISTS(SELECT 1 FROM incident_evidence ie WHERE ie.incident_id=i.id AND ie.event_id=ev.event_id AND ie.relation='direct')))")
        args.append(q['source'])
    if q.get('detector'):
        if q['detector'] not in {'audit', 'detection'}:
            raise ValueError('Invalid detector')
        clauses.append("i.rule " + ('=' if q['detector'] == 'detection' else '<>') + " 'PYTHON_BASELINE'")
    time_field = q.get('timeField', 'detected')
    if time_field not in {'detected', 'occurred', 'updated'}:
        raise ValueError('Invalid time field')
    occurred = "COALESCE((SELECT min(ev.timestamp) FROM incident_evidence ie JOIN audit_events ev ON ev.event_id=ie.event_id WHERE ie.incident_id=i.id AND ie.relation='direct'),e.timestamp)"
    column = {'detected': 'i.created_at', 'occurred': occurred, 'updated': 'i.updated_at'}[time_field]
    start, end = timestamp(q['from']) if q.get('from') else None, timestamp(q['to']) if q.get('to') else None
    if start and end and (start > end or end - start > timedelta(days=366)):
        raise ValueError('Invalid time window')
    for value, operator in [(start, '>='), (end, '<=')]:
        if value:
            clauses.append(column + operator + '%s'); args.append(value)
    size, offset = int(q.get('limit', 25)), int(q.get('offset', 0))
    if not 1 <= size <= 200 or not 0 <= offset <= 1000000:
        raise ValueError('Invalid pagination')
    where = ' WHERE ' + ' AND '.join(clauses) if clauses else ''
    join = ' FROM audit_incidents i LEFT JOIN audit_events e ON e.event_id=i.event_id'
    total = db.execute('SELECT count(*) AS n' + join + where, args).fetchone()['n']
    rows = db.execute('SELECT i.*,' + occurred + ' AS occurred_at,e.source AS event_source' + join + where + ' ORDER BY i.created_at DESC,i.id LIMIT %s OFFSET %s', args + [size, offset]).fetchall()
    return {'rows': rows, 'total': total, 'complete': offset + len(rows) >= total, 'limit': size, 'offset': offset}


def evidence(db, row):
    links = db.execute('SELECT event_ref,event_id,relation FROM incident_evidence WHERE incident_id=%s ORDER BY event_ref LIMIT 501', (row['id'],)).fetchall()
    if row['event_id'] and not any(link['event_ref'] == row['event_id'] for link in links):
        links.insert(0, dict(event_ref=row['event_id'], event_id=row['event_id'], relation='direct'))
    items, missing = [], []
    for link in links[:500]:
        event = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (link['event_id'],)).fetchone() if link['event_id'] else None
        if event:
            items.append(event_view(event, link['relation']))
        else:
            missing.append('audit:' + link['event_ref'])
    return {'items': sorted(items, key=lambda e: (e['occurredAt'], e['ref'])), 'missing': missing, 'complete': len(links) <= 500, 'provenance': 'exact-source-links'}


def get_incident(db, key, lock=False):
    row = db.execute('SELECT * FROM audit_incidents WHERE id=%s' + (' FOR UPDATE' if lock else ''), (key,)).fetchone()
    if not row:
        raise LookupError('Incident not found')
    return row


def detail(db, row, q=None):
    q = q or {}
    proof = evidence(db, row)
    direct = [e for e in proof['items'] if e['relation'] == 'direct']
    anchor = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (row['event_id'],)).fetchone() if row['event_id'] else None
    detection = db.execute('SELECT event_id,run_id,prediction,rules,features,detected_at,version FROM detection_results WHERE event_id=%s', (row['event_id'],)).fetchone() if row['rule'] == 'PYTHON_BASELINE' else None
    rules = detection['rules'] if detection else ([] if row['rule'] == 'PYTHON_BASELINE' else [row['rule']])
    meta = row['investigation']
    generated = [dict(kind='system_proposal', rule=rule, policyVersion=POLICY['version'], text=POLICY['rules'].get(rule, POLICY['fallback']),
                      evidenceRefs=[e['ref'] for e in direct], executed=False) for rule in rules] if direct else []
    size, before_id = int(q.get('historyLimit', 100)), int(q['historyBefore']) if q.get('historyBefore') else None
    if not 1 <= size <= 100 or before_id is not None and not 1 <= before_id <= 9007199254740991:
        raise ValueError('Invalid history cursor/limit')
    history = db.execute('SELECT * FROM incident_history WHERE incident_id=%s' + (' AND id<%s' if before_id else '') + ' ORDER BY id DESC LIMIT %s', [row['id']] + ([before_id] if before_id else []) + [size + 1]).fetchall()
    items = history[:size]
    handler = db.execute('SELECT actor,time FROM incident_history WHERE incident_id=%s ORDER BY id DESC LIMIT 1', (row['id'],)).fetchone()
    actions = []
    for ref in meta.get('actionRefs', []):
        event = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (ref[6:],)).fetchone()
        actions.append(dict(ref=ref, kind='recorded_execution_event', event=event_view(event, 'investigation'), targetVerification='recorded' if (event.get('details') or {}).get('target_user_id') else 'not_recorded') if event else dict(ref=ref, missing=True, kind='unavailable'))
    verify = meta.get('verification')
    latest = max((e['occurredAt'] for e in direct), default=None)
    available = {e['ref']: e for e in proof['items']}
    verified = bool(anchor and proof['complete'] and not proof['missing'] and verify and verify['result'] == 'passed' and latest and all(ref in available and latest < available[ref]['occurredAt'] <= datetime.now(timezone.utc) and available[ref]['decision'] == verify['expectedDecision'] and not EXECUTION_EVENT.match(available[ref]['type']) for ref in verify['evidenceRefs']))
    timeline = [dict(kind='source_event', time=e['occurredAt'], ref=e['ref']) for e in proof['items']]
    timeline.append(dict(kind='detection', time=row['created_at'], source='detection' if row['rule'] == 'PYTHON_BASELINE' else 'audit', incidentId=row['id']))
    timeline.extend(dict(kind='investigation', time=h['time'], version=h['version'], actor=h['actor'], state=h['state'], note=h['note']) for h in items)
    timeline.sort(key=lambda item: item['time'])
    return dict(schemaVersion=1, origin='postgresql', incidentRef='audit:' + row['id'], id=row['id'], type=row['rule'], rule=row['rule'],
                detector='detection' if row['rule'] == 'PYTHON_BASELINE' else 'audit', severity=row['severity'], state=row['state'], version=row['version'],
                occurredAt=min((e['occurredAt'] for e in direct), default=None), detectedAt=row['created_at'], lastObservedAt=latest, updatedAt=row['updated_at'],
                subject=dict(userId=anchor.get('user_id') if anchor else None, username=anchor.get('username') if anchor else None),
                facts={key: sorted({e[field] for e in direct if e[field]}) for key, field in [('ips', 'ip'), ('applications', 'application'), ('resources', 'resource'), ('requestIds', 'requestId')]},
                evidence=proof, detection=detection, assessment=meta.get('assessment'), recommendations=dict(generated=generated, recorded=meta.get('recommendations', [])),
                actions=actions, verification=verify, resolution=dict(verified=row['state'] == 'resolved' and verified, basis='analyst_verification' if verify else 'not_verified', legacy=not meta and row['state'] in {'resolved', 'false_positive'}),
                handler=dict(id=handler['actor'], time=handler['time']) if handler else None, history=dict(items=items, complete=len(history) <= size, nextCursor=items[-1]['id'] if len(history) > size else None),
                timeline=dict(items=timeline, complete=proof['complete'] and len(history) <= size), limitations=(['Source event is no longer available.'] if not anchor else []) + (['Detection result is not available; do not infer individual rules from the summary.'] if row['rule'] == 'PYTHON_BASELINE' and not detection else []))


def review(db, key, body, operation):
    fields(body, ['state', 'version', 'note', 'assessment', 'recommendation', 'actionRefs', 'verification', 'actor', 'requestId'])
    note = text(body.get('note'), 10, 500)
    if type(body.get('version')) is not int or body['version'] < 1:
        raise ValueError('Version required')
    row = get_incident(db, key, lock=True)
    if row['version'] != body['version']:
        raise FileExistsError('Incident version conflict')
    state = body.get('state', row['state'])
    if state not in STATES:
        raise ValueError('Invalid state')
    proof = evidence(db, row)
    direct = [e for e in proof['items'] if e['relation'] == 'direct']
    available = {e['ref']: e for e in proof['items']}
    anchor = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (row['event_id'],)).fetchone() if row['event_id'] else None

    def resolve(ref):
        if not isinstance(ref, str) or not ref.startswith('audit:') or not 1 <= len(ref[6:]) <= 240:
            raise ValueError('Invalid evidence reference')
        if ref in available:
            return available[ref]
        event = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (ref[6:],)).fetchone()
        execution=event and event['action'] in {'REMEDIATION_SYNCED','REMEDIATION_PARTIAL','ACCOUNT_CHANGE_SYNCED','ACCOUNT_CHANGE_PARTIAL','SESSION_TERMINATED'}
        if not event or not anchor or not anchor['user_id'] or (event['user_id'] != anchor['user_id'] and not (execution and (event.get('details') or {}).get('target_user_id') == anchor['user_id'])):
            raise LookupError('Evidence not within incident identity scope')
        available[ref] = event_view(event, 'investigation')
        return available[ref]

    actor = text(body.get('actor'), 1, 180)
    request_id = text(body.get('requestId'), 1, 180)
    now = datetime.now(timezone.utc)
    meta = dict(row['investigation'])
    before = dict(meta)
    for key_name in ['assessment', 'recommendation', 'verification']:
        if key_name not in body:
            continue
        item = body[key_name]
        fields(item, ['text', 'confidence', 'evidenceRefs'] if key_name == 'assessment' else ['text', 'evidenceRefs'] if key_name == 'recommendation' else ['result', 'method', 'expectedDecision', 'evidenceRefs'])
        text(item.get('method') if key_name == 'verification' else item.get('text'), 10, 1000)
        refs = item.get('evidenceRefs')
        if not isinstance(refs, list) or len(refs) > 100:
            raise ValueError('Invalid evidence references')
        observed = [resolve(ref) for ref in refs]
        if key_name == 'assessment':
            if item.get('confidence') not in {'hypothesis', 'supported', 'confirmed', 'refuted'} or item['confidence'] != 'hypothesis' and not refs:
                raise ValueError('Assessment needs evidence and verification level')
            meta['assessment'] = dict(item, kind='analyst_assessment', actor=actor, time=now.isoformat())
        if key_name == 'recommendation':
            if not refs:
                raise ValueError('Recommendation needs evidence')
            proposals = list(meta.get('recommendations', []))
            if len(proposals) >= 100:
                raise ValueError('Recommendation limit reached')
            proposals.append(dict(item, kind='analyst_proposal', actor=actor, time=now.isoformat(), executed=False))
            meta['recommendations'] = proposals
        if key_name == 'verification':
            if item.get('result') not in {'passed', 'failed', 'inconclusive'} or item.get('expectedDecision') not in {'ALLOW', 'DENY'} or not refs:
                raise ValueError('Verification requires test result and recorded evidence')
            if item['result'] == 'passed' and (not direct or any(e['decision'] != item['expectedDecision'] or e['occurredAt'] <= max(d['occurredAt'] for d in direct) or e['occurredAt'] > now or EXECUTION_EVENT.match(e['type']) or not anchor or e['userId'] != anchor['user_id'] for e in observed)):
                raise ValueError('Passing test evidence must follow the incident and match the expected decision')
            meta['verification'] = dict(item, kind='analyst_verification', actor=actor, time=now.isoformat(), observations=[dict(ref=e['ref'], time=e['occurredAt'].isoformat(), decision=e['decision']) for e in observed])
    if 'actionRefs' in body:
        refs = body['actionRefs']
        if not isinstance(refs, list) or len(refs) > 100:
            raise ValueError('Invalid action references')
        for ref in refs:
            event = resolve(ref)
            if event['type'] not in {'REMEDIATION_SYNCED', 'REMEDIATION_PARTIAL', 'ACCOUNT_CHANGE_SYNCED', 'ACCOUNT_CHANGE_PARTIAL', 'SESSION_TERMINATED'}:
                raise ValueError('Action reference must identify an actual execution event')
            if event.get('targetUserId') and event['targetUserId'] != anchor['user_id']:
                raise LookupError('Execution target is outside the incident subject')
        meta['actionRefs'] = list(dict.fromkeys(meta.get('actionRefs', []) + refs))
        if len(meta['actionRefs']) > 100:
            raise ValueError('Action reference limit reached')
    if state in {'open', 'reviewing'} and 'verification' not in body:
        meta.pop('verification', None)
    if state == 'resolved':
        if not proof['complete'] or proof['missing']:
            raise ValueError('Source evidence incomplete; cannot confirm remediation')
        verification = meta.get('verification')
        if not verification or verification['result'] != 'passed':
            raise ValueError('Recorded passing verification required before resolution')
        # Validate again when closing with a previously recorded test result.
        if not direct or any(resolve(ref)['occurredAt'] <= max(e['occurredAt'] for e in direct) or resolve(ref)['occurredAt'] > now or resolve(ref)['decision'] != verification['expectedDecision'] or EXECUTION_EVENT.match(resolve(ref)['type']) or not anchor or resolve(ref)['userId'] != anchor['user_id'] for ref in verification['evidenceRefs']):
            raise ValueError('Verification is stale')
        for ref in meta.get('actionRefs', []):
            action = resolve(ref)
            if action['type'] in {'REMEDIATION_PARTIAL', 'ACCOUNT_CHANGE_PARTIAL'} or any(resolve(test)['occurredAt'] < action['occurredAt'] for test in verification['evidenceRefs']):
                raise ValueError('Execution is partial or verification predates it')
    if state == 'false_positive' and (not meta.get('assessment') or meta['assessment']['confidence'] == 'hypothesis' or not meta['assessment']['evidenceRefs']):
        raise ValueError('Evidence-backed assessment required')
    for ref, item in available.items():
        if item['relation'] != 'direct':
            db.execute("INSERT INTO incident_evidence(incident_id,event_ref,event_id,relation) VALUES(%s,%s,%s,'investigation') ON CONFLICT DO NOTHING", (row['id'], ref[6:], ref[6:]))
    changed = db.execute('UPDATE audit_incidents SET state=%s,version=version+1,updated_at=now(),investigation=%s WHERE id=%s AND version=%s RETURNING version', (state, Jsonb(meta), row['id'], row['version'])).fetchone()
    if not changed:
        raise FileExistsError('Incident version conflict')
    operation(db, body, 'INCIDENT_REVIEW', {'id': row['id'], 'state': state, 'version': changed['version'], 'requestId': request_id})
    db.execute('INSERT INTO incident_history(incident_id,actor,state,note,version,request_id,change) VALUES(%s,%s,%s,%s,%s,%s,%s)',
               (row['id'], actor, state, note, changed['version'], request_id, Jsonb({'before': dict(state=row['state'], investigation=before), 'after': dict(state=state, investigation=meta)})))
    return {'message': 'Đã lưu điều tra. Không thực hiện hành động lên tài khoản.', 'version': changed['version']}


def api(db, method, path, q, body, operation):
    if method == 'GET':
        db.execute('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY')
    if path == '/incidents' and method == 'GET':
        return list_incidents(db, q)
    if not re.fullmatch(r'/incidents/[a-f0-9]{64}', path):
        raise LookupError('Unknown incident endpoint')
    key = path.rsplit('/', 1)[1]
    if method == 'GET':
        row = get_incident(db, key)
        view = detail(db, row, q)
        return {'incident': row, 'history': view['history']['items'], 'detail': view}
    if method == 'POST':
        return review(db, key, body, operation)
    raise LookupError('Unknown incident endpoint')
