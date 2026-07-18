package activity

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/synaploom/synaploom/internal/storage"
)

type recordingEvaluator struct {
	calls  int
	result EvaluationResult
}

func (e *recordingEvaluator) Evaluate(_ context.Context, _ ActivityDefinition, _ json.RawMessage) (EvaluationResult, error) {
	e.calls++
	return e.result, nil
}

func TestServiceRunsDraftSubmissionEvaluationLifecycle(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	definition := activityDefinition("quiz", ActivityKindSingleChoice, map[string]any{
		"options": []any{map[string]any{"id": "a", "label": "A"}}, "correctOptionId": "a",
	}, EvaluationModeAutomatic)
	set := ActivitySetDefinition{ID: "practice", Policy: ActivitySetPolicy{Purpose: ActivityPurposePractice}, Activities: []ActivityReference{{ID: "quiz", Required: true}}}
	evaluator := &recordingEvaluator{result: EvaluationResult{Score: 1, MaxScore: 1, Passed: true, Feedback: ActivityFeedback{Summary: "Correct"}}}
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"quiz": definition}, sets: map[string]ActivitySetDefinition{"practice": set}}, storage.NewActivityRepository(db.SQL), evaluator)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, ActivityID: "quiz"}

	draft, err := service.SaveDraft(ctx, SaveDraftCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"a"}`), Revision: 0, Seed: 91, At: time.Unix(1, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if draft.Status != AttemptStatusDraft || draft.Revision != 1 || draft.RandomSeed != "91" {
		t.Fatalf("unexpected draft: %+v", draft)
	}
	if _, err := service.SaveDraft(ctx, SaveDraftCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"a"}`), Revision: 0, Seed: 91, At: time.Unix(2, 0)}); !errors.Is(err, ErrRevisionConflict) {
		t.Fatalf("expected revision conflict, got %v", err)
	}

	evaluated, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"a"}`), IdempotencyKey: "submit-1", Seed: 91, At: time.Unix(3, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if evaluated.Status != AttemptStatusEvaluated || evaluated.Passed == nil || !*evaluated.Passed || evaluated.RandomSeed != "91" || evaluator.calls != 1 {
		t.Fatalf("unexpected evaluated attempt: %+v evaluator calls=%d", evaluated, evaluator.calls)
	}
	duplicate, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"wrong"}`), IdempotencyKey: "submit-1", Seed: 1, At: time.Unix(4, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if duplicate.ID != evaluated.ID || evaluator.calls != 1 {
		t.Fatalf("idempotent submit re-evaluated: duplicate=%+v calls=%d", duplicate, evaluator.calls)
	}
}

func TestServiceEnforcesMaxAttemptsAndAnswerShape(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	maxAttempts := 1
	definition := activityDefinition("quiz", ActivityKindTrueFalse, map[string]any{"expected": true}, EvaluationModeAutomatic)
	set := ActivitySetDefinition{ID: "assessment", Policy: ActivitySetPolicy{Purpose: ActivityPurposeAssessment, MaxAttempts: &maxAttempts}, Activities: []ActivityReference{{ID: "quiz", Required: true}}}
	evaluator := &recordingEvaluator{result: EvaluationResult{Score: 1, MaxScore: 1, Passed: true}}
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"quiz": definition}, sets: map[string]ActivitySetDefinition{"assessment": set}}, storage.NewActivityRepository(db.SQL), evaluator)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindAssessment, ID: "assessment"}, ActivityID: "quiz"}
	if _, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"true-false","value":"not-bool"}`), IdempotencyKey: "bad"}); !errors.Is(err, ErrMalformedAnswer) {
		t.Fatalf("expected malformed answer, got %v", err)
	}
	if _, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"true-false","value":true}`), IdempotencyKey: "first"}); err != nil {
		t.Fatal(err)
	}
	if _, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"true-false","value":true}`), IdempotencyKey: "second"}); !errors.Is(err, ErrMaxAttemptsReached) {
		t.Fatalf("expected max attempts denial, got %v", err)
	}
}

func TestWritingSubmissionCompletesWithoutAutomaticEvaluator(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	definition := activityDefinition("essay", ActivityKindWriting, map[string]any{"minimumCharacters": 3, "maximumCharacters": 100, "answerFormat": "plain-text"}, EvaluationModeSubmission)
	set := ActivitySetDefinition{ID: "practice", Policy: ActivitySetPolicy{Purpose: ActivityPurposePractice}, Activities: []ActivityReference{{ID: "essay", Required: true}}}
	evaluator := &recordingEvaluator{}
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"essay": definition}, sets: map[string]ActivitySetDefinition{"practice": set}}, storage.NewActivityRepository(db.SQL), evaluator)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, ActivityID: "essay"}
	attempt, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"writing","value":"A considered response"}`), IdempotencyKey: "essay-1"})
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Status != AttemptStatusEvaluated || attempt.Passed == nil || !*attempt.Passed || evaluator.calls != 0 {
		t.Fatalf("writing submission was not completed: %+v evaluator calls=%d", attempt, evaluator.calls)
	}
}

func activityDefinition(id string, kind ActivityKind, config map[string]any, mode EvaluationMode) ActivityDefinition {
	return ActivityDefinition{ID: id, Kind: kind, Title: id, Prompt: map[string]any{"blocks": []any{}}, Config: config, Evaluation: EvaluationPolicy{Mode: mode, Points: 1}, Completion: CompletionPolicy{Required: true}}
}
