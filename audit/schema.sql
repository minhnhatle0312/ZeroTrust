CREATE TABLE IF NOT EXISTS audit_events (
  seq BIGSERIAL UNIQUE NOT NULL,
  event_id TEXT PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  source TEXT NOT NULL,
  user_id TEXT, username TEXT, client_id TEXT, session_id TEXT,
  action TEXT NOT NULL, resource TEXT, decision TEXT NOT NULL,
  http_status INTEGER, ip_address TEXT, request_id TEXT,
  details JSONB NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS audit_time ON audit_events(timestamp DESC,seq DESC);
CREATE INDEX IF NOT EXISTS audit_user ON audit_events(user_id,timestamp);
CREATE INDEX IF NOT EXISTS audit_request ON audit_events(request_id);
CREATE INDEX IF NOT EXISTS audit_session ON audit_events(session_id);
CREATE TABLE IF NOT EXISTS audit_incidents (
  id TEXT PRIMARY KEY, event_id TEXT REFERENCES audit_events(event_id) ON DELETE SET NULL,
  rule TEXT NOT NULL, severity TEXT NOT NULL, summary TEXT NOT NULL,
  state TEXT NOT NULL DEFAULT 'open', version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS incident_history (
  id BIGSERIAL PRIMARY KEY, incident_id TEXT NOT NULL REFERENCES audit_incidents(id),
  actor TEXT NOT NULL, state TEXT NOT NULL, note TEXT NOT NULL, time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS audit_settings (
  id INTEGER PRIMARY KEY CHECK(id=1), retention_days INTEGER NOT NULL DEFAULT 0,
  login_threshold INTEGER NOT NULL DEFAULT 5, deny_threshold INTEGER NOT NULL DEFAULT 10
);
INSERT INTO audit_settings(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS audit_operations (
  id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
  details JSONB NOT NULL, time TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS detection_config (
  id INTEGER PRIMARY KEY CHECK(id=1), version INTEGER NOT NULL DEFAULT 1,
  enabled BOOLEAN NOT NULL DEFAULT false, login_threshold INTEGER NOT NULL DEFAULT 5,
  deny_threshold INTEGER NOT NULL DEFAULT 10, request_threshold INTEGER NOT NULL DEFAULT 100,
  business_start INTEGER NOT NULL DEFAULT 7, business_end INTEGER NOT NULL DEFAULT 19,
  utc_offset INTEGER NOT NULL DEFAULT 7
);
INSERT INTO detection_config(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS detection_state (
  id INTEGER PRIMARY KEY CHECK(id=1), checkpoint BIGINT NOT NULL DEFAULT 0,
  last_success TIMESTAMPTZ,last_error TEXT
);
INSERT INTO detection_state(id) VALUES(1) ON CONFLICT DO NOTHING;
CREATE TABLE IF NOT EXISTS detection_runs (
  id TEXT PRIMARY KEY, actor TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), finished_at TIMESTAMPTZ,
  processed INTEGER NOT NULL DEFAULT 0, anomalies INTEGER NOT NULL DEFAULT 0,
  processing_ms DOUBLE PRECISION, config JSONB NOT NULL, message TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS detection_one_active ON detection_runs((1)) WHERE state IN ('queued','running');
CREATE TABLE IF NOT EXISTS detection_results (
  event_id TEXT PRIMARY KEY REFERENCES audit_events(event_id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES detection_runs(id), prediction TEXT NOT NULL,
  rules JSONB NOT NULL, features JSONB NOT NULL, detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  latency_ms DOUBLE PRECISION NOT NULL, version INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS detection_result_time ON detection_results(detected_at DESC,event_id);
CREATE TABLE IF NOT EXISTS detection_labels (
  event_id TEXT PRIMARY KEY REFERENCES audit_events(event_id) ON DELETE CASCADE,
  label TEXT NOT NULL CHECK(label IN ('Normal','Anomaly')), reviewer TEXT NOT NULL,
  note TEXT NOT NULL, scenario TEXT NOT NULL, split TEXT NOT NULL CHECK(split IN ('train','evaluation')),
  version INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS detection_evaluations (
  id TEXT PRIMARY KEY, actor TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metrics JSONB NOT NULL, dataset_hash TEXT NOT NULL, sample_count INTEGER NOT NULL
);
ALTER TABLE detection_evaluations ADD COLUMN IF NOT EXISTS dataset JSONB NOT NULL DEFAULT '[]';
