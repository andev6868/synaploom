package gointegration

import (
	"context"
	"os"
	"path/filepath"
	"testing"

	"github.com/synaploom/synaploom/internal/app"
	"github.com/synaploom/synaploom/internal/storage"
)

func TestRestartPreservesCurrentLessonAndWorkspace(t *testing.T) {
	ctx := context.Background()
	home := t.TempDir()
	starter := t.TempDir()
	if err := os.WriteFile(filepath.Join(starter, "main.js"), []byte("starter"), 0o600); err != nil {
		t.Fatal(err)
	}

	first, err := app.OpenRuntime(ctx, home)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := first.Database.SQL.Exec(`INSERT INTO course_progress(course_id,version,current_lesson_id,started_at) VALUES('course','1.0.0','lesson-1','2026-07-17T00:00:00Z')`); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Database.SQL.Exec(`INSERT INTO lesson_progress(course_id,version,lesson_id,position,status,reading_acknowledged) VALUES ('course','1.0.0','lesson-1',1,'AVAILABLE',0),('course','1.0.0','lesson-2',2,'LOCKED',0)`); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Database.SQL.Exec(`UPDATE lesson_progress SET status='COMPLETED',reading_acknowledged=1 WHERE lesson_id='lesson-1'`); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Database.SQL.Exec(`UPDATE lesson_progress SET status='IN_PROGRESS' WHERE lesson_id='lesson-2'`); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Database.SQL.Exec(`UPDATE course_progress SET current_lesson_id='lesson-2' WHERE course_id='course' AND version='1.0.0'`); err != nil {
		t.Fatal(err)
	}
	if _, err := first.Workspaces.Prepare(ctx, "course", "lesson-2", starter, ""); err != nil {
		t.Fatal(err)
	}
	if err := first.Workspaces.WriteFile(ctx, "course", "lesson-2", "main.js", []byte("changed")); err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}

	second, err := app.OpenRuntime(ctx, home)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	current, err := storage.NewProgressRepository(second.Database.SQL).CurrentLessonID(ctx, second.Database.SQL, "course", "1.0.0")
	if err != nil {
		t.Fatal(err)
	}
	if current != "lesson-2" {
		t.Fatalf("current lesson=%q", current)
	}
	data, err := second.Workspaces.ReadFile(ctx, "course", "lesson-2", "main.js")
	if err != nil {
		t.Fatal(err)
	}
	if string(data) != "changed" {
		t.Fatalf("workspace=%q", data)
	}
}
