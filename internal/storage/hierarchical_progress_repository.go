package storage

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"time"

	"github.com/synaploom/synaploom/internal/progression"
)

type HierarchicalProgressRepository struct{}

func NewHierarchicalProgressRepository() HierarchicalProgressRepository {
	return HierarchicalProgressRepository{}
}

func (HierarchicalProgressRepository) Initialize(ctx context.Context, tx *sql.Tx, graph progression.CourseGraph) error {
	if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO course_progress(course_id,version,current_lesson_id,started_at) VALUES(?,?,?,?)`, graph.ID, graph.Version, firstRequiredLesson(graph), time.Now().UTC().Format(time.RFC3339Nano)); err != nil {
		return err
	}
	for _, chapter := range graph.Chapters {
		status := progression.StatusLocked
		if chapter.Position == 1 || !chapter.Required {
			status = progression.StatusInProgress
		}
		if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO chapter_progress(course_id,version,chapter_id,position,required,status) VALUES(?,?,?,?,?,?)`, graph.ID, graph.Version, chapter.ID, chapter.Position, boolInt(chapter.Required), status); err != nil {
			return err
		}
		for _, lesson := range chapter.Lessons {
			lessonStatus := progression.StatusLocked
			if chapter.Position == 1 && lesson.Position == 1 {
				lessonStatus = progression.StatusAvailable
			}
			if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO lesson_progress(course_id,version,lesson_id,position,status,reading_acknowledged) VALUES(?,?,?,?,?,0)`, graph.ID, graph.Version, lesson.ID, lesson.Position, lessonStatus); err != nil {
				return err
			}
			for _, practice := range lesson.Practices {
				if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO lesson_practice_progress(course_id,version,lesson_id,practice_id,required) VALUES(?,?,?,?,?)`, graph.ID, graph.Version, lesson.ID, practice.ID, boolInt(practice.Required)); err != nil {
					return err
				}
			}
		}
		for _, assessment := range chapter.Assessments {
			if _, err := tx.ExecContext(ctx, `INSERT OR IGNORE INTO chapter_assessment_progress(course_id,version,chapter_id,assessment_id,required) VALUES(?,?,?,?,?)`, graph.ID, graph.Version, chapter.ID, assessment.ID, boolInt(assessment.Required)); err != nil {
				return err
			}
		}
	}
	return nil
}

func (HierarchicalProgressRepository) Snapshot(ctx context.Context, q progression.Querier, courseID, version string) (progression.ProgressSnapshot, error) {
	s := progression.ProgressSnapshot{Chapters: map[string]progression.ChapterProgress{}, Lessons: map[string]progression.LessonProgress{}, Practices: map[progression.PracticeKey]progression.PracticeProgress{}, Assessments: map[progression.AssessmentKey]progression.PracticeProgress{}, ActivitySets: map[progression.ActivitySetKey]progression.ActivitySetProgress{}}
	var courseStatus sql.NullString
	if err := q.QueryRowContext(ctx, `SELECT current_lesson_id, CASE WHEN completed_at IS NULL THEN 'IN_PROGRESS' ELSE 'COMPLETED' END FROM course_progress WHERE course_id=? AND version=?`, courseID, version).Scan(&s.Course.CurrentLessonID, &courseStatus); err != nil {
		return s, err
	}
	s.Course.Status = progression.Status(courseStatus.String)
	rows, err := q.QueryContext(ctx, `SELECT chapter_id,status FROM chapter_progress WHERE course_id=? AND version=?`, courseID, version)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var id, status string
		if err := rows.Scan(&id, &status); err != nil {
			rows.Close()
			return s, err
		}
		s.Chapters[id] = progression.ChapterProgress{Status: progression.Status(status)}
	}
	if err := rows.Close(); err != nil {
		return s, err
	}
	rows, err = q.QueryContext(ctx, `SELECT lesson_id,status,reading_acknowledged FROM lesson_progress WHERE course_id=? AND version=?`, courseID, version)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var id, status string
		var reading int
		if err := rows.Scan(&id, &status, &reading); err != nil {
			rows.Close()
			return s, err
		}
		s.Lessons[id] = progression.LessonProgress{Status: progression.Status(status), ReadingCompleted: reading != 0}
	}
	if err := rows.Close(); err != nil {
		return s, err
	}
	if err := loadPracticeProgress(ctx, q, `SELECT lesson_id,practice_id,best_result_json,latest_result_json FROM lesson_practice_progress WHERE course_id=? AND version=?`, courseID, version, func(a, b string, p progression.PracticeProgress) {
		s.Practices[progression.PracticeKey{LessonID: a, PracticeID: b}] = p
	}); err != nil {
		return s, err
	}
	if err := loadPracticeProgress(ctx, q, `SELECT chapter_id,assessment_id,best_result_json,latest_result_json FROM chapter_assessment_progress WHERE course_id=? AND version=?`, courseID, version, func(a, b string, p progression.PracticeProgress) {
		s.Assessments[progression.AssessmentKey{ChapterID: a, AssessmentID: b}] = p
	}); err != nil {
		return s, err
	}
	return s, nil
}

func loadPracticeProgress(ctx context.Context, q progression.Querier, query, courseID, version string, put func(string, string, progression.PracticeProgress)) error {
	rows, err := q.QueryContext(ctx, query, courseID, version)
	if err != nil {
		return err
	}
	defer rows.Close()
	for rows.Next() {
		var a, b string
		var best, latest sql.NullString
		if err := rows.Scan(&a, &b, &best, &latest); err != nil {
			return err
		}
		var p progression.PracticeProgress
		if best.Valid {
			if err := json.Unmarshal([]byte(best.String), &p.BestResult); err != nil {
				return err
			}
		}
		if latest.Valid {
			if err := json.Unmarshal([]byte(latest.String), &p.LatestResult); err != nil {
				return err
			}
		}
		put(a, b, p)
	}
	return rows.Err()
}

func (HierarchicalProgressRepository) AcknowledgeReading(ctx context.Context, tx *sql.Tx, key progression.LessonKey, at time.Time) error {
	_, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET reading_acknowledged=1,started_at=COALESCE(started_at,?) WHERE course_id=? AND version=? AND lesson_id=?`, at.UTC().Format(time.RFC3339Nano), key.CourseID, key.Version, key.LessonID)
	return err
}
func (HierarchicalProgressRepository) RecordPracticeAttempt(ctx context.Context, tx *sql.Tx, key progression.CoursePracticeKey, result progression.AttemptResult) error {
	return recordAttempt(ctx, tx, `INSERT INTO lesson_practice_attempts(course_id,version,lesson_id,practice_id,result_json,created_at) VALUES(?,?,?,?,?,?)`, `UPDATE lesson_practice_progress SET latest_result_json=?,best_result_json=CASE WHEN ?=1 THEN ? ELSE best_result_json END WHERE course_id=? AND version=? AND lesson_id=? AND practice_id=?`, []any{key.CourseID, key.Version, key.LessonID, key.PracticeID}, result)
}
func (HierarchicalProgressRepository) RecordAssessmentAttempt(ctx context.Context, tx *sql.Tx, key progression.CourseAssessmentKey, result progression.AttemptResult) error {
	return recordAttempt(ctx, tx, `INSERT INTO chapter_assessment_attempts(course_id,version,chapter_id,assessment_id,result_json,created_at) VALUES(?,?,?,?,?,?)`, `UPDATE chapter_assessment_progress SET latest_result_json=?,best_result_json=CASE WHEN ?=1 THEN ? ELSE best_result_json END WHERE course_id=? AND version=? AND chapter_id=? AND assessment_id=?`, []any{key.CourseID, key.Version, key.ChapterID, key.AssessmentID}, result)
}
func recordAttempt(ctx context.Context, tx *sql.Tx, insert, update string, key []any, result progression.AttemptResult) error {
	data, err := json.Marshal(result)
	if err != nil {
		return err
	}
	args := append(append([]any{}, key...), string(data), result.CompletedAt.UTC().Format(time.RFC3339Nano))
	if _, err = tx.ExecContext(ctx, insert, args...); err != nil {
		return err
	}
	u := []any{string(data), boolInt(result.Passed), string(data)}
	u = append(u, key...)
	res, err := tx.ExecContext(ctx, update, u...)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n != 1 {
		return fmt.Errorf("record attempt: expected one progress row, got %d", n)
	}
	return nil
}
func (HierarchicalProgressRepository) ApplyEvaluation(ctx context.Context, tx *sql.Tx, courseID, version string, e progression.Evaluation) error {
	for id, v := range e.Lessons {
		if _, err := tx.ExecContext(ctx, `UPDATE lesson_progress SET status=?,completed_at=CASE WHEN ?='COMPLETED' THEN COALESCE(completed_at,?) ELSE completed_at END WHERE course_id=? AND version=? AND lesson_id=?`, v.Status, v.Status, time.Now().UTC().Format(time.RFC3339Nano), courseID, version, id); err != nil {
			return err
		}
	}
	for id, v := range e.Chapters {
		if _, err := tx.ExecContext(ctx, `UPDATE chapter_progress SET status=?,completed_at=CASE WHEN ?='COMPLETED' THEN COALESCE(completed_at,?) ELSE completed_at END WHERE course_id=? AND version=? AND chapter_id=?`, v.Status, v.Status, time.Now().UTC().Format(time.RFC3339Nano), courseID, version, id); err != nil {
			return err
		}
	}
	_, err := tx.ExecContext(ctx, `UPDATE course_progress SET current_lesson_id=?,completed_at=CASE WHEN ?='COMPLETED' THEN COALESCE(completed_at,?) ELSE completed_at END WHERE course_id=? AND version=?`, e.CurrentLessonID, e.CourseStatus, time.Now().UTC().Format(time.RFC3339Nano), courseID, version)
	return err
}
func firstRequiredLesson(graph progression.CourseGraph) string {
	for _, c := range graph.Chapters {
		if !c.Required {
			continue
		}
		for _, l := range c.Lessons {
			if l.Required {
				return l.ID
			}
		}
	}
	return ""
}
func boolInt(v bool) int {
	if v {
		return 1
	}
	return 0
}
