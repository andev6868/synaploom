package activity

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"

	"github.com/synaploom/synaploom/internal/storage"
)

type Service interface {
	PublicActivity(context.Context, OwnerIdentity, string) (PublicActivityView, error)
	CurrentAttempt(context.Context, AttemptIdentity) (*ActivityAttempt, error)
	SaveDraft(context.Context, SaveDraftCommand) (ActivityAttempt, error)
	Submit(context.Context, SubmitCommand) (ActivityAttempt, error)
	SetProgress(context.Context, OwnerIdentity, string) (ActivitySetProgress, error)
}

type ServiceImpl struct {
	catalog    Catalog
	repository storage.ActivityRepository
	evaluator  EvaluationEngine
}

func NewService(catalog Catalog, repository storage.ActivityRepository, evaluator EvaluationEngine) *ServiceImpl {
	return &ServiceImpl{catalog: catalog, repository: repository, evaluator: evaluator}
}

func (s *ServiceImpl) PublicActivity(ctx context.Context, owner OwnerIdentity, activityID string) (PublicActivityView, error) {
	definition, _, err := s.catalog.Activity(ctx, owner, activityID)
	if err != nil {
		return PublicActivityView{}, err
	}
	return publicView(definition)
}

func (s *ServiceImpl) CurrentAttempt(ctx context.Context, identity AttemptIdentity) (*ActivityAttempt, error) {
	if s.repository == nil {
		return nil, nil
	}
	record, err := s.repository.CurrentDraft(ctx, storageIdentity(identity))
	if err != nil {
		return nil, mapStorageError(err)
	}
	if record == nil {
		return nil, nil
	}
	attempt, err := attemptFromRecord(*record)
	if err != nil {
		return nil, err
	}
	records, err := s.repository.ListOwnerAttempts(ctx, storageOwner(identity.Owner))
	if err != nil {
		return nil, mapStorageError(err)
	}
	attempt.AttemptNumber = countSubmitted(records, identity.ActivityID) + 1
	return &attempt, nil
}

func (s *ServiceImpl) SaveDraft(ctx context.Context, command SaveDraftCommand) (ActivityAttempt, error) {
	definition, _, err := s.catalog.Activity(ctx, command.Identity.Owner, command.Identity.ActivityID)
	if err != nil {
		return ActivityAttempt{}, err
	}
	if err := validateAnswer(definition.Kind, command.Answer); err != nil {
		return ActivityAttempt{}, err
	}
	record, err := s.repository.SaveDraft(ctx, storage.DraftWrite{
		Identity: storageIdentity(command.Identity), AnswerJSON: command.Answer,
		ExpectedRevision: command.Revision, Seed: command.Seed, At: command.At,
	})
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	attempt, err := attemptFromRecord(record)
	if err != nil {
		return ActivityAttempt{}, err
	}
	records, err := s.repository.ListOwnerAttempts(ctx, storageOwner(command.Identity.Owner))
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	attempt.AttemptNumber = countSubmitted(records, command.Identity.ActivityID) + 1
	return attempt, nil
}

func (s *ServiceImpl) Submit(ctx context.Context, command SubmitCommand) (ActivityAttempt, error) {
	definition, policy, err := s.catalog.Activity(ctx, command.Identity.Owner, command.Identity.ActivityID)
	if err != nil {
		return ActivityAttempt{}, err
	}
	if err := validateAnswer(definition.Kind, command.Answer); err != nil {
		return ActivityAttempt{}, err
	}
	attempts, err := s.repository.ListOwnerAttempts(ctx, storageOwner(command.Identity.Owner))
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	if existing := findIdempotentAttempt(attempts, command.Identity.ActivityID, command.IdempotencyKey); existing != nil {
		return attemptFromRecord(*existing)
	}
	if policy.MaxAttempts != nil && countSubmitted(attempts, command.Identity.ActivityID) >= *policy.MaxAttempts {
		return ActivityAttempt{}, ErrMaxAttemptsReached
	}
	record, created, err := s.repository.CreateSubmission(ctx, storage.SubmissionWrite{
		Identity: storageIdentity(command.Identity), AnswerJSON: command.Answer,
		IdempotencyKey: command.IdempotencyKey, Seed: command.Seed, At: command.At,
	})
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	if !created && record.Status == storage.ActivityAttemptStatusEvaluated {
		return attemptFromRecord(record)
	}

	var result EvaluationResult
	if definition.Evaluation.Mode == EvaluationModeSubmission {
		result = EvaluationResult{Passed: true, Feedback: ActivityFeedback{Summary: "Bài làm đã được ghi nhận.", NextAction: "continue"}}
	} else {
		if s.evaluator == nil {
			return ActivityAttempt{}, ErrEvaluatorUnavailable
		}
		result, err = s.evaluator.Evaluate(ctx, definition, command.Answer)
		if err != nil {
			return ActivityAttempt{}, fmt.Errorf("evaluate activity: %w", err)
		}
		result = ApplyRevealPolicy(result, policy, countSubmitted(attempts, command.Identity.ActivityID)+1)
	}
	feedback, err := json.Marshal(result.Feedback)
	if err != nil {
		return ActivityAttempt{}, fmt.Errorf("marshal activity feedback: %w", err)
	}
	evaluated, err := s.repository.UpdateEvaluation(ctx, storage.EvaluationWrite{
		AttemptID: record.ID, FeedbackJSON: feedback, Score: &result.Score,
		MaxScore: &result.MaxScore, Passed: &result.Passed, At: command.At,
	})
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	return attemptFromRecord(evaluated)
}

func (s *ServiceImpl) SetProgress(ctx context.Context, owner OwnerIdentity, setID string) (ActivitySetProgress, error) {
	set, err := s.catalog.ActivitySet(ctx, owner, setID)
	if err != nil {
		return ActivitySetProgress{}, err
	}
	records, err := s.repository.ListOwnerAttempts(ctx, storageOwner(owner))
	if err != nil {
		return ActivitySetProgress{}, mapStorageError(err)
	}
	progress := ActivitySetProgress{Status: "NOT_STARTED"}
	var score, maxScore float64
	var anyEvaluated bool
	for _, reference := range set.Activities {
		if reference.Required {
			progress.RequiredActivities++
		}
		passed := false
		bestScore := 0.0
		bestMax := 0.0
		for _, record := range records {
			if record.ActivityID != reference.ID || record.Status != storage.ActivityAttemptStatusEvaluated {
				continue
			}
			anyEvaluated = true
			if record.Score != nil && *record.Score >= bestScore {
				bestScore = *record.Score
			}
			if record.MaxScore != nil && *record.MaxScore > bestMax {
				bestMax = *record.MaxScore
			}
			if record.Passed != nil && *record.Passed {
				passed = true
			}
		}
		if reference.Required && passed {
			progress.CompletedRequiredActivities++
		}
		score += bestScore
		maxScore += bestMax
	}
	if anyEvaluated {
		progress.Status = "IN_PROGRESS"
		progress.Score = &score
		progress.MaxScore = &maxScore
	}
	completed := progress.CompletedRequiredActivities == progress.RequiredActivities
	passed := completed
	if set.Policy.PassingScore != nil {
		passed = completed && score >= *set.Policy.PassingScore
	}
	if completed {
		progress.Status = "COMPLETED"
	}
	if anyEvaluated || completed {
		progress.Passed = &passed
	}
	return progress, nil
}

func storageIdentity(identity AttemptIdentity) storage.AttemptIdentity {
	return storage.AttemptIdentity{CourseID: identity.Owner.CourseID, CourseVersion: identity.Owner.CourseVersion, OwnerKind: string(identity.Owner.Kind), OwnerID: identity.Owner.ID, ActivityID: identity.ActivityID}
}

func storageOwner(owner OwnerIdentity) storage.OwnerIdentity {
	return storage.OwnerIdentity{CourseID: owner.CourseID, CourseVersion: owner.CourseVersion, OwnerKind: string(owner.Kind), OwnerID: owner.ID}
}

func findIdempotentAttempt(records []storage.ActivityAttemptRecord, activityID, key string) *storage.ActivityAttemptRecord {
	if key == "" {
		return nil
	}
	for index := range records {
		if records[index].ActivityID == activityID && records[index].IdempotencyKey != nil && *records[index].IdempotencyKey == key {
			return &records[index]
		}
	}
	return nil
}

func countSubmitted(records []storage.ActivityAttemptRecord, activityID string) int {
	count := 0
	for _, record := range records {
		if record.ActivityID == activityID && record.AttemptNumber > 0 {
			count++
		}
	}
	return count
}

func attemptFromRecord(record storage.ActivityAttemptRecord) (ActivityAttempt, error) {
	attempt := ActivityAttempt{
		ID: record.ID, CourseID: record.CourseID, CourseVersion: record.CourseVersion,
		OwnerKind: OwnerKind(record.OwnerKind), OwnerID: record.OwnerID,
		ActivityID: record.ActivityID, AttemptNumber: record.AttemptNumber,
		Status: AttemptStatus(record.Status), Answer: append(json.RawMessage(nil), record.AnswerJSON...),
		Score: record.Score, MaxScore: record.MaxScore, Passed: record.Passed,
		RandomSeed: strconv.FormatInt(record.Seed, 10), Revision: record.Revision, StartedAt: record.StartedAt,
		SubmittedAt: record.SubmittedAt, EvaluatedAt: record.EvaluatedAt,
	}
	if len(record.FeedbackJSON) > 0 && string(record.FeedbackJSON) != "{}" {
		var feedback ActivityFeedback
		if err := json.Unmarshal(record.FeedbackJSON, &feedback); err != nil {
			return ActivityAttempt{}, fmt.Errorf("decode activity feedback: %w", err)
		}
		attempt.Feedback = &feedback
	}
	return attempt, nil
}

func mapStorageError(err error) error {
	switch {
	case errors.Is(err, storage.ErrActivityRevisionConflict):
		return ErrRevisionConflict
	default:
		return err
	}
}

func validateAnswer(kind ActivityKind, raw json.RawMessage) error {
	var answer map[string]any
	if err := json.Unmarshal(raw, &answer); err != nil {
		return fmt.Errorf("%w: invalid JSON", ErrMalformedAnswer)
	}
	if answer["kind"] != string(kind) {
		return fmt.Errorf("%w: answer kind must be %q", ErrMalformedAnswer, kind)
	}
	requireString := func(key string) bool { _, ok := answer[key].(string); return ok }
	requireStrings := func(key string) bool {
		items, ok := answer[key].([]any)
		if !ok {
			return false
		}
		for _, item := range items {
			if _, ok := item.(string); !ok {
				return false
			}
		}
		return true
	}
	requireStringMap := func(key string) bool {
		items, ok := answer[key].(map[string]any)
		if !ok {
			return false
		}
		for _, item := range items {
			if _, ok := item.(string); !ok {
				return false
			}
		}
		return true
	}
	valid := false
	switch kind {
	case ActivityKindSingleChoice:
		valid = requireString("optionId")
	case ActivityKindMultipleChoice:
		valid = requireStrings("optionIds")
	case ActivityKindTrueFalse:
		_, valid = answer["value"].(bool)
	case ActivityKindShortAnswer, ActivityKindWriting:
		valid = requireString("value")
	case ActivityKindFillBlanks:
		valid = requireStringMap("values")
	case ActivityKindOrdering:
		valid = requireStrings("itemIds")
	case ActivityKindMatching:
		valid = requireStringMap("pairs")
	case ActivityKindNumeric:
		valid = requireString("value")
		if unit, exists := answer["unit"]; exists {
			_, valid = unit.(string)
		}
	case ActivityKindCoding:
		valid = requireString("workspaceRevision")
	}
	if !valid {
		return fmt.Errorf("%w: invalid %s answer", ErrMalformedAnswer, kind)
	}
	return nil
}
