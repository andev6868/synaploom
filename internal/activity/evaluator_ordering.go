package activity

import (
	"context"
	"encoding/json"
)

type orderingEvaluator struct{}

func NewOrderingEvaluator() Evaluator        { return orderingEvaluator{} }
func (orderingEvaluator) Kind() ActivityKind { return ActivityKindOrdering }

func (orderingEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	items, err := configuredIDs(ActivityKindOrdering, definition.Config["items"])
	if err != nil {
		return EvaluationResult{}, err
	}
	correct, ok := stringSlice(definition.Config["correctOrder"])
	if !ok || len(correct) != len(items) || !uniqueStrings(correct) || !containsExactly(items, correct) {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindOrdering, "correctOrder must be a permutation of item ids")
	}
	var answer struct {
		Kind    ActivityKind `json:"kind"`
		ItemIDs any          `json:"itemIds"`
	}
	if err := decodeAnswer(raw, ActivityKindOrdering, &answer); err != nil {
		return EvaluationResult{}, err
	}
	ordered, ok := stringSlice(answer.ItemIDs)
	if answer.Kind != ActivityKindOrdering || !ok || len(ordered) != len(items) || !uniqueStrings(ordered) || !containsExactly(items, ordered) {
		return EvaluationResult{}, malformedAnswer(ActivityKindOrdering, "itemIds must be a complete permutation of configured items")
	}
	fullyCorrect := slicesEqual(ordered, correct)
	mode, _ := definition.Config["evaluationMode"].(string)
	if mode == "" {
		mode = "exact"
	}
	score := 0.0
	switch mode {
	case "exact":
		if fullyCorrect {
			score = definition.Evaluation.Points
		}
	case "adjacent":
		if len(correct) <= 1 {
			if fullyCorrect {
				score = definition.Evaluation.Points
			}
			break
		}
		correctAdjacent := make(map[[2]string]struct{}, len(correct)-1)
		for index := 0; index < len(correct)-1; index++ {
			correctAdjacent[[2]string{correct[index], correct[index+1]}] = struct{}{}
		}
		matches := 0
		for index := 0; index < len(ordered)-1; index++ {
			if _, ok := correctAdjacent[[2]string{ordered[index], ordered[index+1]}]; ok {
				matches++
			}
		}
		score = definition.Evaluation.Points * float64(matches) / float64(len(correct)-1)
	default:
		return EvaluationResult{}, evaluatorConfigError(ActivityKindOrdering, "evaluationMode must be exact or adjacent")
	}
	return evaluatedResult(definition, score, fullyCorrect, nil, correct), nil
}

func configuredIDs(kind ActivityKind, raw any) (map[string]struct{}, error) {
	items, ok := raw.([]any)
	if !ok || len(items) == 0 {
		return nil, evaluatorConfigError(kind, "items must be a non-empty array")
	}
	ids := make(map[string]struct{}, len(items))
	for _, rawItem := range items {
		item, ok := rawItem.(map[string]any)
		if !ok {
			return nil, evaluatorConfigError(kind, "each item must be an object")
		}
		id, ok := item["id"].(string)
		if !ok || id == "" {
			return nil, evaluatorConfigError(kind, "each item must have a non-empty id")
		}
		if _, duplicate := ids[id]; duplicate {
			return nil, evaluatorConfigError(kind, "item ids must be unique")
		}
		ids[id] = struct{}{}
	}
	return ids, nil
}

func containsExactly(ids map[string]struct{}, values []string) bool {
	if len(ids) != len(values) {
		return false
	}
	for _, value := range values {
		if _, ok := ids[value]; !ok {
			return false
		}
	}
	return true
}

func slicesEqual(left, right []string) bool {
	if len(left) != len(right) {
		return false
	}
	for index := range left {
		if left[index] != right[index] {
			return false
		}
	}
	return true
}
