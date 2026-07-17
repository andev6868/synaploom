package workspace

import (
	"context"
	"errors"
	"os"
	"path/filepath"
	"testing"
)

func fixtureDir(t *testing.T, name, content string) string {
	t.Helper()
	dir := filepath.Join(t.TempDir(), name)
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(dir, "main.js"), []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}
	return dir
}
func TestWriteFileRejectsEscape(t *testing.T) {
	m := Manager{Root: t.TempDir()}
	err := m.WriteFile(context.Background(), "course", "lesson", "../../outside", []byte("x"))
	if !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("err=%v", err)
	}
}
func TestPreparePreservesEditsAndResetRestoresStarter(t *testing.T) {
	starter := fixtureDir(t, "starter", "initial")
	checks := fixtureDir(t, "checks", "check")
	m := Manager{Root: t.TempDir()}
	if _, err := m.Prepare(context.Background(), "course", "lesson", starter, checks); err != nil {
		t.Fatal(err)
	}
	if err := m.WriteFile(context.Background(), "course", "lesson", "main.js", []byte("changed")); err != nil {
		t.Fatal(err)
	}
	if _, err := m.Prepare(context.Background(), "course", "lesson", starter, checks); err != nil {
		t.Fatal(err)
	}
	data, _ := m.ReadFile(context.Background(), "course", "lesson", "main.js")
	if string(data) != "changed" {
		t.Fatalf("prepare overwrote edit: %q", data)
	}
	if err := m.Reset(context.Background(), "course", "lesson", starter, checks); err != nil {
		t.Fatal(err)
	}
	data, _ = m.ReadFile(context.Background(), "course", "lesson", "main.js")
	if string(data) != "initial" {
		t.Fatalf("reset=%q", data)
	}
	if _, err := m.ReadFile(context.Background(), "course", "lesson", filepath.Join(".synaploom", "checks", "main.js")); err != nil {
		t.Fatal(err)
	}
}
func TestWriteRejectsSymlinkEscape(t *testing.T) {
	root := t.TempDir()
	outside := t.TempDir()
	lesson := filepath.Join(root, "course", "lesson")
	if err := os.MkdirAll(lesson, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(outside, filepath.Join(lesson, "link")); err != nil {
		t.Skipf("symlink unavailable: %v", err)
	}
	m := Manager{Root: root}
	if err := m.WriteFile(context.Background(), "course", "lesson", filepath.Join("link", "x"), []byte("x")); !errors.Is(err, ErrUnsafePath) {
		t.Fatalf("err=%v", err)
	}
}
