package course

import (
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

func safeLinkDestination(raw string) (string, bool) {
	raw = strings.TrimSpace(raw)
	if strings.HasPrefix(raw, "#") {
		return raw, true
	}
	parsed, err := url.Parse(raw)
	if err != nil {
		return "", false
	}
	if parsed.IsAbs() {
		switch strings.ToLower(parsed.Scheme) {
		case "https", "http", "mailto":
			return raw, true
		default:
			return "", false
		}
	}
	clean := filepath.Clean(filepath.FromSlash(raw))
	if clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", false
	}
	return raw, true
}

func (s *markdownState) validateMediaPath(raw string) bool {
	if raw == "" {
		s.issue("DOCUMENT_ASSET_INVALID", "media source is required", raw)
		return false
	}
	if parsed, err := url.Parse(raw); err == nil && parsed.IsAbs() {
		if s.options.Strict {
			s.issue("DOCUMENT_ASSET_REMOTE", "remote media is not allowed", raw)
			return false
		}
		return true
	}
	if err := validateRelativePath(raw); err != nil {
		s.issue("DOCUMENT_ASSET_OUTSIDE_COURSE", "media source escapes the course", raw)
		return false
	}
	if s.options.CourseRoot == "" || s.options.LessonRoot == "" {
		return true
	}
	resolved := filepath.Join(s.options.LessonRoot, filepath.FromSlash(raw))
	relative, err := filepath.Rel(s.options.CourseRoot, resolved)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		s.issue("DOCUMENT_ASSET_OUTSIDE_COURSE", "media source escapes the course", raw)
		return false
	}
	if _, err := os.Stat(resolved); err != nil {
		s.issue("DOCUMENT_ASSET_NOT_FOUND", "media source was not found", raw)
		return false
	}
	return true
}

func ValidateAssetPath(path string) error {
	return validateRelativePath(path)
}
