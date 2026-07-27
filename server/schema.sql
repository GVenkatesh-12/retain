PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS app_settings (
  user_id TEXT PRIMARY KEY,
  timezone TEXT NOT NULL DEFAULT 'UTC',
  daily_target INTEGER NOT NULL DEFAULT 15 CHECK (daily_target BETWEEN 1 AND 100),
  theme TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  animations_enabled INTEGER NOT NULL DEFAULT 1 CHECK (animations_enabled IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  subject TEXT NOT NULL CHECK (length(subject) BETWEEN 1 AND 120),
  title TEXT NOT NULL CHECK (length(title) BETWEEN 1 AND 240),
  created_at TEXT NOT NULL,
  archived_at TEXT
);

CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  offset_days INTEGER NOT NULL,
  due_at TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('mandatory', 'bonus')),
  bonus_batch_id TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed')),
  completed_at TEXT,
  duration_seconds INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(topic_id, sequence, kind, bonus_batch_id)
);

CREATE TABLE IF NOT EXISTS completion_events (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  revision_id TEXT NOT NULL REFERENCES revisions(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('mandatory', 'bonus')),
  completed_at TEXT NOT NULL,
  local_date TEXT NOT NULL,
  bonus_batch_id TEXT,
  UNIQUE(user_id, revision_id)
);

CREATE INDEX IF NOT EXISTS topics_user_created_idx ON topics(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS topics_user_subject_idx ON topics(user_id, subject COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS revisions_queue_idx ON revisions(user_id, status, kind, due_at);
CREATE INDEX IF NOT EXISTS revisions_topic_sequence_idx ON revisions(topic_id, sequence);
CREATE INDEX IF NOT EXISTS completion_local_date_idx ON completion_events(user_id, local_date);
CREATE INDEX IF NOT EXISTS completion_completed_at_idx ON completion_events(user_id, completed_at);
CREATE UNIQUE INDEX IF NOT EXISTS completion_revision_unique_idx ON completion_events(user_id, revision_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT NOT NULL,
  user_id TEXT NOT NULL,
  response_body TEXT NOT NULL,
  status_code INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (key, user_id)
);
