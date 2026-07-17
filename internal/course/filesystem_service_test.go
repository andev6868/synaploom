package course

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/runner"
)

func TestFilesystemServiceConvertsLessonBlocksForAPI(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, "course.json"), []byte(`{"schemaVersion":"1.0","id":"sample","version":"1.0.0","title":"Sample","description":"Sample course","language":"en","lessons":[{"id":"lesson-1","position":1,"path":"lesson.md"}]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "lesson.md"), []byte("# Lesson\n\nHello."), 0o600); err != nil {
		t.Fatal(err)
	}
	svc, err := OpenFilesystemService(root)
	if err != nil {
		t.Fatal(err)
	}
	lesson, err := svc.Lesson(context.Background(), "lesson-1")
	if err != nil {
		t.Fatal(err)
	}
	if len(lesson.Blocks) == 0 || lesson.Blocks[0].Type == "" {
		t.Fatalf("unexpected blocks %#v", lesson.Blocks)
	}
}

func TestFilesystemServiceLoadsExerciseFromLessonFrontMatter(t *testing.T) {
	svc, err := OpenFilesystemService(filepath.Join("..", "..", "examples", "frontend-performance-foundations"))
	if err != nil {
		t.Fatal(err)
	}
	lesson, err := svc.Lesson(context.Background(), "event-loop")
	if err != nil {
		t.Fatal(err)
	}
	if lesson.Type != "mixed" {
		t.Fatalf("expected mixed lesson type, got %q", lesson.Type)
	}
	if lesson.Title != "Event Loop" {
		t.Fatalf("expected front-matter title, got %q", lesson.Title)
	}
	exercise, ok := lesson.Exercise.(contracts.LessonExercise)
	if !ok {
		t.Fatalf("expected exercise payload, got %#v", lesson.Exercise)
	}
	if exercise.Id != "event-loop-order" || len(exercise.Actions) != 2 || len(exercise.Editable) != 1 {
		t.Fatalf("unexpected exercise %#v", exercise)
	}
}

func TestFilesystemServiceRecordsCheckResult(t *testing.T) {
	root := filepath.Join("..", "..", "examples", "frontend-performance-foundations")
	service, err := OpenFilesystemService(root)
	if err != nil {
		t.Fatal(err)
	}
	zero := 0
	if err := service.RecordActionResult(context.Background(), "event-loop", "check", runner.Result{ExitCode: &zero}); err != nil {
		t.Fatal(err)
	}
	lesson, err := service.Lesson(context.Background(), "event-loop")
	if err != nil {
		t.Fatal(err)
	}
	latest, ok := lesson.LatestCheck.(map[string]any)
	if !ok {
		t.Fatalf("latestCheck=%#v", lesson.LatestCheck)
	}
	checks, ok := latest["checks"].([]map[string]any)
	if !ok || len(checks) != 1 {
		t.Fatalf("checks=%#v", latest["checks"])
	}
	if passed, _ := checks[0]["passed"].(bool); !passed {
		t.Fatalf("check=%#v", checks[0])
	}
}
