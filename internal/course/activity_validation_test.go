package course

import (
	"testing"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

func TestValidateActivitySetReportsCrossFileDiagnostics(t *testing.T) {
	set := ActivitySetSource{
		Definition: contracts.ActivitySetDefinition{
			Id: "assessment",
			Policy: contracts.ActivitySetPolicy{
				Purpose: contracts.ActivitySetPolicyPurposeAssessment,
				Scoring: contracts.ActivitySetPolicyScoringPoints,
			},
			Activities: []contracts.ActivityReference{
				{Id: "missing", Path: "missing.activity.json", Required: true},
				{Id: "essay", Path: "essay.activity.json", Required: true},
				{Id: "essay", Path: "essay.activity.json", Required: true},
			},
		},
	}
	activities := map[string]ActivitySource{
		"essay": {ID: "essay", Kind: "writing", EvaluationMode: "submission", Path: "essay.activity.json"},
	}
	issues := ValidateActivitySet(set, activities)
	codes := map[string]bool{}
	for _, issue := range issues {
		codes[issue.Code] = true
	}
	for _, code := range []string{
		"ACTIVITY_REFERENCE_NOT_FOUND",
		"ACTIVITY_ID_DUPLICATE",
		"ACTIVITY_EMBED_DUPLICATE",
		"ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY",
	} {
		if !codes[code] {
			t.Fatalf("missing diagnostic %s in %#v", code, issues)
		}
	}
}

func TestValidateActivitySetRejectsImpossiblePresentationPolicy(t *testing.T) {
	set := ActivitySetSource{
		Definition: contracts.ActivitySetDefinition{
			Id:         "practice",
			Activities: []contracts.ActivityReference{{Id: "quiz", Path: "quiz.activity.json", Required: true}},
		},
	}
	activities := map[string]ActivitySource{
		"quiz": {
			ID: "quiz", Kind: "true-false", Path: "quiz.activity.json",
			Definition: map[string]any{"presentation": map[string]any{
				"defaultSurface": "inline", "allowInline": false, "allowPractice": true,
				"preferredWidth": "compact", "supportsFullscreen": false,
			}},
		},
	}
	issues := ValidateActivitySet(set, activities)
	if len(issues) != 1 || issues[0].Code != "ACTIVITY_PRESENTATION_INVALID" {
		t.Fatalf("issues=%#v", issues)
	}
}
