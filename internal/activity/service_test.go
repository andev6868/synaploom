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
	evaluator := &recordingEvaluator{result: EvaluationResult{Score: floatPointer(1), MaxScore: floatPointer(1), Passed: boolPointer(true), Completed: true, Feedback: ActivityFeedback{Summary: "Correct"}}}
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
	evaluator := &recordingEvaluator{result: EvaluationResult{Score: floatPointer(1), MaxScore: floatPointer(1), Passed: boolPointer(true), Completed: true}}
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

func TestWritingSubmissionCompletesWithoutAutomaticGrade(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	definition := activityDefinition("essay", ActivityKindWriting, map[string]any{"minimumCharacters": 3, "maximumCharacters": 100, "answerFormat": "plain-text"}, EvaluationModeSubmission)
	set := ActivitySetDefinition{ID: "practice", Policy: ActivitySetPolicy{Purpose: ActivityPurposePractice}, Activities: []ActivityReference{{ID: "essay", Required: true}}}
	evaluator := NewRegistry(NewWritingEvaluator())
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"essay": definition}, sets: map[string]ActivitySetDefinition{"practice": set}}, storage.NewActivityRepository(db.SQL), evaluator)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, ActivityID: "essay"}
	attempt, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"writing","value":"A considered response"}`), IdempotencyKey: "essay-1"})
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Status != AttemptStatusEvaluated || attempt.Passed != nil || attempt.Score != nil || attempt.MaxScore != nil {
		t.Fatalf("writing submission was falsely auto-graded: %+v", attempt)
	}
}

func activityDefinition(id string, kind ActivityKind, config map[string]any, mode EvaluationMode) ActivityDefinition {
	return ActivityDefinition{ID: id, Kind: kind, Title: id, Prompt: map[string]any{"blocks": []any{}}, Config: config, Evaluation: EvaluationPolicy{Mode: mode, Points: 1}, Completion: CompletionPolicy{Required: true}}
}

func TestServiceAppliesActivitySetRevealPolicyBeforePersistingFeedback(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	definition := activityDefinition("quiz", ActivityKindSingleChoice, map[string]any{
		"options":         []any{map[string]any{"id": "a", "label": "A"}, map[string]any{"id": "b", "label": "B"}},
		"correctOptionId": "a",
	}, EvaluationModeAutomatic)
	set := ActivitySetDefinition{
		ID:         "practice",
		Policy:     ActivitySetPolicy{Purpose: ActivityPurposePractice, RevealAnswers: "after-submit"},
		Activities: []ActivityReference{{ID: "quiz", Required: true}},
	}
	evaluator := &recordingEvaluator{result: EvaluationResult{
		Score: floatPointer(0), MaxScore: floatPointer(1), Passed: boolPointer(false), CorrectAnswer: "a",
		Feedback: ActivityFeedback{Summary: "Incorrect"},
	}}
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"quiz": definition}, sets: map[string]ActivitySetDefinition{"practice": set}}, storage.NewActivityRepository(db.SQL), evaluator)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, ActivityID: "quiz"}

	attempt, err := service.Submit(ctx, SubmitCommand{Identity: identity, Answer: json.RawMessage(`{"kind":"single-choice","optionId":"b"}`), IdempotencyKey: "reveal-1"})
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Feedback == nil || attempt.Feedback.CorrectAnswer != "a" {
		t.Fatalf("persisted feedback correctAnswer = %#v, want a", attempt.Feedback)
	}
}

func TestServiceRecordsTrustedCodingEvaluationWithoutGenericEvaluator(t *testing.T) {
	ctx := context.Background()
	db, err := storage.Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	definition := activityDefinition("coding-lab", ActivityKindCoding, map[string]any{
		"schemaVersion": "1.0", "id": "coding-lab", "title": "Coding Lab",
		"runtime":   map[string]any{"kind": "local", "requires": []any{"node"}},
		"workspace": map[string]any{"starter": "starter", "editable": []any{"index.js"}},
		"actions":   map[string]any{"check": map[string]any{"label": "Check", "executable": "node", "args": []any{"check.js"}, "timeoutMs": float64(1000)}},
		"checks":    []any{}, "completion": map[string]any{"requireAllRequiredChecks": true},
	}, EvaluationModeCoding)
	set := ActivitySetDefinition{ID: "practice", Policy: ActivitySetPolicy{Purpose: ActivityPurposePractice}, Activities: []ActivityReference{{ID: "coding-lab", Required: true}}}
	service := NewService(testCatalog{definitions: map[string]ActivityDefinition{"coding-lab": definition}, sets: map[string]ActivitySetDefinition{"practice": set}}, storage.NewActivityRepository(db.SQL), nil)
	identity := AttemptIdentity{Owner: OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"}, ActivityID: "coding-lab"}

	attempt, err := service.RecordCodingEvaluation(ctx, RecordCodingEvaluationCommand{
		Identity: identity, Passed: true, Summary: "All checks passed", IdempotencyKey: "execution-1", At: time.Unix(10, 0),
	})
	if err != nil {
		t.Fatal(err)
	}
	if attempt.Status != AttemptStatusEvaluated || attempt.Passed == nil || !*attempt.Passed || attempt.Score == nil || *attempt.Score != 1 {
		t.Fatalf("attempt=%+v", attempt)
	}
	progress, err := service.SetProgress(ctx, identity.Owner, "practice")
	if err != nil {
		t.Fatal(err)
	}
	if progress.Status != "COMPLETED" || progress.Passed == nil || !*progress.Passed {
		t.Fatalf("progress=%+v", progress)
	}
	duplicate, err := service.RecordCodingEvaluation(ctx, RecordCodingEvaluationCommand{
		Identity: identity, Passed: false, Summary: "must not overwrite", IdempotencyKey: "execution-1", At: time.Unix(11, 0),
	})
	if err != nil {
		t.Fatal(err)
	}
	if duplicate.ID != attempt.ID || duplicate.Passed == nil || !*duplicate.Passed {
		t.Fatalf("duplicate=%+v", duplicate)
	}
}
