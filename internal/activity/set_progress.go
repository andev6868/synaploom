package activity

import "fmt"

// AggregateSetProgress derives activity-set completion from immutable attempts.
// Required submission-only writing activities complete on valid evaluation without
// fabricating a score or pass result.
func AggregateSetProgress(
	set ActivitySetDefinition,
	definitions map[string]ActivityDefinition,
	attempts []ActivityAttempt,
) (ActivitySetProgress, error) {
	if len(set.Activities) == 0 {
		return ActivitySetProgress{}, fmt.Errorf("%w: activity set %q has no activities", ErrEvaluatorConfigInvalid, set.ID)
	}
	if err := validateSetEvaluationPolicy(set, definitions); err != nil {
		return ActivitySetProgress{}, err
	}

	progress := ActivitySetProgress{Status: "NOT_STARTED"}
	var totalScore, totalMax float64
	hasScore := false
	hasAttempt := false

	for _, reference := range set.Activities {
		definition, ok := definitions[reference.ID]
		if !ok {
			return ActivitySetProgress{}, fmt.Errorf("%w: activity %q is missing from set %q", ErrActivityNotFound, reference.ID, set.ID)
		}
		if reference.Required {
			progress.RequiredActivities++
		}

		if hasAttemptForActivity(attempts, reference.ID) {
			hasAttempt = true
		}
		best := bestEvaluatedAttempt(attempts, reference.ID)
		if best != nil {
			if best.Score != nil && best.MaxScore != nil {
				hasScore = true
				totalScore += *best.Score
				totalMax += *best.MaxScore
			}
		}
		completed := activityAttemptCompletes(definition, best)
		if reference.Required && completed {
			progress.CompletedRequiredActivities++
		}
	}

	if hasAttempt {
		progress.Status = "IN_PROGRESS"
	}
	if hasScore {
		progress.Score = floatPointer(totalScore)
		progress.MaxScore = floatPointer(totalMax)
	}
	completed := progress.CompletedRequiredActivities == progress.RequiredActivities
	if completed {
		progress.Status = "COMPLETED"
	}
	if hasAttempt || completed {
		passed := completed
		if set.Policy.PassingScore != nil {
			passed = completed && hasScore && totalScore >= *set.Policy.PassingScore
		}
		progress.Passed = boolPointer(passed)
	}
	return progress, nil
}

func validateSetEvaluationPolicy(set ActivitySetDefinition, definitions map[string]ActivityDefinition) error {
	if set.Policy.Purpose != ActivityPurposeAssessment || set.Policy.Scoring != "points" {
		return nil
	}
	for _, reference := range set.Activities {
		definition, ok := definitions[reference.ID]
		if !ok {
			continue
		}
		if definition.Evaluation.Mode == EvaluationModeSubmission {
			return fmt.Errorf("%w: scored assessment %q contains submission-only activity %q", ErrEvaluatorConfigInvalid, set.ID, reference.ID)
		}
	}
	return nil
}

func hasAttemptForActivity(attempts []ActivityAttempt, activityID string) bool {
	for _, attempt := range attempts {
		if attempt.ActivityID == activityID {
			return true
		}
	}
	return false
}

func bestEvaluatedAttempt(attempts []ActivityAttempt, activityID string) *ActivityAttempt {
	var best *ActivityAttempt
	for index := range attempts {
		attempt := &attempts[index]
		if attempt.ActivityID != activityID || attempt.Status != AttemptStatusEvaluated {
			continue
		}
		if best == nil {
			best = attempt
			continue
		}
		if attempt.Score != nil && (best.Score == nil || *attempt.Score > *best.Score) {
			best = attempt
		}
	}
	return best
}

func activityAttemptCompletes(definition ActivityDefinition, attempt *ActivityAttempt) bool {
	if attempt == nil {
		return false
	}
	if definition.Evaluation.Mode == EvaluationModeSubmission {
		return attempt.Status == AttemptStatusEvaluated
	}
	return attempt.Passed != nil && *attempt.Passed
}
