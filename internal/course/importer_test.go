package course

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func TestImportVersionOneCourse(t *testing.T) {
	course, err := Import(context.Background(), filepath.Join("..", "..", "examples", "frontend-performance-foundations"), t.TempDir())
	if err != nil {
		t.Fatal(err)
	}
	if course.Manifest.Id != "frontend-performance-foundations" || course.Digest == "" {
		t.Fatalf("course=%#v", course)
	}
	if _, err := os.Stat(filepath.Join(course.InstallPath, "course.json")); err != nil {
		t.Fatal(err)
	}
}

func TestImportRejectsTraversalAndSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	manifest := `{"schemaVersion":"1.0","id":"unsafe","title":"Unsafe","description":"Unsafe","version":"1.0.0","language":"en","lessons":[{"id":"lesson","position":1,"path":"../outside"}]}`
	if err := os.WriteFile(filepath.Join(root, "course.json"), []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	_, err := Import(context.Background(), root, t.TempDir())
	if err == nil {
		t.Fatal("expected unsafe path")
	}
	root = t.TempDir()
	manifest = `{"schemaVersion":"1.0","id":"unsafe","title":"Unsafe","description":"Unsafe","version":"1.0.0","language":"en","lessons":[{"id":"lesson","position":1,"path":"lesson"}]}`
	_ = os.WriteFile(filepath.Join(root, "course.json"), []byte(manifest), 0o600)
	_ = os.Symlink(filepath.Join(t.TempDir(), "outside"), filepath.Join(root, "lesson"))
	_, err = Import(context.Background(), root, t.TempDir())
	if !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("err=%v", err)
	}
}

func TestImportValidatesSchemaOneTwoActivitySets(t *testing.T) {
	root := t.TempDir()
	manifest := `{"schemaVersion":"1.2.0","id":"activities","title":"Activities","description":"Activities","version":"1.2.0","language":"en","chapters":[{"id":"chapter","title":"Chapter","required":true,"lessons":[{"id":"lesson","required":true}],"assessments":[]}]}`
	if err := os.WriteFile(filepath.Join(root, "course.json"), []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	lessonRoot := filepath.Join(root, "lessons", "lesson")
	if err := os.MkdirAll(filepath.Join(lessonRoot, "activities"), 0o755); err != nil {
		t.Fatal(err)
	}
	lesson := "---\nid: lesson\ntitle: Lesson\ntype: mixed\nactivitySets:\n  - activities/practice.json\n---\nBody\n"
	if err := os.WriteFile(filepath.Join(lessonRoot, "lesson.md"), []byte(lesson), 0o600); err != nil {
		t.Fatal(err)
	}
	set := `{"schemaVersion":"1.0","id":"practice","policy":{"purpose":"practice","maxAttempts":null,"feedbackMode":"immediate","revealAnswers":"never","scoring":"none","passingScore":null},"activities":[{"id":"question","path":"question.activity.json","required":true}]}`
	if err := os.WriteFile(filepath.Join(lessonRoot, "activities", "practice.json"), []byte(set), 0o600); err != nil {
		t.Fatal(err)
	}
	activity := `{"schemaVersion":"1.0","id":"question","kind":"true-false","title":"Question","prompt":{"blocks":[]},"config":{"expected":true},"evaluation":{"mode":"automatic","points":1},"completion":{"required":true}}`
	if err := os.WriteFile(filepath.Join(lessonRoot, "activities", "question.activity.json"), []byte(activity), 0o600); err != nil {
		t.Fatal(err)
	}

	if _, err := Import(context.Background(), root, t.TempDir()); err != nil {
		t.Fatal(err)
	}

	if err := os.Remove(filepath.Join(lessonRoot, "activities", "question.activity.json")); err != nil {
		t.Fatal(err)
	}
	_, err := Import(context.Background(), root, t.TempDir())
	if err == nil || activityErrorCode(err) != "ACTIVITY_REFERENCE_NOT_FOUND" {
		t.Fatalf("expected ACTIVITY_REFERENCE_NOT_FOUND, got %v", err)
	}
}
