package app

import (
	"context"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/course"
)

func TestOpenInstalledCourseReusesPersistentWorkspace(t *testing.T) {
	t.Parallel()
	ctx := context.Background()
	home := t.TempDir()
	source := filepath.Join("..", "..", "examples", "multi-domain-foundations")
	if _, err := course.Import(ctx, source, filepath.Join(home, "courses")); err != nil {
		t.Fatalf("import course: %v", err)
	}

	first, err := openInstalledCourse(home, "multi-domain-foundations")
	if err != nil {
		t.Fatalf("open first service: %v", err)
	}
	content := []byte("function sum(a, b) { return a + b; }\n")
	if err := first.WriteWorkspaceFileForActivity(ctx, "algorithm-flow", "sum-program", "index.js", content); err != nil {
		t.Fatalf("write workspace file: %v", err)
	}

	second, err := openInstalledCourse(home, "multi-domain-foundations")
	if err != nil {
		t.Fatalf("open second service: %v", err)
	}
	got, err := second.ReadWorkspaceFileForActivity(ctx, "algorithm-flow", "sum-program", "index.js")
	if err != nil {
		t.Fatalf("read workspace file: %v", err)
	}
	if string(got) != string(content) {
		t.Fatalf("workspace content = %q, want %q", got, content)
	}
}
