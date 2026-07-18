package course

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"
)

func writeJSONFixture(t *testing.T, path string, value any) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
}

func TestLoadActivitySetsLoadsOwnerRelativeActivities(t *testing.T) {
	root := t.TempDir()
	writeJSONFixture(t, filepath.Join(root, "activities", "set.json"), map[string]any{
		"schemaVersion": "1.0",
		"id":            "practice",
		"policy": map[string]any{
			"purpose": "practice", "maxAttempts": nil, "feedbackMode": "immediate",
			"revealAnswers": "after-submit", "scoring": "none", "passingScore": nil,
		},
		"activities": []any{map[string]any{"id": "question", "path": "question.activity.json", "required": true}},
	})
	writeJSONFixture(t, filepath.Join(root, "activities", "question.activity.json"), map[string]any{
		"schemaVersion": "1.0", "id": "question", "kind": "true-false", "title": "Question",
		"prompt": map[string]any{"blocks": []any{}}, "config": map[string]any{"expected": true},
		"evaluation": map[string]any{"mode": "automatic", "points": 1},
		"completion": map[string]any{"required": true},
	})

	sets, err := LoadActivitySets(context.Background(), root, []string{"activities/set.json"})
	if err != nil {
		t.Fatal(err)
	}
	if len(sets) != 1 || len(sets[0].Activities) != 1 {
		t.Fatalf("unexpected activity sets: %#v", sets)
	}
	if sets[0].Activities[0].ID != "question" || sets[0].Activities[0].Kind != "true-false" {
		t.Fatalf("unexpected activity: %#v", sets[0].Activities[0])
	}
}

func TestLoadActivitySetsRejectsOwnerPathEscape(t *testing.T) {
	_, err := LoadActivitySets(context.Background(), t.TempDir(), []string{"../set.json"})
	if err == nil || activityErrorCode(err) != "DOCUMENT_ASSET_OUTSIDE_COURSE" {
		t.Fatalf("expected DOCUMENT_ASSET_OUTSIDE_COURSE, got %v", err)
	}
}

func TestParseLessonFrontMatterReadsActivitySets(t *testing.T) {
	frontMatter, _, err := parseLessonFrontMatter([]byte("---\nid: lesson\ntitle: Lesson\ntype: mixed\nactivitySets:\n  - activities/practice.json\n  - activities/checkpoint.json\n---\nBody\n"))
	if err != nil {
		t.Fatal(err)
	}
	if len(frontMatter.ActivitySets) != 2 || frontMatter.ActivitySets[1] != "activities/checkpoint.json" {
		t.Fatalf("activitySets=%#v", frontMatter.ActivitySets)
	}
}

func TestLoadLessonActivitySetsAdaptsLegacyExercise(t *testing.T) {
	root := t.TempDir()
	writeJSONFixture(t, filepath.Join(root, "exercise.json"), map[string]any{
		"schemaVersion": "1.0", "id": "legacy-code", "title": "Legacy Code",
		"runtime":   map[string]any{"kind": "local", "requires": []string{"node"}},
		"workspace": map[string]any{"editable": []string{"index.js"}},
		"actions":   map[string]any{}, "checks": []any{},
		"completion": map[string]any{"requireAllRequiredChecks": true},
	})
	sets, err := loadLessonActivitySets(context.Background(), root, lessonFrontMatter{Exercise: "exercise.json"})
	if err != nil {
		t.Fatal(err)
	}
	if len(sets) != 1 || sets[0].Activities[0].Kind != "coding" {
		t.Fatalf("legacy sets=%#v", sets)
	}
}
