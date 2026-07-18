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
