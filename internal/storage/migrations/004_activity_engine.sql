CREATE TABLE IF NOT EXISTS activity_attempts (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL,
  course_version TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('lesson','assessment')),
  owner_id TEXT NOT NULL,
  activity_id TEXT NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number >= 0),
  status TEXT NOT NULL CHECK (status IN ('DRAFT','SUBMITTED','EVALUATED')),
  answer_json TEXT NOT NULL,
  feedback_json TEXT NOT NULL DEFAULT '{}',
  score REAL,
  max_score REAL,
  passed INTEGER,
  seed INTEGER NOT NULL DEFAULT 0,
  revision INTEGER NOT NULL DEFAULT 1 CHECK (revision >= 1),
  idempotency_key TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  submitted_at TEXT,
  evaluated_at TEXT,
  UNIQUE(course_id, course_version, owner_kind, owner_id, activity_id, attempt_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS activity_attempts_idempotency
ON activity_attempts(course_id, course_version, owner_kind, owner_id, activity_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_attempts_owner_status
ON activity_attempts(course_id, course_version, owner_kind, owner_id, status, activity_id);
