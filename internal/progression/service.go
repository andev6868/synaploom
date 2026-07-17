package progression

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

var ErrLessonLocked = errors.New("lesson locked")

type LockedError struct{ CurrentLessonID string }

func (e LockedError) Error() string {
	return fmt.Sprintf("%v: current lesson is %s", ErrLessonLocked, e.CurrentLessonID)
}
func (e LockedError) Unwrap() error { return ErrLessonLocked }

type CompletionResult struct{ NextLessonID string }

type legacyProgressStore interface {
	CurrentLessonID(context.Context, rowQuerier, string, string) (string, error)
	Lesson(context.Context, string, string, string) (legacyLessonRow, error)
	LessonWith(context.Context, rowQuerier, string, string, string) (legacyLessonRow, error)
	Complete(context.Context, *sql.Tx, string, string, string) error
	NextLesson(context.Context, *sql.Tx, string, string, int) (legacyLessonRow, error)
	UnlockAndAdvance(context.Context, *sql.Tx, string, string, string) error
}

type rowQuerier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

type legacyLessonRow struct {
	LessonID string
	Position int
	Status   string
}

type sqlLegacyProgressStore struct{ db *sql.DB }

func (s sqlLegacyProgressStore) Lesson(ctx context.Context, courseID, version, lessonID string) (legacyLessonRow, error) {
	return s.LessonWith(ctx, s.db, courseID, version, lessonID)
}
func (sqlLegacyProgressStore) LessonWith(ctx context.Context, q rowQuerier, courseID, version, lessonID string) (legacyLessonRow, error) {
	var row legacyLessonRow
	if err := q.QueryRowContext(ctx, `SELECT lesson_id,position,status FROM lesson_progress WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID).Scan(&row.LessonID, &row.Position, &row.Status); err != nil {
		return row, err
	}
	switch row.Status {
	case "LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED":
	default:
		return legacyLessonRow{}, fmt.Errorf("decode lesson progress: invalid status %q", row.Status)
	}
	return row, nil
}
func (sqlLegacyProgressStore) CurrentLessonID(ctx context.Context, q rowQuerier, courseID, version string) (string, error) {
	var id sql.NullString
	if err := q.QueryRowContext(ctx, `SELECT current_lesson_id FROM course_progress WHERE course_id=? AND version=?`, courseID, version).Scan(&id); err != nil {
		return "", err
	}
	if !id.Valid || id.String == "" {
		return "", fmt.Errorf("decode course progress: missing current lesson")
	}
	return id.String, nil
}
func (sqlLegacyProgressStore) Complete(ctx context.Context, tx *sql.Tx, courseID, version, lessonID string) error {
	result, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET status='COMPLETED', completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID)
	if err != nil {
		return err
	}
	count, _ := result.RowsAffected()
	if count != 1 {
		return fmt.Errorf("complete lesson: expected one row, got %d", count)
	}
	return nil
}
func (sqlLegacyProgressStore) NextLesson(ctx context.Context, tx *sql.Tx, courseID, version string, position int) (legacyLessonRow, error) {
	var row legacyLessonRow
	if err := tx.QueryRowContext(ctx, `SELECT lesson_id,position,status FROM lesson_progress WHERE course_id=? AND version=? AND position=?`, courseID, version, position+1).Scan(&row.LessonID, &row.Position, &row.Status); err != nil {
		return row, err
	}
	return row, nil
}
func (sqlLegacyProgressStore) UnlockAndAdvance(ctx context.Context, tx *sql.Tx, courseID, version, lessonID string) error {
	if _, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET status='AVAILABLE' WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE course_progress SET current_lesson_id=? WHERE course_id=? AND version=?`, lessonID, courseID, version)
	return err
}

type Service struct {
	db       *sql.DB
	progress legacyProgressStore
}

func New(db *sql.DB) *Service { return &Service{db: db, progress: sqlLegacyProgressStore{db: db}} }

func (s *Service) Authorize(ctx context.Context, courseID, version, lessonID string) error {
	current, err := s.progress.CurrentLessonID(ctx, s.db, courseID, version)
	if err != nil {
		return err
	}
	row, err := s.progress.Lesson(ctx, courseID, version, lessonID)
	if err != nil {
		return err
	}
	if row.Status == "LOCKED" {
		return LockedError{CurrentLessonID: current}
	}
	return nil
}

func (s *Service) Complete(ctx context.Context, courseID, version, lessonID string) (CompletionResult, error) {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return CompletionResult{}, err
	}
	defer tx.Rollback()
	current, err := s.progress.CurrentLessonID(ctx, tx, courseID, version)
	if err != nil {
		return CompletionResult{}, err
	}
	if current != lessonID {
		return CompletionResult{}, LockedError{CurrentLessonID: current}
	}
	row, err := s.progress.LessonWith(ctx, tx, courseID, version, lessonID)
	if err != nil {
		return CompletionResult{}, err
	}
	if err := s.progress.Complete(ctx, tx, courseID, version, lessonID); err != nil {
		return CompletionResult{}, err
	}
	next, err := s.progress.NextLesson(ctx, tx, courseID, version, row.Position)
	if errors.Is(err, sql.ErrNoRows) {
		if _, err := tx.ExecContext(ctx, `UPDATE course_progress SET current_lesson_id=NULL,completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE course_id=? AND version=?`, courseID, version); err != nil {
			return CompletionResult{}, err
		}
		if err := tx.Commit(); err != nil {
			return CompletionResult{}, err
		}
		return CompletionResult{}, nil
	}
	if err != nil {
		return CompletionResult{}, err
	}
	if err := s.progress.UnlockAndAdvance(ctx, tx, courseID, version, next.LessonID); err != nil {
		return CompletionResult{}, err
	}
	if err := tx.Commit(); err != nil {
		return CompletionResult{}, err
	}
	return CompletionResult{NextLessonID: next.LessonID}, nil
}
