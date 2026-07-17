package workspace

import (
	"context"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
)

type Manager struct {
	Root                 string
	InstalledCoursesRoot string
}

func (m Manager) lessonRoot(courseID, lessonID string) (string, error) {
	if _, err := safeJoin(m.Root, filepath.Join(courseID, lessonID)); err != nil {
		return "", err
	}
	return filepath.Join(m.Root, courseID, lessonID), nil
}

func (m Manager) Prepare(ctx context.Context, courseID, lessonID, starterDir, checksDir string) (string, error) {
	_ = ctx
	root, err := m.lessonRoot(courseID, lessonID)
	if err != nil {
		return "", err
	}
	if _, err := os.Stat(root); err == nil {
		return root, nil
	} else if !os.IsNotExist(err) {
		return "", err
	}
	staging := root + ".partial"
	_ = os.RemoveAll(staging)
	if err := copyTree(starterDir, staging); err != nil {
		return "", err
	}
	if checksDir != "" {
		if err := copyTree(checksDir, filepath.Join(staging, ".synaploom", "checks")); err != nil {
			_ = os.RemoveAll(staging)
			return "", err
		}
	}
	if err := os.MkdirAll(filepath.Dir(root), 0o700); err != nil {
		return "", err
	}
	if err := os.Rename(staging, root); err != nil {
		return "", err
	}
	return root, nil
}

func (m Manager) ReadFile(ctx context.Context, courseID, lessonID, relative string) ([]byte, error) {
	_ = ctx
	root, err := m.lessonRoot(courseID, lessonID)
	if err != nil {
		return nil, err
	}
	path, err := safeJoin(root, relative)
	if err != nil {
		return nil, err
	}
	return os.ReadFile(path)
}

func (m Manager) WriteFile(ctx context.Context, courseID, lessonID, relative string, data []byte) error {
	_ = ctx
	root, err := m.lessonRoot(courseID, lessonID)
	if err != nil {
		return err
	}
	path, err := safeJoin(root, relative)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	return os.WriteFile(path, data, 0o600)
}

func (m Manager) Reset(ctx context.Context, courseID, lessonID, starterDir, checksDir string) error {
	_ = ctx
	root, err := m.lessonRoot(courseID, lessonID)
	if err != nil {
		return err
	}
	staging := root + ".reset"
	_ = os.RemoveAll(staging)
	if err := copyTree(starterDir, staging); err != nil {
		return err
	}
	if checksDir != "" {
		if err := copyTree(checksDir, filepath.Join(staging, ".synaploom", "checks")); err != nil {
			return err
		}
	}
	backup := root + ".old"
	_ = os.RemoveAll(backup)
	if err := os.Rename(root, backup); err != nil && !os.IsNotExist(err) {
		return err
	}
	if err := os.Rename(staging, root); err != nil {
		_ = os.Rename(backup, root)
		return err
	}
	return os.RemoveAll(backup)
}

func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("%w: symlink %s", ErrUnsafePath, path)
		}
		rel, err := filepath.Rel(source, path)
		if err != nil {
			return err
		}
		target := filepath.Join(destination, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		if !d.Type().IsRegular() {
			return ErrUnsafePath
		}
		if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
			return err
		}
		in, err := os.Open(path)
		if err != nil {
			return err
		}
		defer in.Close()
		out, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(out, in)
		closeErr := out.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}
