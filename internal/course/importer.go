package course

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"

	generated "github.com/synaploom/synaploom/generated/go/contracts"
	contractvalidator "github.com/synaploom/synaploom/internal/contracts"
)

var ErrUnsafePath = errors.New("unsafe path")

type InstalledCourse struct {
	Manifest    generated.CourseManifest
	SourcePath  string
	InstallPath string
	Digest      string
}

func Import(ctx context.Context, sourcePath, destinationRoot string) (InstalledCourse, error) {
	_ = ctx
	source, err := filepath.Abs(sourcePath)
	if err != nil {
		return InstalledCourse{}, err
	}
	manifestPath := filepath.Join(source, "course.json")
	data, err := os.ReadFile(manifestPath)
	if err != nil {
		return InstalledCourse{}, fmt.Errorf("read course manifest: %w", err)
	}
	var raw any
	if err := json.Unmarshal(data, &raw); err != nil {
		return InstalledCourse{}, fmt.Errorf("decode course manifest: %w", err)
	}
	if err := contractvalidator.NewValidator().Validate("course", raw); err != nil {
		return InstalledCourse{}, fmt.Errorf("validate course manifest: %w", err)
	}
	var manifest generated.CourseManifest
	if err := json.Unmarshal(data, &manifest); err != nil {
		return InstalledCourse{}, err
	}
	for _, lesson := range manifest.Lessons {
		if err := validateRelativePath(lesson.Path); err != nil {
			return InstalledCourse{}, err
		}
	}
	if err := walkSafe(source); err != nil {
		return InstalledCourse{}, err
	}
	digest, err := hashTree(source)
	if err != nil {
		return InstalledCourse{}, err
	}
	install := filepath.Join(destinationRoot, manifest.Id, manifest.Version)
	if err := os.MkdirAll(filepath.Dir(install), 0o700); err != nil {
		return InstalledCourse{}, err
	}
	staging := install + ".partial"
	_ = os.RemoveAll(staging)
	if err := copyTree(source, staging); err != nil {
		_ = os.RemoveAll(staging)
		return InstalledCourse{}, err
	}
	_ = os.RemoveAll(install)
	if err := os.Rename(staging, install); err != nil {
		return InstalledCourse{}, err
	}
	if installedDigest, err := hashTree(install); err != nil || installedDigest != digest {
		if err == nil {
			err = errors.New("course copy hash mismatch")
		}
		return InstalledCourse{}, err
	}
	return InstalledCourse{Manifest: manifest, SourcePath: source, InstallPath: install, Digest: digest}, nil
}

func validateRelativePath(value string) error {
	if value == "" || filepath.IsAbs(value) || filepath.VolumeName(value) != "" {
		return ErrUnsafePath
	}
	clean := filepath.Clean(filepath.FromSlash(value))
	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return ErrUnsafePath
	}
	return nil
}

func walkSafe(root string) error {
	return filepath.WalkDir(root, func(path string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("%w: symlink %s", ErrUnsafePath, path)
		}
		return nil
	})
}

func hashTree(root string) (string, error) {
	var files []string
	if err := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.Type().IsRegular() {
			rel, _ := filepath.Rel(root, path)
			files = append(files, filepath.ToSlash(rel))
		}
		return nil
	}); err != nil {
		return "", err
	}
	sort.Strings(files)
	h := sha256.New()
	for _, rel := range files {
		io.WriteString(h, rel)
		h.Write([]byte{0})
		data, err := os.ReadFile(filepath.Join(root, filepath.FromSlash(rel)))
		if err != nil {
			return "", err
		}
		h.Write(data)
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

func copyTree(source, destination string) error {
	return filepath.WalkDir(source, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		rel, _ := filepath.Rel(source, path)
		target := filepath.Join(destination, rel)
		if d.IsDir() {
			return os.MkdirAll(target, 0o700)
		}
		if !d.Type().IsRegular() {
			return ErrUnsafePath
		}
		input, err := os.Open(path)
		if err != nil {
			return err
		}
		defer input.Close()
		output, err := os.OpenFile(target, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(output, input)
		closeErr := output.Close()
		if copyErr != nil {
			return copyErr
		}
		return closeErr
	})
}
