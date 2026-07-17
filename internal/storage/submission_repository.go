package storage

import (
	"context"
	"database/sql"
)

// SubmissionRepository persists evaluator attempts.
type SubmissionRepository struct{}

func (SubmissionRepository) Add(ctx context.Context, tx *sql.Tx, courseID, version, lessonID, actionID, resultJSON string) error {
	_, err := tx.ExecContext(ctx, `INSERT INTO exercise_attempts(course_id,version,lesson_id,action_id,result_json,created_at) VALUES(?,?,?,?,?,strftime('%Y-%m-%dT%H:%M:%fZ','now'))`, courseID, version, lessonID, actionID, resultJSON)
	return err
}
