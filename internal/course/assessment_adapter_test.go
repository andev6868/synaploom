package course

import (
	"context"
	"encoding/json"
	"os"
	"path/filepath"
	"testing"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
	"github.com/synaploom/synaploom/internal/activity"
)

func assessmentManifestFixture(t *testing.T, root, assessmentJSON string) contracts.CourseManifest {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(root, "assessments", "checkpoint"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "assessments", "checkpoint", "assessment.json"), []byte(assessmentJSON), 0o600); err != nil {
		t.Fatal(err)
	}
	var manifest contracts.CourseManifest
	if err := json.Unmarshal([]byte(`{
		"schemaVersion":"1.2.0","id":"course","version":"1.2.0","title":"Course","description":"Course","language":"vi",
		"chapters":[{"id":"chapter","title":"Chapter","required":true,"lessons":[{"id":"lesson","required":true}],
		"assessments":[{"id":"checkpoint","title":"Checkpoint","required":true,"path":"assessments/checkpoint","requiresLessons":["lesson"],"completion":{"type":"minimum-score","threshold":0.7}}]}]
	}`), &manifest); err != nil {
		t.Fatal(err)
	}
	return manifest
}

func TestLoadAssessmentActivitySetsAdaptsLegacyCodingAssessment(t *testing.T) {
	root := t.TempDir()
	manifest := assessmentManifestFixture(t, root, `{
		"id":"checkpoint","title":"Checkpoint","workspace":{"starter":"starter","editable":["answer.md"]},
		"actions":{"check":{"label":"Check","executable":"node","args":["check.mjs"],"timeoutMs":1000}},
		"checks":[{"id":"required","title":"Required","required":true}]
	}`)

	sets, err := loadAssessmentActivitySets(context.Background(), root, manifest)
	if err != nil {
		t.Fatal(err)
	}
	owner := sets["checkpoint"]
	if len(owner) != 1 || owner[0].Definition.Policy.Purpose != contracts.ActivitySetPolicyPurposeAssessment {
		t.Fatalf("sets=%#v", sets)
	}
	if len(owner[0].Activities) != 1 || owner[0].Activities[0].Kind != string(activity.ActivityKindCoding) {
		t.Fatalf("activities=%#v", owner[0].Activities)
	}
	definition, err := activity.DefinitionFromMap(owner[0].Activities[0].Definition)
	if err != nil {
		t.Fatal(err)
	}
	coding, err := activity.DecodeCodingActivity(definition)
	if err != nil {
		t.Fatal(err)
	}
	if coding.Workspace.Starter != "starter" || coding.Actions["check"].Executable != "node" {
		t.Fatalf("coding=%#v", coding)
	}
}

func TestLoadAssessmentActivitySetsLoadsSchema12AssessmentManifest(t *testing.T) {
	root := t.TempDir()
	manifest := assessmentManifestFixture(t, root, `{
		"schemaVersion":"1.0","id":"checkpoint","title":"Checkpoint","activitySet":"activities/checkpoint.json"
	}`)
	owner := filepath.Join(root, "assessments", "checkpoint", "activities")
	writeJSONFixture(t, filepath.Join(owner, "checkpoint.json"), map[string]any{
		"schemaVersion": "1.0", "id": "checkpoint-set", "title": "Checkpoint",
		"policy":     map[string]any{"purpose": "assessment", "maxAttempts": 2, "feedbackMode": "after-submit", "revealAnswers": "after-final-attempt", "scoring": "points", "passingScore": 1},
		"activities": []any{map[string]any{"id": "question", "path": "question.activity.json", "required": true}},
	})
	writeJSONFixture(t, filepath.Join(owner, "question.activity.json"), map[string]any{
		"schemaVersion": "1.0", "id": "question", "kind": "true-false", "title": "Question", "prompt": map[string]any{"blocks": []any{}},
		"config": map[string]any{"expected": true}, "evaluation": map[string]any{"mode": "automatic", "points": 1}, "completion": map[string]any{"required": true},
	})

	sets, err := loadAssessmentActivitySets(context.Background(), root, manifest)
	if err != nil {
		t.Fatal(err)
	}
	if got := sets["checkpoint"]; len(got) != 1 || string(got[0].Definition.Id) != "checkpoint-set" {
		t.Fatalf("sets=%#v", sets)
	}
}
