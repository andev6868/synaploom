package activity

import (
	"context"
	"testing"

	"github.com/synaploom/synaploom/internal/storage"
)

type statusRepository struct {
	records []storage.ActivityAttemptRecord
}

func (r statusRepository) CurrentDraft(context.Context, storage.AttemptIdentity) (*storage.ActivityAttemptRecord, error) {
	return nil, nil
}
func (r statusRepository) SaveDraft(context.Context, storage.DraftWrite) (storage.ActivityAttemptRecord, error) {
	return storage.ActivityAttemptRecord{}, nil
}
func (r statusRepository) CreateSubmission(context.Context, storage.SubmissionWrite) (storage.ActivityAttemptRecord, bool, error) {
	return storage.ActivityAttemptRecord{}, false, nil
}
func (r statusRepository) UpdateEvaluation(context.Context, storage.EvaluationWrite) (storage.ActivityAttemptRecord, error) {
	return storage.ActivityAttemptRecord{}, nil
}
func (r statusRepository) ListOwnerAttempts(context.Context, storage.OwnerIdentity) ([]storage.ActivityAttemptRecord, error) {
	return r.records, nil
}

func TestActivityStatusesFollowAuthoredOrderAndLatestAttempt(t *testing.T) {
	passed, failed := true, false
	catalog := testCatalog{
		definitions: map[string]ActivityDefinition{
			"fresh":  activityDefinition("fresh", ActivityKindTrueFalse, map[string]any{"expected": true}, EvaluationModeAutomatic),
			"draft":  activityDefinition("draft", ActivityKindTrueFalse, map[string]any{"expected": true}, EvaluationModeAutomatic),
			"passed": activityDefinition("passed", ActivityKindTrueFalse, map[string]any{"expected": true}, EvaluationModeAutomatic),
			"failed": activityDefinition("failed", ActivityKindTrueFalse, map[string]any{"expected": true}, EvaluationModeAutomatic),
		},
		sets: map[string]ActivitySetDefinition{
			"practice":   {ID: "practice", Activities: []ActivityReference{{ID: "fresh", Required: true}, {ID: "draft", Required: true}, {ID: "passed", Required: true}}},
			"assessment": {ID: "assessment", Activities: []ActivityReference{{ID: "passed", Required: true}, {ID: "failed", Required: true}}},
		},
	}
	repository := statusRepository{records: []storage.ActivityAttemptRecord{
		{ActivityID: "draft", AttemptNumber: 0, Status: storage.ActivityAttemptStatusDraft},
		{ActivityID: "passed", AttemptNumber: 1, Status: storage.ActivityAttemptStatusEvaluated, Passed: &passed},
		{ActivityID: "failed", AttemptNumber: 1, Status: storage.ActivityAttemptStatusEvaluated, Passed: &passed},
		{ActivityID: "failed", AttemptNumber: 2, Status: storage.ActivityAttemptStatusEvaluated, Passed: &failed},
	}}
	service := NewService(catalog, repository, nil)
	got, err := service.ActivityStatuses(context.Background(), OwnerIdentity{CourseID: "course", CourseVersion: "1", Kind: OwnerKindLesson, ID: "lesson"})
	if err != nil {
		t.Fatal(err)
	}
	wantStatuses := []string{"AVAILABLE", "DRAFT", "PASSED", "FAILED"}
	wantIDs := []string{"fresh", "draft", "passed", "failed"}
	if len(got) != len(wantIDs) {
		t.Fatalf("got=%+v", got)
	}
	for i := range got {
		if got[i].ActivityID != wantIDs[i] || got[i].Status != wantStatuses[i] {
			t.Fatalf("got[%d]=%+v", i, got[i])
		}
	}
	if got[3].AttemptNumber != 2 {
		t.Fatalf("latest=%+v", got[3])
	}
}
