CREATE TABLE workspace_presentation_states (
  profile_id TEXT NOT NULL,
  course_id TEXT NOT NULL,
  owner_kind TEXT NOT NULL CHECK (owner_kind IN ('lessons', 'assessments')),
  owner_id TEXT NOT NULL,
  focused_activity_id TEXT,
  pane_mode TEXT NOT NULL CHECK (pane_mode IN ('collapsed', 'split', 'expanded')),
  split_ratio REAL NOT NULL,
  user_collapsed INTEGER NOT NULL CHECK (user_collapsed IN (0, 1)),
  revision INTEGER NOT NULL CHECK (revision >= 1),
  updated_at TEXT NOT NULL,
  PRIMARY KEY (profile_id, course_id, owner_kind, owner_id)
);

CREATE INDEX workspace_presentation_states_course_owner
ON workspace_presentation_states(course_id, owner_kind, owner_id);
