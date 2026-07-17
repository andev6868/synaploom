package storage

import (
	"context"
	"path/filepath"
	"testing"
)

func TestProgressRepositoryRejectsMalformedStatus(t *testing.T) {
	db, err := Open(context.Background(), filepath.Join(t.TempDir(), "state.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if _, err := db.SQL.Exec(`PRAGMA ignore_check_constraints=ON`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.SQL.Exec(`INSERT INTO lesson_progress(course_id,version,lesson_id,position,status,reading_acknowledged) VALUES('c','1','l',1,'BROKEN',0)`); err != nil {
		t.Fatal(err)
	}
	if _, err := NewProgressRepository(db.SQL).Lesson(context.Background(), "c", "1", "l"); err == nil {
		t.Fatal("expected malformed status error")
	}
}
