package course

import (
	"context"
	"errors"
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
	if len(lesson.Blocks) == 0 {
		t.Fatalf("unexpected blocks %#v", lesson.Blocks)
	}
	block, ok := lesson.Blocks[0].(map[string]any)
	if !ok || block["type"] == "" {
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

func TestFilesystemServiceUsesSchema12CodingActivityAsWorkspace(t *testing.T) {
	root := t.TempDir()
	writeJSONFixture(t, filepath.Join(root, "course.json"), map[string]any{
		"schemaVersion": "1.2.0", "id": "coding-course", "version": "1.2.0", "title": "Coding Course", "description": "Course", "language": "vi",
		"chapters": []any{map[string]any{
			"id": "chapter", "title": "Chapter", "required": true,
			"lessons": []any{map[string]any{"id": "coding-lesson", "required": true}}, "assessments": []any{},
		}},
	})
	lessonDir := filepath.Join(root, "lessons", "coding-lesson")
	if err := os.MkdirAll(filepath.Join(lessonDir, "starter"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(lessonDir, "lesson.md"), []byte("---\nid: coding-lesson\ntitle: Coding Lesson\ntype: mixed\nactivitySets:\n  - activities/practice.json\n---\n# Coding\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(lessonDir, "starter", "index.js"), []byte("console.log('ok')\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	writeJSONFixture(t, filepath.Join(lessonDir, "activities", "practice.json"), map[string]any{
		"schemaVersion": "1.0", "id": "coding-practice",
		"policy":     map[string]any{"purpose": "practice", "maxAttempts": nil, "feedbackMode": "immediate", "revealAnswers": "never", "scoring": "none", "passingScore": nil},
		"activities": []any{map[string]any{"id": "coding-lab", "path": "coding.activity.json", "required": true}},
	})
	writeJSONFixture(t, filepath.Join(lessonDir, "activities", "coding.activity.json"), map[string]any{
		"schemaVersion": "1.0", "id": "coding-lab", "kind": "coding", "title": "Coding Lab", "prompt": map[string]any{"blocks": []any{}},
		"config": map[string]any{
			"schemaVersion": "1.0", "id": "coding-lab", "title": "Coding Lab", "runtime": map[string]any{"kind": "local", "requires": []any{"node"}},
			"workspace": map[string]any{"starter": "starter", "editable": []any{"index.js"}},
			"actions":   map[string]any{"run": map[string]any{"label": "Run", "executable": "node", "args": []any{"index.js"}, "timeoutMs": float64(1000)}},
			"checks":    []any{map[string]any{"id": "output", "title": "Output", "required": true}}, "completion": map[string]any{"requireAllRequiredChecks": true},
		},
		"evaluation": map[string]any{"mode": "coding", "points": 1}, "completion": map[string]any{"required": true},
	})

	service, err := OpenFilesystemService(root)
	if err != nil {
		t.Fatal(err)
	}
	files, err := service.WorkspaceFilesForActivity(context.Background(), "coding-lesson", "coding-lab")
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 1 || files[0] != "index.js" {
		t.Fatalf("files=%v", files)
	}
	action, err := service.ResolveActivityAction(context.Background(), "coding-lesson", "coding-lab", "run")
	if err != nil {
		t.Fatal(err)
	}
	if action.Program != "node" || len(action.Args) != 1 || action.Args[0] != "index.js" {
		t.Fatalf("action=%+v", action)
	}
	if _, err := service.WorkspaceFilesForActivity(context.Background(), "coding-lesson", "unknown"); !errors.Is(err, ErrExerciseNotFound) {
		t.Fatalf("unknown activity error=%v", err)
	}
}
