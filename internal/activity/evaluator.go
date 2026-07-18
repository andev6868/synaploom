package activity

import (
	"context"
	"encoding/json"
	"fmt"
)

// Evaluator deterministically evaluates one activity kind.
type Evaluator interface {
	Kind() ActivityKind
	Evaluate(context.Context, ActivityDefinition, json.RawMessage) (EvaluationResult, error)
}

// Registry dispatches activity definitions to their kind-specific evaluator.
type Registry struct {
	evaluators map[ActivityKind]Evaluator
}

func NewRegistry(evaluators ...Evaluator) Registry {
	registry := Registry{evaluators: make(map[ActivityKind]Evaluator, len(evaluators))}
	for _, evaluator := range evaluators {
		if evaluator == nil {
			continue
		}
		registry.evaluators[evaluator.Kind()] = evaluator
	}
	return registry
}

func (r Registry) Evaluate(ctx context.Context, definition ActivityDefinition, answer json.RawMessage) (EvaluationResult, error) {
	evaluator, ok := r.evaluators[definition.Kind]
	if !ok {
		return EvaluationResult{}, ErrEvaluatorUnavailable
	}
	result, err := evaluator.Evaluate(ctx, definition, answer)
	if err != nil {
		return EvaluationResult{}, err
	}
	// Correct answers are private evaluator output. The service applies the
	// owning activity-set reveal policy before feedback is persisted or sent.
	result.Feedback.CorrectAnswer = nil
	return result, nil
}

func ApplyRevealPolicy(result EvaluationResult, policy ActivitySetPolicy, attemptNumber int) EvaluationResult {
	reveal := false
	switch policy.RevealAnswers {
	case "after-submit":
		reveal = true
	case "after-final-attempt":
		reveal = policy.MaxAttempts != nil && attemptNumber >= *policy.MaxAttempts
	case "never", "":
		reveal = false
	}
	if reveal {
		result.Feedback.CorrectAnswer = cloneValue(result.CorrectAnswer)
	} else {
		result.Feedback.CorrectAnswer = nil
	}
	return result
}

func evaluatedResult(definition ActivityDefinition, score float64, fullyCorrect bool, details []ActivityFeedbackItem, correctAnswer any) EvaluationResult {
	maxScore := definition.Evaluation.Points
	passed := fullyCorrect
	if definition.Completion.PassingScore != nil {
		passed = score >= *definition.Completion.PassingScore
	}
	summary := "Câu trả lời chưa chính xác."
	nextAction := "retry"
	if passed {
		summary = "Câu trả lời chính xác."
		nextAction = "continue"
	}
	return EvaluationResult{
		Score: score, MaxScore: maxScore, Passed: passed, CorrectAnswer: cloneValue(correctAnswer),
		Feedback: ActivityFeedback{Summary: summary, Details: details, NextAction: nextAction},
	}
}

func malformedAnswer(kind ActivityKind, reason string) error {
	return fmt.Errorf("%w: invalid %s answer: %s", ErrMalformedAnswer, kind, reason)
}

func evaluatorConfigError(kind ActivityKind, reason string) error {
	return fmt.Errorf("%w: invalid %s config: %s", ErrEvaluatorConfigInvalid, kind, reason)
}

func decodeAnswer(raw json.RawMessage, kind ActivityKind, target any) error {
	if err := json.Unmarshal(raw, target); err != nil {
		return malformedAnswer(kind, "invalid JSON")
	}
	return nil
}

func stringSlice(value any) ([]string, bool) {
	items, ok := value.([]any)
	if !ok {
		if typed, direct := value.([]string); direct {
			return append([]string(nil), typed...), true
		}
		return nil, false
	}
	result := make([]string, 0, len(items))
	for _, item := range items {
		text, ok := item.(string)
		if !ok {
			return nil, false
		}
		result = append(result, text)
	}
	return result, true
}

func uniqueStrings(values []string) bool {
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if _, exists := seen[value]; exists {
			return false
		}
		seen[value] = struct{}{}
	}
	return true
}
