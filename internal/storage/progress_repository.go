package storage

import (
	"context"
	"database/sql"
	"fmt"
)

// ProgressRepository persists linear lesson progression using caller-owned transactions.
type ProgressRepository struct{ db *sql.DB }

func NewProgressRepository(db *sql.DB) ProgressRepository { return ProgressRepository{db: db} }

type LessonProgressRow struct {
	CourseID            string
	Version             string
	LessonID            string
	Position            int
	Status              string
	ReadingAcknowledged bool
}

type rowQuerier interface {
	QueryRowContext(context.Context, string, ...any) *sql.Row
}

func (r ProgressRepository) Lesson(ctx context.Context, courseID, version, lessonID string) (LessonProgressRow, error) {
	if r.db == nil {
		return LessonProgressRow{}, fmt.Errorf("progress repository: nil database")
	}
	return r.LessonWith(ctx, r.db, courseID, version, lessonID)
}

func (ProgressRepository) LessonWith(ctx context.Context, q rowQuerier, courseID, version, lessonID string) (LessonProgressRow, error) {
	var row LessonProgressRow
	var acknowledged int
	err := q.QueryRowContext(ctx, `SELECT course_id,version,lesson_id,position,status,reading_acknowledged FROM lesson_progress WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID).
		Scan(&row.CourseID, &row.Version, &row.LessonID, &row.Position, &row.Status, &acknowledged)
	if err != nil {
		return LessonProgressRow{}, err
	}
	if row.CourseID == "" || row.Version == "" || row.LessonID == "" {
		return LessonProgressRow{}, fmt.Errorf("decode lesson progress: null or empty identifier")
	}
	switch row.Status {
	case "LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED":
	default:
		return LessonProgressRow{}, fmt.Errorf("decode lesson progress: invalid status %q", row.Status)
	}
	row.ReadingAcknowledged = acknowledged != 0
	return row, nil
}

func (ProgressRepository) CurrentLessonID(ctx context.Context, q rowQuerier, courseID, version string) (string, error) {
	var id sql.NullString
	if err := q.QueryRowContext(ctx, `SELECT current_lesson_id FROM course_progress WHERE course_id=? AND version=?`, courseID, version).Scan(&id); err != nil {
		return "", err
	}
	if !id.Valid || id.String == "" {
		return "", fmt.Errorf("decode course progress: missing current lesson")
	}
	return id.String, nil
}

func (ProgressRepository) Complete(ctx context.Context, tx *sql.Tx, courseID, version, lessonID string) error {
	result, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET status='COMPLETED', completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID)
	if err != nil {
		return err
	}
	if count, _ := result.RowsAffected(); count != 1 {
		return fmt.Errorf("complete lesson: expected one row, got %d", count)
	}
	return nil
}

func (ProgressRepository) NextLesson(ctx context.Context, tx *sql.Tx, courseID, version string, position int) (LessonProgressRow, error) {
	var row LessonProgressRow
	var acknowledged int
	err := tx.QueryRowContext(ctx, `SELECT course_id,version,lesson_id,position,status,reading_acknowledged FROM lesson_progress WHERE course_id=? AND version=? AND position=?`, courseID, version, position+1).
		Scan(&row.CourseID, &row.Version, &row.LessonID, &row.Position, &row.Status, &acknowledged)
	if err != nil {
		return LessonProgressRow{}, err
	}
	if row.CourseID == "" || row.Version == "" || row.LessonID == "" {
		return LessonProgressRow{}, fmt.Errorf("decode next lesson: null or empty identifier")
	}
	switch row.Status {
	case "LOCKED", "AVAILABLE", "IN_PROGRESS", "COMPLETED":
	default:
		return LessonProgressRow{}, fmt.Errorf("decode next lesson: invalid status %q", row.Status)
	}
	row.ReadingAcknowledged = acknowledged != 0
	return row, nil
}

func (ProgressRepository) UnlockAndAdvance(ctx context.Context, tx *sql.Tx, courseID, version, lessonID string) error {
	if _, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET status='AVAILABLE' WHERE course_id=? AND version=? AND lesson_id=?`, courseID, version, lessonID); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx, `UPDATE course_progress SET current_lesson_id=? WHERE course_id=? AND version=?`, lessonID, courseID, version)
	return err
}
