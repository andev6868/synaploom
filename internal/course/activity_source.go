package course

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	contractvalidator "github.com/synaploom/synaploom/internal/contracts"
)

type ActivitySource struct {
	ID             string
	Kind           string
	Path           string
	EvaluationMode string
	Definition     map[string]any
}

type ActivitySetSource struct {
	Path       string
	Definition contracts.ActivitySetDefinition
	Activities []ActivitySource
}

type activitySourceError struct {
	Code string
	Path string
	Err  error
}

func (e *activitySourceError) Error() string {
	if e.Path == "" {
		return fmt.Sprintf("%s: %v", e.Code, e.Err)
	}
	return fmt.Sprintf("%s at %s: %v", e.Code, e.Path, e.Err)
}

func (e *activitySourceError) Unwrap() error { return e.Err }

func activityErrorCode(err error) string {
	var sourceErr *activitySourceError
	if errors.As(err, &sourceErr) {
		return sourceErr.Code
	}
	return ""
}

func resolveOwnerPath(ownerRoot, ref string) (string, error) {
	clean := filepath.Clean(filepath.FromSlash(ref))
	if ref == "" || filepath.IsAbs(clean) || filepath.VolumeName(clean) != "" || clean == ".." || strings.HasPrefix(clean, ".."+string(filepath.Separator)) {
		return "", &activitySourceError{Code: "DOCUMENT_ASSET_OUTSIDE_COURSE", Path: ref, Err: ErrUnsafePath}
	}
	resolved := filepath.Join(ownerRoot, clean)
	relative, err := filepath.Rel(ownerRoot, resolved)
	if err != nil || relative == ".." || strings.HasPrefix(relative, ".."+string(filepath.Separator)) {
		return "", &activitySourceError{Code: "DOCUMENT_ASSET_OUTSIDE_COURSE", Path: ref, Err: ErrUnsafePath}
	}
	return resolved, nil
}

func LoadActivitySets(ctx context.Context, ownerRoot string, refs []string) ([]ActivitySetSource, error) {
	validator := contractvalidator.NewValidator()
	sets := make([]ActivitySetSource, 0, len(refs))
	for _, ref := range refs {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		setPath, err := resolveOwnerPath(ownerRoot, ref)
		if err != nil {
			return nil, err
		}
		data, err := os.ReadFile(setPath)
		if err != nil {
			return nil, &activitySourceError{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Path: ref, Err: err}
		}
		var definition contracts.ActivitySetDefinition
		if err := json.Unmarshal(data, &definition); err != nil {
			return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: ref, Err: err}
		}
		if string(definition.Id) == "" || len(definition.Activities) == 0 {
			return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: ref, Err: errors.New("activity set requires id and activities")}
		}

		set := ActivitySetSource{Path: filepath.ToSlash(ref), Definition: definition}
		activityRoot := filepath.Dir(setPath)
		for _, reference := range definition.Activities {
			activityPath, err := resolveOwnerPath(activityRoot, string(reference.Path))
			if err != nil {
				return nil, err
			}
			rawData, err := os.ReadFile(activityPath)
			if err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Path: string(reference.Path), Err: err}
			}
			var raw map[string]any
			if err := json.Unmarshal(rawData, &raw); err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: string(reference.Path), Err: err}
			}
			if err := validator.Validate("activity", raw); err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: string(reference.Path), Err: err}
			}
			id, _ := raw["id"].(string)
			kind, _ := raw["kind"].(string)
			evaluationMode := ""
			if evaluation, ok := raw["evaluation"].(map[string]any); ok {
				evaluationMode, _ = evaluation["mode"].(string)
			}
			relative, _ := filepath.Rel(ownerRoot, activityPath)
			set.Activities = append(set.Activities, ActivitySource{
				ID: id, Kind: kind, Path: filepath.ToSlash(relative), EvaluationMode: evaluationMode, Definition: raw,
			})
		}
		activityMap := make(map[string]ActivitySource, len(set.Activities))
		for _, activity := range set.Activities {
			activityMap[activity.ID] = activity
		}
		if issues := ValidateActivitySet(set, activityMap); len(issues) > 0 {
			return nil, &activitySourceError{Code: issues[0].Code, Path: issues[0].Path, Err: errors.New(issues[0].Message)}
		}
		sets = append(sets, set)
	}
	return sets, nil
}

func loadLessonActivitySets(ctx context.Context, lessonDir string, frontMatter lessonFrontMatter) ([]ActivitySetSource, error) {
	if len(frontMatter.ActivitySets) > 0 {
		return LoadActivitySets(ctx, lessonDir, frontMatter.ActivitySets)
	}
	if frontMatter.Exercise == "" {
		return nil, nil
	}
	exercisePath, err := resolveOwnerPath(lessonDir, frontMatter.Exercise)
	if err != nil {
		return nil, err
	}
	data, err := os.ReadFile(exercisePath)
	if err != nil {
		return nil, &activitySourceError{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Path: frontMatter.Exercise, Err: err}
	}
	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil {
		return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: frontMatter.Exercise, Err: err}
	}
	id, _ := config["id"].(string)
	if id == "" {
		return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: frontMatter.Exercise, Err: errors.New("legacy exercise requires id")}
	}
	activity := ActivitySource{
		ID: id, Kind: "coding", Path: filepath.ToSlash(frontMatter.Exercise), EvaluationMode: "coding",
		Definition: map[string]any{
			"schemaVersion": "1.0", "id": id, "kind": "coding", "title": config["title"],
			"prompt": map[string]any{"blocks": []any{}}, "config": config,
			"evaluation": map[string]any{"mode": "coding", "points": 1},
			"completion": map[string]any{"required": true},
		},
	}
	definition := contracts.ActivitySetDefinition{
		SchemaVersion: "1.0",
		Id:            contracts.Id(id + "-practice"),
		Policy: contracts.ActivitySetPolicy{
			Purpose:       contracts.ActivitySetPolicyPurposePractice,
			MaxAttempts:   nil,
			FeedbackMode:  contracts.ActivitySetPolicyFeedbackModeImmediate,
			RevealAnswers: contracts.ActivitySetPolicyRevealAnswersNever,
			Scoring:       contracts.ActivitySetPolicyScoringNone,
			PassingScore:  nil,
		},
		Activities: []contracts.ActivityReference{{Id: contracts.Id(id), Path: contracts.SafePath(frontMatter.Exercise), Required: true}},
	}
	return []ActivitySetSource{{Path: filepath.ToSlash(frontMatter.Exercise), Definition: definition, Activities: []ActivitySource{activity}}}, nil
}

func loadCourseActivitySets(ctx context.Context, courseRoot string, manifest contracts.CourseManifest) (map[string][]ActivitySetSource, error) {
	lessonRoots, err := courseLessonRoots(courseRoot, manifest)
	if err != nil {
		return nil, err
	}
	loaded := make(map[string][]ActivitySetSource, len(lessonRoots))
	for _, lessonRoot := range lessonRoots {
		if err := ctx.Err(); err != nil {
			return nil, err
		}
		lessonPath := filepath.Join(lessonRoot, "lesson.md")
		data, err := os.ReadFile(lessonPath)
		if err != nil {
			return nil, fmt.Errorf("read lesson source %s: %w", lessonPath, err)
		}
		frontMatter, _, err := parseLessonFrontMatter(data)
		if err != nil {
			return nil, fmt.Errorf("parse lesson source %s: %w", lessonPath, err)
		}
		if frontMatter.ID == "" {
			return nil, fmt.Errorf("lesson source %s is missing id", lessonPath)
		}
		if manifest.SchemaVersion == contracts.CourseManifestSchemaVersionA120 && frontMatter.Exercise != "" {
			return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: lessonPath, Err: errors.New("Course Schema 1.2 lessons must use activitySets instead of exercise")}
		}
		sets, err := loadLessonActivitySets(ctx, lessonRoot, frontMatter)
		if err != nil {
			return nil, err
		}
		loaded[frontMatter.ID] = sets
	}
	return loaded, nil
}

func courseLessonRoots(courseRoot string, manifest contracts.CourseManifest) ([]string, error) {
	if manifest.SchemaVersion == contracts.CourseManifestSchemaVersionA10 {
		roots := make([]string, 0, len(manifest.Lessons))
		for _, lesson := range manifest.Lessons {
			resolved, err := resolveOwnerPath(courseRoot, string(lesson.Path))
			if err != nil {
				return nil, err
			}
			roots = append(roots, resolved)
		}
		return roots, nil
	}
	if manifest.SchemaVersion != contracts.CourseManifestSchemaVersionA110 && manifest.SchemaVersion != contracts.CourseManifestSchemaVersionA120 {
		return nil, fmt.Errorf("unsupported course schema version %q", manifest.SchemaVersion)
	}
	entries, err := os.ReadDir(filepath.Join(courseRoot, "lessons"))
	if err != nil {
		return nil, fmt.Errorf("read lessons directory: %w", err)
	}
	roots := make([]string, 0, len(entries))
	for _, entry := range entries {
		if entry.IsDir() {
			roots = append(roots, filepath.Join(courseRoot, "lessons", entry.Name()))
		}
	}
	return roots, nil
}
