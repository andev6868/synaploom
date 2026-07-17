package progression

import (
	"context"
	"database/sql"
	"time"
)

type LessonKey struct{ CourseID, Version, LessonID string }
type CoursePracticeKey struct{ CourseID, Version, LessonID, PracticeID string }
type CourseAssessmentKey struct{ CourseID, Version, ChapterID, AssessmentID string }

type Querier interface {
	QueryContext(context.Context, string, ...any) (*sql.Rows, error)
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type Store interface {
	Initialize(context.Context, *sql.Tx, CourseGraph) error
	Snapshot(context.Context, Querier, string, string) (ProgressSnapshot, error)
	AcknowledgeReading(context.Context, *sql.Tx, LessonKey, time.Time) error
	RecordPracticeAttempt(context.Context, *sql.Tx, CoursePracticeKey, AttemptResult) error
	RecordAssessmentAttempt(context.Context, *sql.Tx, CourseAssessmentKey, AttemptResult) error
	ApplyEvaluation(context.Context, *sql.Tx, string, string, Evaluation) error
}
