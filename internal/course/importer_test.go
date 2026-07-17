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
