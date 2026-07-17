package storage

import (
	"context"
	"os"
	"path/filepath"
	"testing"
)

func TestOpenMigratesNodeDatabaseWithoutLosingProgress(t *testing.T) {
	t.Parallel()
	source := filepath.Join("..", "..", "tests", "fixtures", "databases", "node-0.1.x.db")
	path := filepath.Join(t.TempDir(), "synaploom.db")
	data, err := os.ReadFile(source)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}

	database, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer database.Close()
	if database.BackupPath == "" {
		t.Fatal("expected verified backup")
	}
	if _, err := os.Stat(database.BackupPath); err != nil {
		t.Fatal(err)
	}
	var current string
	if err := database.SQL.QueryRow(`SELECT current_lesson_id FROM course_progress WHERE course_id='demo' AND version='1.0.0'`).Scan(&current); err != nil {
		t.Fatal(err)
	}
	if current != "lesson-2" {
		t.Fatalf("current lesson=%q", current)
	}
	var applied int
	if err := database.SQL.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&applied); err != nil {
		t.Fatal(err)
	}
	if applied != 3 {
		t.Fatalf("applied migrations=%d", applied)
	}
}

func TestOpenIsIdempotent(t *testing.T) {
	path := filepath.Join(t.TempDir(), "synaploom.db")
	first, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	if err := first.Close(); err != nil {
		t.Fatal(err)
	}
	second, err := Open(context.Background(), path)
	if err != nil {
		t.Fatal(err)
	}
	defer second.Close()
	var count int
	if err := second.SQL.QueryRow(`SELECT COUNT(*) FROM schema_migrations`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 3 {
		t.Fatalf("migration count=%d", count)
	}
}
