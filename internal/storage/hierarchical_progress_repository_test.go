package storage

import (
	"context"
	"github.com/synaploom/synaploom/internal/progression"
	"path/filepath"
	"testing"
	"time"
)

func TestHierarchicalProgressPreservesBestPass(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "progress.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	lesson := progression.LessonRef{ID: "l1", ChapterID: "c1", Position: 1, Required: true, ReadingRequired: true, Practices: []progression.Practice{{ID: "p1", Required: true, Rule: progression.CompletionRule{Type: progression.CompletionAllRequiredChecks}}}}
	graph := progression.CourseGraph{ID: "course", Version: "1", Chapters: []progression.Chapter{{ID: "c1", Position: 1, Required: true, Lessons: []progression.LessonRef{lesson}}}, LessonIndex: map[string]progression.LessonRef{"l1": lesson}}
	repo := NewHierarchicalProgressRepository()
	tx, err := db.SQL.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	if err = repo.Initialize(ctx, tx, graph); err != nil {
		t.Fatal(err)
	}
	if err = repo.RecordPracticeAttempt(ctx, tx, progression.CoursePracticeKey{CourseID: "course", Version: "1", LessonID: "l1", PracticeID: "p1"}, progression.AttemptResult{Passed: true, CompletedAt: time.Unix(1, 0)}); err != nil {
		t.Fatal(err)
	}
	if err = repo.RecordPracticeAttempt(ctx, tx, progression.CoursePracticeKey{CourseID: "course", Version: "1", LessonID: "l1", PracticeID: "p1"}, progression.AttemptResult{Passed: false, CompletedAt: time.Unix(2, 0)}); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	snap, err := repo.Snapshot(ctx, db.SQL, "course", "1")
	if err != nil {
		t.Fatal(err)
	}
	p := snap.Practices[progression.PracticeKey{LessonID: "l1", PracticeID: "p1"}]
	if p.BestResult == nil || !p.BestResult.Passed {
		t.Fatal("best pass was lost")
	}
	if p.LatestResult == nil || p.LatestResult.Passed {
		t.Fatal("latest failure missing")
	}
}
func TestMigrationCreatesHierarchicalTables(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "migration.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	for _, name := range []string{"chapter_progress", "lesson_practice_progress", "lesson_practice_attempts", "chapter_assessment_progress", "chapter_assessment_attempts"} {
		var got string
		if err := db.SQL.QueryRowContext(ctx, `SELECT name FROM sqlite_master WHERE type='table' AND name=?`, name).Scan(&got); err != nil {
			t.Fatalf("missing %s: %v", name, err)
		}
	}
}
