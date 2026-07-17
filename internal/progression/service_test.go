package progression_test

import (
	"context"
	"database/sql"
	"errors"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/progression"
	"github.com/synaploom/synaploom/internal/storage"
)

type progressionFixture struct {
	service *progression.Service
	db      *sql.DB
}

func newProgressionFixture(t *testing.T) progressionFixture {
	t.Helper()
	db, err := storage.Open(context.Background(), filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = db.Close() })
	_, err = db.SQL.Exec(`INSERT INTO course_progress(course_id,version,current_lesson_id,started_at) VALUES('course','1.0.0','lesson-1','now');
INSERT INTO lesson_progress(course_id,version,lesson_id,position,status) VALUES
('course','1.0.0','lesson-1',1,'AVAILABLE'),('course','1.0.0','lesson-2',2,'LOCKED'),('course','1.0.0','lesson-3',3,'LOCKED')`)
	if err != nil {
		t.Fatal(err)
	}
	return progressionFixture{service: progression.New(db.SQL), db: db.SQL}
}
func TestCompleteLessonUnlocksOnlyImmediateNextLesson(t *testing.T) {
	f := newProgressionFixture(t)
	result, err := f.service.Complete(context.Background(), "course", "1.0.0", "lesson-1")
	if err != nil {
		t.Fatal(err)
	}
	if result.NextLessonID != "lesson-2" {
		t.Fatalf("next=%q", result.NextLessonID)
	}
	if err := f.service.Authorize(context.Background(), "course", "1.0.0", "lesson-3"); !errors.Is(err, progression.ErrLessonLocked) {
		t.Fatalf("expected locked, got %v", err)
	}
}
func TestDirectCompletionOfLaterLessonIsLocked(t *testing.T) {
	f := newProgressionFixture(t)
	_, err := f.service.Complete(context.Background(), "course", "1.0.0", "lesson-2")
	var locked progression.LockedError
	if !errors.As(err, &locked) || locked.CurrentLessonID != "lesson-1" {
		t.Fatalf("err=%v", err)
	}
}
func TestMalformedStatusReturnsDescriptiveError(t *testing.T) {
	f := newProgressionFixture(t)
	_, err := f.db.Exec(`UPDATE lesson_progress SET status='CORRUPT' WHERE lesson_id='lesson-1'`)
	if err == nil {
		t.Fatal("expected sqlite check constraint")
	}
}
