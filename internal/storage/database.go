package storage

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	_ "modernc.org/sqlite"
)

// Database owns the SQLite connection and records the verified backup created before migration.
type Database struct {
	SQL        *sql.DB
	Path       string
	BackupPath string
}

// Open opens a Synaploom database, creates a verified backup when an existing file requires
// migration, and applies all embedded migrations in order.
func Open(ctx context.Context, path string) (*Database, error) {
	if path == "" {
		return nil, errors.New("storage open: empty database path")
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return nil, fmt.Errorf("storage open: create directory: %w", err)
	}

	backupPath := ""
	if info, err := os.Stat(path); err == nil && info.Size() > 0 {
		backupPath, err = BackupVerified(ctx, path)
		if err != nil {
			return nil, fmt.Errorf("storage open: backup %q: %w", path, err)
		}
	} else if err != nil && !errors.Is(err, os.ErrNotExist) {
		return nil, fmt.Errorf("storage open: stat: %w", err)
	}

	db, err := sql.Open("sqlite", path)
	if err != nil {
		return nil, fmt.Errorf("storage open: sqlite: %w", err)
	}
	closeOnError := true
	defer func() {
		if closeOnError {
			_ = db.Close()
		}
	}()
	for _, pragma := range []string{"PRAGMA foreign_keys=ON", "PRAGMA journal_mode=WAL", "PRAGMA busy_timeout=5000"} {
		if _, err := db.ExecContext(ctx, pragma); err != nil {
			return nil, fmt.Errorf("storage open: %s: %w", pragma, err)
		}
	}
	if err := applyMigrations(ctx, db); err != nil {
		if backupPath != "" {
			return nil, fmt.Errorf("storage open: migrate (backup: %s): %w", backupPath, err)
		}
		return nil, fmt.Errorf("storage open: migrate: %w", err)
	}
	closeOnError = false
	return &Database{SQL: db, Path: path, BackupPath: backupPath}, nil
}

// Close closes the underlying SQLite connection.
func (d *Database) Close() error {
	if d == nil || d.SQL == nil {
		return nil
	}
	return d.SQL.Close()
}
