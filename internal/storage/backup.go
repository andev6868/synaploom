package storage

import (
	"context"
	"database/sql"
	"fmt"
	"io"
	"os"
	"time"
)

// BackupVerified creates an fsynced timestamped copy and verifies it with SQLite integrity_check.
func BackupVerified(ctx context.Context, source string) (string, error) {
	input, err := os.Open(source)
	if err != nil {
		return "", err
	}
	defer input.Close()

	backup := source + ".backup-" + time.Now().UTC().Format("20060102T150405.000000000Z")
	output, err := os.OpenFile(backup, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return "", err
	}
	ok := false
	defer func() {
		_ = output.Close()
		if !ok {
			_ = os.Remove(backup)
		}
	}()
	if _, err := io.Copy(output, input); err != nil {
		return "", err
	}
	if err := output.Sync(); err != nil {
		return "", err
	}
	if err := output.Close(); err != nil {
		return "", err
	}

	db, err := sql.Open("sqlite", "file:"+backup+"?mode=ro")
	if err != nil {
		return "", err
	}
	defer db.Close()
	var integrity string
	if err := db.QueryRowContext(ctx, "PRAGMA integrity_check").Scan(&integrity); err != nil {
		return "", err
	}
	if integrity != "ok" {
		return "", fmt.Errorf("integrity_check=%q", integrity)
	}
	ok = true
	return backup, nil
}
