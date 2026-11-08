import hashlib
import json
import time
import uuid
from datetime import datetime, timezone
from urllib.parse import unquote

from psycopg.types.json import Jsonb
from detection import classify, extract, metrics, RULE_VERSION


def enqueue(db, actor):
    config = db.execute('SELECT * FROM detection_config WHERE id=1').fetchone()
    key = str(uuid.uuid4())
    created = db.execute('INSERT INTO detection_runs(id,actor,config) VALUES(%s,%s,%s) ON CONFLICT DO NOTHING RETURNING id', (key, actor, Jsonb(config))).fetchone()
    if not created:
        raise FileExistsError('A detection run is already active')
    return {'id': key, 'state': 'queued', 'message': 'Đã xếp hàng phân tích; chưa phải kết quả hoàn tất.'}


def api(db, method, path, q, body, operation):
    offset = max(0, min(1000000, int(q.get('offset', 0))))
    if method == 'GET' and path == '/detection/status':
        return {'config': db.execute('SELECT * FROM detection_config WHERE id=1').fetchone(),
                'state': db.execute('SELECT * FROM detection_state WHERE id=1').fetchone(),
                'pending': db.execute('SELECT count(*) AS n FROM audit_events WHERE seq>(SELECT checkpoint FROM detection_state WHERE id=1)').fetchone()['n'],
                'ruleVersion': RULE_VERSION,
                'runs': db.execute('SELECT * FROM detection_runs ORDER BY created_at DESC LIMIT 20').fetchall()}
    if method == 'POST' and path == '/detection/run':
        actor = operation(db, body, 'DETECTION_RUN', {})
        return enqueue(db, actor)
    if method == 'POST' and path == '/detection/config':
        config = body.get('config')
        keys = {'enabled', 'login_threshold', 'deny_threshold', 'request_threshold', 'business_start', 'business_end', 'utc_offset'}
        if not isinstance(config, dict) or set(config) != keys or type(config['enabled']) is not bool:
            raise ValueError('Invalid configuration')
        if any(type(config[k]) is not int for k in keys - {'enabled'}):
            raise ValueError('Integers required')
        if not 2 <= config['login_threshold'] <= 1000 or not 2 <= config['deny_threshold'] <= 1000 or not 10 <= config['request_threshold'] <= 10000:
            raise ValueError('Invalid thresholds')
        if not 0 <= config['business_start'] < config['business_end'] <= 24 or not -12 <= config['utc_offset'] <= 14:
            raise ValueError('Invalid business hours')
        operation(db, body, 'DETECTION_CONFIG', config)
        updated = db.execute('''UPDATE detection_config SET enabled=%s,login_threshold=%s,deny_threshold=%s,request_threshold=%s,
            business_start=%s,business_end=%s,utc_offset=%s,version=version+1 WHERE id=1 AND version=%s RETURNING version''',
            tuple(config[k] for k in ('enabled','login_threshold','deny_threshold','request_threshold','business_start','business_end','utc_offset')) + (int(body['version']),)).fetchone()
        if not updated:
            raise FileExistsError('Configuration changed')
        return {'message': 'Đã lưu cấu hình; chỉ áp dụng cho các lượt phân tích mới.', **updated}
    if method == 'GET' and path == '/detection/results':
        prediction = q.get('prediction', '')
        if prediction not in {'', 'Normal', 'Anomaly'}:
            raise ValueError('Invalid prediction')
        where, args = ('WHERE r.prediction=%s', [prediction]) if prediction else ('', [])
        total = db.execute('SELECT count(*) AS n FROM detection_results r ' + where, args).fetchone()['n']
        rows = db.execute('''SELECT r.*,e.timestamp,e.user_id,e.username,e.action,e.ip_address,l.label,l.note,l.scenario,l.split,l.version AS label_version
            FROM detection_results r JOIN audit_events e USING(event_id) LEFT JOIN detection_labels l USING(event_id) ''' + where +
            ' ORDER BY r.detected_at DESC,r.event_id LIMIT 25 OFFSET %s', args + [offset]).fetchall()
        return {'rows': rows, 'total': total}
    if method == 'POST' and path.startswith('/detection/labels/'):
        key = unquote(path[len('/detection/labels/'):])
        label, split, note, scenario = (body.get(k) for k in ('label', 'split', 'note', 'scenario'))
        if label not in {'Normal', 'Anomaly'} or split not in {'train', 'evaluation'} or not isinstance(note, str) or not 10 <= len(note.strip()) <= 500 or not isinstance(scenario, str) or not 3 <= len(scenario) <= 100:
            raise ValueError('Independent reviewer label, note and scenario are required')
        # Same scenario cannot be divided across training and evaluation.
        db.execute('SELECT pg_advisory_xact_lock(91009)')
        if db.execute('SELECT 1 FROM detection_labels WHERE scenario=%s AND split<>%s AND event_id<>%s', (scenario, split, key)).fetchone():
            raise ValueError('Scenario leakage between splits')
        if not db.execute('SELECT 1 FROM detection_results WHERE event_id=%s', (key,)).fetchone():
            raise LookupError('Result not available')
        actor = operation(db, body, 'DETECTION_LABEL', {'event_id': key, 'label': label, 'scenario': scenario, 'split': split})
        old = db.execute('SELECT version FROM detection_labels WHERE event_id=%s FOR UPDATE', (key,)).fetchone()
        if int(body.get('version', 0)) != (old['version'] if old else 0):
            raise FileExistsError('Label changed')
        db.execute('''INSERT INTO detection_labels(event_id,label,reviewer,note,scenario,split) VALUES(%s,%s,%s,%s,%s,%s)
            ON CONFLICT(event_id) DO UPDATE SET label=EXCLUDED.label,reviewer=EXCLUDED.reviewer,note=EXCLUDED.note,
            scenario=EXCLUDED.scenario,split=EXCLUDED.split,version=detection_labels.version+1,created_at=now()''', (key, label, actor, note, scenario, split))
        return {'message': 'Đã lưu nhãn đánh giá độc lập.'}
    if method == 'POST' and path == '/detection/evaluate':
        actor = operation(db, body, 'DETECTION_EVALUATE', {})
        rows = db.execute('''SELECT l.event_id,l.label,l.scenario,l.version AS label_version,r.prediction,r.rules,r.features,r.version AS config_version,r.latency_ms
            FROM detection_labels l JOIN detection_results r USING(event_id) WHERE l.split='evaluation' ORDER BY l.event_id LIMIT 50001''').fetchall()
        if not rows or len(rows) > 50000:
            raise ValueError('Evaluation needs 1 to 50000 human-labeled results')
        report = metrics(rows)
        report['rule_version'] = RULE_VERSION
        report['config_versions'] = sorted({r['config_version'] for r in rows})
        report['class_coverage'] = len({r['label'] for r in rows}) == 2
        report['warning'] = 'Tập nhỏ hoặc thiếu lớp; chưa đủ cơ sở nghiệm thu.' if len(rows) < 20 or not report['class_coverage'] else 'Nhãn được người dùng nhập; cần đối chiếu kịch bản và tính độc lập trước khi kết luận.'
        digest = hashlib.sha256(json.dumps(rows, sort_keys=True, default=str).encode()).hexdigest()
        key = str(uuid.uuid4())
        db.execute('INSERT INTO detection_evaluations(id,actor,metrics,dataset_hash,sample_count,dataset) VALUES(%s,%s,%s,%s,%s,%s)', (key, actor, Jsonb(report), digest, len(rows), Jsonb(rows)))
        return {'id': key, 'metrics': report, 'dataset_hash': digest}
    if method == 'GET' and path == '/detection/evaluations':
        return {'rows': db.execute('SELECT id,actor,created_at,metrics,dataset_hash,sample_count FROM detection_evaluations ORDER BY created_at DESC LIMIT 50').fetchall()}
    if method == 'GET' and path.startswith('/detection/evaluations/'):
        row = db.execute('SELECT * FROM detection_evaluations WHERE id=%s', (path.rsplit('/', 1)[1],)).fetchone()
        if not row:
            raise LookupError('Evaluation not found')
        return row
    raise LookupError('Unknown detection endpoint')


def work(connect, incident):
    """One service worker; checkpoint/results committed atomically, <= 200 events per job."""
    last_auto = 0
    while True:
        job_id = None
        try:
            with connect() as db:
                if not db.execute('SELECT pg_try_advisory_xact_lock(91010) AS locked').fetchone()['locked']:
                    continue
                config = db.execute('SELECT * FROM detection_config WHERE id=1').fetchone()
                if config['enabled'] and time.monotonic() - last_auto >= 30:
                    if not db.execute("SELECT 1 FROM detection_runs WHERE state IN ('queued','running')").fetchone():
                        enqueue(db, 'scheduler')
                    last_auto = time.monotonic()
                job = db.execute("SELECT * FROM detection_runs WHERE state='queued' ORDER BY created_at LIMIT 1 FOR UPDATE").fetchone()
                if job:
                    job_id = job['id']
                    started = time.monotonic()
                    db.execute("UPDATE detection_runs SET state='running' WHERE id=%s", (job_id,))
                    cursor = db.execute('SELECT checkpoint FROM detection_state WHERE id=1 FOR UPDATE').fetchone()['checkpoint']
                    rows = db.execute('SELECT * FROM audit_events WHERE seq>%s ORDER BY seq LIMIT 200', (cursor,)).fetchall()
                    anomalies = 0
                    for row in rows:
                        result = classify(row, extract(db, row), job['config'])
                        latency = max(0, (datetime.now(timezone.utc) - row['timestamp']).total_seconds() * 1000)
                        db.execute('''INSERT INTO detection_results(event_id,run_id,prediction,rules,features,latency_ms,version)
                            VALUES(%s,%s,%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING''',
                            (row['event_id'], job_id, result['prediction'], Jsonb(result['rules']), Jsonb(result['features']), latency, job['config']['version']))
                        if result['prediction'] == 'Anomaly':
                            anomalies += 1
                            incident(db, row['event_id'], 'PYTHON_BASELINE', 'medium', ', '.join(result['rules']))
                    if rows:
                        cursor = rows[-1]['seq']
                    db.execute('UPDATE detection_state SET checkpoint=%s,last_success=now(),last_error=NULL WHERE id=1', (cursor,))
                    db.execute("UPDATE detection_runs SET state='completed',processed=%s,anomalies=%s,processing_ms=%s,finished_at=now(),message=%s WHERE id=%s",
                               (len(rows), anomalies, (time.monotonic() - started) * 1000, 'Batch completed; remaining events are shown as pending.', job_id))
        except Exception:
            # Failed transaction leaves its checkpoint unchanged; a new job retries those events.
            try:
                with connect() as db:
                    db.execute("UPDATE detection_state SET last_error='Python detection unavailable; checkpoint retained.' WHERE id=1")
                    if job_id:
                        db.execute("UPDATE detection_runs SET state='failed',finished_at=now(),message='Batch rolled back; request another run.' WHERE id=%s", (job_id,))
            except Exception:
                pass
        finally:
            time.sleep(5)
