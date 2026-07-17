package app

import (
	"context"
	"fmt"
	"os"
	"path/filepath"

	"github.com/synaploom/synaploom/internal/storage"
	"github.com/synaploom/synaploom/internal/workspace"
)

// Runtime owns persistent services for one preview daemon lifetime.
type Runtime struct {
	Home       string
	Database   *storage.Database
	Workspaces *workspace.Manager
}

// OpenRuntime opens the persistent state and workspace roots used by the Go preview.
func OpenRuntime(ctx context.Context, home string) (*Runtime, error) {
	if home == "" {
		return nil, fmt.Errorf("open runtime: empty home")
	}
	for _, directory := range []string{filepath.Join(home, "state"), filepath.Join(home, "workspaces"), filepath.Join(home, "courses"), filepath.Join(home, "logs")} {
		if err := os.MkdirAll(directory, 0o700); err != nil {
			return nil, fmt.Errorf("open runtime: %w", err)
		}
	}
	database, err := storage.Open(ctx, filepath.Join(home, "state", "synaploom.db"))
	if err != nil {
		return nil, err
	}
	return &Runtime{Home: home, Database: database, Workspaces: &workspace.Manager{Root: filepath.Join(home, "workspaces"), InstalledCoursesRoot: filepath.Join(home, "courses")}}, nil
}

// Close closes persistent runtime resources.
func (r *Runtime) Close() error {
	if r == nil {
		return nil
	}
	return r.Database.Close()
}
