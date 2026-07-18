package storage

import (
	"context"
	"encoding/json"
	"errors"
	"path/filepath"
	"testing"
	"time"
)

func TestActivityRepositoryPersistsDraftAcrossRestart(t *testing.T) {
	ctx := context.Background()
	path := filepath.Join(t.TempDir(), "activity.db")
	db, err := Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	repo := NewActivityRepository(db.SQL)
	identity := AttemptIdentity{CourseID: "course", CourseVersion: "1.2.0", OwnerKind: "lesson", OwnerID: "intro", ActivityID: "quiz"}
	created, err := repo.SaveDraft(ctx, DraftWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"a"}`), ExpectedRevision: 0, Seed: 42, At: time.Unix(10, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if created.Revision != 1 || created.AttemptNumber != 0 || created.Status != ActivityAttemptStatusDraft {
		t.Fatalf("unexpected created draft: %+v", created)
	}
	if err := db.Close(); err != nil {
		t.Fatal(err)
	}

	db, err = Open(ctx, path)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo = NewActivityRepository(db.SQL)
	got, err := repo.CurrentDraft(ctx, identity)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || string(got.AnswerJSON) != `{"optionId":"a"}` || got.Seed != 42 {
		t.Fatalf("draft did not survive restart: %+v", got)
	}
}

func TestActivityRepositoryRejectsStaleDraftRevision(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := NewActivityRepository(db.SQL)
	identity := AttemptIdentity{CourseID: "course", CourseVersion: "1.2.0", OwnerKind: "lesson", OwnerID: "intro", ActivityID: "quiz"}
	first, err := repo.SaveDraft(ctx, DraftWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"value":"first"}`), ExpectedRevision: 0, At: time.Unix(10, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := repo.SaveDraft(ctx, DraftWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"value":"second"}`), ExpectedRevision: first.Revision - 1, At: time.Unix(11, 0)}); !errors.Is(err, ErrActivityRevisionConflict) {
		t.Fatalf("expected revision conflict, got %v", err)
	}
	got, err := repo.CurrentDraft(ctx, identity)
	if err != nil {
		t.Fatal(err)
	}
	if got == nil || string(got.AnswerJSON) != `{"value":"first"}` || got.Revision != first.Revision {
		t.Fatalf("stale write changed draft: %+v", got)
	}
}

func TestActivityRepositoryCreatesMonotonicIdempotentSubmissions(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := NewActivityRepository(db.SQL)
	identity := AttemptIdentity{CourseID: "course", CourseVersion: "1.2.0", OwnerKind: "assessment", OwnerID: "checkpoint", ActivityID: "quiz"}

	first, created, err := repo.CreateSubmission(ctx, SubmissionWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"a"}`), IdempotencyKey: "submit-1", Seed: 7, At: time.Unix(20, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if !created || first.AttemptNumber != 1 || first.Status != ActivityAttemptStatusSubmitted {
		t.Fatalf("unexpected first submission: created=%v record=%+v", created, first)
	}
	duplicate, created, err := repo.CreateSubmission(ctx, SubmissionWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"b"}`), IdempotencyKey: "submit-1", Seed: 99, At: time.Unix(21, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if created || duplicate.ID != first.ID || string(duplicate.AnswerJSON) != string(first.AnswerJSON) {
		t.Fatalf("duplicate submission was not idempotent: created=%v duplicate=%+v", created, duplicate)
	}
	second, created, err := repo.CreateSubmission(ctx, SubmissionWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"b"}`), IdempotencyKey: "submit-2", Seed: 8, At: time.Unix(22, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if !created || second.AttemptNumber != 2 {
		t.Fatalf("expected monotonic second attempt, created=%v record=%+v", created, second)
	}
}

func TestActivityRepositorySubmissionIsImmutableAndEvaluationIsExplicit(t *testing.T) {
	ctx := context.Background()
	db, err := Open(ctx, filepath.Join(t.TempDir(), "activity.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	repo := NewActivityRepository(db.SQL)
	identity := AttemptIdentity{CourseID: "course", CourseVersion: "1.2.0", OwnerKind: "lesson", OwnerID: "intro", ActivityID: "quiz"}
	if _, err := repo.SaveDraft(ctx, DraftWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"draft"}`), ExpectedRevision: 0, At: time.Unix(10, 0)}); err != nil {
		t.Fatal(err)
	}
	submitted, _, err := repo.CreateSubmission(ctx, SubmissionWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"answer"}`), IdempotencyKey: "submit", At: time.Unix(20, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if draft, err := repo.CurrentDraft(ctx, identity); err != nil || draft != nil {
		t.Fatalf("submission should consume the draft: draft=%+v err=%v", draft, err)
	}
	if _, err := repo.SaveDraft(ctx, DraftWrite{Identity: identity, AnswerJSON: json.RawMessage(`{"optionId":"new-draft"}`), ExpectedRevision: 0, At: time.Unix(21, 0)}); err != nil {
		t.Fatal(err)
	}
	attempts, err := repo.ListOwnerAttempts(ctx, OwnerIdentity{CourseID: identity.CourseID, CourseVersion: identity.CourseVersion, OwnerKind: identity.OwnerKind, OwnerID: identity.OwnerID})
	if err != nil {
		t.Fatal(err)
	}
	if len(attempts) != 2 || string(attempts[0].AnswerJSON) != `{"optionId":"answer"}` || attempts[0].Status != ActivityAttemptStatusSubmitted {
		t.Fatalf("submitted attempt was mutated: %+v", attempts)
	}

	score, maxScore, passed := 1.0, 1.0, true
	evaluated, err := repo.UpdateEvaluation(ctx, EvaluationWrite{AttemptID: submitted.ID, FeedbackJSON: json.RawMessage(`{"message":"Correct"}`), Score: &score, MaxScore: &maxScore, Passed: &passed, At: time.Unix(30, 0)})
	if err != nil {
		t.Fatal(err)
	}
	if evaluated.Status != ActivityAttemptStatusEvaluated || evaluated.EvaluatedAt == nil || evaluated.Passed == nil || !*evaluated.Passed {
		t.Fatalf("evaluation was not recorded: %+v", evaluated)
	}
	if _, err := repo.UpdateEvaluation(ctx, EvaluationWrite{AttemptID: submitted.ID, FeedbackJSON: json.RawMessage(`{}`), At: time.Unix(31, 0)}); !errors.Is(err, ErrActivityAttemptImmutable) {
		t.Fatalf("expected evaluated attempt to be immutable, got %v", err)
	}
}
