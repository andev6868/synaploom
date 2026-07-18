package activity

import (
	"context"
	"encoding/json"
	"math"
	"strconv"
	"strings"
)

type numericEvaluator struct{}

func NewNumericEvaluator() Evaluator        { return numericEvaluator{} }
func (numericEvaluator) Kind() ActivityKind { return ActivityKindNumeric }

func (numericEvaluator) Evaluate(_ context.Context, definition ActivityDefinition, raw json.RawMessage) (EvaluationResult, error) {
	var answer struct {
		Kind  ActivityKind `json:"kind"`
		Value any          `json:"value"`
		Unit  any          `json:"unit,omitempty"`
	}
	if err := decodeAnswer(raw, ActivityKindNumeric, &answer); err != nil {
		return EvaluationResult{}, err
	}
	value, ok := answer.Value.(string)
	if answer.Kind != ActivityKindNumeric || !ok || strings.TrimSpace(value) == "" {
		return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, "value must be a non-empty string")
	}
	learnerUnit := ""
	if answer.Unit != nil {
		learnerUnit, ok = answer.Unit.(string)
		if !ok {
			return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, "unit must be a string")
		}
	}
	mode, _ := definition.Config["answerMode"].(string)
	expected, ok := definition.Config["expected"].(string)
	if !ok || expected == "" {
		return EvaluationResult{}, evaluatorConfigError(ActivityKindNumeric, "expected must be a non-empty string")
	}
	matched := false
	switch mode {
	case "number", "":
		learnerNumber, err := parseNumericValue(value)
		if err != nil {
			return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, "value is not a valid number")
		}
		expectedNumber, err := parseNumericValue(expected)
		if err != nil {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindNumeric, "expected is not a valid number")
		}
		expectedUnit, _ := definition.Config["unit"].(string)
		requireUnit, _ := definition.Config["requireUnit"].(bool)
		if learnerUnit == "" && requireUnit {
			matched = false
		} else {
			if expectedUnit != "" && learnerUnit != "" {
				learnerNumber, err = convertUnit(learnerNumber, learnerUnit, expectedUnit)
				if err != nil {
					return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, err.Error())
				}
			} else if expectedUnit == "" && learnerUnit != "" {
				return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, "unit is not expected")
			}
			absoluteTolerance, err := optionalNonNegativeNumber(definition.Config, "absoluteTolerance")
			if err != nil {
				return EvaluationResult{}, err
			}
			relativeTolerance, err := optionalNonNegativeNumber(definition.Config, "relativeTolerance")
			if err != nil {
				return EvaluationResult{}, err
			}
			difference := math.Abs(learnerNumber - expectedNumber)
			allowed := math.Max(absoluteTolerance, relativeTolerance*math.Abs(expectedNumber))
			matched = difference <= allowed
		}
	case "expression":
		learnerExpression, err := parseExpression(value)
		if err != nil {
			return EvaluationResult{}, malformedAnswer(ActivityKindNumeric, "value is not a valid safe expression")
		}
		expectedExpression, err := parseExpression(expected)
		if err != nil {
			return EvaluationResult{}, evaluatorConfigError(ActivityKindNumeric, "expected is not a valid safe expression")
		}
		matched = expressionsEquivalent(learnerExpression, expectedExpression)
	default:
		return EvaluationResult{}, evaluatorConfigError(ActivityKindNumeric, "answerMode must be number or expression")
	}
	score := 0.0
	if matched {
		score = definition.Evaluation.Points
	}
	correct := map[string]any{"value": expected}
	if unit, ok := definition.Config["unit"].(string); ok && unit != "" {
		correct["unit"] = unit
	}
	return evaluatedResult(definition, score, matched, nil, correct), nil
}

func parseNumericValue(value string) (float64, error) {
	value = strings.TrimSpace(strings.ReplaceAll(value, "_", ""))
	if strings.Count(value, ",") == 1 && !strings.Contains(value, ".") {
		value = strings.ReplaceAll(value, ",", ".")
	}
	return strconv.ParseFloat(value, 64)
}

func optionalNonNegativeNumber(config map[string]any, key string) (float64, error) {
	value, exists := config[key]
	if !exists || value == nil {
		return 0, nil
	}
	var number float64
	switch typed := value.(type) {
	case float64:
		number = typed
	case int:
		number = float64(typed)
	case int64:
		number = float64(typed)
	default:
		return 0, evaluatorConfigError(ActivityKindNumeric, key+" must be a number")
	}
	if number < 0 {
		return 0, evaluatorConfigError(ActivityKindNumeric, key+" must not be negative")
	}
	return number, nil
}
