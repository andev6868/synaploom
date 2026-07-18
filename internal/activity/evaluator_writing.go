package activity

import (
	"context"
	"encoding/json"
	"strings"
	"unicode/utf8"
)

type writingEvaluator struct{}

func NewWritingEvaluator() Evaluator        { return writingEvaluator{} }
func (writingEvaluator) Kind() ActivityKind { return ActivityKindWriting }

func (writingEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	var answer struct {
		Kind  ActivityKind `json:"kind"`
		Value any          `json:"value"`
	}
	if err := decodeAnswer(raw, ActivityKindWriting, &answer); err != nil {
		return EvaluationResult{}, err
	}
	value, ok := answer.Value.(string)
	if answer.Kind != ActivityKindWriting || !ok {
		return EvaluationResult{}, malformedAnswer(ActivityKindWriting, "value must be a string")
	}
	minimum, err := requiredNonNegativeInteger(definition.Config, "minimumCharacters")
	if err != nil {
		return EvaluationResult{}, err
	}
	maximum, err := requiredNonNegativeInteger(definition.Config, "maximumCharacters")
	if err != nil {
		return EvaluationResult{}, err
	}
	if maximum < minimum || maximum == 0 {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindWriting, "maximumCharacters must be at least minimumCharacters and greater than zero")
	}
	format, _ := definition.Config["answerFormat"].(string)
	if format != "plain-text" && format != "markdown" {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindWriting, "answerFormat must be plain-text or markdown")
	}
	length := utf8.RuneCountInString(strings.TrimSpace(value))
	if length < minimum || length > maximum {
		return EvaluationResult{}, malformedAnswer(ActivityKindWriting, "response length is outside the configured range")
	}
	return EvaluationResult{
		Completed: true,
		Feedback:  ActivityFeedback{Summary: "Bài viết đã được ghi nhận.", Details: []ActivityFeedbackItem{}, NextAction: "continue"},
	}, nil
}

func requiredNonNegativeInteger(config map[string]any, key string) (int, error) {
	value, ok := config[key]
	if !ok {
		return 0, evaluatorConfigError(ActivityKindWriting, key+" is required")
	}
	switch typed := value.(type) {
	case int:
		if typed < 0 {
			return 0, evaluatorConfigError(ActivityKindWriting, key+" must not be negative")
		}
		return typed, nil
	case float64:
		if typed < 0 || typed != float64(int(typed)) {
			return 0, evaluatorConfigError(ActivityKindWriting, key+" must be a non-negative integer")
		}
		return int(typed), nil
	default:
		return 0, evaluatorConfigError(ActivityKindWriting, key+" must be a non-negative integer")
	}
}
