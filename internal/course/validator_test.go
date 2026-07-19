package course

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidateRejectsLessonDocumentThatCannotRender(t *testing.T) {
	root := t.TempDir()
	manifest := `{"schemaVersion":"1.2.0","id":"invalid-rich-content","title":"Invalid","description":"Invalid","version":"1.2.0","language":"vi","chapters":[{"id":"chapter","title":"Chapter","required":true,"lessons":[{"id":"lesson","required":true}],"assessments":[]}]}`
	if err := os.WriteFile(filepath.Join(root, "course.json"), []byte(manifest), 0o600); err != nil {
		t.Fatal(err)
	}
	lessonRoot := filepath.Join(root, "lessons", "lesson")
	if err := os.MkdirAll(lessonRoot, 0o755); err != nil {
		t.Fatal(err)
	}
	lesson := "---\nid: lesson\ntitle: Lesson\nposition: 1\ntype: theory\n---\n\n# Lesson\n\nThis has $unbalanced math.\n"
	if err := os.WriteFile(filepath.Join(lessonRoot, "lesson.md"), []byte(lesson), 0o600); err != nil {
		t.Fatal(err)
	}

	err := Validate(root)
	if err == nil || !strings.Contains(err.Error(), "MATH_SOURCE_INVALID") {
		t.Fatalf("err=%v", err)
	}
}
