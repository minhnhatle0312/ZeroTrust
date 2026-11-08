"""Private audit API. Browser access must pass the existing Node authorization layer."""
import hashlib
import hmac
import json
import os
import re
import threading
from datetime import datetime, timedelta, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlsplit, unquote

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

TOKEN = os.environ.get('AUDIT_SERVICE_TOKEN', '')
SOURCES = {'web-a', 'web-b', 'api', 'keycloak', 'keycloak-admin'}
LIMIT = 2 * 1024 * 1024
GATE = threading.BoundedSemaphore(12)


def connect():
    return psycopg.connect(connect_timeout=5, row_factory=dict_row,
                          options='-c statement_timeout=10000 -c lock_timeout=3000')


def stamp(value):
    result = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('Timezone required')
    return result.astimezone(timezone.utc)


def short(value, size=180):
    if value is None:
        return None
    if not isinstance(value, str) or len(value) > size or any(ord(c) < 32 for c in value):
        raise ValueError('Invalid text')
    return value


def normalize(row):
    source = row.get('source')
    decision = row.get('decision')
    if source not in SOURCES or decision not in {'ALLOW', 'DENY', 'UNKNOWN'}:
        raise ValueError('Invalid source or decision')
    event_id = short(row.get('event_id'), 240)
    action = short(row.get('action'), 100)
    if not event_id or not action:
        raise ValueError('Missing event identity')
    status = row.get('http_status')
    if status is not None and (type(status) is not int or not 100 <= status <= 599):
        raise ValueError('Invalid HTTP status')
    # Explicit allowlist: arbitrary payloads, headers and credential fields never enter storage.
    details = row.get('details') or {}
    if not isinstance(details, dict):
        raise ValueError('Invalid details')
    safe = {key: short(details[key], 180) for key in ('role', 'method', 'error', 'resource_type') if key in details}
    return (event_id, stamp(row['timestamp']), source, short(row.get('user_id')),
            short(row.get('username')), short(row.get('client_id')), short(row.get('session_id')),
            action, short(row.get('resource'), 300), decision, status,
            short(row.get('ip_address'), 80), short(row.get('request_id')), Jsonb(safe))


def query_filter(q):
    end = stamp(q.get('to', datetime.now(timezone.utc).isoformat()))
    start = stamp(q.get('from', (end - timedelta(days=7)).isoformat()))
    if start > end or end - start > timedelta(days=93):
        raise ValueError('Choose a time window of at most 93 days')
    parts, args = ['timestamp >= %s', 'timestamp <= %s'], [start, end]
    for key in ('source', 'decision', 'user_id', 'request_id', 'session_id', 'client_id', 'action'):
        if q.get(key):
            parts.append(key + '=%s')
            args.append(short(q[key], 180))
    if q.get('q'):
        parts.append('(strpos(lower(coalesce(username,\'\')),lower(%s))>0 OR strpos(lower(action),lower(%s))>0 OR strpos(lower(coalesce(resource,\'\')),lower(%s))>0)')
        args.extend([short(q['q'], 100)] * 3)
    return ' AND '.join(parts), args


def incident(db, event_id, rule, severity, summary):
    key = hashlib.sha256((rule + ':' + event_id).encode()).hexdigest()
    db.execute('INSERT INTO audit_incidents(id,event_id,rule,severity,summary) VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING',
               (key, event_id, rule, severity, summary))


def rules(db, row, settings):
    user, ip = row.get('user_id'), row.get('ip_address')
    if row['action'] in {'SESSION_REVOKED', 'INSUFFICIENT_ROLE', 'DASHBOARD_ACCESS_DENIED'}:
        incident(db, row['event_id'], row['action'], 'high', 'Access policy rejected this request; investigate the event context.')
    if not user and not ip:
        return
    # User preferred, IP fallback; never group every anonymous user into one identity.
    field, value = ('user_id', user) if user else ('ip_address', ip)
    end = stamp(row['timestamp'])
    for name, condition, threshold in (
        ('LOGIN_FAILURE_BURST', "action='LOGIN_ERROR'", settings['login_threshold']),
        ('DENY_BURST', "decision='DENY'", settings['deny_threshold']),
    ):
        count = db.execute('SELECT count(*) AS n FROM audit_events WHERE ' + field + '=%s AND timestamp BETWEEN %s AND %s AND ' + condition,
                           (value, end - timedelta(minutes=5), end)).fetchone()['n']
        if count >= threshold:
            # One incident per rule/identity/5-minute bucket, even after replay.
            bucket = str(int(end.timestamp()) // 300)
            key = hashlib.sha256((name + ':' + field + ':' + value + ':' + bucket).encode()).hexdigest()
            db.execute('INSERT INTO audit_incidents(id,event_id,rule,severity,summary) VALUES(%s,%s,%s,%s,%s) ON CONFLICT DO NOTHING',
                       (key, row['event_id'], name, 'medium', str(count) + ' events within five minutes; review before taking action.'))


def operation(db, body, action, details):
    actor = short(body.get('actor'), 180)
    if not actor:
        raise ValueError('Actor required')
    db.execute('INSERT INTO audit_operations(actor,action,details) VALUES(%s,%s,%s)', (actor, action, Jsonb(details)))
    return actor


def dispatch(method, path, q, body):
    with connect() as db:
        if path.startswith('/detection/'):
            from detection_api import api
            return api(db, method, path, q, body, operation)
        if method == 'GET' and path == '/health':
            return {'connected': True, 'storage': 'PostgreSQL', 'lastReceived': db.execute('SELECT max(received_at) AS t FROM audit_events').fetchone()['t'],
                    'settings': db.execute('SELECT * FROM audit_settings WHERE id=1').fetchone()}
        if method == 'POST' and path == '/ingest':
            rows = body.get('events')
            if not isinstance(rows, list) or not 1 <= len(rows) <= 200:
                raise ValueError('Batch must contain 1 to 200 events')
            settings = db.execute('SELECT * FROM audit_settings WHERE id=1').fetchone()
            # Serial ingestion makes threshold evaluation deterministic across callers.
            db.execute('SELECT pg_advisory_xact_lock(81008)')
            inserted = 0
            for row in rows:
                values = normalize(row)
                created = db.execute('''INSERT INTO audit_events(event_id,timestamp,source,user_id,username,client_id,session_id,action,resource,decision,http_status,ip_address,request_id,details)
                    VALUES(%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s) ON CONFLICT(event_id) DO NOTHING RETURNING event_id''', values).fetchone()
                if created:
                    inserted += 1
                    rules(db, row, settings)
            return {'accepted': len(rows), 'inserted': inserted}
        if method == 'GET' and path == '/events':
            where, args = query_filter(q)
            size = min(5000, max(1, int(q.get('limit', 25))))
            offset = max(0, int(q.get('offset', 0)))
            if offset > 1000000:
                raise ValueError('Narrow the time window')
            total = db.execute('SELECT count(*) AS n FROM audit_events WHERE ' + where, args).fetchone()['n']
            rows = db.execute('SELECT * FROM audit_events WHERE ' + where + ' ORDER BY timestamp DESC,seq DESC LIMIT %s OFFSET %s', args + [size, offset]).fetchall()
            return {'rows': rows, 'total': total, 'complete': offset + len(rows) >= total}
        if method == 'GET' and path.startswith('/events/'):
            key = unquote(path[len('/events/'):])
            row = db.execute('SELECT * FROM audit_events WHERE event_id=%s', (key,)).fetchone()
            if not row:
                raise LookupError('Event no longer available')
            related = db.execute('''SELECT * FROM audit_events WHERE event_id<>%s AND
                ((request_id IS NOT NULL AND request_id=%s) OR (session_id IS NOT NULL AND session_id=%s))
                ORDER BY timestamp,seq LIMIT 101''', (key, row['request_id'], row['session_id'])).fetchall()
            return {'event': row, 'related': related[:100], 'complete': len(related) <= 100}
        if method == 'GET' and path == '/summary':
            where, args = query_filter(q)
            daily = db.execute("SELECT date_trunc('day',timestamp AT TIME ZONE 'Asia/Ho_Chi_Minh') AS day,decision,count(*) AS count FROM audit_events WHERE " + where + ' GROUP BY 1,2 ORDER BY 1,2', args).fetchall()
            top = db.execute("SELECT user_id,username,count(*) AS count FROM audit_events WHERE " + where + " AND action='LOGIN_ERROR' GROUP BY user_id,username ORDER BY count(*) DESC LIMIT 10", args).fetchall()
            sources = db.execute('SELECT source,count(*) AS count FROM audit_events WHERE ' + where + ' GROUP BY source', args).fetchall()
            return {'daily': daily, 'topFailures': top, 'sources': sources}
        if method == 'GET' and path == '/incidents':
            state = q.get('state', 'open')
            if state not in {'open', 'reviewing', 'resolved', 'false_positive'}:
                raise ValueError('Invalid incident state')
            offset = max(0, min(1000000, int(q.get('offset', 0))))
            rows = db.execute('SELECT * FROM audit_incidents WHERE state=%s ORDER BY created_at DESC,id LIMIT 25 OFFSET %s', (state, offset)).fetchall()
            return {'rows': rows, 'total': db.execute('SELECT count(*) AS n FROM audit_incidents WHERE state=%s', (state,)).fetchone()['n']}
        if re.fullmatch(r'/incidents/[a-f0-9]{64}', path):
            key = path.rsplit('/', 1)[1]
            if method == 'GET':
                return {'incident': db.execute('SELECT * FROM audit_incidents WHERE id=%s', (key,)).fetchone(),
                        'history': db.execute('SELECT * FROM incident_history WHERE incident_id=%s ORDER BY id DESC LIMIT 100', (key,)).fetchall()}
            if method == 'POST':
                state, note = body.get('state'), short(body.get('note'), 500)
                if state not in {'open', 'reviewing', 'resolved', 'false_positive'} or not note or len(note.strip()) < 10:
                    raise ValueError('State and a note of 10 to 500 characters are required')
                actor = operation(db, body, 'INCIDENT_REVIEW', {'id': key, 'state': state})
                result = db.execute('UPDATE audit_incidents SET state=%s,version=version+1,updated_at=now() WHERE id=%s AND version=%s RETURNING id', (state, key, int(body['version']))).fetchone()
                if not result:
                    raise FileExistsError('Incident changed; reload before reviewing')
                db.execute('INSERT INTO incident_history(incident_id,actor,state,note) VALUES(%s,%s,%s,%s)', (key, actor, state, note))
                return {'message': 'Đã lưu kết luận điều tra.'}
        if method == 'POST' and path == '/settings':
            days, login, deny = (body.get(k) for k in ('retention_days', 'login_threshold', 'deny_threshold'))
            if any(type(v) is not int for v in (days, login, deny)) or not 0 <= days <= 3650 or not 2 <= login <= 1000 or not 2 <= deny <= 1000:
                raise ValueError('Invalid retention or thresholds')
            operation(db, body, 'SETTINGS', {k: body[k] for k in ('retention_days', 'login_threshold', 'deny_threshold')})
            db.execute('UPDATE audit_settings SET retention_days=%s,login_threshold=%s,deny_threshold=%s WHERE id=1', (days, login, deny))
            return {'message': 'Đã lưu. Dọn dữ liệu chỉ chạy khi quản trị viên yêu cầu riêng.'}
        if method == 'POST' and path == '/retention':
            days = db.execute('SELECT retention_days FROM audit_settings WHERE id=1').fetchone()['retention_days']
            if days == 0:
                raise ValueError('Retention is disabled')
            cutoff = datetime.now(timezone.utc) - timedelta(days=days)
            eligible = "timestamp<%s AND NOT EXISTS(SELECT 1 FROM audit_incidents i WHERE i.event_id=audit_events.event_id AND i.state IN ('open','reviewing'))"
            count = db.execute('SELECT count(*) AS n FROM audit_events WHERE ' + eligible, (cutoff,)).fetchone()['n']
            if body.get('apply') is True:
                if body.get('confirm') != 'DELETE_EXPIRED_AUDIT':
                    raise ValueError('Explicit confirmation required')
                operation(db, body, 'RETENTION', {'cutoff': cutoff.isoformat(), 'eligible': count})
                count = db.execute('DELETE FROM audit_events WHERE ' + eligible, (cutoff,)).rowcount
            return {'count': count, 'cutoff': cutoff, 'applied': body.get('apply') is True}
        if method == 'GET' and path == '/operations':
            return {'rows': db.execute('SELECT * FROM audit_operations ORDER BY id DESC LIMIT 100').fetchall()}
    raise LookupError('Unknown endpoint')


class Handler(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass  # Never echo credentials, URLs or bodies into container logs.

    def setup(self):
        super().setup()
        self.connection.settimeout(15)

    def reply(self, status, value):
        raw = json.dumps(value, default=lambda v: v.isoformat() if isinstance(v, datetime) else str(v), ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(raw)))
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Connection', 'close')
        self.end_headers()
        self.wfile.write(raw)

    def handle_api(self):
        if not hmac.compare_digest(self.headers.get('Authorization', '').encode('utf-8'), ('Bearer ' + TOKEN).encode('utf-8')):
            self.reply(401, {'message': 'Unauthorized'})
            return
        if not GATE.acquire(blocking=False):
            self.reply(503, {'message': 'Audit service busy'})
            return
        try:
            size = int(self.headers.get('Content-Length', 0))
            if size < 0 or size > LIMIT or self.headers.get('Transfer-Encoding'):
                raise ValueError('Invalid request size')
            body = json.loads(self.rfile.read(size)) if size else {}
            if not isinstance(body, dict):
                raise ValueError('Object required')
            parsed = urlsplit(self.path)
            q = {k: v[-1] for k, v in parse_qs(parsed.query).items()}
            self.reply(200, dispatch(self.command, parsed.path, q, body))
        except (ValueError, TypeError, KeyError):
            self.reply(400, {'message': 'Tham số không hợp lệ. Kiểm tra bộ lọc, thời gian và nội dung.'})
        except LookupError:
            self.reply(404, {'message': 'Không tìm thấy bản ghi.'})
        except FileExistsError:
            self.reply(409, {'message': 'Dữ liệu vừa thay đổi. Hãy tải lại.'})
        except Exception:
            self.reply(503, {'message': 'Dịch vụ Audit PostgreSQL chưa sẵn sàng.'})
        finally:
            GATE.release()

    do_GET = handle_api
    do_POST = handle_api


if __name__ == '__main__':
    if len(TOKEN) < 40:
        raise SystemExit('Configure a private audit service token of at least 40 characters')
    with connect() as connection:
        connection.execute(Path(__file__).with_name('schema.sql').read_text(encoding='utf-8'))
    from detection_api import work
    threading.Thread(target=work, args=(connect, incident), daemon=True).start()
    ThreadingHTTPServer(('0.0.0.0', 8090), Handler).serve_forever()
