"""Week 9 regression cases; authored, NOT RUN during source-only implementation."""
import sys
import unittest
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'audit'))
from detection import classify, metrics


class DetectionRegression(unittest.TestCase):
    def setUp(self):
        self.config = dict(login_threshold=5, deny_threshold=10, request_threshold=100, business_start=7, business_end=19, utc_offset=7)
        self.event = dict(timestamp=datetime(2026, 11, 6, 3, tzinfo=timezone.utc), source='web-a', user_id='employee-1', action='AUTHORIZED', decision='ALLOW', ip_address='10.0.0.1', resource='/api/profile', details={'role': 'employee'})
        self.features = dict(login_failures_5m=0, consecutive_denies=0, requests_5m=1, baseline_5m=1, prior_user_events=10, known_ip=True)

    def test_normal_workday(self):
        self.assertEqual(classify(self.event, self.features, self.config)['prediction'], 'Normal')

    def test_login_threshold_boundary(self):
        self.event.update(action='LOGIN_ERROR', decision='DENY')
        self.features['login_failures_5m'] = 4
        self.assertNotIn('LOGIN_FAILURE_BURST', classify(self.event, self.features, self.config)['rules'])
        self.features['login_failures_5m'] = 5
        self.assertIn('LOGIN_FAILURE_BURST', classify(self.event, self.features, self.config)['rules'])

    def test_new_ip_is_signal_not_account_block(self):
        self.features['known_ip'] = False
        result = classify(self.event, self.features, self.config)
        self.assertIn('NEW_IP_REVIEW', result['rules'])
        self.assertNotIn('block', result)

    def test_employee_admin_attempt(self):
        self.event.update(resource='/api/admin/users', action='INSUFFICIENT_ROLE', decision='DENY')
        self.assertIn('EMPLOYEE_ADMIN_ACCESS', classify(self.event, self.features, self.config)['rules'])

    def test_confusion_matrix_with_false_results(self):
        rows = [{'label': a, 'prediction': b} for a, b in [('Anomaly','Anomaly'),('Normal','Anomaly'),('Normal','Normal'),('Anomaly','Normal')]]
        result = metrics(rows)
        self.assertEqual([result[k] for k in ('tp','fp','tn','fn')], [1,1,1,1])
        self.assertEqual(result['f1'], .5)
        self.assertEqual(result['false_positive_rate'], .5)

    def test_empty_metrics_are_unknown(self):
        self.assertIsNone(metrics([])['precision'])
        self.assertIsNone(metrics([])['latency_p95_ms'])

    def test_undefined_precision_is_not_perfect(self):
        result = metrics([{'label':'Normal','prediction':'Normal'}])
        self.assertIsNone(result['precision'])
        self.assertEqual(result['false_positive_rate'], 0)


if __name__ == '__main__':
    unittest.main()
