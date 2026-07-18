package course

import (
	"fmt"

	contracts "github.com/synaploom/synaploom/generated/go/contracts"
)

type ValidationIssue struct {
	Code    string
	Message string
	Path    string
}

func ValidateActivitySet(set ActivitySetSource, activities map[string]ActivitySource) []ValidationIssue {
	issues := []ValidationIssue{}
	seenIDs := map[string]bool{}
	seenPaths := map[string]bool{}
	for index, reference := range set.Definition.Activities {
		id := string(reference.Id)
		path := string(reference.Path)
		issuePath := fmt.Sprintf("%s.activities[%d]", set.Path, index)
		if seenIDs[id] {
			issues = append(issues, ValidationIssue{Code: "ACTIVITY_ID_DUPLICATE", Message: fmt.Sprintf("duplicate activity id %s", id), Path: issuePath})
		}
		seenIDs[id] = true
		if seenPaths[path] {
			issues = append(issues, ValidationIssue{Code: "ACTIVITY_EMBED_DUPLICATE", Message: fmt.Sprintf("activity %s is referenced more than once", id), Path: issuePath})
		}
		seenPaths[path] = true
		activity, ok := activities[id]
		if !ok || activity.ID != id {
			issues = append(issues, ValidationIssue{Code: "ACTIVITY_REFERENCE_NOT_FOUND", Message: fmt.Sprintf("activity %s was not loaded", id), Path: issuePath})
			continue
		}
		if set.Definition.Policy.Purpose == contracts.ActivitySetPolicyPurposeAssessment &&
			set.Definition.Policy.Scoring == contracts.ActivitySetPolicyScoringPoints &&
			activity.Kind == "writing" && activity.EvaluationMode == "submission" {
			issues = append(issues, ValidationIssue{
				Code: "ASSESSMENT_SCORE_REQUIRES_SCORABLE_ACTIVITY", Message: "scored assessments cannot include submission-only writing activities", Path: activity.Path,
			})
		}
	}
	return issues
}
