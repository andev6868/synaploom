package activity

import (
	"context"
	"encoding/json"
)

type matchingEvaluator struct{}

func NewMatchingEvaluator() Evaluator        { return matchingEvaluator{} }
func (matchingEvaluator) Kind() ActivityKind { return ActivityKindMatching }

func (matchingEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	left, err := configuredIDs(ActivityKindMatching, definition.Config["left"])
	if err != nil {
		return EvaluationResult{}, err
	}
	right, err := configuredIDs(ActivityKindMatching, definition.Config["right"])
	if err != nil {
		return EvaluationResult{}, err
	}
	correct, ok := definition.Config["correctMatches"].(map[string]any)
	if !ok || len(correct) != len(left) {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindMatching, "correctMatches must map every left item")
	}
	correctStrings := make(map[string]string, len(correct))
	usedCorrectRight := make(map[string]struct{}, len(correct))
	for leftID, rawRightID := range correct {
		rightID, ok := rawRightID.(string)
		if !ok {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindMatching, "correctMatches values must be strings")
		}
		if _, exists := left[leftID]; !exists {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindMatching, "correctMatches contains an unknown left id")
		}
		if _, exists := right[rightID]; !exists {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindMatching, "correctMatches contains an unknown right id")
		}
		if _, duplicate := usedCorrectRight[rightID]; duplicate {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindMatching, "correctMatches must be one-to-one")
		}
		usedCorrectRight[rightID] = struct{}{}
		correctStrings[leftID] = rightID
	}

	var answer struct {
		Kind    ActivityKind `json:"kind"`
		Matches any          `json:"matches"`
	}
	if err := decodeAnswer(raw, ActivityKindMatching, &answer); err != nil {
		return EvaluationResult{}, err
	}
	matches, ok := answer.Matches.(map[string]any)
	if answer.Kind != ActivityKindMatching || !ok || len(matches) != len(left) {
		return EvaluationResult{}, malformedAnswer(ActivityKindMatching, "matches must map every configured left item")
	}
	usedRight := make(map[string]struct{}, len(matches))
	correctCount := 0
	for leftID, rawRightID := range matches {
		rightID, ok := rawRightID.(string)
		if !ok {
			return EvaluationResult{}, malformedAnswer(ActivityKindMatching, "match values must be strings")
		}
		if _, exists := left[leftID]; !exists {
			return EvaluationResult{}, malformedAnswer(ActivityKindMatching, "matches contains an unknown left id")
		}
		if _, exists := right[rightID]; !exists {
			return EvaluationResult{}, malformedAnswer(ActivityKindMatching, "matches contains an unknown right id")
		}
		if _, duplicate := usedRight[rightID]; duplicate {
			return EvaluationResult{}, malformedAnswer(ActivityKindMatching, "matches must be one-to-one")
		}
		usedRight[rightID] = struct{}{}
		if correctStrings[leftID] == rightID {
			correctCount++
		}
	}
	fullyCorrect := correctCount == len(correctStrings)
	score := definition.Evaluation.Points * float64(correctCount) / float64(len(correctStrings))
	return evaluatedResult(definition, score, fullyCorrect, nil, correctStrings), nil
}
