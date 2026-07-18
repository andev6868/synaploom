package activity

import (
	"context"
	"encoding/json"
	"math"
)

type choiceEvaluator struct {
	kind ActivityKind
}

func NewChoiceEvaluator(kind ActivityKind) Evaluator {
	return &choiceEvaluator{kind: kind}
}

func (e *choiceEvaluator) Kind() ActivityKind { return e.kind }

func (e *choiceEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	if definition.Kind != e.kind {
		return EvaluationResult{}, evaluatorConfigError(e.kind, "definition kind does not match evaluator")
	}
	switch e.kind {
	case ActivityKindSingleChoice:
		optionIDs, err := configuredOptionIDs(ActivityKindSingleChoice, definition.Config)
		if err != nil {
			return EvaluationResult{}, err
		}
		return evaluateSingleChoice(definition, raw, optionIDs)
	case ActivityKindMultipleChoice:
		optionIDs, err := configuredOptionIDs(ActivityKindMultipleChoice, definition.Config)
		if err != nil {
			return EvaluationResult{}, err
		}
		return evaluateMultipleChoice(definition, raw, optionIDs)
	case ActivityKindTrueFalse:
		return evaluateTrueFalse(definition, raw)
	default:
		return EvaluationResult{}, ErrEvaluatorUnavailable
	}
}

func evaluateSingleChoice(definition ActivityDefinition, raw json.RawMessage, optionIDs map[string]struct{}) (EvaluationResult, error) {
	var answer struct {
		Kind     ActivityKind `json:"kind"`
		OptionID any          `json:"optionId"`
	}
	if err := decodeAnswer(raw, ActivityKindSingleChoice, &answer); err != nil {
		return EvaluationResult{}, err
	}
	optionID, ok := answer.OptionID.(string)
	if answer.Kind != ActivityKindSingleChoice || !ok || optionID == "" {
		return EvaluationResult{}, malformedAnswer(ActivityKindSingleChoice, "optionId must be a non-empty string")
	}
	if _, exists := optionIDs[optionID]; !exists {
		return EvaluationResult{}, malformedAnswer(ActivityKindSingleChoice, "optionId is not a configured option")
	}
	correct, ok := definition.Config["correctOptionId"].(string)
	if !ok || correct == "" {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindSingleChoice, "correctOptionId must be a non-empty string")
	}
	if _, exists := optionIDs[correct]; !exists {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindSingleChoice, "correctOptionId is not a configured option")
	}
	matched := optionID == correct
	score := 0.0
	if matched {
		score = definition.Evaluation.Points
	}
	return evaluatedResult(definition, score, matched, nil, correct), nil
}

func evaluateMultipleChoice(definition ActivityDefinition, raw json.RawMessage, optionIDs map[string]struct{}) (EvaluationResult, error) {
	var answer struct {
		Kind      ActivityKind `json:"kind"`
		OptionIDs any          `json:"optionIds"`
	}
	if err := decodeAnswer(raw, ActivityKindMultipleChoice, &answer); err != nil {
		return EvaluationResult{}, err
	}
	selected, ok := stringSlice(answer.OptionIDs)
	if answer.Kind != ActivityKindMultipleChoice || !ok || !uniqueStrings(selected) {
		return EvaluationResult{}, malformedAnswer(ActivityKindMultipleChoice, "optionIds must be a unique string array")
	}
	for _, id := range selected {
		if _, exists := optionIDs[id]; !exists {
			return EvaluationResult{}, malformedAnswer(ActivityKindMultipleChoice, "optionIds contains an unconfigured option")
		}
	}
	correct, ok := stringSlice(definition.Config["correctOptionIds"])
	if !ok || len(correct) == 0 || !uniqueStrings(correct) {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindMultipleChoice, "correctOptionIds must be a non-empty unique string array")
	}
	correctSet := make(map[string]struct{}, len(correct))
	for _, id := range correct {
		if _, exists := optionIDs[id]; !exists {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindMultipleChoice, "correctOptionIds contains an unconfigured option")
		}
		correctSet[id] = struct{}{}
	}

	mode, _ := definition.Config["evaluationMode"].(string)
	if mode == "" {
		mode = "exact-set"
	}
	fullyCorrect := sameStringSet(selected, correctSet)
	score := 0.0
	switch mode {
	case "exact-set":
		if fullyCorrect {
			score = definition.Evaluation.Points
		}
	case "partial-credit":
		correctSelections := 0
		incorrectSelections := 0
		for _, id := range selected {
			if _, exists := correctSet[id]; exists {
				correctSelections++
			} else {
				incorrectSelections++
			}
		}
		ratio := float64(correctSelections-incorrectSelections) / float64(len(correctSet))
		ratio = math.Max(0, math.Min(1, ratio))
		score = definition.Evaluation.Points * ratio
	default:
		return EvaluationResult{}, evaluatorConfigError(ActivityKindMultipleChoice, "evaluationMode must be exact-set or partial-credit")
	}
	return evaluatedResult(definition, score, fullyCorrect, nil, correct), nil
}

func evaluateTrueFalse(definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	var answer struct {
		Kind  ActivityKind `json:"kind"`
		Value any          `json:"value"`
	}
	if err := decodeAnswer(raw, ActivityKindTrueFalse, &answer); err != nil {
		return EvaluationResult{}, err
	}
	value, ok := answer.Value.(bool)
	if answer.Kind != ActivityKindTrueFalse || !ok {
		return EvaluationResult{}, malformedAnswer(ActivityKindTrueFalse, "value must be boolean")
	}
	expected, ok := definition.Config["expected"].(bool)
	if !ok {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindTrueFalse, "expected must be boolean")
	}
	matched := value == expected
	score := 0.0
	if matched {
		score = definition.Evaluation.Points
	}
	return evaluatedResult(definition, score, matched, nil, expected), nil
}

func configuredOptionIDs(kind ActivityKind, config map[string]any) (map[string]struct{}, error) {
	options, ok := config["options"].([]any)
	if !ok || len(options) == 0 {
		return nil, evaluatorConfigError(kind, "options must be a non-empty array")
	}
	ids := make(map[string]struct{}, len(options))
	for _, raw := range options {
		option, ok := raw.(map[string]any)
		if !ok {
			return nil, evaluatorConfigError(kind, "each option must be an object")
		}
		id, ok := option["id"].(string)
		if !ok || id == "" {
			return nil, evaluatorConfigError(kind, "each option must have a non-empty id")
		}
		if _, exists := ids[id]; exists {
			return nil, evaluatorConfigError(kind, "option ids must be unique")
		}
		ids[id] = struct{}{}
	}
	return ids, nil
}

func sameStringSet(values []string, expected map[string]struct{}) bool {
	if len(values) != len(expected) {
		return false
	}
	for _, value := range values {
		if _, exists := expected[value]; !exists {
			return false
		}
	}
	return true
}
