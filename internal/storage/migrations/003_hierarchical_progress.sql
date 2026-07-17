CREATE TABLE IF NOT EXISTS chapter_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  required INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('LOCKED','AVAILABLE','IN_PROGRESS','ASSESSMENT_REQUIRED','COMPLETED')),
  completed_at TEXT,
  PRIMARY KEY (course_id, version, chapter_id)
);

CREATE TABLE IF NOT EXISTS lesson_practice_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  required INTEGER NOT NULL,
  best_result_json TEXT,
  latest_result_json TEXT,
  PRIMARY KEY (course_id, version, lesson_id, practice_id)
);

CREATE TABLE IF NOT EXISTS lesson_practice_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  practice_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chapter_assessment_progress (
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  required INTEGER NOT NULL,
  best_result_json TEXT,
  latest_result_json TEXT,
  PRIMARY KEY (course_id, version, chapter_id, assessment_id)
);

CREATE TABLE IF NOT EXISTS chapter_assessment_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  course_id TEXT NOT NULL,
  version TEXT NOT NULL,
  chapter_id TEXT NOT NULL,
  assessment_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);
