package activity

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"time"

	"github.com/synaploom/synaploom/internal/storage"
)

type Service interface {
	PublicActivity(context.Context, OwnerIdentity, string) (PublicActivityView, error)
	PublicActivitySets(context.Context, OwnerIdentity) ([]PublicActivitySetView, error)
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

func (s *ServiceImpl) PublicActivitySets(ctx context.Context, owner OwnerIdentity) ([]PublicActivitySetView, error) {
	catalog, ok := s.catalog.(ActivitySetCatalog)
	if !ok {
		return nil, ErrActivitySetNotFound
	}
	sets, err := catalog.ActivitySets(ctx, owner)
	if err != nil {
		return nil, err
	}
	views := make([]PublicActivitySetView, 0, len(sets))
	for _, set := range sets {
		view := PublicActivitySetView{ID: set.ID, Title: set.Title, Policy: set.Policy, Activities: make([]PublicActivityReference, 0, len(set.Activities))}
		for _, reference := range set.Activities {
			definition, _, err := s.catalog.Activity(ctx, owner, reference.ID)
			if err != nil {
				return nil, err
			}
			activityView, err := publicView(definition)
			if err != nil {
				return nil, err
			}
			view.Activities = append(view.Activities, PublicActivityReference{Required: reference.Required, Activity: activityView})
		}
		views = append(views, view)
	}
	return views, nil
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

	if s.evaluator == nil {
		return ActivityAttempt{}, ErrEvaluatorUnavailable
	}
	result, err := s.evaluator.Evaluate(ctx, definition, command.Answer)
	if err != nil {
		return ActivityAttempt{}, fmt.Errorf("evaluate activity: %w", err)
	}
	result = ApplyRevealPolicy(result, policy, countSubmitted(attempts, command.Identity.ActivityID)+1)
	feedback, err := json.Marshal(result.Feedback)
	if err != nil {
		return ActivityAttempt{}, fmt.Errorf("marshal activity feedback: %w", err)
	}
	evaluated, err := s.repository.UpdateEvaluation(ctx, storage.EvaluationWrite{
		AttemptID: record.ID, FeedbackJSON: feedback, Score: result.Score,
		MaxScore: result.MaxScore, Passed: result.Passed, At: command.At,
	})
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	return attemptFromRecord(evaluated)
}

// RecordCodingEvaluation persists a terminal result from the trusted coding runner.
// Generic activity submissions cannot invoke this path.
func (s *ServiceImpl) RecordCodingEvaluation(ctx context.Context, command RecordCodingEvaluationCommand) (ActivityAttempt, error) {
	definition, policy, err := s.catalog.Activity(ctx, command.Identity.Owner, command.Identity.ActivityID)
	if err != nil {
		return ActivityAttempt{}, err
	}
	if definition.Kind != ActivityKindCoding || definition.Evaluation.Mode != EvaluationModeCoding {
		return ActivityAttempt{}, fmt.Errorf("%w: activity %q is not a trusted coding activity", ErrEvaluatorConfigInvalid, definition.ID)
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
	if command.At.IsZero() {
		command.At = time.Now().UTC()
	}
	answer, err := json.Marshal(map[string]any{
		"kind":              string(ActivityKindCoding),
		"workspaceRevision": command.IdempotencyKey,
	})
	if err != nil {
		return ActivityAttempt{}, fmt.Errorf("marshal coding answer: %w", err)
	}
	record, _, err := s.repository.CreateSubmission(ctx, storage.SubmissionWrite{
		Identity: storageIdentity(command.Identity), AnswerJSON: answer,
		IdempotencyKey: command.IdempotencyKey, At: command.At,
	})
	if err != nil {
		return ActivityAttempt{}, mapStorageError(err)
	}
	maxScore := definition.Evaluation.Points
	score := 0.0
	if command.Passed {
		score = maxScore
	}
	nextAction := "retry"
	if command.Passed {
		nextAction = "continue"
	}
	feedback, err := json.Marshal(ActivityFeedback{
		Summary: command.Summary, Details: []ActivityFeedbackItem{}, NextAction: nextAction,
	})
	if err != nil {
		return ActivityAttempt{}, fmt.Errorf("marshal coding feedback: %w", err)
	}
	evaluated, err := s.repository.UpdateEvaluation(ctx, storage.EvaluationWrite{
		AttemptID: record.ID, FeedbackJSON: feedback, Score: &score,
		MaxScore: &maxScore, Passed: &command.Passed, At: command.At,
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
	attempts := make([]ActivityAttempt, 0, len(records))
	for _, record := range records {
		attempt, err := attemptFromRecord(record)
		if err != nil {
			return ActivitySetProgress{}, err
		}
		attempts = append(attempts, attempt)
	}
	definitions := make(map[string]ActivityDefinition, len(set.Activities))
	for _, reference := range set.Activities {
		definition, _, err := s.catalog.Activity(ctx, owner, reference.ID)
		if err != nil {
			return ActivitySetProgress{}, err
		}
		definitions[reference.ID] = definition
	}
	return AggregateSetProgress(set, definitions, attempts)
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
