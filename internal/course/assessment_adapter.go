package course

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

type assessmentActivityManifest struct {
	SchemaVersion string `json:"schemaVersion"`
	ID            string `json:"id"`
	Title         string `json:"title"`
	ActivitySet   string `json:"activitySet"`
}

// loadAssessmentActivitySets resolves every chapter assessment to one ordered
// assessment activity set. Schema 1.2 manifests reference an authored set;
// coding-only 1.1 manifests are normalized through a compatibility adapter.
func loadAssessmentActivitySets(ctx context.Context, courseRoot string, manifest contracts.CourseManifest) (map[string][]ActivitySetSource, error) {
	loaded := make(map[string][]ActivitySetSource)
	for _, chapter := range manifest.Chapters {
		for _, assessment := range chapter.Assessments {
			if err := ctx.Err(); err != nil {
				return nil, err
			}
			ownerPath, err := resolveOwnerPath(courseRoot, string(assessment.Path))
			if err != nil {
				return nil, err
			}
			info, err := os.Stat(ownerPath)
			if err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Path: string(assessment.Path), Err: err}
			}
			ownerRoot := ownerPath
			manifestPath := ownerPath
			if info.IsDir() {
				manifestPath = filepath.Join(ownerPath, "assessment.json")
			} else {
				ownerRoot = filepath.Dir(ownerPath)
			}
			data, err := os.ReadFile(manifestPath)
			if err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Path: string(assessment.Path), Err: err}
			}
			var descriptor assessmentActivityManifest
			if err := json.Unmarshal(data, &descriptor); err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: string(assessment.Path), Err: err}
			}
			assessmentID := string(assessment.Id)
			if descriptor.ID != assessmentID {
				return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: string(assessment.Path), Err: fmt.Errorf("assessment id %q does not match %q", descriptor.ID, assessmentID)}
			}
			if descriptor.ActivitySet != "" {
				sets, err := LoadActivitySets(ctx, ownerRoot, []string{descriptor.ActivitySet})
				if err != nil {
					return nil, err
				}
				if len(sets) != 1 || sets[0].Definition.Policy.Purpose != contracts.ActivitySetPolicyPurposeAssessment {
					return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: descriptor.ActivitySet, Err: errors.New("assessment manifest must reference one assessment activity set")}
				}
				loaded[assessmentID] = sets
				continue
			}
			set, err := adaptLegacyAssessment(data, filepath.ToSlash(filepath.Base(manifestPath)), assessmentID, descriptor.Title)
			if err != nil {
				return nil, &activitySourceError{Code: "ACTIVITY_CONFIG_INVALID", Path: string(assessment.Path), Err: err}
			}
			loaded[assessmentID] = []ActivitySetSource{set}
		}
	}
	return loaded, nil
}

func adaptLegacyAssessment(data []byte, sourcePath, assessmentID, title string) (ActivitySetSource, error) {
	var config map[string]any
	if err := json.Unmarshal(data, &config); err != nil {
		return ActivitySetSource{}, err
	}
	if title == "" {
		title, _ = config["title"].(string)
	}
	if title == "" {
		title = assessmentID
	}
	config["schemaVersion"] = "1.0"
	config["id"] = assessmentID
	config["title"] = title
	if _, ok := config["runtime"]; !ok {
		config["runtime"] = map[string]any{"kind": "local", "requires": []any{}}
	}
	if _, ok := config["completion"]; !ok {
		config["completion"] = map[string]any{"requireAllRequiredChecks": true}
	}
	activityDefinition := map[string]any{
		"schemaVersion": "1.0", "id": assessmentID, "kind": "coding", "title": title,
		"prompt": map[string]any{"blocks": []any{}}, "config": config,
		"evaluation": map[string]any{"mode": "coding", "points": 1},
		"completion": map[string]any{"required": true},
	}
	maxAttempts := 1
	passingScore := 1.0
	setID := assessmentID + "-assessment"
	definition := contracts.ActivitySetDefinition{
		SchemaVersion: "1.0", Id: contracts.Id(setID),
		Policy: contracts.ActivitySetPolicy{
			Purpose: contracts.ActivitySetPolicyPurposeAssessment, MaxAttempts: &maxAttempts,
			FeedbackMode:  contracts.ActivitySetPolicyFeedbackModeAfterSubmit,
			RevealAnswers: contracts.ActivitySetPolicyRevealAnswersNever,
			Scoring:       contracts.ActivitySetPolicyScoringPoints, PassingScore: &passingScore,
		},
		Activities: []contracts.ActivityReference{{Id: contracts.Id(assessmentID), Path: contracts.SafePath(sourcePath), Required: true}},
	}
	return ActivitySetSource{
		Path: sourcePath, Definition: definition,
		Activities: []ActivitySource{{ID: assessmentID, Kind: "coding", Path: sourcePath, EvaluationMode: "coding", Definition: activityDefinition}},
	}, nil
}
