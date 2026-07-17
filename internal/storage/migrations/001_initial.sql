PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS installed_courses (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  title TEXT NOT NULL,
  source_path TEXT NOT NULL,
  install_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  trusted_hash TEXT,
  installed_at TEXT NOT NULL,
  trusted_at TEXT,
  PRIMARY KEY (course_id, version)
);

CREATE TABLE IF NOT EXISTS course_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  current_lesson_id TEXT,
  started_at TEXT NOT NULL,
  completed_at TEXT,
  PRIMARY KEY (course_id, version)
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LOCKED','AVAILABLE','IN_PROGRESS','COMPLETED')),
  reading_acknowledged INTEGER NOT NULL DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  PRIMARY KEY (course_id, version, lesson_id)
);

CREATE TABLE IF NOT EXISTS exercise_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  action_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS preferences (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL
);
