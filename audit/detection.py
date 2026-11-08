"""Explainable baseline. Signals require investigation; no automatic account blocking."""
from datetime import timedelta, timezone
import math

RULE_VERSION = 'rules-v1'


def classify(event, features, config):
    reasons = []
    action, decision = event['action'], event['decision']
    if action == 'LOGIN_ERROR' and features['login_failures_5m'] >= config['login_threshold']:
        reasons.append('LOGIN_FAILURE_BURST')
    if features['consecutive_denies'] >= config['deny_threshold'] and decision == 'DENY':
        reasons.append('CONSECUTIVE_DENY')
    if decision == 'DENY' and (event.get('details') or {}).get('role') == 'employee' and (
        (event.get('resource') or '').startswith(('/api/admin', '/api/security')) or action == 'DASHBOARD_ACCESS_DENIED'
    ):
        reasons.append('EMPLOYEE_ADMIN_ACCESS')
    if action == 'SESSION_REVOKED':
        reasons.append('REVOKED_TOKEN_REUSE')
    if features['prior_user_events'] >= 5 and event.get('ip_address') and not features['known_ip']:
        reasons.append('NEW_IP_REVIEW')
    local_hour = (event['timestamp'].astimezone(timezone.utc).hour + config['utc_offset']) % 24
    if event.get('user_id') and event['source'] != 'keycloak-admin' and not config['business_start'] <= local_hour < config['business_end']:
        reasons.append('OUTSIDE_BUSINESS_HOURS')
    if features['requests_5m'] >= max(config['request_threshold'], features['baseline_5m'] * 3):
        reasons.append('REQUEST_SPIKE')
    return {'prediction': 'Anomaly' if reasons else 'Normal', 'rules': reasons,
            'features': {**features, 'local_hour': local_hour, 'rule_version': RULE_VERSION}}


def extract(db, event):
    identity = event.get('user_id') or event.get('ip_address')
    empty = {'login_failures_5m': 0, 'requests_5m': 0, 'consecutive_denies': 0,
             'baseline_5m': 0, 'prior_user_events': 0, 'known_ip': False, 'identity_basis': 'unknown'}
    if not identity:
        return empty
    field = 'user_id' if event.get('user_id') else 'ip_address'
    end, seq = event['timestamp'], event['seq']
    # Event-time and stable seq ties; include rows with smaller timestamps even if ingested later.
    counts = db.execute('''SELECT count(*) FILTER(WHERE action='LOGIN_ERROR') AS failures,
        count(*) FILTER(WHERE source IN ('web-a','web-b','api')) AS requests
        FROM audit_events WHERE ''' + field + '''=%s AND timestamp >= %s AND (timestamp,seq)<= (%s,%s)''',
        (identity, end - timedelta(minutes=5), end, seq)).fetchone()
    recent = db.execute('SELECT decision FROM audit_events WHERE ' + field + '=%s AND timestamp >= %s AND (timestamp,seq)<= (%s,%s) ORDER BY timestamp DESC,seq DESC LIMIT 1000',
                        (identity, end - timedelta(minutes=5), end, seq)).fetchall()
    consecutive = 0
    for row in recent:
        if row['decision'] != 'DENY':
            break
        consecutive += 1
    baseline = db.execute("SELECT count(*) AS n FROM audit_events WHERE " + field + "=%s AND timestamp >= %s AND timestamp < %s AND source IN ('web-a','web-b','api')",
                          (identity, end - timedelta(minutes=65), end - timedelta(minutes=5))).fetchone()['n'] / 12
    prior = {'n': 0, 'known': False}
    if event.get('user_id'):
        prior = db.execute('''SELECT count(*) AS n,coalesce(bool_or(ip_address=%s),false) AS known
            FROM audit_events WHERE user_id=%s AND timestamp>=%s AND (timestamp,seq)<(%s,%s)''',
            (event.get('ip_address'), identity, end - timedelta(days=30), end, seq)).fetchone()
    return {'login_failures_5m': counts['failures'], 'requests_5m': counts['requests'],
            'consecutive_denies': consecutive, 'baseline_5m': baseline,
            'prior_user_events': prior['n'], 'known_ip': prior['known'], 'identity_basis': field}


def metrics(rows):
    matrix = {'tp': 0, 'fp': 0, 'tn': 0, 'fn': 0}
    latencies = []
    for row in rows:
        if row['label'] not in {'Normal', 'Anomaly'} or row['prediction'] not in {'Normal', 'Anomaly'}:
            raise ValueError('Unknown label or prediction')
        truth, predicted = row['label'] == 'Anomaly', row['prediction'] == 'Anomaly'
        matrix['tp' if truth and predicted else 'fn' if truth else 'fp' if predicted else 'tn'] += 1
        latency = row.get('latency_ms')
        if latency is not None and math.isfinite(float(latency)) and float(latency) >= 0:
            latencies.append(float(latency))
    tp, fp, tn, fn = (matrix[k] for k in ('tp', 'fp', 'tn', 'fn'))
    ratio = lambda n, d: n / d if d else None
    latencies.sort()
    return {**matrix, 'precision': ratio(tp, tp + fp), 'recall': ratio(tp, tp + fn),
            'f1': ratio(2 * tp, 2 * tp + fp + fn), 'false_positive_rate': ratio(fp, fp + tn),
            'sample_count': len(rows), 'latency_mean_ms': ratio(sum(latencies), len(latencies)),
            'latency_p95_ms': latencies[max(0, math.ceil(len(latencies) * .95) - 1)] if latencies else None,
            'limitations': 'Human labels required; signals are not proof of attack. Latency includes collection/backfill delays.'}
