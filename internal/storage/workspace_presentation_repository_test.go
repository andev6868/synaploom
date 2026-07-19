package storage

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestWorkspacePresentationRepositoryPersistsAndConflicts(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "workspace.db")
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	repository := NewWorkspacePresentationRepository(db.SQL)
	key := WorkspacePresentationKey{ProfileID: "local", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a"}
	fixed := time.Date(2026, 7, 19, 1, 2, 3, 4, time.FixedZone("test", 3600))
	first, err := repository.Put(ctx, WorkspacePresentationWrite{Key: key, PaneMode: "collapsed", SplitRatio: 0.45, ExpectedRevision: 0, At: fixed})
	if err != nil {
		t.Fatal(err)
	}
	if first.Revision != 1 || first.UpdatedAt != fixed.UTC().Format(time.RFC3339Nano) {
		t.Fatalf("first=%+v", first)
	}
	focus := "quiz"
	second, err := repository.Put(ctx, WorkspacePresentationWrite{Key: key, FocusedActivityID: &focus, PaneMode: "split", SplitRatio: 0.5, ExpectedRevision: 1, At: fixed.Add(time.Second)})
	if err != nil {
		t.Fatal(err)
	}
	if second.Revision != 2 || second.FocusedActivityID == nil || *second.FocusedActivityID != focus {
		t.Fatalf("second=%+v", second)
	}
	_, err = repository.Put(ctx, WorkspacePresentationWrite{Key: key, PaneMode: "collapsed", SplitRatio: 0.45, ExpectedRevision: 1})
	if !errors.Is(err, ErrWorkspacePresentationRevisionConflict) {
		t.Fatalf("err=%v", err)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	reopened, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer reopened.Close()
	persisted, err := NewWorkspacePresentationRepository(reopened.SQL).Get(ctx, key)
	if err != nil {
		t.Fatal(err)
	}
	if persisted == nil || persisted.Revision != 2 || persisted.FocusedActivityID == nil {
		t.Fatalf("persisted=%+v", persisted)
	}
}

func TestWorkspacePresentationRepositoryIsolatesOwnerAndProfile(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "workspace.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repository := NewWorkspacePresentationRepository(db.SQL)
	keys := []WorkspacePresentationKey{
		{ProfileID: "local", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a"},
		{ProfileID: "local", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-b"},
		{ProfileID: "other", CourseID: "course", OwnerKind: "lessons", OwnerID: "lesson-a"},
	}
	for index, key := range keys {
		if _, err := repository.Put(ctx, WorkspacePresentationWrite{Key: key, PaneMode: "collapsed", SplitRatio: 0.45 + float64(index)/100, ExpectedRevision: 0}); err != nil {
			t.Fatal(err)
		}
	}
	for index, key := range keys {
		got, err := repository.Get(ctx, key)
		if err != nil {
			t.Fatal(err)
		}
		want := 0.45 + float64(index)/100
		if got == nil || got.SplitRatio != want {
			t.Fatalf("key=%+v got=%+v", key, got)
		}
	}
}
