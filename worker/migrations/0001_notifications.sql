CREATE TABLE IF NOT EXISTS push_installations (
  installation_id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL,
  push_endpoint TEXT NOT NULL,
  push_p256dh TEXT NOT NULL,
  push_auth TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  last_test_at INTEGER
);

CREATE TABLE IF NOT EXISTS wake_schedules (
  schedule_id TEXT PRIMARY KEY,
  installation_id TEXT NOT NULL,
  trigger_at_utc INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (installation_id) REFERENCES push_installations(installation_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_wake_schedules_trigger_at ON wake_schedules(trigger_at_utc);
CREATE INDEX IF NOT EXISTS idx_wake_schedules_installation ON wake_schedules(installation_id);
