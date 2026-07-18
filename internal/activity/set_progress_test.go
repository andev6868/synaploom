package activity

import (
	"errors"
	"testing"
)

func TestAggregateActivitySetProgress(t *testing.T) {
	t.Parallel()
	passing := true
	definitions := map[string]ActivityDefinition{
		"quiz":     {ID: "quiz", Kind: ActivityKindSingleChoice, Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: 2}},
		"essay":    {ID: "essay", Kind: ActivityKindWriting, Evaluation: EvaluationPolicy{Mode: EvaluationModeSubmission, Points: 0}},
		"optional": {ID: "optional", Kind: ActivityKindShortAnswer, Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: 1}},
	}
	set := ActivitySetDefinition{
		ID:         "practice",
		Policy:     ActivitySetPolicy{Purpose: ActivityPurposePractice, Scoring: "points"},
		Activities: []ActivityReference{{ID: "quiz", Required: true}, {ID: "essay", Required: true}, {ID: "optional", Required: false}},
	}
	attempts := []ActivityAttempt{
		{ActivityID: "quiz", Status: AttemptStatusEvaluated, Score: floatPointer(2), MaxScore: floatPointer(2), Passed: &passing},
		{ActivityID: "essay", Status: AttemptStatusEvaluated},
	}
	progress, err := AggregateSetProgress(set, definitions, attempts)
	if err != nil {
		t.Fatal(err)
	}
	if progress.Status != "COMPLETED" || progress.CompletedRequiredActivities != 2 || progress.RequiredActivities != 2 {
		t.Fatalf("progress = %+v", progress)
	}
	if progress.Score == nil || *progress.Score != 2 || progress.MaxScore == nil || *progress.MaxScore != 2 {
		t.Fatalf("scored progress = %+v", progress)
	}
	if progress.Passed == nil || !*progress.Passed {
		t.Fatalf("practice passed = %+v", progress.Passed)
	}
}

func TestAggregateDraftMarksSetInProgressWithoutCompletingIt(t *testing.T) {
	t.Parallel()
	set := ActivitySetDefinition{
		ID:         "practice",
		Policy:     ActivitySetPolicy{Purpose: ActivityPurposePractice, Scoring: "none"},
		Activities: []ActivityReference{{ID: "quiz", Required: true}},
	}
	progress, err := AggregateSetProgress(set, map[string]ActivityDefinition{
		"quiz": {ID: "quiz", Kind: ActivityKindSingleChoice, Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: 1}},
	}, []ActivityAttempt{{ActivityID: "quiz", Status: AttemptStatusDraft}})
	if err != nil {
		t.Fatal(err)
	}
	if progress.Status != "IN_PROGRESS" || progress.CompletedRequiredActivities != 0 {
		t.Fatalf("draft progress = %+v", progress)
	}
}

func TestAggregateAssessmentThresholdAndInProgressState(t *testing.T) {
	t.Parallel()
	passed := true
	definitions := map[string]ActivityDefinition{
		"one": {ID: "one", Kind: ActivityKindNumeric, Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: 5}},
		"two": {ID: "two", Kind: ActivityKindMultipleChoice, Evaluation: EvaluationPolicy{Mode: EvaluationModeAutomatic, Points: 5}},
	}
	threshold := 8.0
	set := ActivitySetDefinition{
		ID:         "assessment",
		Policy:     ActivitySetPolicy{Purpose: ActivityPurposeAssessment, Scoring: "points", PassingScore: &threshold},
		Activities: []ActivityReference{{ID: "one", Required: true}, {ID: "two", Required: true}},
	}
	progress, err := AggregateSetProgress(set, definitions, []ActivityAttempt{
		{ActivityID: "one", Status: AttemptStatusEvaluated, Score: floatPointer(5), MaxScore: floatPointer(5), Passed: &passed},
	})
	if err != nil {
		t.Fatal(err)
	}
	if progress.Status != "IN_PROGRESS" || progress.CompletedRequiredActivities != 1 || progress.Passed == nil || *progress.Passed {
		t.Fatalf("partial assessment progress = %+v", progress)
	}
	progress, err = AggregateSetProgress(set, definitions, []ActivityAttempt{
		{ActivityID: "one", Status: AttemptStatusEvaluated, Score: floatPointer(5), MaxScore: floatPointer(5), Passed: &passed},
		{ActivityID: "two", Status: AttemptStatusEvaluated, Score: floatPointer(3), MaxScore: floatPointer(5), Passed: &passed},
	})
	if err != nil {
		t.Fatal(err)
	}
	if progress.Status != "COMPLETED" || progress.Passed == nil || !*progress.Passed {
		t.Fatalf("completed assessment progress = %+v", progress)
	}
}

func TestAggregateRejectsScoredAssessmentWithSubmissionOnlyWriting(t *testing.T) {
	t.Parallel()
	threshold := 1.0
	set := ActivitySetDefinition{
		ID:         "assessment",
		Policy:     ActivitySetPolicy{Purpose: ActivityPurposeAssessment, Scoring: "points", PassingScore: &threshold},
		Activities: []ActivityReference{{ID: "essay", Required: true}},
	}
	_, err := AggregateSetProgress(set, map[string]ActivityDefinition{
		"essay": {ID: "essay", Kind: ActivityKindWriting, Evaluation: EvaluationPolicy{Mode: EvaluationModeSubmission}},
	}, nil)
	if !errors.Is(err, ErrEvaluatorConfigInvalid) {
		t.Fatalf("error = %v, want ErrEvaluatorConfigInvalid", err)
	}
}
